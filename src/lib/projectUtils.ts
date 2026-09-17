/**
 * Shared project helpers — validation, labels, and formatting.
 * Used by CreateProject, ProjectDetails and the Customer Dashboard.
 */
import { ProjectStatus, ProjectType } from '../types/project';

export const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
  { value: 'NEW_CONSTRUCTION', label: 'New Construction' },
  { value: 'RENOVATION', label: 'Renovation' },
  { value: 'INTERIOR_DESIGN', label: 'Interior Design' },
];

export const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  // The live legacy table uses these values; the Phase-4 migration adds
  // DRAFT/SUBMITTED on top (both sets are part of the ProjectStatus union).
  { value: 'PLANNING', label: 'Planning' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const CONSTRUCTION_STAGE_OPTIONS = [
  'Planning',
  'Design',
  'Foundation',
  'Structure',
  'Finishing',
  'Handover',
];

export function projectTypeLabel(t?: string | null): string {
  return PROJECT_TYPE_OPTIONS.find(o => o.value === t)?.label ?? t ?? '—';
}

export function projectStatusLabel(s?: string | null): string {
  return PROJECT_STATUS_OPTIONS.find(o => o.value === s)?.label ?? s ?? '—';
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function displayLocation(city?: string | null, state?: string | null): string {
  return [city, state].filter(Boolean).join(', ') || '—';
}

/** Formats an INR amount as ₹X Lakhs (the application's display unit). */
export function inrInLakhs(amount?: number | null, digits = 1): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return `₹${(amount / 100000).toFixed(digits)} Lakhs`;
}

/** Normalize a form string to a number or null. */
export function toNullableNumber(v: string | number | null | undefined): number | null {
  if (v === '' || v == null) return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

/** Everything the customer form collects before it is sent to Supabase. */
export interface ProjectFormInput {
  name: string;
  project_type: ProjectType | string;
  building_type?: string;
  full_address?: string;
  city: string;
  state: string;
  plot_size: string | number | null;
  built_up_area: string | number | null;
  floors: string | number | null;
  bedrooms: string | number | null;
  bathrooms: string | number | null;
  preferred_materials?: string;
  budget_min: string | number | null;
  budget_max: string | number | null;
  budget?: string | number | null; // legacy single-budget field
  construction_stage?: string;
  description: string;
  requirements?: string;
}

export interface ProjectValidationResult {
  errors: Partial<Record<string, string>>;
  isValid: boolean;
}

/**
 * Phase-4 validation rules (spec §6):
 * name/type/city required, positive sizes, floors ≥ 1, counts ≥ 0,
 * valid budgets and min ≤ max, requirements non-empty.
 */
export function validateProject(input: ProjectFormInput): ProjectValidationResult {
  const errors: Partial<Record<string, string>> = {};

  if (!input.name.trim()) errors.name = 'Project name is required.';
  if (!input.project_type) errors.project_type = 'Project type is required.';
  if (!input.city.trim()) errors.city = 'Location / city is required.';
  if (!input.state.trim()) errors.state = 'State is required.';

  const plot = toNullableNumber(input.plot_size);
  if (plot != null && plot <= 0) errors.plot_size = 'Plot size must be a positive number.';

  const area = toNullableNumber(input.built_up_area);
  if (area != null && area <= 0) errors.built_up_area = 'Built-up area must be a positive number.';

  const floors = toNullableNumber(input.floors);
  if (floors != null && floors < 1) errors.floors = 'Floors must be at least 1.';

  const beds = toNullableNumber(input.bedrooms);
  if (beds != null && beds < 0) errors.bedrooms = 'Bedrooms cannot be negative.';

  const baths = toNullableNumber(input.bathrooms);
  if (baths != null && baths < 0) errors.bathrooms = 'Bathrooms cannot be negative.';

  const bmin = toNullableNumber(input.budget_min);
  const bmax = toNullableNumber(input.budget_max);

  if (bmin == null) errors.budget_min = 'Budget minimum is required.';
  if (bmax == null) errors.budget_max = 'Budget maximum is required.';
  if (bmin != null && bmin <= 0) errors.budget_min = 'Budget minimum must be greater than zero.';
  if (bmax != null && bmax <= 0) errors.budget_max = 'Budget maximum must be greater than zero.';
  if (bmin != null && bmax != null && bmin > bmax) {
    errors.budget_max = 'Budget maximum must be greater than or equal to the minimum.';
  }

  if (!input.description.trim() && !(input.requirements ?? '').trim()) {
    errors.description = 'Please describe your project or add requirements.';
  }

  return { errors, isValid: Object.keys(errors).length === 0 };
}
