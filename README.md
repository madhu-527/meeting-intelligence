# Brightcone AI • Agentic Meeting Intelligence & Action Tracking System

A full-stack meeting intelligence platform designed to ingest raw multi-speaker transcripts (or audio recordings), extract verifiable consensus decisions, track granular action items with dependency trees, and audit deliverables against hallucinations using deterministic multi-agent graphs.

---

## 🧠 System Architecture & Multi-Agent Workflow

Brightcone replaces generic single-prompt summarization with a stateful, cyclical **LangGraph** multi-agent orchestration pipeline backed by Google Gemini models (`gemini-1.5-flash` / `gemini-1.5-flash-8b`).

```text
Raw Transcript / Audio Upload
              │
              ▼
   ┌──────────────────────┐
   │ Speech-to-Text (STT) │  (Gemini Multimodal Processing)
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │    Summary Agent     │  Executive Summary & Key Topic Extraction
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │    Decision Agent    │  Identifies Confirmed Consensus & Architectural Choices
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │ Action & Dep Agent   │  Extracts Tasks, Assignees, Deadlines & Pre-requisites
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │ Reviewer Guardrail   │  Strict Groundedness Audit (Anti-Hallucination Gate)
   └──────────┬───────────┘
              │
      ┌───────┴───────┐
      ▼               ▼
┌───────────┐   ┌───────────┐
│  SQLite   │   │  ChromaDB │  (Cross-meeting RAG Vector Store)
└───────────┘   └───────────┘
```

### Agent Roles & Guardrails
* **Executive Summarization Agent:** Condenses conversational context into structured summaries and categorized topics.
* **Decision Agent:** Extracts definitive, agreed-upon decisions while ignoring speculative discussions or discarded suggestions.
* **Action & Dependency Agent:** Maps out assignments, expected completion milestones, priority classifications, and directed predecessor dependencies (e.g., Task B blocked by Task A).
* **Reviewer & Groundedness Agent:** Validates every extracted entity directly against source transcript spans. If an owner or due date is omitted or ambiguous, it strictly assigns `"Not Specified / Requires Confirmation"` rather than hallucinating details.
* **Rate-Limit & Demand Spike Handling:** Backend agents implement request throttling and exponential backoff retry algorithms to seamlessly absorb HTTP `429 (Resource Exhausted)` and `503 (Model Overloaded)` conditions.

---

## ✨ Core Features

* **Groundedness Audit Trail:** Complete transparency with an anti-hallucination log verifying every extracted action item.
* **Cross-Meeting Semantic RAG:** Vector-embedded transcripts stored in ChromaDB allow natural-language question answering across past meetings.
* **Multimodal Audio STT:** Transcribes meeting voice notes directly into structured analysis pipelines.
* **One-Click Calendar Sync:** Exports extracted action items as RFC-compliant `.ics` calendar events with assigned dates and descriptions.
* **Email Follow-up Generator:** Drafts pre-formatted meeting digests ready to launch in default email clients.

---

## 📂 Repository Structure

```text
meeting-intelligence/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── __init__.py
│   │   │   └── graph.py          # LangGraph multi-agent pipeline & retry logic
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── models.py         # SQLAlchemy schemas for meetings & action items
│   │   │   └── session.py        # Database engine setup
│   │   ├── services/
│   │   │   ├── audio.py          # Multimodal audio ingestion
│   │   │   └── rag.py            # ChromaDB vector embedding & RAG search
│   │   └── main.py               # FastAPI routes, CORS configuration, API controllers
│   └── requirements.txt          # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Main dashboard UI & reactive API integration
│   │   ├── types.ts              # TypeScript interfaces for API schemas
│   │   ├── index.css             # Tailwind styling rules
│   │   └── main.tsx              # React DOM entrypoint
│   ├── package.json              # Frontend dependencies and scripts
│   ├── vite.config.ts            # Vite build configuration
│   └── tailwind.config.js        # UI utility styles
└── README.md
```

---

## ⚙️ Local Development Setup

### 1. Prerequisites
* Python 3.10+
* Node.js 18+ and npm
* Google AI Studio Gemini API Key

### 2. Backend Configuration
```bash
# Navigate to the backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
echo "GEMINI_API_KEY=your_google_ai_studio_api_key" > .env

# Run FastAPI development server
uvicorn app.main:app --reload --port 8000
```
Backend will be live at `http://localhost:8000` (Swagger UI at `http://localhost:8000/docs`).

### 3. Frontend Configuration
```bash
# Navigate to the frontend directory
cd ../frontend

# Install dependencies
npm install

# Configure environment variables
echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local

# Run frontend dev server
npm run dev
```
Frontend will be live at `http://localhost:5173`.

---



