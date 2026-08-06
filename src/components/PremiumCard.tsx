import React from 'react';

interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
  glow?: boolean;
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  className = '',
  title,
  action,
  glow = false,
}) => (
  <div
    className={`bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium relative overflow-hidden ${className}`}
  >
    {glow && (
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-warmbeige-100 to-transparent opacity-40 rounded-full blur-2xl pointer-events-none" />
    )}
    {(title || action) && (
      <div className="flex justify-between items-center mb-4 relative">
        {title && (
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            {title}
          </span>
        )}
        {action}
      </div>
    )}
    <div className="relative">{children}</div>
  </div>
);
