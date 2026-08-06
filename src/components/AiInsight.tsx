import React from 'react';
import { Sparkles, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

interface AiInsightProps {
  title?: string;
  insight: string;
  recommendation: string;
  confidenceScore: number; // e.g. 96
  impactValue?: string; // e.g. "₹1.5L Savings" or "5 Days Saved"
}

export const AiInsight: React.FC<AiInsightProps> = ({
  title = "BuildSmart AI Insight",
  insight,
  recommendation,
  confidenceScore,
  impactValue
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl bg-white border border-terracotta-100 p-6 ai-border-glow shadow-premium hover:shadow-premium-hover transition-all duration-300"
    >
      {/* Decorative Gradient Background Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-terracotta-50 to-transparent opacity-60 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-start gap-4">
        {/* Animated AI Icon Container */}
        <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-terracotta-50 text-terracotta-500 border border-terracotta-100">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>

        {/* Content Area */}
        <div className="flex-grow">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h4 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">
              {title}
            </h4>
            
            <div className="flex items-center gap-3">
              {impactValue && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  {impactValue}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
                <ShieldCheck className="w-3.5 h-3.5 text-terracotta" />
                Confidence: <strong className="text-neutral-800">{confidenceScore}%</strong>
              </span>
            </div>
          </div>

          <p className="text-neutral-800 font-medium text-base mb-1.5 leading-relaxed">
            {insight}
          </p>
          <p className="text-neutral-500 text-sm leading-relaxed">
            <span className="text-terracotta font-semibold">Recommendation: </span>
            {recommendation}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
