import React from 'react';
import {
  ShieldCheck, Clock, XCircle, ArrowRight, RefreshCw, Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isVerificationVerified, normalizeVerificationStatus, getOwnContractorVerification } from '../services/contractorService';

interface ContractorAccessGateProps {
  children: React.ReactNode;
  onNavigate?: (page: string) => void;
  areaLabel?: string;
}

/**
 * PHASE 4 - VERIFIED CONTRACTOR ACCESS CONTROL (UX layer).
 * Security boundary is the DATABASE: marketplace queries + RLS
 * return only VERIFIED rows, and verification_status is
 * admin-only (RLS WITH CHECK + self-approval trigger).
 * This gate reads the contractor's OWN status from Supabase
 * and renders the workspace or an informative status screen.
 */
/** Shared "checking" spinner used while auth/profile or DB status loads. */
const CheckingVerification: React.FC<{ label?: string }> = ({
  label = 'Checking your verification status...',
}) => (
  <div className="py-16 text-center">
    <Loader2 className="w-8 h-8 animate-spin text-terracotta mx-auto" />
    <p className="text-sm text-neutral-500 mt-3">{label}</p>
  </div>
);

export const ContractorAccessGate: React.FC<ContractorAccessGateProps> = ({
  children, onNavigate, areaLabel = 'Contractor Workspace',
}) => {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);
  // The LIVE public.profiles table has no verification_status column, so the
  // contractor's REAL status is read from their own contractor_profiles row
  // (owner-readable under RLS by email). Legacy installs that still carry
  // verification_status on profiles keep working via the fallback below.
  const [dbStatus, setDbStatus] = React.useState<string | null>(null);
  const [statusResolving, setStatusResolving] = React.useState(false);
  const userEmail = user?.email ?? null;

  const loadDbStatus = React.useCallback(async () => {
    if (!userEmail) {
      setDbStatus(null);
      return;
    }
    setStatusResolving(true);
    try {
      const result = await getOwnContractorVerification(userEmail);
      setDbStatus(result.status);
    } finally {
      setStatusResolving(false);
    }
  }, [userEmail]);

  React.useEffect(() => {
    void loadDbStatus();
  }, [loadDbStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshProfile(), loadDbStatus()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <CheckingVerification />;
  }

  if (!user || !profile) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="bg-white border border-neutral-200 rounded-3xl p-10 text-center space-y-4 shadow-premium">
          <ShieldCheck className="w-10 h-10 mx-auto text-neutral-300" />
          <h2 className="text-lg font-extrabold text-neutral-900">Sign in required</h2>
          <p className="text-sm text-neutral-500">Please sign in as a contractor to access {areaLabel}.</p>
          {onNavigate && (
            <button
              onClick={() => onNavigate('landing')}
              className="px-5 py-2.5 rounded-xl bg-terracotta text-white text-xs font-bold hover:bg-terracotta-600 transition-all inline-flex items-center gap-1.5"
            >
              Go to Sign In <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Legacy profiles column first (absent on the live schema → null), then the
  // real contractor_profiles row read above.
  const metaStatus = profile.verification_status ?? null;
  const status = metaStatus ?? dbStatus;

  // Do not flash the PENDING screen while the contractor_profiles read is in
  // flight — VERIFIED contractors must not briefly see "Verification Pending".
  if (metaStatus == null && dbStatus == null && statusResolving) {
    return <CheckingVerification />;
  }

  if (isVerificationVerified(status)) {
    return (
      <div className="space-y-4">
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800">
            <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>
              Verified contractor{profile.company_name ? ` - ${profile.company_name}` : ''} - you have
              access to {areaLabel} and customer project opportunities.
            </span>
          </div>
        </div>
        {children}
      </div>
    );
  }


  // PENDING / REJECTED — informative status screen, workspace withheld.
  // Case-insensitive so a lowercase 'rejected' in the DB still renders the
  // Rejected screen (Part 14: read the actual DB status, don't mislabel it).
  const rejected = normalizeVerificationStatus(status) === 'REJECTED';
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div
        className={`bg-white rounded-3xl p-10 text-center space-y-5 shadow-premium border ${
          rejected ? 'border-red-200' : 'border-amber-200'
        }`}
      >
        {rejected ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto">
              <XCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-extrabold text-neutral-900">Application Rejected</h2>
            <p className="text-sm text-neutral-500 max-w-md mx-auto font-light">
              Your contractor application was not approved by the admin team. You cannot access the
              verified contractor marketplace or customer project opportunities.
            </p>
            {profile.rejection_reason && (
              <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-left">
                <span className="text-[10px] font-extrabold text-red-400 uppercase tracking-wider block mb-1">
                  Rejection Reason
                </span>
                <p className="text-sm text-red-700 font-semibold leading-relaxed">
                  {profile.rejection_reason}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
              <Clock className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-extrabold text-neutral-900">
              Verification Pending
            </h2>
            <p className="text-sm text-neutral-500 max-w-md mx-auto font-light">
              Your application is waiting for administrator verification.
            </p>
          </>
        )}

        {/* Current DB status badge */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">
            Status in database:
          </span>
          <span
            className={`px-3 py-1 rounded-full text-[11px] font-extrabold border ${
              rejected
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {status || 'PENDING'}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="px-5 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 text-xs font-bold hover:border-terracotta hover:text-terracotta transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={'w-3.5 h-3.5 ' + (refreshing ? 'animate-spin' : '')} />
            Refresh Status
          </button>
          {onNavigate && (
            <button
              onClick={() => onNavigate('contractor-registration')}
              className="px-5 py-2.5 rounded-xl bg-terracotta text-white text-xs font-bold hover:bg-terracotta-600 transition-all inline-flex items-center gap-1.5"
            >
              {rejected ? 'Re-submit Application' : 'View Registration'}{' '}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

