import { supabase } from '../lib/supabase';
import { Project, ConstructionPhoto, ProjectUpdate } from '../types/project';
import { ProjectMilestone } from '../types';
import { getProjectById } from './projectService';
import type { WeatherRiskResult } from '../types/weather';
import { getWeatherRisk } from './weatherService';

/**
 * Phase 11 — weather snapshot for a project report.
 *
 * Only calls the existing weather service when the project has a saved
 * city/state. Otherwise reports a calm "no alerts" state so the report
 * stays readable even for projects without a location.
 */
export interface ReportWeather {
  /** True when the project has no saved location or the location is unknown. */
  noAlerts: boolean;
  /** Human-readable summary for the report card (never empty). */
  summary: string;
  /** The underlying service result for further rendering if present. */
  result: WeatherRiskResult | null;
}

export async function getReportWeather(projectId: string): Promise<ReportWeather> {
  if (!projectId) return { noAlerts: true, summary: 'Weather alert data is unavailable.', result: null };

  let project: Project | null = null;
  try {
    project = await getProjectById(projectId);
  } catch {
    return {
      noAlerts: true,
      summary: 'Weather alert data is unavailable.',
      result: null,
    };
  }

  const city = String(project?.city ?? '').trim();
  const state = String(project?.state ?? '').trim() || null;

  if (!city) {
    return {
      noAlerts: true,
      summary: 'Construction location is not set on this project, so no weather alerts are shown.',
      result: null,
    };
  }

  let result: WeatherRiskResult;
  try {
    result = await getWeatherRisk(projectId);
  } catch {
    return {
      noAlerts: true,
      summary: 'Weather alert data is unavailable.',
      result: null,
    };
  }

  if (!result.success) {
    return {
      noAlerts: true,
      summary: 'Weather alert data is unavailable right now.',
      result,
    };
  }

  const data = result.data;
  if (!data) {
    return {
      noAlerts: true,
      summary: 'Weather alert data is unavailable.',
      result,
    };
  }

  const severe = data.risk.impacts.length > 0
    ? data.risk.impacts
        .filter((impact) => impact.length > 0)
        .join('; ')
    : '';

  if (severe) {
    return {
      noAlerts: false,
      summary: `Weather alerts for ${data.location.resolved}: ${severe}.`,
      result,
    };
  }

  const rainDays = data.risk.rainDays;
  const nextRain = data.forecast.find((day) => day.pop >= 40);

  if (rainDays > 0 && nextRain) {
    return {
      noAlerts: false,
      summary: `Rain is likely on ${nextRain.day} (${nextRain.date.slice(5)}) for ${data.location.resolved}. Plan protective cover and drainage for exposed work.`,
      result,
    };
  }

  if (rainDays > 0) {
    return {
      noAlerts: false,
      summary: `Rain is expected on ${rainDays} day(s) during the next 5 days for ${data.location.resolved}. Check daily before pouring concrete or closing-up work.`,
      result,
    };
  }

  if (data.risk.rainRisk === 'moderate' || data.risk.weatherRisk === 'moderate') {
    return {
      noAlerts: false,
      summary: `Moderate weather risk for ${data.location.resolved} over the next 5 days. Review the forecast before scheduling weather-sensitive tasks.`,
      result,
    };
  }

  return {
    noAlerts: true,
    summary: `Construction weather outlook for ${data.location.resolved} is currently low risk. Continue to check the forecast before weather-sensitive work.`,
    result,
  };
}

/**
 * Lightweight alert lines for the report card UI.
 * Derived only from real weather data; no fabricated alerts.
 */
export interface ReportWeatherAlert {
  title: string;
  message: string;
  isSevere: boolean;
}

export function reportWeatherAlerts(weather: ReportWeather): ReportWeatherAlert[] {
  if (weather.noAlerts || !weather.result?.data) {
    return [];
  }

  const data = weather.result.data;
  const alerts: ReportWeatherAlert[] = [];

  if (data.risk.rainRisk === 'high') {
    alerts.push({
      title: 'High rain risk',
      message: `Rain is likely during the next 5 days for ${data.location.resolved}. Protect exposed materials and postpone weather-sensitive tasks if needed.`,
      isSevere: true,
    });
  } else if (data.risk.rainRisk === 'moderate') {
    alerts.push({
      title: 'Moderate rain risk',
      message: `Rain is possible during the next 5 days for ${data.location.resolved}. Check the forecast before pouring concrete, plastering, or closing-up work.`,
      isSevere: false,
    });
  }

  if (data.risk.weatherRisk === 'high') {
    alerts.push({
      title: 'High weather risk',
      message: `Adverse conditions are possible for ${data.location.resolved} over the next 5 days. Confirm site readiness before scheduling critical milestones.`,
      isSevere: true,
    });
  } else if (data.risk.weatherRisk === 'moderate') {
    alerts.push({
      title: 'Moderate weather risk',
      message: `Some adverse conditions may affect ${data.location.resolved} over the next 5 days. Schedule weather-sensitive tasks carefully.`,
      isSevere: false,
    });
  }

  if (data.current.main === 'Thunderstorm') {
    alerts.push({
      title: 'Thunderstorm possible',
      message: `Current conditions for ${data.location.resolved} include thunderstorms. Avoid exposed roof, electrical, and crane work until conditions clear.`,
      isSevere: true,
    });
  }

  return alerts;
}
