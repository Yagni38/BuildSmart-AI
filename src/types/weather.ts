/**
 * Phase 8 — Location-based construction weather outlook types.
 *
 * These describe the payload returned by the weather service and
 * surfaced to the dashboard. Weather data is fetched directly from
 * the browser-safe Open-Meteo API using the customer's saved project
 * location (city/state). No API key or Edge Function is needed.
 */

export type RiskLevel = 'low' | 'moderate' | 'high';

export type WeatherRiskCode =
  | 'LOCATION_NOT_SET'
  | 'LOCATION_NOT_FOUND'
  | 'SERVICE_UNAVAILABLE'
  | 'FETCH_ERROR';

export interface WeatherLocation {
  city: string;
  state: string | null;
  country: string | null;
  lat: number;
  lon: number;
  resolved: string;
}

export interface CurrentWeather {
  temp: number;
  feelsLike: number;
  humidity: number | null;
  windSpeed: number | null;
  description: string;
  icon: string;
  /** OpenWeather "main" weather string, e.g. Rain / Clear / Thunderstorm. */
  main: string;
  updatedAt: string;
}

export interface ForecastDay {
  date: string; // YYYY-MM-DD
  day: string; // e.g. 'Mon'
  max: number;
  min: number;
  pop: number; // probability of precipitation, 0..100
  rain: number; // mm
  wind?: number; // max m/s that day (optional, used internally)
  description: string;
  icon: string;
  main: string;
}

export interface WeatherRisk {
  rainRisk: RiskLevel;
  weatherRisk: RiskLevel;
  rainDays: number;
  summary: string;
  impacts: string[];
  precautions: string[];
}

export interface WeatherRiskData {
  location: WeatherLocation;
  current: CurrentWeather;
  forecast: ForecastDay[];
  risk: WeatherRisk;
  /** Provenance so users know the source and that it's an outlook. */
  source: string;
  /** Plain-language caveat shown in the UI. */
  disclaimer: string;
}

/** Result envelope returned by the Edge Function / service. */
export interface WeatherRiskResult {
  success: boolean;
  data?: WeatherRiskData;
  error?: string;
  code?: WeatherRiskCode;
}
