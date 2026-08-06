import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, ShieldAlert, Sparkles, TrendingDown, ArrowUpRight, Plus, Check } from 'lucide-react';
import { INITIAL_BUDGET, BudgetItem } from '../mockData';
import { AiInsight } from '../components/AiInsight';

export const BudgetEstimator: React.FC = () => {
  const [budgetList, setBudgetList] = useState<BudgetItem[]>(INITIAL_BUDGET);
  const [showOptimization, setShowOptimization] = useState<boolean>(true);

  // Totals
  const totalEstimated = budgetList.reduce((acc, curr) => acc + curr.estimated, 0);
  const totalSpent = budgetList.reduce((acc, curr) => acc + curr.spent, 0);
  const totalRemaining = totalEstimated - totalSpent;

  // AI Savings Proposals
  const savingsProposals = [
    { item: "AAC Eco-Blocks Substitution", saving: 1.5, reason: "Substituting clay bricks cuts mortar plaster volume and decreases masonry labor costs.", applied: false },
    { item: "Bulk Steel Ordering", saving: 0.38, reason: " tata steel distribution pre-booking avoids the upcoming 4% mid-season tariff hike.", applied: false },
    { item: "Vitrified Tiles vs Marble", saving: 1.12, reason: "Using vitrified floor layouts in general bedrooms reduces stone polishing overhead.", applied: false }
  ];

  const [activeSavings, setActiveSavings] = useState(savingsProposals);

  const handleApplySaving = (idx: number) => {
    const updated = [...activeSavings];
    updated[idx].applied = true;
    setActiveSavings(updated);

    // Subtract from estimated budget
    const targetItemName = updated[idx].item.includes("Tile") ? "Material Cost" : (updated[idx].item.includes("Steel") ? "Material Cost" : "Labour Wages");
    setBudgetList(prev => prev.map(item => {
      if (item.name === targetItemName) {
        return {
          ...item,
          estimated: Math.round((item.estimated - updated[idx].saving) * 100) / 100
        };
      }
      return item;
    }));
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">AI Budget Estimator</h1>
          <p className="text-neutral-500 font-light mt-1">
            Predictive financial analysis, real-time expense ledgers, and structural saving audits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400 font-bold">Financial Confidence:</span>
          <span className="text-sm font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">98% Verified</span>
        </div>
      </div>

      {/* Totals Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-neutral-50 rounded-bl-full pointer-events-none" />
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Target Budget</span>
          <div className="text-3xl font-extrabold text-neutral-900 mt-2">₹{totalEstimated.toFixed(2)} Lakhs</div>
          <div className="text-xs text-neutral-400 mt-2 font-light">Based on custom floor blueprints</div>
        </div>

        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50/20 rounded-bl-full pointer-events-none" />
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Actual Spent-to-Date</span>
          <div className="text-3xl font-extrabold text-red-500 mt-2">₹{totalSpent.toFixed(2)} Lakhs</div>
          <div className="text-xs text-neutral-400 mt-2 font-light">{Math.round((totalSpent / totalEstimated) * 100)}% of total allocated limit</div>
        </div>

        <div className="bg-white border-2 border-emerald-500 rounded-3xl p-6 shadow-premium relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/20 rounded-bl-full pointer-events-none" />
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Remaining Balance</span>
          <div className="text-3xl font-extrabold text-emerald-600 mt-2">₹{totalRemaining.toFixed(2)} Lakhs</div>
          <div className="text-xs text-neutral-400 mt-2 font-light">Sufficient for remaining slabs and painting</div>
        </div>
      </div>

      {/* Main ledger & SVG Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Ledger */}
        <div className="lg:col-span-8 bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-6">
          <h2 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3">
            Detailed Ledger Breakdown
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-100 text-neutral-400 font-semibold">
                  <th className="pb-3 pr-4 font-bold text-xs uppercase">Category</th>
                  <th className="pb-3 px-4 font-bold text-xs uppercase text-right">Estimated Cost</th>
                  <th className="pb-3 px-4 font-bold text-xs uppercase text-right">Actual Spent</th>
                  <th className="pb-3 px-4 font-bold text-xs uppercase text-right">Progress Variance</th>
                  <th className="pb-3 pl-4 font-bold text-xs uppercase text-right">Burn Indicator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {budgetList.map((item, idx) => {
                  const percentUsed = Math.min(Math.round((item.spent / item.estimated) * 100), 100);
                  const isOver = item.spent > item.estimated;
                  return (
                    <tr key={idx} className="text-neutral-800 font-semibold">
                      <td className="py-4 pr-4 font-bold text-neutral-900">{item.name}</td>
                      <td className="py-4 px-4 text-right">₹{item.estimated.toFixed(2)}L</td>
                      <td className="py-4 px-4 text-right text-neutral-700">₹{item.spent.toFixed(2)}L</td>
                      <td className="py-4 px-4 text-right">
                        <span className={`text-xs px-2.5 py-0.5 rounded font-bold ${
                          isOver ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {isOver ? `+₹${(item.spent - item.estimated).toFixed(2)}L` : `₹${(item.estimated - item.spent).toFixed(2)}L left`}
                        </span>
                      </td>
                      <td className="py-4 pl-4 text-right">
                        <div className="w-24 bg-neutral-100 h-2 rounded-full overflow-hidden ml-auto">
                          <div 
                            className={`h-full rounded-full ${isOver ? "bg-red-500" : "bg-terracotta"}`}
                            style={{ width: `${percentUsed}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Charts & Optimization */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Custom SVG Budget Chart */}
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Estimated Allocation</h3>
            
            {/* Simple Visual Chart blocks */}
            <div className="flex flex-col gap-3">
              {budgetList.map((item, idx) => {
                const ratio = Math.round((item.estimated / totalEstimated) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs text-neutral-700 font-bold">
                      <span>{item.name}</span>
                      <span>{ratio}%</span>
                    </div>
                    <div className="w-full bg-neutral-50 h-3 rounded-md overflow-hidden border border-neutral-100">
                      <div 
                        className="h-full bg-terracotta/80 rounded-md" 
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Optimizations card */}
          {showOptimization && (
            <div className="bg-white border-2 border-terracotta rounded-3xl p-6 shadow-premium space-y-4 relative overflow-hidden ai-border-glow">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-terracotta-50 to-transparent opacity-50 rounded-full blur-xl pointer-events-none" />
              <h3 className="text-sm font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-1.5 uppercase tracking-wide">
                <Sparkles className="w-4 h-4 text-terracotta animate-pulse" /> AI Budget Optimization
              </h3>

              <div className="space-y-3">
                {activeSavings.map((item, idx) => (
                  <div key={idx} className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-start gap-2.5">
                    <div className="flex-grow">
                      <h4 className="font-bold text-neutral-800 text-xs flex justify-between">
                        {item.item}
                        <span className="text-emerald-600">-₹{item.saving} Lakhs</span>
                      </h4>
                      <p className="text-[10px] text-neutral-400 font-light mt-1 leading-relaxed">
                        {item.reason}
                      </p>
                    </div>
                    
                    <button
                      disabled={item.applied}
                      onClick={() => handleApplySaving(idx)}
                      className={`p-1.5 rounded-lg flex-shrink-0 border transition-all ${
                        item.applied 
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                          : "bg-white text-terracotta border-neutral-200 hover:border-terracotta"
                      }`}
                    >
                      {item.applied ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

      <AiInsight
        insight="Operational overhead is running 3% below target projection due to efficient crane rentals."
        recommendation="Apply the 'AAC Eco-Blocks Substitution' optimization to instantly reduce projected masonry wages, yielding a final estimated budget of under ₹39.8L."
        confidenceScore={96}
        impactValue="₹1,50,000 Saved"
      />
    </div>
  );
};
