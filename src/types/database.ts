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
export type Database = {
  public: {
    Tables: {
      project_members: ReadTable<MembershipRow>;
      projects: ReadTable<ProjectRow>;
      assignment_versions: ReadTable<AssignmentRow>;
    };
    Views: { [_ in never]: never };
    Functions: {
      schedule_snapshot: { Args: { p_project: string }; Returns: Json };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
