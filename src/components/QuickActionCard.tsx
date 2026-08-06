import React from 'react';
import { LucideIcon, ArrowRight } from 'lucide-react';

interface QuickActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  accent?: 'terracotta' | 'emerald' | 'neutral';
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  icon: Icon,
  title,
  description,
  onClick,
  accent = 'terracotta',
}) => {
  const accentClasses = {
    terracotta: 'bg-terracotta-50 text-terracotta border-terracotta-100 group-hover:bg-terracotta group-hover:text-white',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white',
    neutral: 'bg-neutral-50 text-neutral-600 border-neutral-100 group-hover:bg-neutral-900 group-hover:text-white',
  };

  return (
    <button
      onClick={onClick}
      className="group bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-premium hover:shadow-premium-hover transition-all duration-300 text-left w-full hover:-translate-y-0.5"
    >
      <div
        className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 transition-colors duration-300 ${accentClasses[accent]}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <h4 className="font-bold text-neutral-900 text-sm mb-1">{title}</h4>
      <p className="text-xs text-neutral-500 font-light leading-relaxed mb-3">{description}</p>
      <span className="text-xs text-terracotta font-semibold flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
        Open <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </button>
  );
};
