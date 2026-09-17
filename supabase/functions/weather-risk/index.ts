// ============================================================
// BuildSmart AI — Phase 8: weather-risk Edge Function
// ============================================================
// Server-side construction weather outlook for a saved project
// location. Resolves city/state → lat/lon via OpenWeatherMap
// geocoding, then fetches current + 5-day forecast and computes
// construction-oriented risk flags / impacts / precautions.
//
// The OpenWeatherMap API key lives ONLY in Supabase secrets
// (WEATHER_API_KEY). It is never exposed to the browser.
//
// All "business" failures (no location, location not found,
// provider unavailable) return { success: false, code } with
// HTTP 200 so the dashboard can degrade gracefully and never
// block construction scheduling automatically.
// ============================================================
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

// ---------------------------------------------------------------------------
// Configuration (read from Supabase secrets / environment)
// ---------------------------------------------------------------------------
// Preferred secret name: OPENWEATHERMAP_API_KEY.
// WEATHER_API_KEY is also accepted so either existing project secret works —
// no duplicate secret is required. The key is NEVER exposed to the browser.
const WEATHER_API_KEY =
  Deno.env.get('OPENWEATHERMAP_API_KEY') || Deno.env.get('WEATHER_API_KEY');
const WEATHER_BASE_URL =
  Deno.env.get('WEATHER_BASE_URL') ||
  'https://api.openweathermap.org/data/2.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestBody {
  /** Preferred: full location string, e.g. "Hyderabad, Telangana". */
  location?: string;
  /** Alternative: separate city / state fields. */
  city?: string;
  state?: string | null;
}

interface GeoCoord { lat: number; lon: number; }

interface OpenWeatherCurrent {
  name: string;
  sys: { country?: string; sunrise?: number; sunset?: number };
  main: { temp: number; feels_like: number; humidity: number; pressure?: number; };
  wind?: { speed?: number; gust?: number; deg?: number };
  weather?: Array<{ id: number; main: string; description: string; icon: string; }>;
}

interface OpenWeatherForecastItem {
  dt: number; dt_txt: string;
  main: { temp: { min: number; max: number }; humidity?: number; pop?: number; };
  wind?: { speed?: number };
  weather?: Array<{ id: number; main: string; description: string; icon: string; }>;
  rain?: { '3h'?: number };
}

interface OpenWeatherForecast { list: OpenWeatherForecastItem[]; }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function corsOk(body: string, status = 200) {
  return new Response(body, { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function jsonOk(data: unknown, status = 200) { return corsOk(JSON.stringify(data), status); }

function fail(code: string, message: string, status = 200) { return jsonOk({ success: false, code, error: message }, status); }

function isoDate(ts: number): string { return new Date(ts * 1000).toISOString().slice(0, 10); }

function dayName(ts: number): string { return new Date(ts * 1000).toLocaleDateString('en-US', { weekday: 'short' }); }

// ---------------------------------------------------------------------------
// Fetch functions
// ---------------------------------------------------------------------------
/**
 * Resolve (city, state?) → { lat, lon } using OpenWeatherMap's
 * geocoding endpoint. Returns null when the lookup fails for any
 * reason (missing key, network error, no results).
 */
async function resolveCoords(city: string, state?: string | null): Promise<GeoCoord | null> {
  if (!WEATHER_API_KEY) return null;
  const params = new URLSearchParams({ q: state ? `${city},${state}` : city, limit: '1', appid: WEATHER_API_KEY });
  const res = await fetch(`${WEATHER_BASE_URL}/geo/1.0/direct?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const results = await res.json() as Array<{ lat: number; lon: number; state?: string }>;
  const match = results[0];
  if (!match) return null;
  if (state && match.state?.toLowerCase() !== state.toLowerCase()) {
    const sameState = results.find((r) => r.state?.toLowerCase() === state.toLowerCase());
    if (sameState) return { lat: sameState.lat, lon: sameState.lon };
  }
  return { lat: match.lat, lon: match.lon };
}

/** Fetch current weather for a lat/lon. Returns null on any failure. */
async function fetchCurrent(lat: number, lon: number): Promise<OpenWeatherCurrent | null> {
  if (!WEATHER_API_KEY) return null;
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon), units: 'metric', appid: WEATHER_API_KEY });
  const res = await fetch(`${WEATHER_BASE_URL}/weather?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  return (await res.json()) as OpenWeatherCurrent;
}

/** Fetch the 5-day / 3-hour forecast. Returns null on any failure. */
async function fetchForecast(lat: number, lon: number): Promise<OpenWeatherForecast | null> {
  if (!WEATHER_API_KEY) return null;
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon), units: 'metric', appid: WEATHER_API_KEY });
  const res = await fetch(`${WEATHER_BASE_URL}/forecast?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  return (await res.json()) as OpenWeatherForecast;
}

// ---------------------------------------------------------------------------
// Forecast-day collapse
// ---------------------------------------------------------------------------

interface ForecastDay { date: string; day: string; max: number; min: number; pop: number; rain: number; wind?: number; description: string; icon: string; main: string; }

function collapseForecast(forecast: OpenWeatherForecast): ForecastDay[] {
  const byDate = new Map<string, { max: number; min: number; pop: number; rain: number; wind: number; descriptions: Array<{ main: string; description: string; icon: string; id: number }> }>();
  for (const item of forecast.list) {
    const date = item.dt_txt.slice(0, 10);
    const entry = byDate.get(date) || { max: -Infinity, min: Infinity, pop: 0, rain: 0, wind: 0, descriptions: [] };
    const m = item.main;
    if (m.temp.max > entry.max) entry.max = m.temp.max;
    if (m.temp.min < entry.min) entry.min = m.temp.min;
    if (m.pop !== undefined && m.pop > entry.pop) entry.pop = m.pop;
    entry.rain = Math.max(entry.rain, item.rain?.['3h'] ?? 0);
    if (item.wind?.speed) entry.wind = Math.max(entry.wind, item.wind.speed);
    if (item.weather?.length) { const w = item.weather[0]; entry.descriptions.push({ id: w.id, main: w.main, description: w.description, icon: w.icon }); }
    byDate.set(date, entry);
  }
  const days: ForecastDay[] = [];
  for (const [date, entry] of byDate) {
    if (days.length >= 5) break;
    const dominant = entry.descriptions.reduce((a, b) => (a.id >= b.id ? a : b), { id: 0, main: 'Clear', description: 'clear sky', icon: '01d' });
    days.push({ date, day: dayName(new Date(date).getTime() / 1000), max: Math.round(entry.max), min: Math.round(entry.min), pop: Math.round(entry.pop), rain: Math.round(entry.rain * 10) / 10, wind: entry.wind ? Math.round(entry.wind * 10) / 10 : undefined, description: dominant.description, icon: dominant.icon, main: dominant.main });
  }
  return days;
}
// ---------------------------------------------------------------------------
// Construction risk heuristics
// ---------------------------------------------------------------------------

const THUNDER_ID_MIN = 200, THUNDER_ID_MAX = 232, RAIN_ID_MIN = 500, RAIN_ID_MAX = 531;
const DRIZZLE_ID_MIN = 300, DRIZZLE_ID_MAX = 399, SNOW_ID_MIN = 600, SNOW_ID_MAX = 622;
const MIST_ID_MIN = 701, MIST_ID_MAX = 781, CLEAR_ID_MIN = 800, CLEAR_ID_MAX = 804;

function weatherMainFromId(id: number): string {
  if (id >= THUNDER_ID_MIN && id <= THUNDER_ID_MAX) return 'Thunderstorm';
  if (id >= RAIN_ID_MIN && id <= RAIN_ID_MAX) return 'Rain';
  if (id >= DRIZZLE_ID_MIN && id <= DRIZZLE_ID_MAX) return 'Drizzle';
  if (id >= SNOW_ID_MIN && id <= SNOW_ID_MAX) return 'Snow';
  if (id >= MIST_ID_MIN && id <= MIST_ID_MAX) return 'Mist';
  if (id >= 900 && id <= 906) return 'Extreme';
  if (id >= 951 && id <= 962) return 'Other';
  if (id >= CLEAR_ID_MIN && id <= CLEAR_ID_MAX) return id === 800 ? 'Clear' : 'Clouds';
  if (id >= 200 && id < 300) return 'Thunderstorm';
  if (id >= 500 && id < 600) return 'Rain';
  if (id >= 600 && id < 700) return 'Snow';
  if (id >= 700 && id < 800) return 'Mist';
  return 'Other';
}

function riskLevelFromPop(pop: number, rainMm: number): 'low' | 'moderate' | 'high' {
  if (pop >= 70 || rainMm >= 10) return 'high';
  if (pop >= 40 || rainMm >= 2) return 'moderate';
  return 'low';
}

function weatherRiskFromMain(main: string): 'low' | 'moderate' | 'high' {
  if (main === 'Thunderstorm' || main === 'Extreme') return 'high';
  if (main === 'Rain' || main === 'Snow' || main === 'Mist') return 'moderate';
  if (main === 'Drizzle') return 'moderate';
  return 'low';
}

function buildRisk(forecast: ForecastDay[]) {
  let rainDays = 0, highRiskDays = 0, moderateRiskDays = 0;
  const impacts = new Set<string>(), precautions = new Set<string>();
  for (const day of forecast) {
    const rainLevel = riskLevelFromPop(day.pop, day.rain);
    const weatherLevel = weatherRiskFromMain(day.main);
    if (rainLevel !== 'low' || weatherLevel !== 'low') rainDays++;
    if (rainLevel === 'high' || weatherLevel === 'high') highRiskDays++;
    if (rainLevel === 'moderate' || weatherLevel === 'moderate') moderateRiskDays++;
    if (day.pop >= 60 || day.rain >= 5) impacts.add(`Rain is likely on ${day.day} (${day.date}) — wet site, muddy access routes, and slower curing.`);
    if (day.main === 'Thunderstorm' || day.main === 'Extreme') impacts.add(`${day.day} (${day.date}) carries thunderstorm/extreme-weather risk — outdoor work, scaffolding, and roofing should be paused.`);
    if (day.main === 'Snow' || (day.rain > 0 && day.max < 5)) impacts.add(`${day.day} (${day.date}) may be too cold/wet for concrete pouring and plastering.`);
    if (day.wind && day.wind > 8) impacts.add(`${day.day} (${day.date}) has stronger winds — cranes, scaffolding, loose materials, and roofing work need extra securing.`);
    if (day.pop >= 30 && day.pop < 60) impacts.add(`${day.day} (${day.date}) has a moderate chance of showers — have tarps and drainage ready if you schedule outdoor work.`);
  }
  const rainRisk: 'low' | 'moderate' | 'high' = highRiskDays > 0 ? 'high' : moderateRiskDays > 0 ? 'moderate' : 'low';
  const weatherRisk: 'low' | 'moderate' | 'high' = forecast.some((d) => d.main === 'Thunderstorm' || d.main === 'Extreme' || d.main === 'Snow' || (d.wind && d.wind > 10)) ? 'high' : rainRisk === 'moderate' || moderateRiskDays > 0 ? 'moderate' : 'low';
  precautions.add('Keep the site drained and any loose materials covered when rain is in the forecast.');
  precautions.add('Postpone outdoor concreting, plastering, and tile work on high-risk days and allow extra curing time after rain.');
  precautions.add('For thunderstorm/extreme-risk days, pause work on scaffolding, roofing, and exposed steel until the worst passes.');
  if (forecast.some((d) => d.wind && d.wind > 8)) precautions.add('On windy days, secure cranes, scaffolding, formwork, and loose stacks before work begins.');
  precautions.add('Use this outlook as a planning hint only — always confirm with the latest local forecast before committing a critical pour or lift.');
  const summary = rainRisk === 'high' || forecast.some((d) => d.main === 'Thunderstorm' || d.main === 'Extreme' || d.main === 'Snow') ? 'Several days in the outlook look wet or rough. Plan outdoor-critical work around them.' : moderateRiskDays > 0 ? 'A few days look showery or unsettled. You can likely keep building with the usual wet-weather prep.' : 'The next few days look largely dry and workable. Keep an eye on the forecast as your schedule approaches.';
  return { rainRisk, weatherRisk, rainDays, summary, impacts: [...impacts], precautions: [...precautions] };
}
// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = (await req.json()) as RequestBody | undefined;

    // Accept either { location: "Hyderabad, Telangana" } or { city, state }.
    let city = body?.city ? String(body.city).trim() : '';
    let state = body?.state ? String(body.state).trim() || null : null;

    if (!city && body?.location) {
      const parts = String(body.location).split(',').map((p) => p.trim()).filter(Boolean);
      city = parts[0] ?? '';
      state = parts[1] ?? state;
    }

    if (!WEATHER_API_KEY) {
      return fail(
        'SERVICE_UNAVAILABLE',
        'Weather provider key is not configured on the server. Set the OPENWEATHERMAP_API_KEY secret (supabase secrets set OPENWEATHERMAP_API_KEY=...) and redeploy. Your schedule is not affected.',
      );
    }
    if (!city) return fail('LOCATION_NOT_SET', 'No city was provided.');
    const coords = await resolveCoords(city, state);
    if (!coords) return fail('LOCATION_NOT_FOUND', `Could not find weather data for "${city}${state ? `, ${state}` : ''}". Try a different city name or add a more specific location to your project.`);
    const [current, forecastRaw] = await Promise.all([fetchCurrent(coords.lat, coords.lon), fetchForecast(coords.lat, coords.lon)]);
    if (!current || !forecastRaw) return fail('SERVICE_UNAVAILABLE', 'Weather data is currently unavailable for this location. The outlook will not block your construction schedule — please check back later or rely on your local forecast.');
    const forecast = collapseForecast(forecastRaw);
    const risk = buildRisk(forecast);
    const resolvedName = [city, state].filter(Boolean).join(', ');
    return jsonOk({
      success: true,
      data: {
        location: { city, state, country: current.sys?.country ?? null, lat: coords.lat, lon: coords.lon, resolved: resolvedName },
        current: {
          temp: Math.round(current.main.temp),
          feelsLike: Math.round(current.main.feels_like),
          humidity: current.main.humidity,
          windSpeed: current.wind?.speed !== undefined ? Math.round(current.wind.speed * 10) / 10 : null,
          description: current.weather?.[0]?.description ?? '—',
          icon: current.weather?.[0]?.icon ?? '01d',
          main: current.weather?.[0]?.main ?? weatherMainFromId(0),
          updatedAt: new Date().toISOString(),
        },
        forecast,
        risk,
        source: 'OpenWeather — preliminary outlook, not a construction forecast.',
        disclaimer: 'This is a preliminary weather outlook for planning only. It is not a guaranteed forecast and should not be used as the sole basis for stopping or rescheduling construction. Always confirm with the latest local weather service before committing critical work.',
      },
    });
  } catch (err) {
    return fail('FETCH_ERROR', err instanceof Error ? err.message : 'Unexpected error while fetching weather risk.');
  }
});
