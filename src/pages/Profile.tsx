import React, { useEffect, useState } from 'react';
import {
  User, Settings, ShieldCheck, CreditCard, Bell,
  Loader2, CheckCircle2, AlertCircle, Briefcase, MapPin, RefreshCw,
} from 'lucide-react';
import { AiInsight } from '../components/AiInsight';
import { useAuth } from '../context/AuthContext';
import { updateProfile, UpdateProfileData } from '../services/profileService';
import { isVerificationVerified, updateOwnContractorProfile } from '../services/contractorService';

const inputStyle =
  'w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta transition-colors font-medium text-neutral-800 text-sm bg-white';

export const Profile: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();

  // Editable fields — a safe subset of the public.profiles row.
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Contractor-specific editable fields (Phase 14) — these live on the LIVE
  // public.contractor_profiles table (location, skills, experience_years,
  // project_types). company_name / description do NOT exist on either live
  // table, so they are no longer collected.
  const [yearsExp, setYearsExp] = useState('');
  const [skills, setSkills] = useState('');
  const [location, setLocation] = useState('');
  const [projectTypes, setProjectTypes] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync the form whenever the real profile (re)loads from Supabase.
  // AuthContext merges the contractor's own contractor_profiles row into the
  // profile, so these fields show REAL database values.
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setPhone(profile.phone ?? '');
      setCity(profile.city ?? '');
      setState(profile.state ?? '');
      // Contractor fields (Phase 14 — merged from contractor_profiles)
      setYearsExp(profile.years_of_experience != null ? String(profile.years_of_experience) : '');
      setSkills(profile.skills ?? '');
      setLocation(profile.location ?? '');
      setProjectTypes(profile.project_types ?? '');
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || saving) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // 1) Base account fields → public.profiles (live columns only:
      //    full_name, phone, city, state).
      const updates: Record<string, unknown> = {
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
      };

      await updateProfile(profile.id, updates as UpdateProfileData);

      // 2) PHASE 1: contractor professional details → the contractor's OWN
      //    public.contractor_profiles row (live columns: location, skills,
      //    experience_years, project_types). Sending these to public.profiles
      //    used to crash with PGRST204 — those columns do not exist there.
      if (profile.role === 'CONTRACTOR') {
        const exp = Number(yearsExp);
        await updateOwnContractorProfile(profile.email, {
          location: location.trim() || null,
          skills: skills.trim() || null,
          project_types: projectTypes.trim() || null,
          experience_years:
            yearsExp.trim() !== '' && Number.isFinite(exp) && exp >= 0
              ? Math.floor(exp)
              : null,
        });
      }

      // Reload the profile into AuthContext so the rest of the app
      // (greetings, role routing, etc.) reflects the change immediately.
      await refreshProfile();

      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('[Profile] Save failed:', err?.message);
      setSaveError(err?.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // No authenticated user/profile yet — show a neutral loading state.
  if (!user || !profile) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-terracotta mx-auto" />
        <p className="text-sm text-neutral-500 mt-3">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-6 px-4">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Account & Security</h1>
        <p className="text-neutral-500 font-light mt-1">
          Manage payment credentials, security protocols, settings, and contractor ratings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        
        {/* Left Settings Sidebar */}
        <div className="md:col-span-1 bg-white border border-neutral-200/80 rounded-3xl p-5 shadow-premium space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-terracotta-50/50 border border-terracotta-100 mb-2">
            <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-extrabold text-sm flex-shrink-0">
              {(profile.full_name || profile.email).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-neutral-900 truncate">
                {profile.full_name || 'BuildSmart User'}
              </p>
              <p className="text-[10px] font-semibold text-terracotta uppercase tracking-wide">
                {profile.role}
              </p>
            </div>
          </div>
          <button className="w-full text-left p-3 rounded-xl bg-terracotta-50/50 border border-terracotta-100 text-terracotta font-bold text-xs flex items-center gap-2">
            <User className="w-4 h-4" /> Personal Information
          </button>
          <button className="w-full text-left p-3 rounded-xl text-neutral-500 hover:bg-neutral-50 font-semibold text-xs flex items-center gap-2 transition-colors">
            <CreditCard className="w-4 h-4" /> Billing & Payments
          </button>
          <button className="w-full text-left p-3 rounded-xl text-neutral-500 hover:bg-neutral-50 font-semibold text-xs flex items-center gap-2 transition-colors">
            <Bell className="w-4 h-4" /> System Notifications
          </button>
          <button className="w-full text-left p-3 rounded-xl text-neutral-500 hover:bg-neutral-50 font-semibold text-xs flex items-center gap-2 transition-colors">
            <Settings className="w-4 h-4" /> Account Settings
          </button>
        </div>

        {/* Right Settings Details */}
        <div className="md:col-span-2 bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-6">
          <h2 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3">
            Personal Information
          </h2>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-neutral-400 font-bold uppercase block mb-2">Full Name</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className={inputStyle}
                />
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 font-bold uppercase block mb-2">Email Address</span>
                <input
                  type="email"
                  value={profile.email}
                  readOnly
                  className={`${inputStyle} bg-neutral-50 text-neutral-500 cursor-not-allowed`}
                />
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 font-bold uppercase block mb-2">Phone Number</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 ..."
                  className={inputStyle}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block mb-2">City</span>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className={inputStyle}
                  />
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block mb-2">State</span>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    className={inputStyle}
                  />
                </div>
              </div>
</div>

              {/* Role (read-only display) */}
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block mb-1">Role</span>
                  <p className="font-semibold text-neutral-900">{profile.role}</p>
                </div>
                <span className="text-[9px] text-neutral-400 italic">
                  Role is managed by the administrator.
                </span>
              </div>

              {/* Contractor professional details — editable (Phase 14) */}
              {profile.role === 'CONTRACTOR' && (
                <div className="pt-4 border-t border-neutral-100">
                  <h3 className="text-sm font-bold text-neutral-900 mb-3 border-b border-neutral-100 pb-2">
                    Professional Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-neutral-400 font-bold uppercase block mb-2">Years of Experience</span>
                      <input type="number" min={0} value={yearsExp} onChange={(e) => setYearsExp(e.target.value)} placeholder="e.g. 10" className={inputStyle} />
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[10px] text-neutral-400 font-bold uppercase block mb-2">Skills</span>
                      <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. Masonry, Electrical, Plumbing" className={inputStyle} />
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 font-bold uppercase block mb-2">Operating Location</span>
                      <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Bengaluru, Karnataka" className={inputStyle} />
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 font-bold uppercase block mb-2">Project Types</span>
                      <input type="text" value={projectTypes} onChange={(e) => setProjectTypes(e.target.value)} placeholder="e.g. Villas, Apartments, Renovations" className={inputStyle} />
                    </div>
                  </div>
                </div>
              )}

            {saveError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-700">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                Profile updated successfully.
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-neutral-100">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-terracotta hover:bg-terracotta-600 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Save Changes
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Contractor verification block — visible only to contractor accounts */}
          {profile.role === 'CONTRACTOR' && (
            <>
              <h2 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3 pt-4">
                Contractor Verification
              </h2>

              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  profile.verification_status === 'APPROVED'
                    ? 'bg-emerald-50/50 border-emerald-100'
                    : profile.verification_status === 'REJECTED'
                      ? 'bg-red-50/50 border-red-100'
                      : 'bg-amber-50/50 border-amber-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  {profile.verification_status === 'APPROVED' ? (
                    <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  ) : profile.verification_status === 'REJECTED' ? (
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  ) : (
                    <RefreshCw className="w-6 h-6 text-amber-600" />
                  )}
                  <div>
                    <h4 className="font-bold text-neutral-800 text-xs">
                      {(profile.verification_status === 'VERIFIED' || profile.verification_status === 'APPROVED')
                        ? 'Verification Approved'
                        : profile.verification_status === 'REJECTED'
                          ? 'Verification Rejected'
                          : 'Verification Pending Review'}
                    </h4>
                    <p className="text-[10px] text-neutral-500 mt-0.5 leading-normal">
                      {isVerificationVerified(profile.verification_status)
                        ? 'Your contractor profile is live in the marketplace.'
                        : profile.verification_status === 'REJECTED'
                          ? (profile.rejection_reason || 'Your application was rejected. Contact support for details.')
                          : 'An administrator is reviewing your registration documents.'}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded flex-shrink-0 ${
                    isVerificationVerified(profile.verification_status)
                      ? 'text-emerald-700 bg-emerald-100/50'
                      : profile.verification_status === 'REJECTED'
                        ? 'text-red-700 bg-red-100/50'
                        : 'text-amber-700 bg-amber-100/50'
                  }`}
                >
                  {isVerificationVerified(profile.verification_status) ? (
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified
                    </span>
                  ) : (
                    profile.verification_status || 'PENDING'
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">Experience</span>
                  <strong className="text-sm text-neutral-800 font-semibold">
                    {profile.years_of_experience ?? 0} years
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">Skills</span>
                  <strong className="text-sm text-neutral-800 font-semibold">{profile.skills || '—'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase block">Location</span>
                  <strong className="text-sm text-neutral-800 font-semibold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-terracotta" />
                    {profile.location || '—'}
                  </strong>
                </div>
              </div>
            </>
          )}

          <h2 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3 pt-4">
            Escrow Account Status
          </h2>

          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <div>
                <h4 className="font-bold text-neutral-800 text-xs">Escrow Funding Active</h4>
                <p className="text-[10px] text-neutral-500 mt-0.5 leading-normal">
                  SBI Escrow account #9082 linked. Funds released only upon photo verification of milestones.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100/50 px-2.5 py-1 rounded">
              Verified
            </span>
          </div>
        </div>

      </div>

      <AiInsight
        insight="Your payments escrow link is configured with a double-sign verification security check."
        recommendation="Enable SMS milestones triggers to immediately release vendor cement payouts once daily supervisor photo logs are approved."
        confidenceScore={99}
        impactValue="Secure Escrow Setup"
      />
    </div>
  );
};
