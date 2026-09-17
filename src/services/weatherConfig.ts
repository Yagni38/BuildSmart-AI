// Single source of truth for Open-Meteo API base URLs.
// Open-Meteo is a free, keyless weather API that can be called
// directly from the browser — no API key, no Edge Function.
// See: https://open-meteo.com/
//
// WeatherRiskService and WeatherRiskCard both import from here
// so the base URLs stay in one place and never leak into JSX.
export const WEATHER_GEOCODING_BASE_URL =
  'https://geocoding-api.open-meteo.com/v1/search';
export const WEATHER_FORECAST_BASE_URL =
  'https://api.open-meteo.com/v1/forecast';
