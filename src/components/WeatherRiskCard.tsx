import React, { useState } from 'react';

import {
  CloudRain,
  CloudSun,
  Sunrise,
  Gauge,
  Wind,
  AlertTriangle,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { PremiumCard } from './PremiumCard';
import type { WeatherRiskResult } from '../types/weather';

interface WeatherRiskCardProps {
  result: WeatherRiskResult;
  city: string;
  state: string | null;
  onRetry?: () => void;
}

function riskBadgeClass(level: 'low' | 'moderate' | 'high') {
  if (level === 'low') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (level === 'moderate') return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-rose-50 text-rose-700 border-rose-100';
}

function riskLabel(level: 'low' | 'moderate' | 'high') {
  if (level === 'low') return 'Low risk';
  if (level === 'moderate') return 'Moderate risk';
  return 'High risk';
}

function iconForCode(icon: string) {
  if (!icon) return <CloudSun className='w-4 h-4 text-neutral-500' />;
  const code = icon.replace(/[a-z]/g, '');
  if (code === '01' || code === '02') return <SunIcon className='w-4 h-4 text-amber-500' />;
  if (code === '03' || code === '04') return <CloudSun className='w-4 h-4 text-neutral-500' />;
  if (code === '09' || code === '10') return <CloudRain className='w-4 h-4 text-blue-500' />;
  if (code === '11') return <CloudRain className='w-4 h-4 text-purple-500' />;
  if (code === '13') return <CloudRain className='w-4 h-4 text-cyan-500' />;
  if (code === '50') return <CloudRain className='w-4 h-4 text-neutral-400' />;
  return <CloudSun className='w-4 h-4 text-neutral-500' />;
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <circle cx='12' cy='12' r='4' />
      <path d='M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41' />
    </svg>
  );
}

export const WeatherRiskCard: React.FC<WeatherRiskCardProps> = ({
  result,
  city,
  state,
  onRetry,
}) => {
  const [localRetryCount, setLocalRetryCount] = useState(0);

  if (!result.success && result.code === 'LOCATION_NOT_SET') {
    return (
      <PremiumCard title='Construction Weather Outlook' className='flex flex-col'>
        <div className='flex items-start gap-3'>
          <div className='w-9 h-9 rounded-xl bg-warmbeige-100 text-warmbeige-600 flex items-center justify-center flex-shrink-0'>
            <MapPin className='w-4 h-4' />
          </div>
          <div className='min-w-0 flex-1'>
            <p className='text-xs text-neutral-600 leading-relaxed'>
              Add a construction location (city / state) to your project to see the weather outlook.
            </p>
            <button
              onClick={() => onRetry?.()}
              disabled={!onRetry}
              className='mt-2 text-xs text-terracotta-600 font-medium hover:text-terracotta-700 disabled:text-neutral-400 disabled:cursor-not-allowed'
            >
              {onRetry ? 'Add location to project →' : 'Location needed'}
            </button>
          </div>
        </div>
        <p className='mt-3 text-[10px] text-neutral-400 leading-relaxed'>
          The outlook is tied to your project&apos;s saved location and is provided for planning only.
        </p>
      </PremiumCard>
    );
  }

  if (!result.success) {
    return (
      <PremiumCard title='Construction Weather Outlook' className='flex flex-col'>
        <div className='flex items-start gap-3'>
          <div className='w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center flex-shrink-0'>
            <AlertTriangle className='w-4 h-4' />
          </div>
          <div className='min-w-0 flex-1'>
            <h4 className='text-xs font-semibold text-rose-700'>
              Weather outlook unavailable
            </h4>
            <p className='text-xs text-neutral-600 mt-1 leading-relaxed'>
              {result.error ? result.error : 'We could not load the weather outlook right now.'}
            </p>
            <button
              onClick={() => {
                setLocalRetryCount((n) => n + 1);
                onRetry?.();
              }}
              className='mt-2 text-xs text-terracotta-600 font-medium hover:text-terracotta-700'
            >
              {localRetryCount > 0 ? 'Retry again' : 'Try again'}
            </button>
          </div>
        </div>
        <p className='mt-3 text-[10px] text-neutral-400 leading-relaxed'>
          Weather issues will not block your construction schedule. Check back later or rely on your 
          local forecast.
        </p>
      </PremiumCard>
    );
  }

  const data = result.data!;
  const risk = data.risk;

  return (
    <PremiumCard title='Construction Weather Outlook' className='flex flex-col'>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <span className='text-[10px] font-semibold uppercase tracking-wider text-neutral-400'>
            PRELIMINARY OUTLOOK
          </span>
          <span className='text-[10px] text-neutral-400'>·</span>
          <span className='text-[10px] text-neutral-500'>
            {data.location.resolved}
          </span>
        </div>
        <button
          onClick={() => {
            setLocalRetryCount((n) => n + 1);
            onRetry?.();
          }}
          className='text-[10px] text-neutral-400 hover:text-neutral-600 flex items-center gap-1 transition-colors'
        >
          <RefreshCw className='w-3 h-3' />
          Refresh
        </button>
      </div>

      <div className='flex items-center gap-4 py-3 px-4 rounded-2xl bg-neutral-50 border border-neutral-100 mb-4'>
        <div className='flex items-center gap-2'>
          {iconForCode(data.current.icon)}
          <div className='min-w-0'>
            <p className='text-xs font-semibold text-neutral-800'>
              {data.current.temp}°C
            </p>
            <p className='text-[10px] text-neutral-500 truncate max-w-[90px]'>
              {data.current.description}
            </p>
          </div>
        </div>
        <div className='h-6 w-px bg-neutral-200' />
        <div className='flex items-center gap-1.5 text-[10px] text-neutral-600'>
          <Gauge className='w-3 h-3 text-neutral-400' />
          <span>Feels {data.current.feelsLike}°C</span>
        </div>
        <div className='h-6 w-px bg-neutral-200' />
        <div className='flex items-center gap-1.5 text-[10px] text-neutral-600'>
          <Wind className='w-3 h-3 text-neutral-400' />
          <span>
            {data.current.windSpeed !== null
              ? `${data.current.windSpeed} m/s`
              : '— wind'}
          </span>
        </div>
        <div className='h-6 w-px bg-neutral-200' />
        <div className='flex items-center gap-1.5 text-[10px] text-neutral-600'>
          <Sunrise className='w-3 h-3 text-neutral-400' />
          <span>{data.current.humidity !== null ? `${data.current.humidity}% RH` : '— RH'}</span>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-3 mb-4'>
        <div className={`rounded-xl border px-3 py-2.5 ${riskBadgeClass(risk.rainRisk)}`}>
          <div className='flex items-center justify-between'>
            <span className='text-[10px] font-semibold uppercase tracking-wider'>Rain Risk</span>
            <span className='text-[10px] font-medium'>{riskLabel(risk.rainRisk)}</span>
          </div>
          <p className='text-xs mt-0.5 opacity-80'>{rainDaysLabel(risk.rainDays)}</p>
        </div>
        <div className={`rounded-xl border px-3 py-2.5 ${riskBadgeClass(risk.weatherRisk)}`}>
          <div className='flex items-center justify-between'>
            <span className='text-[10px] font-semibold uppercase tracking-wider'>Weather Risk</span>
            <span className='text-[10px] font-medium'>{riskLabel(risk.weatherRisk)}</span>
          </div>
          <p className='text-xs mt-0.5 opacity-80'>{risk.summary}</p>
        </div>
      </div>

      <div className='mb-4'>
        <p className='text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2'>
          5-Day Outlook
        </p>
        <div className='grid grid-cols-5 gap-2'>
          {data.forecast.map((day) => (
            <div
              key={day.date}
              className='rounded-xl bg-neutral-50 border border-neutral-100 p-2.5 text-center'
            >
              <p className='text-[10px] font-semibold text-neutral-500'>{day.day}</p>
              <p className='text-[10px] text-neutral-400'>{day.date.slice(5)}</p>
              <div className='my-1.5 flex justify-center'>
                {iconForCode(day.icon)}
              </div>
              <p className='text-xs font-semibold text-neutral-800'>{day.max}°</p>
              <p className='text-[10px] text-neutral-500'>{day.min}°</p>
              {day.pop > 0 && (
                <div className='mt-1 pt-1 border-t border-neutral-100'>
                  <p className='text-[9px] text-blue-600 font-medium'>{day.pop}% rain</p>
                  {day.rain > 0 && (
                    <p className='text-[9px] text-neutral-500'>{day.rain} mm</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {risk.impacts.length > 0 && (
        <div className='mb-4'>
          <p className='text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-1'>
            <AlertTriangle className='w-3 h-3' />
            Possible Construction Impact
          </p>
          <ul className='space-y-1.5'>
            {risk.impacts.map((impact, i) => (
              <li
                key={i}
                className='text-xs text-neutral-700 leading-relaxed pl-4 border-l-2 border-amber-200'
              >
                {impact}
              </li>
            ))}
          </ul>
        </div>
      )}

      {risk.precautions.length > 0 && (
        <div className='mb-4'>
          <p className='text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mb-2 flex items-center gap-1'>
            <ShieldCheck className='w-3 h-3' />
            Simple Precautions
          </p>
          <ul className='space-y-1.5'>
            {risk.precautions.map((precaution, i) => (
              <li
                key={i}
                className='text-xs text-neutral-700 leading-relaxed pl-4 border-l-2 border-emerald-200'
              >
                {precaution}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
        <p className="text-[10px] text-neutral-500 leading-relaxed">
          <span className="font-medium text-neutral-600">
            {data.source}
          </span>
        </p>
        <p className="text-[10px] text-neutral-500 leading-relaxed mt-1.5">
          {data.disclaimer}
        </p>
        <p className="text-[9px] text-neutral-400 leading-relaxed mt-1">
          This outlook does not block any construction activity automatically.
        </p>
      </div>
    </PremiumCard>
  );
};


function rainDaysLabel(rainDays: number) {
  if (rainDays === 0) return 'No rain days in the outlook.';
  if (rainDays === 1) return '1 rain day in the outlook.';
  return `${rainDays} rain days in the outlook.`;
}

