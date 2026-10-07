export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserKindEnum = "student" | "staff";
export type GenderEnum = "female" | "male" | "other" | "prefer_not_to_say";
export type AppRoleEnum = "owner" | "moderator";
export type RequestStatusEnum = "open" | "closed" | "full";
export type ApplicationStatusEnum =
  | "applied"
  | "selected"
  | "waitlisted"
  | "rejected"
  | "accepted"
  | "declined"
  | "expired"
  | "withdrawn";
export type RoomMemberRoleEnum = "lead" | "member" | "mentor";
export type RoomMemberStatusEnum = "active" | "left" | "removed";
export type TaskStatusEnum = "todo" | "in_progress" | "done";
export type ReportStatusEnum = "pending" | "under_review" | "dismissed" | "blocked" | "appealed";

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  kind: UserKindEnum;
  admission_year: number | null;
  department: string;
  gender: GenderEnum;
  is_blocked: boolean;
  is_deactivated: boolean;
  consent_version: string;
  consent_given_at: string;
  created_at: string;
  updated_at: string;
}

export interface AppRole {
  id: string;
  user_id: string;
  role: AppRoleEnum;
  created_at: string;
}

export interface TeamRequest {
  id: string;
  lead_id: string;
  title: string;
  description: string;
  status: RequestStatusEnum;
  role_needed: string;
  headcount: number;
  tags: string[];
  filter_years: number[];
  filter_departments: string[];
  filter_genders: GenderEnum[];
  resume_required: boolean;
  closed_at: string | null;
  room_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  request_id: string;
  applicant_id: string;
  note: string | null;
  status: ApplicationStatusEnum;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationFile {
  id: string;
  application_id: string;
  storage_path: string;
  file_type: string;
  file_size_bytes: number;
  delete_after: string | null;
  created_at: string;
}

export interface Room {
  id: string;
  request_id: string;
  lead_id: string;
  created_at: string;
  updated_at: string;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  role: RoomMemberRoleEnum;
  status: RoomMemberStatusEnum;
  can_edit_tasks: boolean;
  can_set_deadlines: boolean;
  can_invite_mentors: boolean;
  removed_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  room_id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatusEnum;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  target: string;
  metadata: Json;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface RoomEvent {
  id: string;
  room_id: string;
  actor_id: string;
  event_type: string;
  metadata: Json;
  created_at: string;
}

export interface LeadTransfer {
  id: string;
  room_id: string;
  current_lead_id: string;
  target_lead_id: string;
  status: ApplicationStatusEnum;
  created_at: string;
}

export interface MentorInvite {
  id: string;
  request_id: string;
  room_id: string | null;
  staff_id: string;
  invited_by: string;
  status: ApplicationStatusEnum;
  expires_at: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  reply_to_id: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Mention {
  id: string;
  message_id: string;
  mentioned_user_id: string;
  created_at: string;
}

export interface RoomFile {
  id: string;
  room_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  created_at: string;
}

