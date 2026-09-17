/**
 * Authentication-related types for the BuildSmart AI Supabase auth integration.
 *
 * UserRole and Profile are the single source of truth used across the app.
 * They are re-exported from ./index so legacy `../types` imports keep working.
 */
import type { User, Session } from '@supabase/supabase-js';

// ============================================================
// UserRole
// ============================================================
export type UserRole = 'CUSTOMER' | 'CONTRACTOR' | 'ADMIN';

// ============================================================
// Profile (mirrors the public.profiles table)
// ============================================================
export interface Profile {
  id: string; // UUID — references auth.users.id
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  // Contractor-specific fields
  location: string | null;  // city/area where contractor operates
  skills: string | null;    // comma-separated list of contractor skills
  years_of_experience: number | null;  // numeric years
  project_types: string | null;  // comma-separated list of project types handled
  company_name: string | null;   // business or company name
  description: string | null;    // short professional description
  resume_path: string | null;    // storage path in contractor-resumes bucket
  resume_url: string | null;     // public URL for resume file
  /**
   * Phase 3 verification status. 'VERIFIED' is the canonical verified-pool
   * status written by admin approval. 'APPROVED' is a legacy value kept for
   * backward compatibility with pre-Phase-3 rows.
   */
  verification_status: 'PENDING' | 'VERIFIED' | 'APPROVED' | 'REJECTED' | null;
  rejection_reason?: string | null;
}

// ============================================================
// SignUpData — payload for the public signup form.
// ADMIN is intentionally excluded: admins are created via seed/RBAC only.
// Extended fields for contractor registration:
//   - location: city/area where contractor operates
//   - skills: comma-separated list of contractor skills
//   - years_of_experience: numeric years
//   - project_types: comma-separated list of project types handled
//   - company_name: business or company name
//   - description: short professional description
//   - resume_path: storage path
// ============================================================
export interface SignUpData {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  role: 'CUSTOMER' | 'CONTRACTOR';
  location?: string;
  skills?: string;
  years_of_experience?: number;
  project_types?: string;
  company_name?: string;
  description?: string;
  resume_path?: string;
}

// ============================================================
// ContractorRegistrationData — payload for contractor profile submission
// ============================================================
export interface ContractorRegistrationData {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  skills: string;
  years_of_experience: number;
  project_types: string;
  company_name: string;
  description: string;
  resume_file?: File | null;
}

// ============================================================
// AuthResult helpers
// ============================================================

/**
 * Consistent result returned by authService.signUp().
 */
export interface SignUpResult {
  user: User | null;
  session: Session | null;
  error: string | null;
  /**
   * True when Supabase email confirmation is enabled and therefore no
   * session was issued (user created, but not yet signed in).
   */
  requiresEmailConfirmation?: boolean;
}

/**
 * Consistent result returned by authService.signIn().
 */
export interface SignInResult {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /**
   * Real Supabase error from the profile read (RLS / missing table / etc.).
   * Null when the row simply does not exist yet.
   */
  profileError?: string | null;
  error: string | null;
}

// ============================================================
// AuthenticatedUser
// ============================================================
export interface AuthenticatedUser {
  id: string;
  email: string;
  profile: Profile | null;
}

// ============================================================
// AuthState — the shape exposed by AuthContext
// ============================================================
export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /**
   * Non-null when the profile query failed (RLS / dead table / network).
   * Distinct from profile === null with no error, which means the row is
   * simply missing. Lets the UI differentiate the two instead of showing
   * an infinite "Finishing setup..." screen.
   */
  profileError: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: SignUpData) => Promise<{ requiresEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}