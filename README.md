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

# meeting-intelligence

## Repository Structure

```text
meeting-intelligence/
├── backend/
│   ├── requirements.txt
│   ├── test_gemini.py
│   └── app/
│       ├── __init__.py
│       ├── database.py
│       ├── main.py
│       ├── rag.py
│       ├── schemas.py
│       └── agents/
│           ├── __init__.py
│           └── graph.py
├── chroma_db/
│   ├── chroma.sqlite3
│   └── 108e11cb-32cb-4bbc-8e63-f30a3f19e3e2/
└── frontend/
    ├── index.html
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── App.js
        ├── App.tsx
        ├── index.css
        ├── main.js
        ├── main.tsx
        ├── types.js
        ├── types.ts
        └── vite-env.d.ts
```

This repository is organized into a FastAPI backend, a frontend app, and a local vector database for meeting intelligence workflows.
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



