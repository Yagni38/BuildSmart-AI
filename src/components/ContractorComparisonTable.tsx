import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, MapPin, Clock, Star, Award, CheckCircle2, Lock,
} from 'lucide-react';
import { ContractorRecommendation } from '../services/contractorRecommendationService';

interface ComparisonTableProps {
  recommendations: ContractorRecommendation[];
  selectedContractor: any | null;
  onSelectContractor: (contractor: any) => void;
}

/**
 * Phase 5 — Side-by-side comparison of the (already admin-verified) top
 * contractor recommendations. Renders a compact comparison table so users can
 * diff the AI-reranked candidates before committing a selection.
 *
 * Selection is guarded: only `verified === true` contractors can be chosen
 * (the AI layer is purely re-rank + re-explain; it never introduces new
 * contractors, so this guard mirrors that invariant on the UI).
 */
export const ContractorComparisonTable: React.FC<ComparisonTableProps> = ({
  recommendations,
  selectedContractor,
  onSelectContractor,
}) => {
  const recs = recommendations.slice(0, 3);
  const isSelected = (c: any) =>
    selectedContractor &&
    (selectedContractor.id === c.id || selectedContractor.id === c.user_id);

  const rows: { label: string; render: (c: any, rec: any) => React.ReactNode }[] = [
    {
      label: 'Contractor',
      render: (c) => <span className="font-extrabold text-neutral-900">{c.company}</span>,
    },
    {
      label: 'Owner / Verification',
      render: (c) => (
        <span className="flex flex-col text-[11px]">
          <span className="text-neutral-500">Owned by {c.owner}</span>
          <span
            className={
              c.verified
                ? 'text-emerald-700 font-bold flex items-center gap-1'
                : 'text-red-600 font-bold flex items-center gap-1'
            }
          >
            {c.verified ? 'Verified ✓' : 'Not Verified ✗'}
          </span>
        </span>
      ),
    },
    {
      label: 'Match Score',
      render: (c, rec) => (
        <span className="font-extrabold text-emerald-700">
          {rec.matchScore ?? rec.match_score ?? 95}%
        </span>
      ),
    },
    {
      label: 'Location',
      render: (c) => (
        <span className="flex items-center gap-1 text-neutral-700">
          <MapPin className="w-3.5 h-3.5 text-terracotta" /> {c.location}
        </span>
      ),
    },
    {
      label: 'Experience',
      render: (c) => (
        <span className="flex items-center gap-1 text-neutral-700">
          <Clock className="w-3.5 h-3.5" /> {c.yearsOfExperience} Yrs
        </span>
      ),
    },
    {
      label: 'Rating',
      render: (c) => (
        <span className="flex items-center gap-1 font-bold text-amber-600">
          <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />{' '}
          {c.rating} ({c.reviewsCount})
        </span>
      ),
    },
    {
      label: 'Projects Completed',
      render: (c) => (
        <span className="flex items-center gap-1 text-neutral-700">
          <Award className="w-3.5 h-3.5 text-neutral-500" />{' '}
          {c.projectsCompleted ?? 28} completed
        </span>
      ),
    },
    {
      label: 'Price Estimate',
      render: (c) => (
        <span className="font-bold text-neutral-800">
          ₹{c.priceEstimate ?? 42.5} Lakhs
        </span>
      ),
    },
    {
      label: 'Warranty',
      render: (c) => (
        <span className="flex items-center gap-1 text-neutral-700">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />{' '}
          {c.warranty ?? 10} yrs
        </span>
      ),
    },
    {
      label: 'Skills',
      render: (c) => (
        <span className="text-[10px] text-neutral-600">
          {c.skills?.slice(0, 4).join(', ')}
        </span>
      ),
    },
    {
      label: 'Why Recommended',
      render: (c) => (
        <span className="text-[10px] text-neutral-600 font-light">
          {c.whyRecommended || c.description}
        </span>
      ),
    },
    {
      label: 'Select',
      render: (c) => (
        <button
          onClick={() => c.verified && onSelectContractor(c)}
          disabled={!c.verified}
          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all ${
            isSelected(c)
              ? 'bg-emerald-700 text-white'
              : c.verified
              ? 'bg-neutral-900 hover:bg-neutral-800 text-white'
              : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
          }`}
        >
          {c.verified ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <Lock className="w-3 h-3" />
          )}
          {isSelected(c) ? 'Selected' : c.verified ? 'Select' : 'Locked'}
        </button>
      ),
    },
  ];

  if (recs.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-x-auto rounded-2xl border border-neutral-200"
    >
      <table className="min-w-full border-collapse text-xs text-neutral-700">
        <thead>
          <tr className="bg-neutral-50 border-b border-neutral-200">
            <th className="text-left px-3 py-2.5 font-extrabold text-neutral-500 uppercase text-[10px]">
              #
            </th>
            {recs.map((rec) => (
              <th
                key={rec.contractor.id}
                className="text-left px-3 py-2.5"
              >
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-terracotta-100 text-terracotta">
                  {rec.rankLabel}
                </span>
                <div className="mt-1 font-extrabold text-neutral-900">
                  {rec.contractor.company}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className="border-b border-neutral-100 last:border-0"
            >
              <td className="px-3 py-2.5 font-bold text-neutral-500 uppercase text-[9px] w-48">
                {row.label}
              </td>
              {recs.map((rec) => (
                <td
                  key={`${rec.contractor.id}-${row.label}`}
                  className="px-3 py-2.5 align-top text-[11px]"
                >
                  {row.render(rec.contractor, rec)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
};
