import React from 'react';

interface ProgressCircleProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

export const ProgressCircle: React.FC<ProgressCircleProps> = ({
  percent,
  size = 80,
  strokeWidth = 6,
  label,
  sublabel,
}) => {
  const radius = (size - strokeWidth) / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, percent)) / 100);
  const center = size / 2;

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            className="stroke-neutral-100 fill-none"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            className="stroke-terracotta fill-none"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-base font-extrabold text-neutral-900">{percent}%</span>
      </div>
      {(label || sublabel) && (
        <div>
          {label && <h3 className="font-bold text-neutral-950 text-lg">{label}</h3>}
          {sublabel && <p className="text-xs text-neutral-400">{sublabel}</p>}
        </div>
      )}
    </div>
  );
};
