import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Phone, MapPin, Wrench, Briefcase, 
  Building2, FileText, Upload, CheckCircle2, AlertCircle, 
  Clock, ShieldCheck, ArrowRight, Sparkles, Loader2, FileCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { registerContractorProfile } from '../services/contractorService';

interface ContractorRegistrationProps {
  onNavigate?: (page: string) => void;
}

export const ContractorRegistration: React.FC<ContractorRegistrationProps> = ({ onNavigate }) => {
  const { user, profile, refreshProfile, signUp } = useAuth();

  // Form Fields
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || user?.email || '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [skills, setSkills] = useState(profile?.skills || '');
  const [yearsOfExperience, setYearsOfExperience] = useState(
    profile?.years_of_experience != null ? String(profile.years_of_experience) : ''
  );
  const [projectTypes, setProjectTypes] = useState(profile?.project_types || '');
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      if (profile.full_name) setFullName(profile.full_name);
      if (profile.email) setEmail(profile.email);
      if (profile.phone) setPhone(profile.phone);
      if (profile.location) setLocation(profile.location);
      if (profile.skills) setSkills(profile.skills);
      if (profile.years_of_experience != null) setYearsOfExperience(String(profile.years_of_experience));
      if (profile.project_types) setProjectTypes(profile.project_types);
    }
  }, [profile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = [
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg', 
        'image/png'
      ];

      if (!validTypes.includes(file.type)) {
        setError('Please upload a PDF, DOCX, PNG, or JPG file for your resume.');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError('Resume file size must be less than 10 MB.');
        return;
      }

      setError(null);
      setResumeFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Form Validations
    if (!fullName.trim()) return setError('Please enter your Full Name.');
    if (!email.trim() || !email.includes('@')) return setError('Please enter a valid Email Address.');
    if (!phone.trim()) return setError('Please enter your Phone Number.');
    if (!location.trim()) return setError('Please enter your Location / Operating Area.');
    if (!skills.trim()) return setError('Please enter your Skills (e.g. Structural Framing, Plumbing, Masonry).');
    if (!yearsOfExperience.trim() || Number.isNaN(Number(yearsOfExperience)) || Number(yearsOfExperience) < 0) {
      return setError('Please enter a valid number for Years of Experience.');
    }
    if (!projectTypes.trim()) return setError('Please enter your Project Types (e.g. Villas, Apartments, Commercial).');
    
    if (!user && !password) {
      return setError('Please provide a Password to create your account.');
    }

    setLoading(true);
    setUploadProgress(10);

    try {
      let activeUserId = user?.id;

      // If user is not authenticated yet, create account first
      if (!activeUserId) {
        setUploadProgress(20);
        const { requiresEmailConfirmation } = await signUp({
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          role: 'CONTRACTOR',
          location: location.trim(),
          skills: skills.trim(),
          years_of_experience: Number(yearsOfExperience),
          project_types: projectTypes.trim(),
        });

        if (requiresEmailConfirmation) {
          setLoading(false);
          setSuccessMessage('Account created! Please check your email to confirm your account, then sign in and submit your contractor registration.');
          return;
        }

        // Resolve the authenticated user id from the freshly created session.
        // `profile`/`user` in this closure are still the pre-signup values
        // (React state has not re-rendered yet), so they cannot be used here.
        const sessionRes = await supabase.auth.getSession();
        const sessionUserId = sessionRes.data.session?.user?.id ?? null;

        if (sessionRes.error || !sessionUserId) {
          throw new Error(
            'Your account was created, but your session could not be verified. Please sign in and submit your registration again.',
          );
        }

        activeUserId = sessionUserId;
      }

      if (!activeUserId) {
        throw new Error('Please sign in to submit your contractor registration.');
      }

      // Register / update profile via contractorService
      const result = await registerContractorProfile(
        activeUserId,
        {
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          location: location.trim(),
          skills: skills.trim(),
          years_of_experience: Number(yearsOfExperience),
          project_types: projectTypes.trim(),
          resume_file: resumeFile,
        },
        (progress) => setUploadProgress(progress)
      );

      await refreshProfile();
      setSuccessMessage(result.message);
    } catch (err: any) {
      console.error('[ContractorRegistration] Error:', err);
      setError(err.message || 'Failed to submit contractor registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      
      {/* Title Banner */}
      <div className="text-center mb-10 space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-terracotta-50 text-terracotta border border-terracotta-100">
          <Building2 className="w-3.5 h-3.5" /> Partner Portal
        </span>
        <h1 className="text-3xl md:text-4xl font-extrabold text-neutral-900 tracking-tight">
          Contractor Professional Registration
        </h1>
        <p className="text-neutral-500 font-light max-w-xl mx-auto text-sm leading-relaxed">
          Join BuildSmart AI's verified general contractor directory. Get matched directly with verified homeowners and receive milestone escrows.
        </p>
      </div>

      {/* Main Form Container */}
      <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 md:p-10 shadow-premium relative overflow-hidden">
        
        {/* Success Banner */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-8 p-6 rounded-2xl bg-emerald-50 border border-emerald-100 text-center space-y-3"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-emerald-900 text-lg">Registration Received!</h3>
              <p className="text-sm font-semibold text-emerald-700 max-w-md mx-auto">
                {successMessage}
              </p>
              <div className="pt-2 flex justify-center gap-3">
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('contractor-dash')}
                    className="px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold shadow-sm"
                  >
                    Open Contractor Portal
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-8 p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-700 text-sm font-semibold"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section 1: Contact & Business Credentials */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-terracotta" /> 1. Contact & Business Credentials
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 focus:border-terracotta text-sm text-neutral-800 font-semibold focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="rajesh@apexbuilders.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 focus:border-terracotta text-sm text-neutral-800 font-semibold focus:outline-none"
                    required
                    disabled={!!user}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Phone Number *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 focus:border-terracotta text-sm text-neutral-800 font-semibold focus:outline-none"
                    required
                  />
                </div>
              </div>

              {!user && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Account Password *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-terracotta text-sm text-neutral-800 font-semibold focus:outline-none"
                    required
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Operating Scope & Experience */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-2 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-terracotta" /> 2. Operating Scope & Experience
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Operating Location / City *</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g. Indiranagar, Bengaluru, Karnataka"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 focus:border-terracotta text-sm text-neutral-800 font-semibold focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Years of Experience *</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={yearsOfExperience}
                  onChange={e => setYearsOfExperience(e.target.value)}
                  placeholder="e.g. 15"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-terracotta text-sm text-neutral-800 font-semibold focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Primary Skills *</label>
                <div className="relative">
                  <Wrench className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={skills}
                    onChange={e => setSkills(e.target.value)}
                    placeholder="e.g. RCC Concrete Slabs, Masonry, Plumbing, Finishing"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 focus:border-terracotta text-sm text-neutral-800 font-semibold focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Project Types Handled *</label>
                <input
                  type="text"
                  value={projectTypes}
                  onChange={e => setProjectTypes(e.target.value)}
                  placeholder="e.g. Luxury Villas, Apartments, Commercial Buildings"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-terracotta text-sm text-neutral-800 font-semibold focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 3: Resume Upload to Supabase Storage */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-neutral-900 uppercase tracking-wider border-b border-neutral-100 pb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-terracotta" /> 3. Verification Resume / Portfolio Upload
            </h3>

            <div className="border-2 border-dashed border-neutral-200 hover:border-terracotta rounded-2xl p-6 text-center transition-colors bg-neutral-50/50">
              <input
                type="file"
                id="resumeUpload"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                className="hidden"
              />

              <label htmlFor="resumeUpload" className="cursor-pointer space-y-3 block">
                <div className="w-12 h-12 rounded-full bg-terracotta-50 text-terracotta flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-sm font-bold text-neutral-800 block">
                    {resumeFile ? resumeFile.name : 'Click to Upload Resume / Company Portfolio'}
                  </span>
                  <span className="text-xs text-neutral-400 font-light block mt-0.5">
                    Supports PDF, DOCX, JPG, PNG (Max 10 MB). Stored securely in `contractor-resumes` bucket.
                  </span>
                </div>
                {resumeFile && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <FileCheck className="w-3.5 h-3.5" /> {(resumeFile.size / 1024 / 1024).toFixed(2)} MB Attached
                  </span>
                )}
              </label>
            </div>
          </div>

          {/* Upload Progress Bar */}
          {loading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-neutral-600">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-terracotta" /> Uploading Profile & Resume...
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-terracotta transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">
              Default status: <strong className="text-amber-600 font-bold uppercase">PENDING Verification</strong>
            </span>

            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3.5 rounded-xl bg-terracotta hover:bg-terracotta-600 text-white font-extrabold text-sm shadow-premium hover:shadow-premium-hover transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  Submit Contractor Application <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
};
