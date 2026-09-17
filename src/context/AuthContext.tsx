import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import type { User, Session, AuthResponse } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import { getOwnContractorProfile } from '../services/contractorService';

import type {
  UserRole,
  Profile,
  SignUpData,
  AuthState,
} from '../types/auth';

const AuthContext = createContext<AuthState | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Convert the database profile into our application Profile type.
 */
function normalizeProfile(row: any): Profile {
  return {
    id: String(row.id),
    email: String(row.email ?? ''),
    full_name: row.full_name ?? null,
    phone: row.phone ?? null,
    role: (row.role ?? 'CUSTOMER') as UserRole,
    city: row.city ?? null,
    state: row.state ?? null,
    avatar_url: row.avatar_url ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    location: row.location ?? null,
    skills: row.skills ?? null,
    years_of_experience:
      row.years_of_experience == null
        ? null
        : Number(row.years_of_experience),
    project_types: row.project_types ?? null,
    company_name: row.company_name ?? null,
    description: row.description ?? null,
    resume_path: row.resume_path ?? null,
    resume_url: row.resume_url ?? null,
    verification_status:
      row.verification_status ?? null,
    rejection_reason: row.rejection_reason ?? null,
  };
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  /**
   * Load the user's profile from public.profiles.
   *
   * maybeSingle() is intentional:
   * if the profile row does not exist, it returns null
   * instead of throwing the PGRST116 single-row error.
   */
  const loadProfile = useCallback(async (userId: string) => {
    setProfileError(null);

    const response = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (response.error) {
      console.error('Profile loading error:', response.error);

      setProfile(null);
      setProfileError(response.error.message);

      return;
    }

    if (!response.data) {
      setProfile(null);
      return;
    }

    const baseProfile = normalizeProfile(response.data);

    /**
     * PHASE 1 — contractor data merge.
     *
     * The LIVE public.profiles table has NO contractor columns (location,
     * skills, years_of_experience, project_types, verification_status,
     * resume_url). For contractor accounts those values live on the
     * contractor's OWN public.contractor_profiles row
     * (contractor_profiles.id = auth.users.id — there is NO user_id column),
     * readable under RLS by the account email.
     *
     * This merge is BEST-EFFORT: a missing row or a failed read must NEVER
     * block login — the profile simply stays profiles-only and the contractor
     * gates re-check the DB status themselves.
     */
    if (baseProfile.role === 'CONTRACTOR') {
      try {
        const contractorRow = await getOwnContractorProfile(baseProfile.email);

        if (contractorRow) {
          setProfile({
            ...baseProfile,
            location: contractorRow.location ?? baseProfile.location,
            skills: contractorRow.skills ?? baseProfile.skills,
            years_of_experience:
              contractorRow.experience_years == null
                ? baseProfile.years_of_experience
                : Number(contractorRow.experience_years),
            project_types:
              contractorRow.project_types ?? baseProfile.project_types,
            resume_url: contractorRow.resume_url ?? baseProfile.resume_url,
            verification_status:
              contractorRow.verification_status ??
              baseProfile.verification_status,
          });
          return;
        }
      } catch (mergeError) {
        console.warn(
          'Contractor profile merge skipped:',
          mergeError instanceof Error ? mergeError.message : mergeError,
        );
      }
    }

    setProfile(baseProfile);
  }, []);

  /**
   * Restore the existing Supabase session when the application starts.
   */
  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        setLoading(true);

        const sessionResponse = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionResponse.error) {
          console.error(
            'Session restore error:',
            sessionResponse.error.message,
          );

          setUser(null);
          setSession(null);
          setProfile(null);
          setProfileError(sessionResponse.error.message);

          return;
        }

        const currentSession = sessionResponse.data.session;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await loadProfile(currentSession.user.id);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Failed to restore session:', error);

        if (mounted) {
          setUser(null);
          setSession(null);
          setProfile(null);

          setProfileError(
            error instanceof Error
              ? error.message
              : 'Failed to restore authentication session.',
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    /**
     * Keep React state synchronized with Supabase authentication.
     */
    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      console.log('Supabase auth event:', event);

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setProfile(null);
        setProfileError(null);
        return;
      }

      /**
       * Do not await Supabase operations directly inside
       * onAuthStateChange. Schedule profile loading instead.
       */
      setTimeout(() => {
        if (mounted && nextSession.user) {
          void loadProfile(nextSession.user.id);
        }
      }, 0);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  /**
   * Sign in an existing user.
   */
  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      const cleanEmail = email.trim();

      if (!cleanEmail || !password) {
        throw new Error('Email and password are required.');
      }

      const response: AuthResponse = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const signedInSession = response.data.session;
      const signedInUser = response.data.user;

      setSession(signedInSession);
      setUser(signedInUser);

      if (signedInUser) {
        await loadProfile(signedInUser.id);
      }
    },
    [loadProfile],
  );

  /**
   * Create a new CUSTOMER or CONTRACTOR account.
   */
  const signUp = useCallback(
    async (
      data: SignUpData,
    ): Promise<{ requiresEmailConfirmation: boolean }> => {
      const cleanEmail = data.email.trim();

      if (!data.full_name.trim()) {
        throw new Error('Full name is required.');
      }

      if (!cleanEmail) {
        throw new Error('Email is required.');
      }

      if (!data.password) {
        throw new Error('Password is required.');
      }

      if (data.password.length < 6) {
        throw new Error('Password must contain at least 6 characters.');
      }

      const response: AuthResponse = await supabase.auth.signUp({
        email: cleanEmail,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name.trim(),
            phone: data.phone?.trim() || null,
            role: data.role,
            location: data.location?.trim() || null,
            skills: data.skills?.trim() || null,
            years_of_experience:
              data.years_of_experience == null
                ? null
                : Number(data.years_of_experience),
            project_types: data.project_types?.trim() || null,
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const createdUser = response.data.user;
      const createdSession = response.data.session;

      setUser(createdUser);
      setSession(createdSession);

      /**
       * If Supabase email confirmation is enabled,
       * session will normally be null here.
       */
      const requiresEmailConfirmation =
        Boolean(createdUser) && createdSession === null;

      /**
       * If a session was immediately created, load the profile.
       *
       * Normally a database trigger should create the profile row.
       * We also attempt a small client-side fallback insert if
       * the row is not present.
       */
      if (createdUser && createdSession) {
        await loadProfile(createdUser.id);

        /**
         * Give the database trigger a moment to create the profile.
         */
        const profileCheck = await supabase
          .from('profiles')
          .select('id')
          .eq('id', createdUser.id)
          .maybeSingle();

        if (!profileCheck.error && !profileCheck.data) {
          // Fallback insert uses ONLY columns that exist on the live
          // public.profiles table (id, full_name, email, phone, role, city,
          // state, avatar_url, created_at, updated_at). Contractor metadata
          // (location, skills, verification_status, …) lives on
          // contractor_profiles and is never written here.
          const profileInsert = await supabase.from('profiles').insert({
            id: createdUser.id,
            email: cleanEmail,
            full_name: data.full_name.trim(),
            phone: data.phone?.trim() || null,
            role: data.role,
          });

          if (profileInsert.error) {
            console.warn(
              'Profile fallback insert failed:',
              profileInsert.error.message,
            );
          } else {
            await loadProfile(createdUser.id);
          }
        }
      }

      return {
        requiresEmailConfirmation,
      };
    },
    [loadProfile],
  );

  /**
   * Sign out the current user.
   */
  const signOut = useCallback(async (): Promise<void> => {
    const response = await supabase.auth.signOut();

    if (response.error) {
      throw new Error(response.error.message);
    }

    setUser(null);
    setSession(null);
    setProfile(null);
    setProfileError(null);
  }, []);

  /**
   * Send a password reset email to the user.
   */
  const resetPassword = useCallback(
    async (email: string): Promise<void> => {
      const response = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }
    },
    [],
  );

  /**
   * Update the user's password using the recovery session.
   */
  const updatePassword = useCallback(
    async (newPassword: string): Promise<void> => {
      const response = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }
    },
    [],
  );

    /**
   * Manually reload the current user's profile.
   */
  const refreshProfile = useCallback(async (): Promise<void> => {
    if (!user) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    await loadProfile(user.id);
  }, [user, loadProfile]);

  const contextValue: AuthState = {
    user,
    session,
    profile,
    profileError,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    resetPassword,
    updatePassword,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Access authentication state anywhere in the application.
 */
export const useAuth = (): AuthState => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside an AuthProvider.',
    );
  }

  return context;
};
