import json
import uuid
import traceback
import shutil
import os
import mimetypes
from typing import List
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import google.generativeai as genai

from app.schemas import ProcessMeetingRequest, MeetingReportResponse
from app.agents.graph import workflow_graph
from app.database import get_db, MeetingRecord
from app.rag import index_meeting, query_meeting_history

app = FastAPI(
    title="Brightcone AI Meeting Intelligence Service",
    description="Agentic Meeting Intelligence, SQLite Persistence, ChromaDB RAG, and Multimodal Audio STT."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Schemas
class QueryHistoryRequest(BaseModel):
    query: str

class QueryHistoryResponse(BaseModel):
    answer: str
    sources: List[str]

class TranscribeResponse(BaseModel):
    transcript: str

@app.get("/")
def read_root():
    return {"status": "online", "service": "Meeting Intelligence Agent Engine"}

@app.post("/api/meetings/process", response_model=MeetingReportResponse)
async def process_meeting(payload: ProcessMeetingRequest, db: Session = Depends(get_db)):
    if not payload.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript content cannot be empty.")

    meeting_id = str(uuid.uuid4())

    initial_state = {
        "transcript": payload.transcript,
        "summary": "",
        "key_topics": [],
        "decisions": [],
        "action_items": [],
        "blockers": [],
        "open_questions": [],
        "follow_up_notes": [],
        "reviewer_audit_log": ""
    }

    try:
        final_state = await workflow_graph.ainvoke(initial_state)

        record = MeetingRecord(
            id=meeting_id,
            status="Completed",
            summary=final_state.get("summary", ""),
            key_topics=json.dumps(final_state.get("key_topics", [])),
            decisions=json.dumps(final_state.get("decisions", [])),
            action_items=json.dumps(final_state.get("action_items", [])),
            blockers=json.dumps(final_state.get("blockers", [])),
            open_questions=json.dumps(final_state.get("open_questions", [])),
            follow_up_notes=json.dumps(final_state.get("follow_up_notes", [])),
            reviewer_audit_log=final_state.get("reviewer_audit_log", "Groundedness check completed.")
        )
        db.add(record)
        db.commit()

        # Index transcript & summary into ChromaDB for Meeting-History RAG
        try:
            index_meeting(
                meeting_id=meeting_id,
                transcript=payload.transcript,
                summary=record.summary,
                metadata={"status": "Completed", "meeting_id": meeting_id}
            )
        except Exception as vector_err:
            print(f"[Warning] ChromaDB indexing skipped/failed: {vector_err}")

        return {
            "id": meeting_id,
            "processing_status": "Completed",
            "summary": record.summary,
            "key_topics": json.loads(record.key_topics),
            "decisions": json.loads(record.decisions),
            "action_items": json.loads(record.action_items),
            "blockers": json.loads(record.blockers),
            "open_questions": json.loads(record.open_questions),
            "follow_up_notes": json.loads(record.follow_up_notes),
            "reviewer_audit_log": record.reviewer_audit_log
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Agent workflow error: {str(e)}")

@app.post("/api/meetings/query", response_model=QueryHistoryResponse)
def query_history(payload: QueryHistoryRequest):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    try:
        return query_meeting_history(payload.query)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"History RAG search failed: {str(e)}")

@app.get("/api/meetings", response_model=List[MeetingReportResponse])
def list_meetings(db: Session = Depends(get_db)):
    records = db.query(MeetingRecord).order_by(MeetingRecord.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "processing_status": r.status,
            "summary": r.summary,
            "key_topics": json.loads(r.key_topics),
            "decisions": json.loads(r.decisions),
            "action_items": json.loads(r.action_items),
            "blockers": json.loads(r.blockers),
            "open_questions": json.loads(r.open_questions),
            "follow_up_notes": json.loads(r.follow_up_notes),
            "reviewer_audit_log": r.reviewer_audit_log
        }
        for r in records
    ]

@app.get("/api/meetings/{meeting_id}", response_model=MeetingReportResponse)
def get_meeting(meeting_id: str, db: Session = Depends(get_db)):
    record = db.query(MeetingRecord).filter(MeetingRecord.id == meeting_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Meeting report not found")

    return {
        "id": record.id,
        "processing_status": record.status,
        "summary": record.summary,
        "key_topics": json.loads(record.key_topics),
        "decisions": json.loads(record.decisions),
        "action_items": json.loads(record.action_items),
        "blockers": json.loads(record.blockers),
        "open_questions": json.loads(record.open_questions),
        "follow_up_notes": json.loads(record.follow_up_notes),
        "reviewer_audit_log": record.reviewer_audit_log
    }

@app.post("/api/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribes an uploaded meeting audio file using Gemini's native multimodal audio capabilities."""
    allowed_extensions = (".mp3", ".wav", ".m4a", ".ogg", ".webm")
    if not file.filename.lower().endswith(allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Supported formats: {', '.join(allowed_extensions)}"
        )

    temp_path = f"temp_{uuid.uuid4()}_{file.filename}"
    try:
        # 1. Save uploaded audio file temporarily
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2. Configure Gemini GenAI client
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        mime_type, _ = mimetypes.guess_type(temp_path)
        audio_file = genai.upload_file(path=temp_path, mime_type=mime_type or "audio/mp3")

        # 3. Transcribe with gemini-1.5-flash
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = (
            "Transcribe this meeting audio verbatim into text. "
            "Label speakers if distinguishable (e.g. Speaker 1, Speaker 2). "
            "Do not summarize or add markdown formatting beyond plain paragraphs."
        )
        response = model.generate_content([audio_file, prompt])

        # 4. Clean up audio file from Google cloud storage
        try:
            audio_file.delete()
        except Exception:
            pass

        return {"transcript": response.text.strip()}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Audio transcription failed: {str(e)}")
    finally:
        # 5. Clean up local temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)