/**
 * Weather service (frontend) — browser-safe, no Edge Function, no Gemini.
 *
 * Reads the customer's SAVED construction location from public.projects
 * and uses the free Open-Meteo APIs (geocoding + forecast), which need no
 * API key and therefore expose no secrets in browser code.
 */
import { getProjectById } from './projectService';
import type { ForecastDay, WeatherRiskResult } from '../types/weather';
// ---------------------------------------------------------------------------
// Open-Meteo helpers (browser-safe, keyless). No Edge Function, no secrets.
// ---------------------------------------------------------------------------

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string | null;
  admin1: string | null;
}

async function geocodeLocation(city: string, state: string | null): Promise<GeoResult | null> {
  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}` +
    `&count=10&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json() as { results?: Array<{
    name: string; latitude: number; longitude: number;
    country?: string; admin1?: string;
  }> };
  const results = json.results ?? [];
  if (results.length === 0) return null;
  if (state) {
    const s = state.toLowerCase();
    const match = results.find((r) =>
      (r.admin1 ?? '').toLowerCase().includes(s) ||
      (r.country ?? '').toLowerCase().includes(s) ||
      r.name.toLowerCase().includes(s),
    );
    if (match) {
      return {
        name: match.name, latitude: match.latitude, longitude: match.longitude,
        country: match.country ?? null, admin1: match.admin1 ?? null,
      };
    }
  }
  const first = results[0];
  return {
    name: first.name, latitude: first.latitude, longitude: first.longitude,
    country: first.country ?? null, admin1: first.admin1 ?? null,
  };
}

interface OpenMeteoForecast {
  current?: {
    temperature_2m?: number; relative_humidity_2m?: number;
    apparent_temperature?: number; weather_code?: number; wind_speed_10m?: number;
  };
  daily?: {
    time?: string[]; weather_code?: number[];
    temperature_2m_max?: number[]; temperature_2m_min?: number[];
    precipitation_probability_max?: number[]; precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
  };
}

async function fetchForecast(lat: number, lon: number): Promise<OpenMeteoForecast | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,` +
    `precipitation_probability_max,precipitation_sum,wind_speed_10m_max` +
    `&timezone=auto&forecast_days=5`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as OpenMeteoForecast;
}

/** Map a WMO weather code to a display triple + OWM-style icon for the card. */
function describeCode(code: number): { main: string; description: string; icon: string } {
  if (code === 0) return { main: 'Clear', description: 'clear sky', icon: '01d' };
  if (code === 1) return { main: 'Clouds', description: 'mainly clear', icon: '02d' };
  if (code === 2) return { main: 'Clouds', description: 'partly cloudy', icon: '03d' };
  if (code === 3) return { main: 'Clouds', description: 'overcast', icon: '04d' };
  if (code === 45 || code === 48) return { main: 'Mist', description: 'fog', icon: '50d' };
  if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) {
    return { main: 'Drizzle', description: 'drizzle', icon: '09d' };
  }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { main: 'Rain', description: 'rain', icon: '10d' };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { main: 'Snow', description: 'snow', icon: '13d' };
  }
  if (code === 95 || code === 96 || code === 99) {
    return { main: 'Thunderstorm', description: 'thunderstorm', icon: '11d' };
  }
  return { main: 'Clouds', description: 'cloudy', icon: '03d' };
}

function riskFromMain(main: string): 'low' | 'moderate' | 'high' {
  if (main === 'Thunderstorm') return 'high';
  if (main === 'Rain' || main === 'Snow' || main === 'Mist' || main === 'Drizzle') return 'moderate';
  return 'low';
}

function riskFromPop(pop: number, rainMm: number): 'low' | 'moderate' | 'high' {
  if (pop >= 70 || rainMm >= 10) return 'high';
  if (pop >= 40 || rainMm >= 2) return 'moderate';
  return 'low';
}

function dayName(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? isoDate.slice(5)
    : d.toLocaleDateString('en-US', { weekday: 'short' });
}


/**
 * Fetch a construction weather outlook for the project with the given id,
 * using that project's saved city/state as the location.
 */
export async function getWeatherRisk(projectId: string): Promise<WeatherRiskResult> {
  // Re-read the project so the outlook always reflects the SAVED location.
  let project;
  try {
    project = await getProjectById(projectId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      code: 'FETCH_ERROR',
      error: `Unable to load project location: ${message}`,
    };
  }

  const city = String(project?.city ?? '').trim();
  const state = String(project?.state ?? '').trim() || null;

  if (!city) {
    return {
      success: false,
      code: 'LOCATION_NOT_SET',
      error:
        'Add a construction location (city/state) to your project to see the weather outlook.',
    };
  }

  // Geocode the SAVED project location (browser-safe Open-Meteo, keyless).
  let geo: GeoResult | null;
  try {
    geo = await geocodeLocation(city, state);
  } catch {
    return {
      success: false,
      code: 'SERVICE_UNAVAILABLE',
      error:
        'The location lookup is unreachable right now. Check your connection and try again. Your construction schedule is not affected.',
    };
  }

  if (!geo) {
    return {
      success: false,
      code: 'LOCATION_NOT_FOUND',
      error:
        `Could not find weather data for "${state ? `${city}, ${state}` : city}". ` +
        'Try a more specific city name in your project location.',
    };
  }

  let forecast: OpenMeteoForecast | null;
  try {
    forecast = await fetchForecast(geo.latitude, geo.longitude);
  } catch {
    return {
      success: false,
      code: 'SERVICE_UNAVAILABLE',
      error:
        'Weather data is currently unavailable for this location. Check back later or rely on your local forecast. Your construction schedule is not affected.',
    };
  }

  if (!forecast?.daily?.time?.length) {
    return {
      success: false,
      code: 'SERVICE_UNAVAILABLE',
      error: 'Weather service returned an empty response.',
    };
  }

  const cur = forecast.current;
  const curDesc = describeCode(cur?.weather_code ?? 3);
  const daily = forecast.daily;
  const times = daily.time ?? [];

  const days: ForecastDay[] = times.slice(0, 5).map((date, i) => {
    const code = daily.weather_code?.[i] ?? 3;
    const d = describeCode(code);
    const windMax = daily.wind_speed_10m_max?.[i];
    return {
      date,
      day: dayName(date),
      max: Math.round(daily.temperature_2m_max?.[i] ?? 0),
      min: Math.round(daily.temperature_2m_min?.[i] ?? 0),
      pop: Math.round(daily.precipitation_probability_max?.[i] ?? 0),
      rain: Math.round((daily.precipitation_sum?.[i] ?? 0) * 10) / 10,
             wind: windMax != null ? Math.round((windMax / 3.6) * 10) / 10 : undefined,
      description: d.description,
      icon: d.icon,
      main: d.main,
    };
  });

  // Construction risk summary (planning hints only — never blocks scheduling).
  let rainDays = 0;
  let highRiskDays = 0;
  let moderateRiskDays = 0;
  const impacts: string[] = [];
  const precautions: string[] = [
    'Keep the site drained and loose materials covered when rain is in the forecast.',
    'Postpone outdoor concreting, plastering, and tile work on high-risk days and allow extra curing time after rain.',
    'For thunderstorm-risk days, pause work on scaffolding, roofing, and exposed steel until the worst passes.',
    'Use this outlook as a planning hint only — always confirm with the latest local forecast before committing a critical pour or lift.',
  ];

  for (const day of days) {
    const rainLevel = riskFromPop(day.pop, day.rain);
    const weatherLevel = riskFromMain(day.main);
    if (rainLevel !== 'low' || weatherLevel !== 'low') rainDays += 1;
    if (rainLevel === 'high' || weatherLevel === 'high') highRiskDays += 1;
    else if (rainLevel === 'moderate' || weatherLevel === 'moderate') moderateRiskDays += 1;

    if (day.pop >= 60 || day.rain >= 5) {
      impacts.push(`Rain is likely on ${day.day} (${day.date}) — wet site, muddy access routes, and slower curing.`);
    }
    if (day.main === 'Thunderstorm') {
      impacts.push(`${day.day} (${day.date}) carries thunderstorm risk — pause outdoor work, scaffolding, and roofing.`);
    }
    if (day.main === 'Snow' || (day.rain > 0 && day.max < 5)) {
      impacts.push(`${day.day} (${day.date}) may be too cold/wet for concrete pouring and plastering.`);
    }
    if (day.wind != null && day.wind > 8) {
      impacts.push(`${day.day} (${day.date}) has stronger winds — secure cranes, scaffolding, and loose materials.`);
    }
    if (day.pop >= 30 && day.pop < 60) {
      impacts.push(`${day.day} (${day.date}) has a moderate chance of showers — keep tarps and drainage ready.`);
    }
  }

  const severeDay = days.some(
    (d) => d.main === 'Thunderstorm' || d.main === 'Snow' || (d.wind != null && d.wind > 10),
  );
  const rainRisk: 'low' | 'moderate' | 'high' =
    highRiskDays > 0 ? 'high' : moderateRiskDays > 0 ? 'moderate' : 'low';
  const weatherRisk: 'low' | 'moderate' | 'high' =
    severeDay ? 'high' : rainRisk === 'moderate' || moderateRiskDays > 0 ? 'moderate' : 'low';

  const summary =
    rainRisk === 'high' || days.some((d) => d.main === 'Thunderstorm' || d.main === 'Snow')
      ? 'Several days in the outlook look wet or rough. Plan outdoor-critical work around them.'
      : moderateRiskDays > 0
        ? 'A few days look showery or unsettled. You can likely keep building with the usual wet-weather prep.'
        : 'The next few days look largely dry and workable. Keep an eye on the forecast as your schedule approaches.';

  const resolved = state ? `${city}, ${state}` : city;
  const curWind = cur?.wind_speed_10m;

  return {
    success: true,
    data: {
      location: {
        city,
        state,
        country: geo.country,
        lat: geo.latitude,
        lon: geo.longitude,
        resolved: geo.admin1 ? `${geo.name}, ${geo.admin1}` : resolved,
      },
      current: {
        temp: Math.round(cur?.temperature_2m ?? 0),
        feelsLike: Math.round(cur?.apparent_temperature ?? cur?.temperature_2m ?? 0),
        humidity: cur?.relative_humidity_2m ?? null,
                 windSpeed: curWind != null ? Math.round((curWind / 3.6) * 10) / 10 : null,
        description: curDesc.description,
        icon: curDesc.icon,
        main: curDesc.main,
        updatedAt: new Date().toISOString(),
      },
      forecast: days,
      risk: { rainRisk, weatherRisk, rainDays, summary, impacts, precautions },
      source: 'Open-Meteo — preliminary outlook, not a construction forecast.',
      disclaimer:
        'This is a preliminary weather outlook for planning only. It is not a guaranteed forecast and should not be used as the sole basis for stopping or rescheduling construction. Always confirm with the latest local weather service before committing critical work.',
    },
  };
}
