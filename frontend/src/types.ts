export interface ActionItem {
  task: string;
  owner: string;
  deadline: string;
  priority: string;
  dependencies: string[];
}

export interface MeetingReport {
  id: string;
  processing_status: string;
  summary: string;
  key_topics: string[];
  decisions: string[];
  action_items: ActionItem[];
  blockers: string[];
  open_questions: string[];
  follow_up_notes: string[];
  reviewer_audit_log: string;
}