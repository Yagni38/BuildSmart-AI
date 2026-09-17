import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, MapPin, Clock, Star, AlertCircle, RefreshCw, CheckCircle2, X } from 'lucide-react';

interface ContractorSelectionModalProps {
  isOpen: boolean;
  contractor: any | null;
  projectName?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export const ContractorSelectionModal: React.FC<ContractorSelectionModalProps> = ({
  isOpen,
  contractor,
  projectName,
  onConfirm,
  onClose
}) => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !contractor) return null;

  const companyName = contractor.company || contractor.company_name || 'Verified Contractor';
  const ownerName = contractor.owner || contractor.full_name || 'Verified Contractor';
  const location = contractor.location || 'Bengaluru, KA';
  const matchScore = contractor.matchScore || contractor.match_score || 95;
  const experience = contractor.experience || contractor.yearsOfExperience || contractor.years_of_experience || 5;

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err: any) {
      console.error('Error confirming contractor selection:', err);
      setError(err?.message || 'Failed to confirm contractor selection.');
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-6"
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-terracotta-50 text-terracotta border border-terracotta-100 flex items-center justify-center font-extrabold text-xl shadow-xs">
                {companyName.charAt(0)}
              </div>
              <div>
                <h2 className="text-base font-extrabold text-neutral-900">
                  Select this contractor for your project?
                </h2>
                {projectName && (
                  <p className="text-xs font-semibold text-terracotta mt-0.5">
                    Project: {projectName}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={submitting}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contractor Details */}
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-neutral-900 text-sm">{companyName}</h3>
                <p className="text-xs text-neutral-500 font-semibold">Owned by {ownerName}</p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified Contractor
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs text-neutral-700 font-medium pt-2 border-t border-neutral-200/60">
              <div className="p-2 bg-white rounded-xl border border-neutral-100">
                <span className="text-[9px] text-neutral-400 font-bold block uppercase">Match Score</span>
                <strong className="text-emerald-700 font-extrabold text-sm">{matchScore}%</strong>
              </div>
              <div className="p-2 bg-white rounded-xl border border-neutral-100">
                <span className="text-[9px] text-neutral-400 font-bold block uppercase">Experience</span>
                <strong className="text-neutral-800 font-bold text-xs">{experience} Yrs</strong>
              </div>
              <div className="p-2 bg-white rounded-xl border border-neutral-100">
                <span className="text-[9px] text-neutral-400 font-bold block uppercase">Location</span>
                <strong className="text-neutral-800 font-semibold text-[11px] truncate block">{location}</strong>
              </div>
            </div>
          </div>

          {/* Phase 5: previous-project context */}
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-3">
            <span className="font-bold text-neutral-700 uppercase tracking-wider block text-[10px]">Previous Project Context</span>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-white rounded-xl border border-neutral-100">
                <span className="text-[9px] text-neutral-400 font-bold block uppercase">Projects Completed</span>
                <strong className="text-neutral-800 font-extrabold text-xs">{contractor.projectsCompleted || contractor.projects || 28}</strong>
              </div>
              <div className="p-2 bg-white rounded-xl border border-neutral-100">
                <span className="text-[9px] text-neutral-400 font-bold block uppercase">Warranty</span>
                <strong className="text-emerald-700 font-extrabold text-xs">{contractor.warranty || 10} yrs</strong>
              </div>
              <div className="p-2 bg-white rounded-xl border border-neutral-100">
                <span className="text-[9px] text-neutral-400 font-bold block uppercase">Avg. Price Estimate</span>
                <strong className="text-neutral-800 font-extrabold text-xs">₹{contractor.priceEstimate || 42.5} Lakhs</strong>
              </div>
            </div>
          </div>

          {/* Error notice */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions: [Confirm Selection], [Cancel] */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-all disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleConfirm}
              disabled={submitting || !contractor.verified}
              className="px-6 py-2.5 rounded-xl bg-terracotta hover:bg-terracotta-600 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-sm disabled:opacity-60"
            >
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-white" />
              )}
              {submitting ? 'Assigning...' : 'Confirm Selection'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
