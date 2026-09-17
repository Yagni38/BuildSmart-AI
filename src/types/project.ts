/**
 * Project types — canonical BuildSmart project domain types (Phase 4).
 *
 * These mirror the REAL public.projects columns. The live Supabase database
 * currently exposes the base columns (id, customer_id, name, building_type,
 * description, city, state, built_up_area, floors, bedrooms, bathrooms,
 * budget, soil_type, status, priority, design_style, created_at, updated_at)
 * plus a legacy status CHECK constraint (PLANNING / IN_PROGRESS /
 * COMPLETED / CANCELLED).
 *
 * The Phase-4 columns (project_type, plot_size, budget_min, budget_max,
 * construction_stage, requirements, contractor_id) are added by
 * supabase/migrations/20260816130000_projects_customer_rls.sql — they are
 * OPTIONAL in the payload types because the insert only sends a column when
 * it actually exists in the live database (see projectService.ts).
 *
 * Legacy single-column `budget` maps the old form's single "Expected Budget"
 * field to the live `budget` column.
 *
 * `customer_id` is intentionally NOT part of CreateProjectData/UpdateProjectData:
 * the service resolves it from supabase.auth.getUser() and rejects requests
 * from unauthenticated users ("Please log in to create a project.").
 */

export type ProjectType =
  | 'NEW_CONSTRUCTION'
  | 'RENOVATION'
  | 'INTERIOR_DESIGN';

/**
 * Status union covering BOTH the live legacy constraint
 * (PLANNING / IN_PROGRESS / COMPLETED / CANCELLED) and the Phase-4 migration
 * list (DRAFT / SUBMITTED / IN_PROGRESS / COMPLETED / CANCELLED).
 */
export type ProjectStatus =
  | 'DRAFT'
  | 'PLANNING'
  | 'SUBMITTED'
  | 'CONTRACTOR_SELECTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

/** A project as the application consumes it (DB row + derived location). */
export interface Project {
  id: string; // UUID — public.projects.id
  customer_id: string; // UUID — the authenticated owner (profiles.id)
  contractor_id: string | null;
  selected_at?: string | null;
  name: string;
  project_type: ProjectType | string;
  building_type: string | null;
  full_address: string | null; // Phase 1: full location/address if provided
  location: string | null; // derived client-side: `${city}, ${state}`
  city: string | null;
  state: string | null;
  plot_size: number | null; // sq ft
  built_up_area: number | null; // sq ft
  floors: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  preferred_materials: string | null; // Phase 1: customer material preferences
  budget: number | null; // INR — legacy live column
  budget_min: number | null; // INR — Phase-4 column (after migration)
  budget_max: number | null; // INR — Phase-4 column (after migration)
  construction_stage: string | null;
  description: string | null;
  requirements: string | null;
  soil_type: string | null;
  priority: string | null;
  design_style: string | null; // design preference (existing UI "Design Style")
  timeline: string | null; // expected completion date (UI "Expected Completion")
  // ------------------------------------------------------------
  // Live public.projects columns (confirmed schema) used by the
  // AI Project Plan and Material Estimator. Optional so the app
  // keeps working against databases where a column is absent.
  // ------------------------------------------------------------
  material_preference?: string | null; // e.g. "Marble", "Granite", "Wood"
  sustainability_preference?: string | null; // e.g. "Solar ready", "Rainwater"
  parking?: string | null; // e.g. "Covered parking for 1 car"
  kitchen_type?: string | null; // e.g. "Modular"
  expected_completion?: string | null; // alternate completion field
  plot_length?: number | null; // ft
  plot_width?: number | null; // ft
  status: ProjectStatus | string;
  /** Phase 6: build completion percentage 0–100 (contractor-managed). */
  progress: number | null;
  /** Phase 6: when on-site work started (contractor-managed). */
  start_date: string | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Payload collected by the existing CreateProject form. `customer_id` is NOT
 * included — createProject() injects it from the authenticated session, so the
 * customer's ID can never come from the form (RLS ownership requirement).
 */
export interface CreateProjectData {
  name: string;
  project_type?: ProjectType;
  building_type?: string;
  full_address?: string | null; // Phase 1: full location/address if provided
  city: string;
  state: string;
  plot_size?: number | null;
  built_up_area?: number | null;
  floors?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  preferred_materials?: string | null; // Phase 1: customer material preferences
  budget?: number | null; // legacy single-budget column
  budget_min?: number | null;
  budget_max?: number | null;
  construction_stage?: string;
  description?: string | null;
  requirements?: string | null;
  soil_type?: string | null;
  priority?: string | null;
  design_style?: string | null;
  timeline?: string | null;
  contractor_id?: string | null;
  status?: ProjectStatus;
}

/**
 * Phase 6 — a contractor-posted update on a project (progress / milestone /
 * site / image). Mirrors the public.project_updates table created by
 * supabase/migrations/20260908120000_phase6_contractor_dashboard.sql.
 */
export type ProjectUpdateType = 'PROGRESS' | 'MILESTONE' | 'SITE' | 'IMAGE';

export interface ProjectUpdate {
  id: string; // UUID — public.project_updates.id
  project_id: string; // references projects.id
  author_id: string; // profiles.id of the contractor who posted
  update_type: ProjectUpdateType | string;
  title: string | null;
  content: string | null;
  image_url: string | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/** Payload for posting a new contractor update. */
export interface CreateProjectUpdateData {
  project_id: string;
  update_type: ProjectUpdateType;
  title?: string | null;
  content?: string | null;
  image_url?: string | null;
}

/**
 * Phase 8 — a construction progress photo uploaded by the contractor.
 * Mirrors the public.construction_photos table created by
 * supabase/migrations/20260908160000_phase8_construction_photo_updates.sql.
 */
export interface ConstructionPhoto {
  id: string; // UUID — public.construction_photos.id
  project_id: string; // references projects.id
  contractor_id: string; // profiles.id of the uploading contractor
  image_url: string; // public URL from storage bucket "construction-updates"
  caption: string | null;
  milestone_id: string | null; // optional link to a project_milestones row
  created_at: string; // ISO timestamp
}

/** Payload for uploading a new construction photo. */
export interface CreateConstructionPhotoData {
  project_id: string;
  image_url: string;
  caption?: string | null;
  milestone_id?: string | null;
}

/**
 * Phase 11 — a budget allocation line for a project.
 * Mirrors public.budget_items (estimated construction cost breakdown).
 * The original project.budget column is NEVER written by this table.
 */
export interface BudgetItem {
  id: string; // UUID — public.budget_items.id
  project_id: string; // references projects.id
  name: string; // e.g. "Foundation", "Material Cost"
  category: string;
  estimated: number; // in Lakhs (INR)
  spent: number; // in Lakhs (INR)
  sort_order: number;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/** Payload for creating a budget item. */
export interface CreateBudgetItemData {
  project_id: string;
  name: string;
  category?: string;
  estimated?: number;
  spent?: number;
  sort_order?: number;
}

/** Payload for updating a budget item. */
export interface UpdateBudgetItemData {
  name?: string;
  category?: string;
  estimated?: number;
  spent?: number;
  sort_order?: number;
}

/**
 * Phase 11 — a construction material take-off line for a project.
 * Mirrors public.construction_materials.
 */
export interface ConstructionMaterial {
  id: string; // UUID — public.construction_materials.id
  project_id: string; // references projects.id
  name: string;
  category: string; // structural | finishing | services
  quantity: number;
  unit: string; // e.g. "kg", "nos", "sqft"
  estimated_cost: number; // in INR
  actual_cost: number; // in INR
  supplier: string | null;
  recommendation?: string | null; // AI purchase optimizer tip (optional)
  sort_order: number;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/** Payload for creating a construction material. */
export interface CreateConstructionMaterialData {
  project_id: string;
  name: string;
  category?: string;
  quantity?: number;
  unit?: string;
  estimated_cost?: number;
  actual_cost?: number;
  supplier?: string | null;
  sort_order?: number;
}

/** Payload for updating a construction material. */
export interface UpdateConstructionMaterialData {
  name?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  estimated_cost?: number;
  actual_cost?: number;
  supplier?: string | null;
  sort_order?: number;
}

/** Fields the contractor may update on an existing project. */
export type UpdateProjectData = Partial<
  Pick<
    CreateProjectData,
    | 'name'
    | 'project_type'
    | 'building_type'
    | 'full_address'
    | 'city'
    | 'state'
    | 'plot_size'
    | 'built_up_area'
    | 'floors'
    | 'bedrooms'
    | 'bathrooms'
    | 'preferred_materials'
    | 'budget'
    | 'budget_min'
    | 'budget_max'
    | 'construction_stage'
    | 'description'
    | 'requirements'
    | 'soil_type'
    | 'priority'
    | 'design_style'
    | 'timeline'
    | 'status'
  >
>;