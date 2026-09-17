# Weather Feature (Phase 8) — Implementation Guide

The Construction Weather Outlook card on the Customer Dashboard fetches
**real weather** for the customer's saved project location using the
**browser-safe Open-Meteo API** (geocoding + forecast). No API key is
needed and none is exposed in frontend code.

## Architecture

```
CustomerDashboard.tsx
  └─ getWeatherRisk(projectId)          // src/services/weatherService.ts
       ├─ getProjectById(projectId)     // reads saved city/state from public.projects
       ├─ Open-Meteo Geocode API        // city → lat/lon (no key)
       └─ Open-Meteo Forecast API       // lat/lon → current + 5-day forecast (no key)
```

The weather service re-reads the project from Supabase every time so the
outlook always reflects the **most recently saved location**.


The weather service (`getWeatherRisk`) returns a `WeatherRiskResult`:

- On success: `location` (resolved city/state/country/lat/lon), `current` weather
  (temperature, feels-like, humidity, wind, description, icon), `forecast` (5-day
  outlook with max/min temps, precipitation probability, rain mm, dominant condition),
  `risk` (rain/weather risk level, summary, possible construction impacts, simple
  precautions), plus `source` + `disclaimer`.

## Guarantees

- No API key in frontend code — Open-Meteo is free and keyless.
- No Edge Function required — the card shows a friendly error and never blocks
  construction scheduling if the service is unavailable.
- The outlook is explicitly labelled as a **preliminary planning hint**, not a
  guaranteed forecast.
