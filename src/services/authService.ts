import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile, SignUpData, SignUpResult, SignInResult } from '../types/auth';

/**
 * Auth service — wraps Supabase Auth operations.
 *
 * Allowed public signup roles: CUSTOMER, CONTRACTOR.
 * ADMIN can never be created from the public signup UI.
 */

/**
 * Result of a profile read. `error` stays null when the row simply does
 * not exist (maybeSingle returns data = null) — a distinct, recoverable
 * state that must not be confused with a database failure.
 */
export interface ProfileFetchResult {
  profile: Profile | null;
  error: string | null;
}

/**
 * Fetch a profile row by user id (session.user.id, never email).
 *
 * Uses maybeSingle() so a missing row returns `{ profile: null, error: null }`
 * instead of a PGRST116 error. Any real Supabase failure (RLS, missing
 * table, network) is surfaced on the result — never silently swallowed —
 * so the UI can show the actual message.
 */
export async function fetchProfile(userId: string): Promise<ProfileFetchResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[authService] fetchProfile failed:', error.code, error.message);
    return { profile: null, error: error.message };
  }

  return { profile: (data as Profile) ?? null, error: null };
}

/**
 * Sign up a new user.
 *
 * Passes `full_name`, `phone`, and `role` as user metadata. A database
 * trigger creates the corresponding `profiles` row. Returns a consistent
 * SignUpResult; if email confirmation is enabled, `session` is null and
 * `requiresEmailConfirmation` is set so the UI can prompt the user.
 */
export async function signUp(data: SignUpData): Promise<SignUpResult> {
  // The SignUpData type only allows CUSTOMER | CONTRACTOR, so ADMIN can never
  // be created from the public signup form at the type level.

  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.full_name,
        phone: data.phone ?? null,
        role: data.role,
        // Contractor registration fields: the registration form already sends
        // them (ContractorRegistration.tsx). They were previously DROPPED here,
        // so when email confirmation interrupted the flow (session = null),
        // the DB trigger could not create the contractor_profiles row and the
        // admin verification table stayed empty. They are real user-entered
        // values only — consumed by handle_new_contractor_verification_row().
        ...(data.role === 'CONTRACTOR'
          ? {
              location: data.location ?? null,
              skills: data.skills ?? null,
              experience_years: data.years_of_experience ?? null,
              project_types: data.project_types ?? null,
            }
          : {}),
      },
    },
  });

  if (error) {
    console.error('[authService] signUp failed:', error.message);
    return { user: null, session: null, error: mapAuthError(error.message) };
  }

  return {
    user: authData.user ?? null,
    session: authData.session ?? null,
    error: null,
    requiresEmailConfirmation: !authData.session,
  };
}

/**
 * Sign in with email and password. Also resolves the matching profile.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('[authService] signIn failed:', error.message);
    return { user: null, session: null, profile: null, error: mapAuthError(error.message) };
  }

  let profile: Profile | null = null;
  let profileError: string | null = null;
  if (data.user) {
    const result = await fetchProfile(data.user.id);
    profile = result.profile;
    profileError = result.error;
  }

  return {
    user: data.user ?? null,
    session: data.session ?? null,
    profile,
    profileError,
    error: null,
  };
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('[authService] signOut failed:', error.message);
    throw new Error('Failed to sign out. Please try again.');
  }
}

/**
 * Get the currently authenticated Supabase user.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error('[authService] getCurrentUser failed:', error.message);
    return null;
  }

  return data.user;
}

/**
 * Get the current Supabase session.
 */
export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('[authService] getCurrentSession failed:', error.message);
    return null;
  }

  return data.session;
}

/**
 * Fetch the profile for the currently authenticated user.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { profile } = await fetchProfile(user.id);
  return profile;
}

/**
 * Map raw Supabase error messages to user-friendly messages.
 */
function mapAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (lower.includes('user already registered') || lower.includes('already registered')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (lower.includes('password should be at least')) {
    return 'Password must be at least 6 characters long.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in.';
  }
  if (lower.includes('user not found')) {
    return 'No account found with this email address. Please sign up first.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Network error. Please check your internet connection and try again.';
  }

  return 'Something went wrong. Please try again.';
}
