import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Building2,
  Home,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ContractorRegistration } from './ContractorRegistration';

type AuthMode = 'login' | 'signup' | 'forgot-password';

interface AuthPageProps {
  /**
   * Optional starting mode. Lets the dedicated /forgot-password URL reuse this
   * same page instead of duplicating the reset-email form elsewhere.
   * Defaults to the normal login screen.
   */
  initialMode?: AuthMode;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
}) => {
  const { signIn, signUp, resetPassword } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [role, setRole] = useState<'CUSTOMER' | 'CONTRACTOR'>('CUSTOMER');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [skills, setSkills] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [projectTypes, setProjectTypes] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setForgotError(null);
    setForgotSuccess(null);

    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotEmail.trim())) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    setForgotLoading(true);

    try {
      await resetPassword(forgotEmail.trim());
      setForgotSuccess('If an account exists with this email, a password reset link has been sent. Please check your inbox (and spam folder) for the reset link.');
      setForgotEmail('');
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Failed to send reset email. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setSuccess(null);

    if (!email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (mode === 'signup' && role === 'CONTRACTOR') {
      if (!location.trim()) {
        setError('Please enter your location.');
        return;
      }

      if (!skills.trim()) {
        setError('Please enter your skills.');
        return;
      }

      if (
        yearsOfExperience.trim() !== '' &&
        Number.isNaN(Number(yearsOfExperience))
      ) {
        setError('Years of experience must be a valid number.');
        return;
      }

      if (!projectTypes.trim()) {
        setError('Please enter your project types.');
        return;
      }
    }

    setLoading(true);

    try {
      // ============================================================
      // LOGIN
      // ============================================================
      if (mode === 'login') {
        await signIn(email.trim(), password);

        setSuccess('Signed in successfully.');
        return;
      }

      // ============================================================
      // SIGN UP
      // ============================================================
      const { requiresEmailConfirmation } = await signUp({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        role,
        location: location.trim() || undefined,
        skills: skills.trim() || undefined,
        years_of_experience:
          yearsOfExperience.trim() !== ''
            ? Number(yearsOfExperience)
            : undefined,
        project_types: projectTypes.trim() || undefined,
      });

      // ============================================================
      // CONTRACTOR RESUME UPLOAD
      // ============================================================
      if (role === 'CONTRACTOR' && resumeFile && !requiresEmailConfirmation) {
        try {
          const {
            data: sessionData,
            error: sessionError,
          } = await supabase.auth.getSession();

          if (sessionError) {
            throw sessionError;
          }

          const userId = sessionData.session?.user?.id;

          if (userId) {
            const safeFileName = resumeFile.name.replace(
              /[^a-zA-Z0-9._-]/g,
              '_',
            );

            const filePath = `${userId}/${Date.now()}_${safeFileName}`;

            const { error: uploadError } = await supabase.storage
              .from('contractor-resumes')
              .upload(filePath, resumeFile, {
                upsert: true,
              });

            if (uploadError) {
              throw new Error(
                `Resume upload failed: ${uploadError.message}`,
              );
            }

            const { data: publicUrlData } = supabase.storage
              .from('contractor-resumes')
              .getPublicUrl(filePath);

            const resumeUrl = publicUrlData.publicUrl;

            const { error: profileError } = await supabase
              .from('profiles')
              .update({
                resume_url: resumeUrl,
                verification_status: 'PENDING',
              })
              .eq('id', userId);

            if (profileError) {
              console.warn(
                'Account created, but resume URL could not be saved:',
                profileError.message,
              );
            }
          }
        } catch (resumeError) {
          console.warn('Resume processing failed:', resumeError);
        }
      }

      // ============================================================
      // SUCCESS MESSAGE
      // ============================================================
      if (requiresEmailConfirmation) {
        setSuccess(
          'Account created! Please check your email to confirm your account before signing in.',
        );
      } else if (role === 'CONTRACTOR') {
        setSuccess(
          'Contractor account created successfully. Your application is now pending admin verification.',
        );
      } else {
        setSuccess(
          'Account created successfully! You are now signed in.',
        );
      }

      // Clear form
      setFullName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setLocation('');
      setSkills('');
      setYearsOfExperience('');
      setProjectTypes('');
      setResumeFile(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const inputStyle =
    'w-full pl-11 pr-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta transition-colors font-medium text-neutral-800 text-sm bg-white';

  const labelStyle =
    'block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2';

  return (
    <div className="min-h-screen bg-warmbeige-50 flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-extrabold text-sm">
            B
          </div>

          <div>
            <h1 className="text-lg font-extrabold text-neutral-900 leading-none">
              BuildSmart{' '}
              <span className="text-terracotta">AI</span>
            </h1>

            <span className="text-[10px] text-neutral-400 font-semibold tracking-wide uppercase">
              Construction Platform
            </span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white border border-neutral-200/80 rounded-3xl p-8 shadow-premium"
        >

          {/* Mode Toggle */}
          <div className="flex items-center gap-1.5 bg-neutral-50 p-1.5 rounded-xl border border-neutral-200/50 text-xs font-bold text-neutral-600 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccess(null);
              }}
              className={`flex-1 py-2.5 rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white text-terracotta shadow-sm border border-neutral-200/20 font-extrabold'
                  : 'hover:text-neutral-900'
              }`}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
                setSuccess(null);
              }}
              className={`flex-1 py-2.5 rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-white text-terracotta shadow-sm border border-neutral-200/20 font-extrabold'
                  : 'hover:text-neutral-900'
              }`}
            >
              Create Account
            </button>
          </div>

          <h2 className="text-2xl font-extrabold text-neutral-900 mb-1">
            {mode === 'login'
              ? 'Welcome back'
              : mode === 'forgot-password'
              ? 'Reset Password'
              : 'Join BuildSmart AI'}
          </h2>

          <p className="text-sm text-neutral-400 font-light mb-6">
            {mode === 'login'
              ? 'Sign in to access your construction workspace.'
              : mode === 'forgot-password'
              ? 'Enter your email to receive a password reset link.'
              : 'Create your account to start building smarter.'}
          </p>

          {/* Role Selection */}
          {mode === 'signup' && (
            <div className="mb-6">
              <label className={labelStyle}>I am a</label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('CUSTOMER')}
                  className={`py-3 px-2 rounded-xl border text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    role === 'CUSTOMER'
                      ? 'border-terracotta bg-terracotta-50 text-terracotta shadow-sm'
                      : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  Homeowner
                </button>

                <button
                  type="button"
                  onClick={() => setRole('CONTRACTOR')}
                  className={`py-3 px-2 rounded-xl border text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    role === 'CONTRACTOR'
                      ? 'border-terracotta bg-terracotta-50 text-terracotta shadow-sm'
                      : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  Contractor
                </button>
              </div>
            </div>
          )}

                    {mode === 'forgot-password' ? (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              {/* Forgot Password Heading */}
              <div className="mb-4">
                <h2 className="text-xl font-extrabold text-neutral-900">
                  Reset Password
                </h2>
                <p className="text-sm text-neutral-500 mt-1">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              {/* Email Field */}
              <div>
                <label className={labelStyle}>Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className={inputStyle}
                    placeholder="you@example.com"
                    disabled={forgotLoading}
                    autoFocus
                  />
                </div>
              </div>

              {/* Error */}
              {forgotError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-700">
                  {forgotError}
                </div>
              )}

              {/* Success */}
              {forgotSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700">
                  {forgotSuccess}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full py-3.5 rounded-xl bg-terracotta hover:bg-terracotta-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-premium hover:shadow-premium-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {forgotLoading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Sending reset link...
                  </>
                ) : (
                  <>
                    Send Reset Link
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
                            </button>

              {/* Back to Login */}
              <div className="text-center -mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setForgotError(null);
                    setForgotSuccess(null);
                  }}
                  className="text-sm font-semibold text-terracotta hover:text-terracotta-600 transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Login
                </button>
              </div>
            </form>
          ) : mode === 'signup' && role === 'CONTRACTOR' ? (
            <ContractorRegistration />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">

            {/* Full Name */}
            {mode === 'signup' && (
              <div>
                <label className={labelStyle}>Full Name</label>

                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />

                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputStyle}
                    placeholder="e.g. Yagni Yeruva"
                    disabled={loading}
                    required
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className={labelStyle}>Email Address</label>

              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputStyle}
                  placeholder="you@example.com"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className={labelStyle}>Password</label>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputStyle}
                  placeholder="••••••••"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Forgot Password Link */}
            {mode === 'login' && (
              <div className="flex justify-end -mt-4">
                <button
                  type="button"
                  onClick={() => setMode('forgot-password')}
                  className="text-sm font-semibold text-terracotta hover:text-terracotta-600 transition-colors inline-flex items-center gap-1"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {/* Phone */}
            {mode === 'signup' && (
              <div>
                <label className={labelStyle}>Phone (Optional)</label>

                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />

                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputStyle}
                    placeholder="+91 98765 43210"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* Contractor Fields */}
            {mode === 'signup' && role === 'CONTRACTOR' && (
              <>
                <div>
                  <label className={labelStyle}>Location</label>

                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-sm bg-white"
                    placeholder="e.g. Bengaluru"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className={labelStyle}>Skills</label>

                  <input
                    type="text"
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-sm bg-white"
                    placeholder="Civil, Electrical, Plumbing"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className={labelStyle}>
                    Years of Experience
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={yearsOfExperience}
                    onChange={(e) =>
                      setYearsOfExperience(e.target.value)
                    }
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-sm bg-white"
                    placeholder="e.g. 5"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className={labelStyle}>
                    Project Types
                  </label>

                  <input
                    type="text"
                    value={projectTypes}
                    onChange={(e) =>
                      setProjectTypes(e.target.value)
                    }
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-sm bg-white"
                    placeholder="Residential, Commercial"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className={labelStyle}>
                    Resume
                  </label>

                  <div className="relative">
                    <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />

                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) =>
                        setResumeFile(e.target.files?.[0] ?? null)
                      }
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-neutral-200 text-sm bg-white"
                      disabled={loading}
                    />
                  </div>

                  {resumeFile && (
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Selected: {resumeFile.name}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-700">
                {error}
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700">
                {success}
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

                  {mode === 'login'
                    ? 'Signing in...'
                    : 'Creating account...'}
                </>
              ) : (
                <>
                  {mode === 'login'
                    ? 'Sign In'
                    : 'Create Account'}

                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
          )}

          {/* Security */}
          <div className="mt-6 pt-5 border-t border-neutral-100 flex items-center justify-center gap-1.5 text-[10px] text-neutral-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Secured by Supabase Authentication
          </div>
        </motion.div>

        {/* Feature hint */}
        <div className="mt-6 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-terracotta" />
            AI-powered planning, estimation, and construction tracking
          </span>
        </div>
      </div>
    </div>
  );
};