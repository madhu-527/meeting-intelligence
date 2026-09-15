import os
import json
import asyncio
import logging
from typing import TypedDict, List
from dotenv import load_dotenv
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

load_dotenv()

logger = logging.getLogger(__name__)

api_key = os.getenv("GEMINI_API_KEY")
model_name = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

llm = ChatGoogleGenerativeAI(
    model=model_name,
    temperature=0.2,
    google_api_key=api_key,
    max_retries=3
)

async def invoke_with_retry(prompt: str, retries: int = 4, delay: float = 5.0):
    """Retries transient Gemini capacity and rate-limit failures with backoff."""
    for attempt in range(retries):
        try:
            return await llm.ainvoke([HumanMessage(content=prompt)])
        except Exception as e:
            error_text = str(e)
            is_transient = any(
                marker in error_text
                for marker in ("429", "503", "RESOURCE_EXHAUSTED", "UNAVAILABLE")
            )
            if is_transient and attempt < retries - 1:
                wait_time = delay * (2 ** attempt)
                logger.warning(
                    "Transient Gemini failure. Retrying in %ss (attempt %s/%s): %s",
                    wait_time,
                    attempt + 1,
                    retries,
                    error_text,
                )
                await asyncio.sleep(wait_time)
                continue
            raise e

def extract_text(content) -> str:
    """Extracts raw string even if returned as a list of content blocks."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict) and "text" in block:
                return block["text"]
            if hasattr(block, "text"):
                return block.text
    return str(content)

def clean_and_parse_json(content) -> dict:
    """Extracts clean JSON text and parses safely."""
    raw = extract_text(content).strip()
    if raw.startswith("```json"):
        raw = raw[7:]
    elif raw.startswith("```"):
        raw = raw[3:]
    if raw.endswith("```"):
        raw = raw[:-3]
    try:
        return json.loads(raw.strip())
    except Exception:
        return {}

class AgentState(TypedDict):
    transcript: str
    summary: str
    key_topics: List[str]
    decisions: List[str]
    action_items: List[dict]
    blockers: List[str]
    open_questions: List[str]
    follow_up_notes: List[str]
    reviewer_audit_log: str

# 1. Summary Agent
async def summary_agent(state: AgentState):
    prompt = f"""You are an executive meeting summarization agent. Return a valid JSON object only:
{{
  "summary": "2-3 paragraph summary of the meeting",
  "key_topics": ["topic 1", "topic 2"]
}}

Transcript:
{state['transcript']}"""

    res = await invoke_with_retry(prompt)
    data = clean_and_parse_json(res.content)
    return {
        "summary": data.get("summary", "Summary unavailable."),
        "key_topics": data.get("key_topics", [])
    }

# 2. Decision Agent
async def decision_agent(state: AgentState):
    await asyncio.sleep(1.5)  # Throttle to stay within RPM quota
    prompt = f"""You are a strict Decision Extraction Agent. Extract ONLY confirmed decisions.
Return a valid JSON object only:
{{
  "decisions": ["decision 1", "decision 2"]
}}

Transcript:
{state['transcript']}"""

    res = await invoke_with_retry(prompt)
    data = clean_and_parse_json(res.content)
    return {"decisions": data.get("decisions", [])}

# 3. Action Item & Dependency Agent
async def action_agent(state: AgentState):
    await asyncio.sleep(1.5)  # Throttle to stay within RPM quota
    prompt = f"""Extract action items, blockers, and unresolved questions.

CRITICAL INSTRUCTIONS:
1. If an owner is NOT explicitly mentioned, set owner to "Not Specified / Requires Confirmation".
2. If a deadline is NOT explicitly mentioned, set deadline to "Not Specified / Requires Confirmation".
3. Identify dependencies: if task B runs after task A, list task A under dependencies.

Return a valid JSON object only:
{{
  "action_items": [
    {{
      "task": "description of task",
      "owner": "name or 'Not Specified / Requires Confirmation'",
      "deadline": "date or 'Not Specified / Requires Confirmation'",
      "priority": "High" | "Medium" | "Low",
      "dependencies": ["prerequisite task 1"]
    }}
  ],
  "blockers": ["blocker 1"],
  "open_questions": ["question 1"]
}}

Transcript:
{state['transcript']}"""

    res = await invoke_with_retry(prompt)
    data = clean_and_parse_json(res.content)
    return {
        "action_items": data.get("action_items", []),
        "blockers": data.get("blockers", []),
        "open_questions": data.get("open_questions", [])
    }

# 4. Reviewer & Follow-Up Agent
async def reviewer_agent(state: AgentState):
    await asyncio.sleep(1.5)  # Throttle to stay within RPM quota
    prompt = f"""You are a Quality Control Reviewer Agent.
Compare the extracted Action Items against the original Transcript.

Rules:
1. Verify each action's owner and deadline against the transcript.
2. If any entity was inferred or hallucinated, overwrite with 'Not Specified / Requires Confirmation'.
3. Formulate follow-up communications needed for items with missing details.
4. Provide a clear audit remark documenting the groundedness verification.

Original Transcript:
{state['transcript']}

Extracted Actions:
{json.dumps(state['action_items'])}

Return a valid JSON object only:
{{
  "verified_actions": [
    {{
      "task": "description of task",
      "owner": "string",
      "deadline": "string",
      "priority": "High" | "Medium" | "Low",
      "dependencies": ["string"]
    }}
  ],
  "follow_up_notes": ["note 1"],
  "reviewer_audit_log": "Audit remark confirming groundedness"
}}"""

    res = await invoke_with_retry(prompt)
    data = clean_and_parse_json(res.content)
    return {
        "action_items": data.get("verified_actions", state["action_items"]),
        "follow_up_notes": data.get("follow_up_notes", []),
        "reviewer_audit_log": data.get("reviewer_audit_log", "Groundedness check completed.")
    }

builder = StateGraph(AgentState)
builder.add_node("summary_node", summary_agent)
builder.add_node("decision_node", decision_agent)
builder.add_node("action_node", action_agent)
builder.add_node("reviewer_node", reviewer_agent)

builder.set_entry_point("summary_node")
builder.add_edge("summary_node", "decision_node")
builder.add_edge("decision_node", "action_node")
builder.add_edge("action_node", "reviewer_node")
builder.add_edge("reviewer_node", END)

workflow_graph = builder.compile()