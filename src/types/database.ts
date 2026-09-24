// Read-only columns used by roadmap 1.1, mirrored from the existing SQL migrations.
// This is a scoped client contract, not a generated copy of the complete schema.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
type ReadTable<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: [];
};
export type MembershipRow = {
  project_id: string;
  user_id: string;
  display_name: string;
  role: 'reporter' | 'supervisor' | 'planner' | 'manager';
  active: boolean;
  version: number;
};
export type ProjectRow = { id: string; name: string };
export type AssignmentRow = {
  project_id: string;
  activity_id: string;
  version: number;
  reporter_id: string;
  effective_from: string;
  effective_to: string;
};
export type ReportRow = {
  id: string;
  project_id: string;
  author_id: string;
  capture_id: string;
  current_version: number;
  lifecycle: 'draft' | 'submitted' | 'withdrawn';
  received_at: string;
  source_kind: 'text' | 'voice' | 'spreadsheet';
};
export type AttachmentRow = {
  id: string;
  project_id: string;
  report_id: string;
  object_path: string;
  state: 'reserved' | 'received' | 'failed';
  file_name: string;
  mime_type: string;
  byte_size: number;
  sha256: string | null;
  caption: string;
  media_kind: 'audio' | 'photo' | null;
  language: string | null;
  created_at: string;
};
export type MediaJobRow = {
  attachment_id: string;
  status: 'queued' | 'running' | 'ready' | 'failed';
  attempts: number;
  error_code: string | null;
};
export type MediaResultRow = {
  attachment_id: string;
  original_transcript: string | null;
  provider: string | null;
  model: string | null;
  sha256: string;
  details: Json;
  created_at: string;
};
export type ReportJobRow = {
  id: string;
  report_id: string;
  report_version: number;
  status: 'queued' | 'running' | 'retry_wait' | 'succeeded' | 'failed';
  attempts: number;
  error_code: string | null;
  created_at: string;
};
export type ClaimRow = {
  id: string;
  project_id: string;
  report_id: string;
  report_version: number;
  run_id: string;
  ordinal: number;
  facts: Json;
  validation_flags: string[];
  state:
    | 'pending'
    | 'clarification'
    | 'verification'
    | 'disputed'
    | 'accepted'
    | 'rejected'
    | 'observed'
    | 'unplanned'
    | 'superseded'
    | 'withdrawn';
  version: number;
  plan_revision_id: string;
  policy_version: number;
  parent_claim_id: string | null;
  root_claim_id: string | null;
  followup_round: number;
  manual_review: boolean;
  correction_of_event_id: string | null;
};
export type ReportVersionRow = {
  report_id: string;
  version: number;
  source_text: string;
  work_date: string | null;
  selected_activity_id: string | null;
  content_hash: string;
  context: Json;
  created_at: string;
};
export type CandidateMatchRow = {
  claim_id: string;
  project_id: string;
  activity_id: string;
  revision_id: string;
  rank: number;
  score: number;
  features: Json;
  mismatch_flags: string[];
};
export type VerificationRequestRow = {
  id: string;
  project_id: string;
  claim_id: string;
  report_id: string;
  activity_id: string;
  verifier_id: string;
  claim_version: number;
  report_version: number;
  plan_revision_id: string;
  policy_version: number;
  assignment_version: number;
  facts_hash: string;
  status:
    'open' | 'confirmed' | 'needs_info' | 'denied' | 'superseded' | 'cancelled';
  allocation_confirmed: boolean;
  work_confirmed: boolean;
  version: number;
  created_at: string;
};
export type ClarificationRequestRow = {
  id: string;
  project_id: string;
  claim_id: string;
  report_id: string;
  claim_version: number;
  report_version: number;
  version: number;
  reason_code: 'location' | 'date' | 'scope' | 'assignment' | 'detail';
  question_text: string;
  options: Json;
  automatic: boolean;
  status: 'open' | 'answered' | 'resolved' | 'superseded' | 'cancelled';
  created_at: string;
};
export type ClarificationResponseRow = {
  id: string;
  request_id: string;
  project_id: string;
  actor_id: string;
  question_version: number;
  input: Json;
  resulting_report_version: number | null;
  created_at: string;
};
export type VerificationDecisionRow = {
  id: string;
  request_id: string;
  project_id: string;
  actor_id: string;
  request_version: number;
  allocation: 'confirmed' | 'denied' | 'needs_info';
  work: 'confirmed' | 'denied' | 'needs_info';
  reason: string;
  created_at: string;
};
export type Database = {
  public: {
    Tables: {
      project_members: ReadTable<MembershipRow>;
      projects: ReadTable<ProjectRow>;
      assignment_versions: ReadTable<AssignmentRow>;
      reports: ReadTable<ReportRow>;
      attachments: ReadTable<AttachmentRow>;
      media_jobs: ReadTable<MediaJobRow>;
      media_results: ReadTable<MediaResultRow>;
      jobs: ReadTable<ReportJobRow>;
      claims: ReadTable<ClaimRow>;
      report_versions: ReadTable<ReportVersionRow>;
      candidate_matches: ReadTable<CandidateMatchRow>;
      clarification_requests: ReadTable<ClarificationRequestRow>;
      clarification_responses: ReadTable<ClarificationResponseRow>;
      verification_requests: ReadTable<VerificationRequestRow>;
      verification_decisions: ReadTable<VerificationDecisionRow>;
    };
    Views: { [_ in never]: never };
    Functions: {
      schedule_snapshot: { Args: { p_project: string }; Returns: Json };
      preview_claim: { Args: { p_command: Json }; Returns: Json };
      decide_claim: { Args: { p_command: Json }; Returns: Json };
      request_clarification: {
        Args: { p_claim: string; p_command: Json };
        Returns: Json;
      };
      request_verification: {
        Args: { p_claim: string; p_command: Json };
        Returns: Json;
      };
      respond_clarification: {
        Args: { p_question: string; p_command: Json };
        Returns: Json;
      };
      decide_verification: {
        Args: { p_request: string; p_command: Json };
        Returns: Json;
      };
      verification_context: {
        Args: { p_project: string };
        Returns: { request_id: string; reporter_name: string }[];
      };
      reserve_field_capture: {
        Args: {
          p_project: string;
          p_capture: string;
          p_files: Json;
          p_language: string;
        };
        Returns: string;
      };
      finalize_field_media: {
        Args: { p_report: string };
        Returns: Json;
      };
      submit_field_capture: {
        Args: {
          p_report: string;
          p_text: string;
          p_work_date: string | null;
          p_activity: string | null;
        };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
