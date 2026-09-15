import os
import chromadb
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

# Initialize persistent local ChromaDB
chroma_client = chromadb.PersistentClient(path="./chroma_db")
meeting_collection = chroma_client.get_or_create_collection(name="meeting_transcripts")

llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    temperature=0.0,
    google_api_key=api_key
)

def extract_text(content) -> str:
    """Extracts raw text string whether returned as a string or block list."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict) and "text" in block:
                return block["text"]
            if hasattr(block, "text"):
                return block.text
    return str(content)

def index_meeting(meeting_id: str, transcript: str, summary: str, metadata: dict = None):
    """Indexes the transcript and executive summary into ChromaDB."""
    full_text = f"Summary:\n{summary}\n\nTranscript:\n{transcript}"
    meeting_collection.upsert(
        ids=[meeting_id],
        documents=[full_text],
        metadatas=[metadata or {"meeting_id": meeting_id}]
    )

def query_meeting_history(query: str, n_results: int = 2) -> dict:
    """Retrieves relevant transcript context and answers the question."""
    results = meeting_collection.query(
        query_texts=[query],
        n_results=n_results
    )

    docs = results.get("documents", [[]])[0]
    if not docs:
        return {
            "answer": "No previous meeting records found in the ChromaDB knowledge base.",
            "sources": []
        }

    context = "\n---\n".join(docs)

    prompt = f"""You are an AI assistant answering questions about past team meetings.
Answer the question strictly using the provided meeting context.
If the information is not present, answer: 'Not Specified / Requires Confirmation in Past Records'.

Meeting History Context:
{context}

Question:
{query}
"""
    response = llm.invoke([HumanMessage(content=prompt)])
    answer = extract_text(response.content).strip()

    return {
        "answer": answer,
        "sources": results.get("ids", [[]])[0]
    }