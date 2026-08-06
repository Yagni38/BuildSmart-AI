import React from 'react';
import { BudgetItem } from '../mockData';

interface ExpenseSummaryChartProps {
  items: BudgetItem[];
}

const categoryColors: Record<string, string> = {
  Materials: 'bg-terracotta',
  Labour: 'bg-amber-500',
  Equipment: 'bg-blue-500',
  Fee: 'bg-violet-500',
  Overhead: 'bg-neutral-400',
};

export const ExpenseSummaryChart: React.FC<ExpenseSummaryChartProps> = ({ items }) => {
  const maxEstimated = Math.max(...items.map(i => i.estimated), 1);

  return (
    <div className="space-y-4">
      {items.map(item => {
        const spentPercent = (item.spent / maxEstimated) * 100;
        const estimatedPercent = (item.estimated / maxEstimated) * 100;
        const barColor = categoryColors[item.category] || 'bg-neutral-400';

        return (
          <div key={item.name} className="space-y-1.5">
            <div className="flex justify-between items-baseline text-xs">
              <span className="font-semibold text-neutral-700">{item.name}</span>
              <span className="text-neutral-500">
                <strong className="text-neutral-800">₹{item.spent.toFixed(1)}L</strong>
                <span className="text-neutral-400"> / ₹{item.estimated.toFixed(1)}L</span>
              </span>
            </div>
            <div className="relative h-2.5 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-neutral-200/60 rounded-full"
                style={{ width: `${estimatedPercent}%` }}
              />
              <div
                className={`absolute inset-y-0 left-0 ${barColor} rounded-full transition-all duration-500`}
                style={{ width: `${spentPercent}%` }}
              />
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-3 pt-2 border-t border-neutral-100">
        {Object.entries(categoryColors).map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-semibold">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};
