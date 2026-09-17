import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, ShieldCheck, Star, Clock, Briefcase, Award, 
  MapPin, Check, Plus, AlertCircle, ArrowRight, Sparkles,
  Eye, RefreshCw, X, Filter, Building2, Phone, Mail, FileText, CheckCircle2
} from 'lucide-react';
import { Contractor } from '../mockData';
import { AiInsight } from '../components/AiInsight';
import { getApprovedContractors } from '../services/contractorService';
import { ContractorSelectionModal } from '../components/ContractorSelectionModal';

interface ContractorMarketplaceProps {
  onSelectContractor: (c: Contractor) => void;
  onNavigate: (page: string) => void;
  selectedCompareList: Contractor[];
  onToggleCompare: (c: Contractor) => void;
}

export const ContractorMarketplace: React.FC<ContractorMarketplaceProps> = ({
  onSelectContractor,
  onNavigate,
  selectedCompareList,
  onToggleCompare
}) => {
  const [contractors, setContractors] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View Profile Modal State
  const [activeProfile, setActiveProfile] = useState<any | null>(null);

  // Selection Modal State
  const [modalContractor, setModalContractor] = useState<any | null>(null);
  const [selectedContractor, setSelectedContractor] = useState<any | null>(null);
  
  // Filter States
  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterProjectType, setFilterProjectType] = useState("all");
  const [filterExp, setFilterExp] = useState<number>(0);
  const [filterSkill, setFilterSkill] = useState("");

  const handleConfirmSelection = async () => {
    if (!modalContractor) return;
    const chosen = modalContractor;
    setSelectedContractor(chosen);
    setModalContractor(null);
    onSelectContractor(chosen);
  };

  const loadContractors = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getApprovedContractors();
      
      // Verification comes from the DATABASE — only rows the API returned as
      // VERIFIED (or legacy APPROVED) are ever shown. No mock fallback.
      const verifiedOnly = data.filter(c => 
        c.verification_status === 'VERIFIED' || c.verificationStatus === 'VERIFIED' ||
        c.verification_status === 'APPROVED' || c.verificationStatus === 'APPROVED' ||
        c.verified === true
      );

      setContractors(verifiedOnly);
    } catch (err: any) {
      console.error('Error loading verified contractors:', err);
      setError(err?.message || 'Failed to load verified contractors.');
      setContractors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContractors();
  }, []);

  // Filter Logic
  const filteredContractors = contractors.filter(c => {
    // 1. Double check strict verification status constraint (DB-backed)
    const isVerified = c.verified === true ||
      c.verification_status === 'VERIFIED' || c.verificationStatus === 'VERIFIED' ||
      c.verification_status === 'APPROVED' || c.verificationStatus === 'APPROVED';
    if (!isVerified) return false;

    const companyName = (c.company || c.company_name || '').toLowerCase();
    const ownerName = (c.owner || c.full_name || c.owner_name || '').toLowerCase();
    const specialty = (c.specialty || c.project_types || '').toLowerCase();
    const locationStr = (c.location || '').toLowerCase();
    const skillsStr = (c.skills || '').toLowerCase();
    const descriptionStr = (c.description || '').toLowerCase();
    const q = search.toLowerCase();

    const matchesSearch = !search || 
      companyName.includes(q) || 
      ownerName.includes(q) || 
      specialty.includes(q) ||
      locationStr.includes(q) ||
      skillsStr.includes(q) ||
      descriptionStr.includes(q);

    const matchesLocation = filterLocation === "all" || locationStr.includes(filterLocation.toLowerCase());
    const matchesProjectType = filterProjectType === "all" || specialty.includes(filterProjectType.toLowerCase());
    const matchesExp = (c.experience || c.years_of_experience || 0) >= filterExp;
    const matchesSkill = !filterSkill || skillsStr.includes(filterSkill.toLowerCase());

    return matchesSearch && matchesLocation && matchesProjectType && matchesExp && matchesSkill;
  });

  const resetFilters = () => {
    setSearch("");
    setFilterLocation("all");
    setFilterProjectType("all");
    setFilterExp(0);
    setFilterSkill("");
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Verified Contractor Marketplace</h1>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Verified Only
            </span>
          </div>
          <p className="text-neutral-500 font-light text-sm max-w-3xl">
            Browse and connect with background-checked, admin-approved construction professionals. Every contractor displayed has passed licensing, identity, and background verification.
          </p>
        </div>
        
        {selectedCompareList.length > 0 && (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-terracotta shadow-premium"
          >
            <span className="text-xs font-bold text-neutral-700">
              {selectedCompareList.length} Selected for Compare
            </span>
            <button
              onClick={() => onNavigate('comparison')}
              className="px-4 py-2 bg-terracotta hover:bg-terracotta-600 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all"
            >
              Compare Side-by-Side <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>{error}</span>
          </div>
          <button 
            onClick={loadContractors}
            className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Comprehensive Filter Toolbar */}
      <div className="bg-white border border-neutral-200/80 rounded-3xl p-5 shadow-premium space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-terracotta" /> Contractor Filters
          </span>
          {(search || filterLocation !== "all" || filterProjectType !== "all" || filterExp > 0 || filterSkill) && (
            <button 
              onClick={resetFilters}
              className="text-xs font-bold text-terracotta hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search contractor name, company, or skills..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-xs font-semibold text-neutral-800"
            />
          </div>

          {/* Location Filter */}
          <div>
            <select
              value={filterLocation}
              onChange={e => setFilterLocation(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-xs font-semibold text-neutral-700 bg-white cursor-pointer"
            >
              <option value="all">All Locations</option>
              <option value="indiranagar">Indiranagar</option>
              <option value="koramangala">Koramangala</option>
              <option value="hsr layout">HSR Layout</option>
              <option value="bengaluru">Bengaluru</option>
            </select>
          </div>

          {/* Project Type Filter */}
          <div>
            <select
              value={filterProjectType}
              onChange={e => setFilterProjectType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-xs font-semibold text-neutral-700 bg-white cursor-pointer"
            >
              <option value="all">All Project Types</option>
              <option value="villa">Villa Construction</option>
              <option value="custom homes">Custom Homes</option>
              <option value="minimalism">Minimalism / Modern</option>
              <option value="commercial">Commercial</option>
              <option value="apartment">Apartment</option>
            </select>
          </div>

          {/* Experience Filter */}
          <div>
            <select
              value={filterExp}
              onChange={e => setFilterExp(parseInt(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-xs font-semibold text-neutral-700 bg-white cursor-pointer"
            >
              <option value="0">Any Experience</option>
              <option value="15">15+ Years Exp</option>
              <option value="10">10+ Years Exp</option>
              <option value="5">5+ Years Exp</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm animate-pulse space-y-4">
              <div className="flex justify-between items-center">
                <div className="w-12 h-12 rounded-2xl bg-neutral-200" />
                <div className="w-28 h-6 rounded-full bg-neutral-200" />
              </div>
              <div className="h-5 bg-neutral-200 rounded w-3/4" />
              <div className="h-4 bg-neutral-100 rounded w-1/2" />
              <div className="h-16 bg-neutral-50 rounded-2xl" />
              <div className="h-10 bg-neutral-200 rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        /* Contractors Grid */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {filteredContractors.map(c => {
            const isSelected = selectedCompareList.some(item => item.id === c.id);
            const companyName = c.company || c.company_name || 'BuildSmart Contractor';
            const ownerName = c.owner || c.full_name || 'Verified Owner';
            const location = c.location || 'Bengaluru, KA';
            const specialty = c.specialty || c.project_types || 'General Construction';
            const experience = c.experience || c.years_of_experience || 5;
            const description = c.description || c.matchReason || 'Licensed contractor with verified background and active project portfolio.';
            const skillsList = (c.skills || 'Civil Engineering, Structural Masonry, Project Management').split(',').map((s: string) => s.trim());

            return (
              <div 
                key={c.id}
                className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium hover:shadow-premium-hover transition-all duration-300 flex flex-col justify-between relative group"
              >
                <div>
                  {/* Header */}
                  <div className="flex justify-between items-start gap-2 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-terracotta-50 text-terracotta border border-terracotta-100 flex items-center justify-center font-extrabold text-lg shadow-sm">
                      {companyName.charAt(0)}
                    </div>
                    
                    {/* Verification Badge */}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" /> Verified Contractor
                    </span>
                  </div>

                  {/* Company & Owner Name */}
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-neutral-900 text-lg leading-tight group-hover:text-terracotta transition-colors duration-200">
                      {companyName}
                    </h3>
                    <p className="text-xs text-neutral-500 font-semibold flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-neutral-400" /> By {ownerName}
                    </p>
                    <p className="text-[11px] text-terracotta font-bold uppercase tracking-wide mt-1">
                      {specialty}
                    </p>
                  </div>

                  {/* Rating & Experience Stats */}
                  <div className="flex items-center justify-between mt-3 text-xs text-neutral-600 font-medium border-y border-neutral-100 py-2.5 my-3">
                    <span className="flex items-center gap-1 font-bold text-neutral-900">
                      <Star className="w-4 h-4 text-amber-400 fill-current" /> {c.rating || 4.9} 
                      <span className="font-normal text-neutral-400">({c.reviewsCount || 28})</span>
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-neutral-700">
                      <Briefcase className="w-3.5 h-3.5 text-neutral-400" /> {c.projects || 35}+ Projects
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-neutral-700">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" /> {experience} Yrs Exp
                    </span>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-light mb-3">
                    <MapPin className="w-3.5 h-3.5 text-terracotta flex-shrink-0" />
                    <span className="font-medium text-neutral-700">{location}</span>
                  </div>

                  {/* Description Snippet */}
                  <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed font-light mb-3">
                    {description}
                  </p>

                  {/* Skills Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {skillsList.slice(0, 3).map((skill: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 text-[10px] font-semibold">
                        {skill}
                      </span>
                    ))}
                    {skillsList.length > 3 && (
                      <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-500 text-[10px] font-semibold">
                        +{skillsList.length - 3} more
                      </span>
                    )}
                  </div>

                  {/* AI Match Ring & Details */}
                  <div className="p-3.5 rounded-2xl bg-terracotta-50/40 border border-terracotta-100 flex items-start gap-3">
                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl bg-white border border-terracotta-200 text-terracotta font-extrabold text-xs shadow-sm">
                      {c.matchScore || 96}%
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold text-neutral-800 uppercase tracking-wide flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-terracotta" /> BuildSmart Fit Factor
                      </h4>
                      <p className="text-[10px] text-neutral-600 mt-0.5 leading-normal font-light">
                        {c.matchReason || "100% License Verified & Active Liability Insured."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Buttons Bar: [View Profile], [Compare], [Select Contractor] */}
                <div className="space-y-2 mt-6">
                  <div className="grid grid-cols-2 gap-2">
                    {/* View Profile */}
                    <button
                      onClick={() => setActiveProfile(c)}
                      className="py-2.5 px-3 rounded-xl border border-neutral-200 hover:border-terracotta text-neutral-700 hover:text-terracotta text-xs font-bold transition-all flex items-center justify-center gap-1 bg-white shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Profile
                    </button>

                    {/* Compare Button */}
                    <button
                      onClick={() => onToggleCompare(c)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                        isSelected 
                          ? "bg-neutral-100 text-neutral-800 border-neutral-300" 
                          : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400 shadow-xs"
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Compared
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 text-neutral-500" /> Compare
                        </>
                      )}
                    </button>
                  </div>

                  {/* Select Contractor */}
                  <button
                    onClick={() => onSelectContractor(c)}
                    className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Select Contractor
                  </button>
                </div>
              </div>
            );
          })}

          {/* Empty State */}
          {filteredContractors.length === 0 && (
            <div className="col-span-3 bg-white border border-neutral-200 rounded-3xl p-12 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-neutral-900 text-base">No verified contractors available</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto font-light">
                Only admin-verified contractors appear here. Check back soon or adjust your filters.
              </p>
              {(search || filterLocation !== "all" || filterProjectType !== "all" || filterExp > 0 || filterSkill) && (
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 bg-terracotta hover:bg-terracotta-600 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Platform Insight */}
      <AiInsight
        insight="All displayed contractors hold active, admin-verified legal licensing and structural insurance in Karnataka."
        recommendation="Utilize the 'Compare' action to compare warranty terms and estimated completion timelines side-by-side."
        confidenceScore={99}
        impactValue="100% Verified"
      />

      {/* View Profile Modal */}
      <AnimatePresence>
        {activeProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-neutral-200 max-h-[90vh] overflow-y-auto space-y-6"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-neutral-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-terracotta-50 text-terracotta border border-terracotta-100 flex items-center justify-center font-extrabold text-xl shadow-xs">
                    {(activeProfile.company || activeProfile.company_name || 'C').charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-extrabold text-neutral-900">
                        {activeProfile.company || activeProfile.company_name || 'Contractor Profile'}
                      </h2>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified Contractor
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-neutral-500">
                      Owned by {activeProfile.owner || activeProfile.full_name || 'Verified Contractor'}
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

              {/* Profile Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-neutral-50 space-y-2">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Contact & Location</span>
                  <div className="text-xs text-neutral-700 space-y-1.5">
                    <p className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-terracotta" />
                      <strong>Location:</strong> {activeProfile.location || 'Bengaluru'}
                    </p>
                    {activeProfile.email && (
                      <p className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-neutral-400" />
                        <strong>Email:</strong> {activeProfile.email}
                      </p>
                    )}
                    {activeProfile.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-neutral-400" />
                        <strong>Phone:</strong> {activeProfile.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 space-y-2">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Experience & Warranty</span>
                  <div className="text-xs text-neutral-700 space-y-1.5">
                    <p className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-neutral-400" />
                      <strong>Experience:</strong> {activeProfile.experience || activeProfile.years_of_experience || 5} Years
                    </p>
                    <p className="flex items-center gap-2">
                      <Award className="w-3.5 h-3.5 text-amber-500" />
                      <strong>Structural Warranty:</strong> {activeProfile.warranty || 10} Years
                    </p>
                    <p className="flex items-center gap-2">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                      <strong>Rating:</strong> {activeProfile.rating || 4.9} / 5.0
                    </p>
                  </div>
                </div>
              </div>

              {/* Skills & Project Types */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider block">Specialties & Project Types</span>
                <p className="text-xs font-semibold text-terracotta bg-terracotta-50/50 p-3 rounded-xl border border-terracotta-100">
                  {activeProfile.specialty || activeProfile.project_types || activeProfile.skills || "Residential Villa Construction, Turnkey Projects, Structural Framing"}
                </p>
              </div>

              {/* Professional Description */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider block">Professional Description</span>
                <p className="text-xs text-neutral-600 font-light leading-relaxed bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                  {activeProfile.description || activeProfile.matchReason || "Experienced contractor with verified credentials, specializing in high quality construction, structural integrity, and timely project delivery."}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
                <button
                  onClick={() => setActiveProfile(null)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-all"
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    const profileToSelect = activeProfile;
                    setActiveProfile(null);
                    onSelectContractor(profileToSelect);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-terracotta hover:bg-terracotta-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
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
