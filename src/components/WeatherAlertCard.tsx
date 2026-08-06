import React from 'react';
import { CloudRain } from 'lucide-react';

interface WeatherAlertCardProps {
  title: string;
  message: string;
  location?: string;
}

export const WeatherAlertCard: React.FC<WeatherAlertCardProps> = ({
  title,
  message,
  location,
}) => (
  <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100 flex gap-3">
    <CloudRain className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
    <div>
      <h4 className="font-bold text-amber-900 text-xs">
        {title}
        {location && <span className="font-normal text-amber-700"> ({location})</span>}
      </h4>
      <p className="text-xs text-amber-700 mt-1 leading-relaxed">{message}</p>
    </div>
  </div>
);
