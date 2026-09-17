import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * Password reset page reached from the Supabase recovery email
 * (redirect target: `${window.location.origin}/reset-password`).
 *
 * Works for BOTH roles (CUSTOMER + CONTRACTOR): this page only changes the
 * authentication password. It never touches profiles.role, contractor
 * verification status or any other project data.
 */

type RecoveryStatus = 'checking' | 'ready' | 'invalid';

/** Same minimum password length enforced by AuthContext.signUp(). */
const MIN_PASSWORD_LENGTH = 6;

const labelStyle = 'block text-xs font-bold text-neutral-600 mb-1.5';

const inputStyle =
  'w-full pl-11 pr-11 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-sm bg-white disabled:bg-neutral-50 disabled:text-neutral-400';

export const ResetPassword: React.FC = () => {
  const { updatePassword } = useAuth();

  const [status, setStatus] = useState<RecoveryStatus>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);

  /*
   * Supabase puts the recovery token in the URL hash
   * (#access_token=...&type=recovery). The client (detectSessionInUrl: true)
   * consumes it and emits PASSWORD_RECOVERY.
   *
   * We wait for that event OR for an already restored session before deciding
   * the link is invalid, so the user is never bounced away too early.
   */
  useEffect(() => {
    let cancelled = false;
    let settled = false;

    const settle = (next: RecoveryStatus) => {
      if (cancelled || settled) return;
      settled = true;
      setStatus(next);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (event === 'PASSWORD_RECOVERY') {
          settle('ready');
          return;
        }

        if (
          nextSession &&
          (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')
        ) {
          settle('ready');
        }
      },
    );

    const checkExistingSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!sessionError && data.session) settle('ready');
    };

    void checkExistingSession();

    const hash = window.location.hash ?? '';
    const isRecoveryLink =
      hash.includes('type=recovery') || hash.includes('access_token');

    const timer = window.setTimeout(
      () => settle('invalid'),
      isRecoveryLink ? 6000 : 2500,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);

    if (!password) {
      setError('Please enter a new password.');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await updatePassword(password);

      setUpdated(true);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      const lower = raw.toLowerCase();

      if (lower.includes('should be different')) {
        setError('Your new password must be different from your current password.');
      } else if (
        lower.includes('at least') ||
        lower.includes('password length')
      ) {
        setError(
          `Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`,
        );
      } else if (
        lower.includes('session') ||
        lower.includes('jwt') ||
        lower.includes('expired') ||
        lower.includes('token')
      ) {
        setError(
          'Password reset link is invalid or expired. Please request a new reset link.',
        );
        setStatus('invalid');
      } else {
        setError(raw || 'Could not update your password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /*
   * The recovery link creates a REAL session, so it is cleared before sending
   * the user back to the login screen (otherwise the app would show the
   * dashboard because the user is already signed in).
   */
  const goToLogin = async () => {
    await supabase.auth.signOut();
    window.location.assign('/');
  };

  const requestNewLink = () => {
    window.location.assign('/forgot-password');
  };

  /* ------------------------------------------------------------------
   * 1. Waiting for the Supabase recovery session
   * ------------------------------------------------------------------ */
  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-warmbeige-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-terracotta/20 border-t-terracotta animate-spin" />
          <p className="text-sm font-semibold text-neutral-500">
            Verifying your password reset link...
          </p>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------
   * 2. Invalid or expired recovery link
   * ------------------------------------------------------------------ */
  if (status === 'invalid') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="min-h-screen bg-warmbeige-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-premium border border-neutral-200 p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h1 className="text-xl font-extrabold text-neutral-900">
              Reset link invalid or expired
            </h1>

            <p className="text-sm text-neutral-500 mt-2">
              Password reset link is invalid or expired. Please request a new
              reset link.
            </p>

            <button
              type="button"
              onClick={requestNewLink}
              className="mt-6 w-full py-3.5 rounded-xl bg-terracotta hover:bg-terracotta-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-premium hover:shadow-premium-hover"
            >
              Request New Reset Link
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="mt-5 text-sm font-semibold text-terracotta hover:text-terracotta-600 transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Login
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ------------------------------------------------------------------
   * 3. Password updated
   * ------------------------------------------------------------------ */
  if (updated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="min-h-screen bg-warmbeige-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-premium border border-neutral-200 p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <h1 className="text-xl font-extrabold text-neutral-900">
              Password updated successfully.
            </h1>

            <p className="text-sm text-neutral-500 mt-2">
              Sign in with your new password. Your profile, role, projects and
              all other project data remain unchanged.
            </p>

            <button
              type="button"
              onClick={() => {
                void goToLogin();
              }}
              className="mt-6 w-full py-3.5 rounded-xl bg-terracotta hover:bg-terracotta-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-premium hover:shadow-premium-hover"
            >
              Go to Login
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-6 text-center">
            <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Secured by Supabase Authentication
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-warmbeige-50 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-terracotta text-white mb-4 shadow-lg">
            <Sparkles className="w-7 h-7" />
          </div>

          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            Set a new password
          </h1>

          <p className="text-sm text-neutral-500 mt-2">
            Choose a new password for your BuildSmart AI account.
          </p>
        </div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white rounded-3xl shadow-premium border border-neutral-200 p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div>
              <label htmlFor="new-password" className={labelStyle}>
                New Password
              </label>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />

                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputStyle}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="new-password"
                  autoFocus
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              <p className="text-[11px] text-neutral-400 font-semibold mt-1.5">
                At least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor="confirm-password" className={labelStyle}>
                Confirm New Password
              </label>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />

                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputStyle}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={
                    showConfirmPassword ? 'Hide password' : 'Show password'
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {confirmPassword !== '' && password !== confirmPassword && (
                <p className="text-[11px] font-semibold text-red-600 mt-1.5">
                  Passwords do not match.
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-terracotta hover:bg-terracotta-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-premium hover:shadow-premium-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Updating password...
                </>
              ) : (
                <>
                  Update Password
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 pt-5 border-t border-neutral-100 text-center">
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="text-sm font-semibold text-terracotta hover:text-terracotta-600 transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Login
            </button>
          </div>

          {/* Security Badge */}
          <div className="mt-6 pt-5 border-t border-neutral-100 flex items-center justify-center gap-1.5 text-[10px] text-neutral-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Secured by Supabase Authentication
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};