import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, ShieldCheck, Star, Clock, Briefcase, Award, 
  MapPin, Check, Plus, AlertCircle, ArrowRight, Sparkles 
} from 'lucide-react';
import { INITIAL_CONTRACTORS, Contractor } from '../mockData';
import { AiInsight } from '../components/AiInsight';

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
  const [contractors] = useState<Contractor[]>(INITIAL_CONTRACTORS);
  
  // Filter States
  const [search, setSearch] = useState("");
  const [filterRating, setFilterRating] = useState<number>(0);
  const [filterExp, setFilterExp] = useState<number>(0);

  const filteredContractors = contractors.filter(c => {
    const matchesSearch = c.company.toLowerCase().includes(search.toLowerCase()) || 
                          c.specialty.toLowerCase().includes(search.toLowerCase()) ||
                          c.location.toLowerCase().includes(search.toLowerCase());
    const matchesRating = c.rating >= filterRating;
    const matchesExp = c.experience >= filterExp;
    return matchesSearch && matchesRating && matchesExp;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Contractor Marketplace</h1>
          <p className="text-neutral-500 font-light mt-1">
            Browse premium, background-verified general contractors. AI matches compatibility based on historical timelines and styling specialties.
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

      {/* Filter Toolbar */}
      <div className="bg-white border border-neutral-200/80 rounded-3xl p-5 shadow-premium grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        {/* Search */}
        <div className="relative col-span-1 md:col-span-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by company, location, or architectural specialty..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-sm font-semibold text-neutral-800"
          />
        </div>

        {/* Rating filter */}
        <div>
          <select
            value={filterRating}
            onChange={e => setFilterRating(parseFloat(e.target.value))}
            className="w-full px-3.5 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-sm font-semibold text-neutral-600 bg-white cursor-pointer"
          >
            <option value="0">All Star Ratings</option>
            <option value="4.8">4.8★ and above</option>
            <option value="4.6">4.6★ and above</option>
            <option value="4.5">4.5★ and above</option>
          </select>
        </div>

        {/* Experience filter */}
        <div>
          <select
            value={filterExp}
            onChange={e => setFilterExp(parseInt(e.target.value))}
            className="w-full px-3.5 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-sm font-semibold text-neutral-600 bg-white cursor-pointer"
          >
            <option value="0">Any Experience</option>
            <option value="15">15+ Years</option>
            <option value="10">10+ Years</option>
            <option value="5">5+ Years</option>
          </select>
        </div>
      </div>

      {/* Contractors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {filteredContractors.map(c => {
          const isSelected = selectedCompareList.some(item => item.id === c.id);
          return (
            <div 
              key={c.id}
              className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium hover:shadow-premium-hover transition-all duration-300 flex flex-col justify-between relative group"
            >
              <div>
                {/* Header */}
                <div className="flex justify-between items-start gap-2 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-50 text-terracotta border border-neutral-100 flex items-center justify-center font-extrabold text-lg">
                    {c.company.charAt(0)}
                  </div>
                  
                  {c.verified && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> VERIFIED VENDOR
                    </span>
                  )}
                </div>

                {/* Company Name & Specialty */}
                <div className="space-y-1">
                  <h3 className="font-bold text-neutral-900 text-lg leading-tight group-hover:text-terracotta transition-colors duration-200">
                    {c.company}
                  </h3>
                  <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wide">
                    {c.specialty}
                  </p>
                </div>

                {/* Rating details */}
                <div className="flex items-center gap-3.5 mt-3 text-xs text-neutral-500 font-medium border-y border-neutral-50 py-2.5 my-3">
                  <span className="flex items-center gap-1 font-bold text-neutral-800">
                    <Star className="w-4 h-4 text-amber-400 fill-current" /> {c.rating} 
                    <span className="font-normal text-neutral-400">({c.reviewsCount} reviews)</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-4 h-4 text-neutral-400" /> {c.projects} projects
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-neutral-400" /> {c.experience} yrs exp
                  </span>
                </div>

                {/* Location & Response times */}
                <div className="space-y-2 text-xs text-neutral-500 font-light leading-relaxed">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-neutral-400" /> {c.location}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-neutral-400" /> Responses: <strong className="font-semibold text-neutral-700">{c.responseTime}</strong>
                  </div>
                </div>

                {/* AI Match ring & details */}
                <div className="mt-4 p-4 rounded-2xl bg-terracotta-50/30 border border-terracotta-100/50 flex items-start gap-3">
                  <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-terracotta-100 text-terracotta font-extrabold text-xs shadow-sm">
                    {c.matchScore}%
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold text-neutral-800 uppercase tracking-wide flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-terracotta animate-pulse" /> AI Fit Factor
                    </h4>
                    <p className="text-[10px] text-neutral-500 mt-0.5 leading-normal font-light">
                      {c.matchReason}
                    </p>
                  </div>
                </div>

                {/* Cost/Timeline Estimate details */}
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-100">
                  <div>
                    <span className="text-[10px] text-neutral-400 block font-semibold">Starting Price</span>
                    <strong className="text-base text-neutral-800 font-extrabold">₹{c.priceEstimate} Lakhs</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 block font-semibold">Project Duration</span>
                    <strong className="text-base text-neutral-800 font-extrabold">{c.completionTime} Months</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  onClick={() => onToggleCompare(c)}
                  className={`py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                    isSelected 
                      ? "bg-neutral-100 text-neutral-800 border-neutral-200" 
                      : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  {isSelected ? (
                    <>
                      <Check className="w-4 h-4" /> Added to Compare
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Compare Spec
                    </>
                  )}
                </button>

                <button
                  onClick={() => onSelectContractor(c)}
                  className="py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all text-center"
                >
                  Hire Contractor
                </button>
              </div>
            </div>
          );
        })}

        {filteredContractors.length === 0 && (
          <div className="col-span-3 bg-white border border-neutral-200 rounded-3xl p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-neutral-300 mx-auto" />
            <h3 className="font-bold text-neutral-800 text-base">No contractors match search criteria</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">Try clearing search parameters or adjusting rating settings.</p>
          </div>
        )}
      </div>

      <AiInsight
        insight="All three matched contractors have fully verified licensing records and active structural liability insurance in Karnataka."
        recommendation="Use the 'Compare Spec' tool to stack Rajesh Sharma's 10-year warranty parameters side-by-side with Vikram Reddy's 8-month fast-track timeline options."
        confidenceScore={98}
        impactValue="100% Legally Insured"
      />
    </div>
  );
};
