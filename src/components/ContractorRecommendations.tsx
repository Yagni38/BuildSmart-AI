import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, ShieldCheck, Star, MapPin, Briefcase, Clock, 
  Award, Scale, Eye, CheckCircle2, AlertCircle, RefreshCw, X, Building2, Phone, Mail
} from 'lucide-react';
import { 
  getTop3ContractorRecommendations, 
  getAssignedContractorForProject,
  ContractorRecommendation, 
  ProjectRecommendationInput 
} from '../services/contractorRecommendationService';
import { ContractorSelectionModal } from './ContractorSelectionModal';
import { ContractorComparisonTable } from './ContractorComparisonTable';
import { assignContractorToProject } from '../services/projectService';

interface ContractorRecommendationsProps {
  projectData: ProjectRecommendationInput & { projectId?: string; name?: string };
  onSelectContractor?: (contractor: any) => void;
  onNavigate?: (page: string) => void;
}

export const ContractorRecommendations: React.FC<ContractorRecommendationsProps> = ({
  projectData,
  onSelectContractor,
  onNavigate
}) => {
  const [recommendations, setRecommendations] = useState<ContractorRecommendation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasFewerThan3, setHasFewerThan3] = useState<boolean>(false);
  const [noticeMessage, setNoticeMessage] = useState<string | undefined>();
  const [activeProfile, setActiveProfile] = useState<any | null>(null);

  // Selection state
  const [modalContractor, setModalContractor] = useState<any | null>(null);
  const [selectedContractor, setSelectedContractor] = useState<any | null>(null);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [assigning, setAssigning] = useState<boolean>(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await getTop3ContractorRecommendations(projectData);
      setRecommendations(res.recommendations);
      setHasFewerThan3(res.hasFewerThan3Approved);
      setNoticeMessage(res.message);
    } catch (err) {
      console.error('Error fetching contractor recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [projectData.location, projectData.buildingType, projectData.city]);

  /**
   * Restore the REAL assignment from Supabase (projects.contractor_id) so the
   * "Contractor Selected Successfully" state and the selected contractor
   * survive a page refresh / logout-login — never transient React state.
   */
  useEffect(() => {
    let cancelled = false;
    const projectId = projectData.projectId;

    if (!projectId) {
      setSelectedContractor(null);
      return;
    }

    (async () => {
      try {
        const assigned = await getAssignedContractorForProject(projectId);
        if (!cancelled) setSelectedContractor(assigned);
      } catch (err) {
        if (!cancelled) {
          console.warn('[ContractorRecommendations] assignment restore failed:', err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectData.projectId]);

  const handleConfirmSelection = async () => {
    if (!modalContractor || assigning) return;

    const contractorId = modalContractor.id || modalContractor.user_id;

    if (!contractorId) {
      setAssignmentError('This contractor has no database identity, so it cannot be assigned.');
      return;
    }

    if (!projectData.projectId) {
      setAssignmentError(
        'The project must be saved before a contractor can be assigned — please save the project and select again.'
      );
      return;
    }

    setAssigning(true);
    setAssignmentError(null);

    try {
      // Persist projects.contractor_id = the selected contractor_profiles.id.
      // The service throws when the row did not persist, so the banner below is
      // never shown for an assignment that is not actually in the database.
      await assignContractorToProject(projectData.projectId, contractorId);
    } catch (err) {
      setAssignmentError(err instanceof Error ? err.message : String(err));
      setAssigning(false);
      return;
    }

    setAssigning(false);

    setSelectedContractor(modalContractor);
    const chosen = modalContractor;
    setModalContractor(null);

    if (onSelectContractor) {
      onSelectContractor(chosen);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-56 bg-neutral-200 rounded animate-pulse" />
          <div className="h-4 w-24 bg-neutral-100 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-neutral-50 rounded-2xl border border-neutral-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-neutral-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-neutral-900 text-lg tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-terracotta animate-pulse" />
              AI-Assisted Contractor Matching
            </h3>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-terracotta-50 text-terracotta border border-terracotta-100">
              100-Pt Algorithm
            </span>
          </div>
          <p className="text-xs text-neutral-500 font-light mt-0.5">
            Evaluates location, project type, structural experience, and skills against admin-verified contractors.
          </p>
        </div>

        <button 
          onClick={fetchRecommendations}
          className="text-xs font-bold text-neutral-500 hover:text-terracotta flex items-center gap-1 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Re-evaluate
        </button>

        {/* Phase 5: side-by-side comparison toggle */}
        <button
          onClick={() => setCompareMode((v) => !v)}
          className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${compareMode ? 'bg-terracotta-50 text-terracotta border border-terracotta-200' : 'text-neutral-500 hover:text-terracotta hover:bg-neutral-50'}`}
        >
          <Scale className="w-3.5 h-3.5" />
          {compareMode ? 'List View' : 'Compare Side-by-Side'}
        </button>
      </div>

      {/* Selected Contractor Success Confirmation Card */}
      {selectedContractor && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 bg-emerald-50/90 border border-emerald-200 rounded-3xl space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              <div>
                <h3 className="font-extrabold text-emerald-950 text-base">Contractor Selected Successfully</h3>
                <p className="text-xs text-emerald-700 font-medium">Contract assignment initialized for your project.</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full border border-emerald-300">
              Assigned
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-emerald-100/80">
            <div>
              <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block">Selected Contractor</span>
              <strong className="text-xs text-neutral-900 font-extrabold block mt-0.5">
                {selectedContractor.owner || selectedContractor.full_name || 'Verified Contractor'}
              </strong>
            </div>

            <div>
              <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block">Company</span>
              <strong className="text-xs text-neutral-900 font-extrabold block mt-0.5">
                {selectedContractor.company || selectedContractor.company_name || 'BuildSmart Infra'}
              </strong>
            </div>

            <div>
              <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block">Verification Status</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified Contractor
              </span>
            </div>

            <div>
              <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block">Project Status</span>
              <strong className="text-xs text-terracotta font-extrabold block mt-0.5">
                Contractor Selected
              </strong>
            </div>
          </div>

          <div className="p-3 bg-emerald-100/60 rounded-xl border border-emerald-200/80 text-xs text-emerald-800 font-semibold flex items-center justify-between">
            <span>Contract assignment initialized. Assigned contractor will see this in their workspace.</span>
            {onNavigate && (
              <button 
                onClick={() => onNavigate('chat')}
                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold transition-colors ml-2 flex-shrink-0"
              >
                Open Project Chat
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Truthful assignment failure notice — replaces the success banner when
          the database write did not persist. */}
      {assignmentError && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Contractor assignment failed: {assignmentError}</span>
        </div>
      )}

      {/* Edge case notice when <3 approved contractors exist */}
      {hasFewerThan3 && noticeMessage && (
        <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* Phase 5: side-by-side comparison table */}
      {compareMode && recommendations.length > 0 && (
        <ContractorComparisonTable
          recommendations={recommendations}
          selectedContractor={selectedContractor}
          onSelectContractor={(c) => setModalContractor(c)}
        />
      )}

      {/* Recommended Contractor Cards */}
      {!compareMode && (<div className="space-y-4">
        {recommendations.map((rec, index) => {
          const c = rec.contractor;
          const isTopRank = index === 0;
          const isCurrentlySelected = selectedContractor && (selectedContractor.id === c.id || selectedContractor.id === c.user_id);

          return (
            <motion.div
              key={c.id || index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-5 rounded-3xl border transition-all duration-300 relative group flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                isCurrentlySelected
                  ? "bg-emerald-50/40 border-emerald-300 shadow-sm"
                  : isTopRank 
                  ? "bg-gradient-to-r from-terracotta-50/30 via-white to-emerald-50/20 border-terracotta-200 shadow-sm" 
                  : "bg-white border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <div className="flex items-start gap-4 flex-1">
                {/* Avatar Icon */}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-lg flex-shrink-0 border shadow-xs ${
                  isCurrentlySelected
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : isTopRank 
                    ? "bg-terracotta text-white border-terracotta" 
                    : "bg-neutral-100 text-neutral-700 border-neutral-200"
                }`}>
                  {c.company.charAt(0)}
                </div>

                <div className="space-y-1.5 flex-1">
                  {/* Rank & Verified Badge Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                      isCurrentlySelected
                        ? "bg-emerald-700 text-white"
                        : index === 0 
                        ? "bg-terracotta text-white shadow-xs" 
                        : index === 1 
                        ? "bg-neutral-900 text-white" 
                        : "bg-neutral-100 text-neutral-800"
                    }`}>
                      {isCurrentlySelected ? "Selected" : rec.rankLabel} ({rec.matchScore}% Match)
                    </span>

                    {c.verified && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified Contractor
                      </span>
                    )}
                  </div>

                  {/* Company & Owner */}
                  <div>
                    <h4 className="font-extrabold text-neutral-900 text-base group-hover:text-terracotta transition-colors">
                      {c.company}
                    </h4>
                    <p className="text-xs text-neutral-500 font-semibold flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-neutral-400" /> By {c.owner}
                    </p>
                  </div>

                  {/* Location & Experience details */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 font-medium">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-terracotta" /> {c.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" /> {c.yearsOfExperience} Yrs Exp
                    </span>
                    <span className="flex items-center gap-1 font-bold text-amber-600">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-current" /> {c.rating} ({c.reviewsCount})
                    </span>
                  </div>

                  {/* Skills badges */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {c.skills.slice(0, 3).map((skill, sIdx) => (
                      <span key={sIdx} className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 text-[10px] font-semibold">
                        {skill}
                      </span>
                    ))}
                    {c.skills.length > 3 && (
                      <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-500 text-[10px] font-semibold">
                        +{c.skills.length - 3} more
                      </span>
                    )}
                  </div>

                  {/* Why Recommended Rationale Box */}
                  <div className="mt-2.5 p-3 rounded-2xl bg-neutral-50 border border-neutral-100 text-xs font-medium text-neutral-700 leading-relaxed flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-terracotta flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-neutral-900 font-extrabold">Why Recommended: </strong>
                      <span className="font-light">{rec.whyRecommended}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto self-stretch md:self-center justify-end">
                <button
                  onClick={() => setActiveProfile(c)}
                  className="flex-1 md:flex-none px-4 py-2.5 rounded-xl border border-neutral-200 hover:border-terracotta text-neutral-700 hover:text-terracotta text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-white shadow-xs"
                >
                  <Eye className="w-3.5 h-3.5" /> View Profile
                </button>

                <button
                  onClick={() => setModalContractor(c)}
                  disabled={!c.verified}
                  title={c.verified ? 'Select this verified contractor' : 'Only verified contractors can be selected'}
                  className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
                    isCurrentlySelected
                      ? "bg-emerald-700 text-white"
                      : "bg-neutral-900 hover:bg-neutral-800 text-white"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {isCurrentlySelected ? "Selected" : "Select Contractor"}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
      )}

      {/* Confirmation Modal */}
      <ContractorSelectionModal
        isOpen={Boolean(modalContractor)}
        contractor={modalContractor}
        projectName={projectData.name || projectData.buildingType}
        onConfirm={handleConfirmSelection}
        onClose={() => setModalContractor(null)}
      />

      {/* View Profile Modal */}
      <AnimatePresence>
        {activeProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-neutral-200 space-y-5"
            >
              <div className="flex justify-between items-start border-b border-neutral-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-terracotta-50 text-terracotta border border-terracotta-100 flex items-center justify-center font-extrabold text-xl shadow-xs">
                    {activeProfile.company.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-neutral-900">
                      {activeProfile.company}
                    </h2>
                    <p className="text-xs font-semibold text-neutral-500">
                      Owned by {activeProfile.owner}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setActiveProfile(null)}
                  className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-neutral-700">
                <div className="p-3.5 rounded-2xl bg-neutral-50 space-y-1">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Location</span>
                  <p className="font-semibold">{activeProfile.location}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-neutral-50 space-y-1">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Experience</span>
                  <p className="font-semibold">{activeProfile.yearsOfExperience} Years</p>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <span className="font-bold text-neutral-700 uppercase tracking-wider block text-[10px]">Skills & Project Types</span>
                <p className="font-semibold text-terracotta bg-terracotta-50/40 p-3 rounded-xl border border-terracotta-100">
                  {activeProfile.skills.join(', ')}
                </p>
              </div>

              <div className="space-y-1 text-xs">
                <span className="font-bold text-neutral-700 uppercase tracking-wider block text-[10px]">Professional Overview</span>
                <p className="text-neutral-600 font-light leading-relaxed bg-neutral-50 p-3.5 rounded-xl border border-neutral-100">
                  {activeProfile.description}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100">
                <button
                  onClick={() => setActiveProfile(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-all"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    if (!activeProfile.verified) return;
                    const sel = activeProfile;
                    setActiveProfile(null);
                    setModalContractor(sel);
                  }}
                  disabled={!activeProfile.verified}
                  className="px-5 py-2 rounded-xl bg-terracotta hover:bg-terracotta-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" /> Select Contractor
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
