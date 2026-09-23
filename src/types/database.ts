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
export type ClaimRow = {
  id: string;
  project_id: string;
  report_id: string;
  state:
    | 'pending'
    | 'clarification'
    | 'verification'
    | 'disputed'
    | 'accepted'
    | 'rejected'
    | 'unplanned'
    | 'superseded'
    | 'withdrawn';
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
      claims: ReadTable<ClaimRow>;
    };
    Views: { [_ in never]: never };
    Functions: {
      schedule_snapshot: { Args: { p_project: string }; Returns: Json };
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
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
