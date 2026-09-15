from pydantic import BaseModel, Field
from typing import List

class ActionItem(BaseModel):
    task: str = Field(description="Actionable statement describing what needs to be done")
    owner: str = Field(
        default="Not Specified / Requires Confirmation",
        description="Explicit assignee name from the transcript, or 'Not Specified / Requires Confirmation'"
    )
    deadline: str = Field(
        default="Not Specified / Requires Confirmation",
        description="Explicit completion date or timeline, or 'Not Specified / Requires Confirmation'"
    )
    priority: str = Field(
        default="Medium",
        description="Priority level: High, Medium, or Low"
    )
    dependencies: List[str] = Field(
        default_factory=list,
        description="Exact previous tasks or prerequisites that must be completed before this action"
    )

class ProcessMeetingRequest(BaseModel):
    title: str = Field(default="Sprint Sync Meeting")
    transcript: str

class MeetingReportResponse(BaseModel):
    id: str
    processing_status: str
    summary: str
    key_topics: List[str]
    decisions: List[str]
    action_items: List[ActionItem]
    blockers: List[str]
    open_questions: List[str]
    follow_up_notes: List[str]
    reviewer_audit_log: str