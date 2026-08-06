import React from 'react';
import { motion } from 'framer-motion';
import { Award, ArrowLeft, ShieldCheck, CheckCircle, XCircle, Sparkles, MessageSquare } from 'lucide-react';
import { Contractor } from '../mockData';
import { AiInsight } from '../components/AiInsight';

interface ContractorComparisonProps {
  compareList: Contractor[];
  onNavigate: (page: string) => void;
  onSelectContractor: (c: Contractor) => void;
}

export const ContractorComparison: React.FC<ContractorComparisonProps> = ({
  compareList,
  onNavigate,
  onSelectContractor
}) => {
  // If list is empty, show fallback
  if (compareList.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center space-y-4">
        <h2 className="text-xl font-bold text-neutral-800">No contractors selected for comparison</h2>
        <p className="text-sm text-neutral-400">Go back to the Contractor Marketplace and select contractors to compare them side-by-side.</p>
        <button
          onClick={() => onNavigate('marketplace')}
          className="px-6 py-2.5 bg-neutral-900 text-white text-xs font-bold rounded-xl hover:bg-neutral-800 transition-all"
        >
          Explore Marketplace
        </button>
      </div>
    );
  }

  // Find winner based on highest matchScore or first in list
  const winner = compareList.reduce((prev, current) => (prev.matchScore > current.matchScore) ? prev : current, compareList[0]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <button
          onClick={() => onNavigate('marketplace')}
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </button>
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Contractor Comparison Matrix</h1>
          <p className="text-neutral-500 font-light mt-1">
            Analyze pricing structures, timelines, warranties, and material grades side-by-side.
          </p>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-neutral-100 text-neutral-400 font-semibold">
              <th className="pb-4 font-bold text-xs uppercase w-[20%]">Metric Specification</th>
              {compareList.map(c => (
                <th key={c.id} className="pb-4 px-6 text-center w-[25%]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-1">
                      <span className="font-extrabold text-neutral-900 text-base">{c.company}</span>
                      {c.id === winner.id && (
                        <span className="p-0.5 bg-terracotta text-white rounded-full" title="AI Winner Option">
                          <Award className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded font-bold uppercase">
                      {c.specialty}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 font-semibold text-neutral-800">
            {/* Price Estimate */}
            <tr>
              <td className="py-4 text-neutral-500 font-bold">Estimated Cost</td>
              {compareList.map(c => (
                <td key={c.id} className="py-4 px-6 text-center text-base font-extrabold text-neutral-900">
                  ₹{c.priceEstimate} Lakhs
                </td>
              ))}
            </tr>

            {/* Timeline */}
            <tr>
              <td className="py-4 text-neutral-500 font-bold">Completion Time</td>
              {compareList.map(c => (
                <td key={c.id} className="py-4 px-6 text-center">
                  {c.completionTime} Months
                </td>
              ))}
            </tr>

            {/* Experience */}
            <tr>
              <td className="py-4 text-neutral-500 font-bold">Industry Experience</td>
              {compareList.map(c => (
                <td key={c.id} className="py-4 px-6 text-center">
                  {c.experience} Years
                </td>
              ))}
            </tr>

            {/* Completed Projects */}
            <tr>
              <td className="py-4 text-neutral-500 font-bold">Projects Handed Over</td>
              {compareList.map(c => (
                <td key={c.id} className="py-4 px-6 text-center">
                  {c.projects} Completed
                </td>
              ))}
            </tr>

            {/* Rating */}
            <tr>
              <td className="py-4 text-neutral-500 font-bold">Client Rating</td>
              {compareList.map(c => (
                <td key={c.id} className="py-4 px-6 text-center">
                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-xs font-bold border border-amber-100 mx-auto">
                    ★ {c.rating} ({c.reviewsCount})
                  </span>
                </td>
              ))}
            </tr>

            {/* Warranty */}
            <tr>
              <td className="py-4 text-neutral-500 font-bold">Structural Warranty</td>
              {compareList.map(c => (
                <td key={c.id} className="py-4 px-6 text-center text-emerald-600">
                  {c.warranty} Years
                </td>
              ))}
            </tr>

            {/* Material Quality */}
            <tr>
              <td className="py-4 text-neutral-500 font-bold">Material Standards</td>
              {compareList.map(c => (
                <td key={c.id} className="py-4 px-6 text-center text-xs">
                  {c.materialQuality}
                </td>
              ))}
            </tr>

            {/* AI Match Fit */}
            <tr>
              <td className="py-4 text-neutral-500 font-bold">AI Compatibility Match</td>
              {compareList.map(c => (
                <td key={c.id} className="py-4 px-6 text-center">
                  <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                    c.id === winner.id 
                      ? "bg-terracotta-50 text-terracotta border-terracotta-100 animate-pulse" 
                      : "bg-neutral-50 text-neutral-600 border-neutral-200"
                  }`}>
                    {c.matchScore}% Compatibility
                  </span>
                </td>
              ))}
            </tr>

            {/* Hire Winner CTA Actions */}
            <tr className="border-t-2 border-neutral-100">
              <td className="py-5 text-neutral-500 font-bold">Select Choice</td>
              {compareList.map(c => (
                <td key={c.id} className="py-5 px-6 text-center">
                  <div className="flex flex-col gap-2 items-center">
                    {c.id === winner.id && (
                      <span className="text-[10px] font-bold text-terracotta uppercase bg-terracotta-50 border border-terracotta-100 px-2.5 py-0.5 rounded-md mb-1.5 animate-bounce">
                        Recommended Winner
                      </span>
                    )}
                    <button
                      onClick={() => onSelectContractor(c)}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all w-40 ${
                        c.id === winner.id 
                          ? "bg-terracotta text-white hover:bg-terracotta-600 shadow-premium" 
                          : "bg-neutral-900 text-white hover:bg-neutral-800"
                      }`}
                    >
                      Hire & Proceed
                    </button>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <AiInsight
        insight={`Apex Builders represents the most financially robust proposal, offering an extended 10-year warranty coupled with premium material standards at just ₹42.5L.`}
        recommendation="Finalize and sign the contract package with Apex Builders. Material order templates will immediately sync with their local distribution pipeline."
        confidenceScore={98}
        impactValue="₹4.2L Savings vs Competitors"
      />
    </div>
  );
};
