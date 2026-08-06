import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, CloudRain, ShieldCheck, ChevronDown, 
  ChevronUp, Image as ImageIcon, Sparkles, TrendingUp, AlertTriangle 
} from 'lucide-react';
import { Milestone } from '../mockData';
import { AiInsight } from '../components/AiInsight';

interface ProjectTrackerProps {
  milestones: Milestone[];
  onUpdateMilestone: (updatedMilestones: Milestone[]) => void;
}

export const ProjectTracker: React.FC<ProjectTrackerProps> = ({
  milestones,
  onUpdateMilestone
}) => {
  const [expandedId, setExpandedId] = useState<string | null>('ms3'); // Expand the active in-progress one by default

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getStatusBadge = (status: Milestone['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase">
            Completed
          </span>
        );
      case 'in-progress':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-terracotta-50 text-terracotta border border-terracotta-100 uppercase animate-pulse">
            In Progress
          </span>
        );
      case 'upcoming':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-50 text-neutral-400 border border-neutral-100 uppercase">
            Upcoming
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-6 px-4">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Interactive Project Tracker</h1>
        <p className="text-neutral-500 font-light mt-1">
          Detailed site progress timeline with photo proof audits, weather warnings, and AI delay predictions.
        </p>
      </div>

      {/* Vertical Timeline */}
      <div className="space-y-6 relative pl-6 before:absolute before:left-[14px] before:top-2 before:bottom-2 before:w-[2px] before:bg-neutral-200">
        
        {milestones.map((ms, index) => {
          const isExpanded = expandedId === ms.id;
          const isActive = ms.status === 'in-progress';
          const isDone = ms.status === 'completed';

          return (
            <div key={ms.id} className="relative space-y-2">
              {/* Connector Pin */}
              <div className={`absolute -left-[20px] top-1.5 w-6 h-6 rounded-full border-4 flex items-center justify-center transition-all ${
                isDone 
                  ? "bg-emerald-500 border-emerald-100" 
                  : (isActive ? "bg-terracotta border-terracotta-100 scale-110" : "bg-white border-neutral-300")
              }`}>
                {isDone && <ShieldCheck className="w-3 h-3 text-white" />}
              </div>

              {/* Milestone Accordion Header */}
              <div 
                onClick={() => toggleExpand(ms.id)}
                className={`w-full text-left bg-white border rounded-2xl p-5 shadow-premium hover:shadow-premium-hover transition-all duration-300 flex items-center justify-between cursor-pointer ${
                  isActive ? "border-terracotta" : "border-neutral-200"
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-neutral-400">Step 0{index + 1}</span>
                  <div>
                    <h3 className="font-bold text-neutral-800 text-base">{ms.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-neutral-400 font-medium">Target: {ms.targetDate}</span>
                      <span className="text-xs text-neutral-400">•</span>
                      <span className="text-xs text-neutral-400 font-medium">Est Cost: ₹{ms.expenses > 0 ? `${ms.expenses}L` : "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusBadge(ms.status)}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                </div>
              </div>

              {/* Accordion Expandable Details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden bg-white border border-t-0 border-neutral-200 rounded-b-2xl -mt-3 p-5 space-y-4 shadow-sm"
                  >
                    {/* Completion Ring & Expense Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-3 border-t border-neutral-100">
                      <div>
                        <span className="text-[10px] text-neutral-400 font-bold uppercase">Milestone Progress</span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-full bg-neutral-100 h-2.5 rounded-full overflow-hidden">
                            <div className="h-full bg-terracotta rounded-full" style={{ width: `${ms.completionPercent}%` }} />
                          </div>
                          <span className="text-sm font-bold text-neutral-800">{ms.completionPercent}%</span>
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-[10px] text-neutral-400 font-bold uppercase">Phase Expense</span>
                        <div className="text-base font-extrabold text-neutral-800 mt-1">
                          ₹{ms.expenses > 0 ? `${ms.expenses} Lakhs` : "₹0 (Pending)"}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-neutral-400 font-bold uppercase">Supervisor Logs</span>
                        <p className="text-xs text-neutral-500 font-light mt-1 truncate" title={ms.comments}>
                          {ms.comments || "No logs updated yet."}
                        </p>
                      </div>
                    </div>

                    {/* Delay & Weather warnings */}
                    {ms.status !== 'completed' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                        <div>
                          <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-amber-600" /> AI Delay Risk Prediction
                          </h4>
                          <p className="text-[11px] text-amber-800 mt-1 leading-normal">
                            {ms.delayPrediction}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1">
                            <CloudRain className="w-4 h-4 text-amber-600" /> Weather Risk Impact
                          </h4>
                          <p className="text-[11px] text-amber-800 mt-1 leading-normal">
                            {ms.weatherImpact}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Site photos preview */}
                    {ms.photos.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] text-neutral-400 font-bold uppercase flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5" /> Phase Daily Upload Photos
                        </span>
                        <div className="grid grid-cols-3 gap-4">
                          {ms.photos.map((url, i) => (
                            <div key={i} className="rounded-xl overflow-hidden aspect-video border border-neutral-100 group cursor-zoom-in">
                              <img src={url} alt={`Site progress`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

      </div>

      <AiInsight
        insight="Milestone 3 (Roof Slab & Concreting) displays a high delay risk score due to impending monsoon showers on Aug 9."
        recommendation="Instruct the contractor to delay concrete pouring by 24h to Aug 11 when rain risk drops below 15%. This preserves cement setting ratios and prevents structural cracks."
        confidenceScore={94}
        impactValue="Defect Prevention Guaranteed"
      />
    </div>
  );
};
