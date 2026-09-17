// BuildSmart AI — TypeScript types reflecting the Supabase database schema.

// Auth types (UserRole, Profile) are defined once in ./auth and re-exported
// here so legacy `../types` imports continue to work without duplication.
export type { UserRole, Profile } from './auth';

// ============================================================
// Contractor
// ============================================================
export interface Contractor {
  id: string; // UUID
  profile_id: string; // references profiles.id
  company_name: string;
  owner_name: string;
  experience_years: number;
  projects_completed: number;
  rating: number; // 0.0 – 5.0
  reviews_count: number;
  price_estimate_lakhs: number;
  completion_time_months: number;
  response_time: string;
  /** Phase 3: 'VERIFIED' when admin-approved; legacy 'APPROVED' also kept. */
  verification_status: 'PENDING' | 'VERIFIED' | 'APPROVED' | 'REJECTED';
  match_score: number;
  match_reason: string | null;
  specialty: string;
  location: string;
  warranty_years: number;
  material_quality: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Project
// ============================================================
export interface Project {
  id: string; // UUID
  customer_id: string; // references profiles.id
  contractor_id: string | null; // references contractors.id
  name: string;
  description: string | null;
  building_type: string;
  city: string;
  state: string;
  plot_size_sqft: number | null;
  floors: number | null;
  soil_type: string | null;
  total_budget_lakhs: number;
  expected_completion_date: string | null; // ISO date
  status: 'DRAFT' | 'PLANNING' | 'ACTIVE_BUILD' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  start_date: string | null; // ISO date
  created_at: string;
  updated_at: string;
}

// ============================================================
// DesignRequest
// ============================================================
export interface DesignRequest {
  id: string; // UUID
  project_id: string; // references projects.id
  customer_id: string; // references profiles.id
  description: string;
  design_style: string | null;
  priority: string | null;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  created_at: string;
  updated_at: string;
}

// ============================================================
// GeneratedDesign
// ============================================================
export interface GeneratedDesign {
  id: string; // UUID
  design_request_id: string; // references design_requests.id
  project_id: string; // references projects.id
  title: string;
  description: string | null;
  image_url: string | null;
  blueprint_url: string | null;
  confidence_score: number | null; // 0 – 100
  created_at: string;
}

// ============================================================
// ContractorMatch
// ============================================================
export interface ContractorMatch {
  id: string; // UUID
  project_id: string; // references projects.id
  contractor_id: string; // references contractors.id
  match_score: number; // 0 – 100
  match_reason: string | null;
  created_at: string;
}

// ============================================================
// Quote — mirrors the LIVE public.quotes columns
// (verified 2026-09-07 via PostgREST probe: id, project_id,
//  contractor_id, customer_id, amount, description, status,
//  created_at — there is NO amount_lakhs / valid_until /
//  updated_at column in the live database)
// ============================================================
export interface Quote {
  id: string; // UUID
  project_id: string; // references projects.id
  contractor_id: string; // references contractors.id
  customer_id: string; // references profiles.id
  amount: number | null; // INR (live column name is `amount`, not `amount_lakhs`)
  description: string | null;
  status: string; // live CHECK constraint not visible to anon; treat as string
  created_at: string;
}

// ============================================================
// Review
// ============================================================
export interface Review {
  id: string; // UUID
  project_id: string; // references projects.id
  contractor_id: string; // references contractors.id
  customer_id: string; // references profiles.id
  rating: number; // 1 – 5
  comment: string | null;
  created_at: string;
}

// ============================================================
// ProjectMilestone — mirrors public.project_milestones.
// Phase 7 added progress / start_date / expected_end_date /
// completed_date / updated_at (see
// supabase/migrations/20260908140000_phase7_milestone_tracker_schema.sql).
// The legacy live columns due_date / completed_at are retained
// as optional for pre-migration databases; the Phase-7 fields
// are the canonical ones for the tracker.
// ============================================================
export interface ProjectMilestone {
  id: string; // UUID
  project_id: string; // references projects.id
  title: string; // live column name is `title`, not `name`
  description: string | null;
  status: string; // live CHECK constraint; treated as flexible string
  /** Phase 7: completion percentage 0–100 (contractor-managed). */
  progress: number | null;
  /** Phase 7: when this milestone's work started (contractor-managed). */
  start_date: string | null; // ISO date
  /** Phase 7: expected completion of this milestone. */
  expected_end_date: string | null; // ISO date
  /** Phase 7: when the milestone was actually completed. */
  completed_date: string | null; // ISO timestamp
  /** Phase 7: last-modified timestamp (auto-bumped by database trigger). */
  updated_at: string | null; // ISO timestamp
  /** Legacy live column (backward compatibility). */
  due_date: string | null; // ISO date
  /** Legacy live column (backward compatibility). */
  completed_at: string | null; // ISO timestamp
  created_at: string;
}

// ============================================================
// Message — mirrors the LIVE public.messages columns
// (verified 2026-09-07 via PostgREST probe: id, project_id,
//  sender_id, message, attachment_url, created_at — there is NO
//  sender_type / text / attachment_type / attachment_name column
//  in the live database).
// Phase 9 added receiver_id + read_at (see
// supabase/migrations/20260908180000_phase9_project_chat.sql).
// ============================================================
export interface Message {
  id: string; // UUID
  project_id: string; // references projects.id
  sender_id: string; // references profiles.id
  receiver_id: string | null; // references profiles.id (the other participant)
  message: string; // body text (live column name is `message`, not `text`)
  attachment_url: string | null; // no attachment_type/name columns live
  created_at: string;
  read_at: string | null; // ISO timestamp — null until the receiver reads it
}

// ============================================================
// SiteLog
// ============================================================
export interface SiteLog {
  id: string; // UUID
  project_id: string; // references projects.id
  logged_by: string; // references profiles.id
  text: string;
  logged_at: string; // ISO timestamp
  created_at: string;
}

// ============================================================
// Notification
// ============================================================
export interface Notification {
  id: string; // UUID
  user_id: string; // references profiles.id
  type: 'MILESTONE' | 'PRICE' | 'WEATHER' | 'BUDGET' | 'QUOTE' | 'MESSAGE' | 'SYSTEM';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}