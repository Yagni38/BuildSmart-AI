import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Single Supabase client for the whole app.
//
// The key is a PUBLIC (publishable / anon) key — safe for the browser and
// protected by Row Level Security. No service-role / secret key is ever
// used or bundled in frontend code.
//
// Both env names are accepted so existing deployments keep working:
//   VITE_SUPABASE_PUBLISHABLE_KEY  (preferred, new Supabase naming)
//   VITE_SUPABASE_ANON_KEY         (legacy name, currently in .env.local)
// ---------------------------------------------------------------------------
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey =
  ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)) ??
  undefined;

if (!supabaseUrl || !supabaseKey) {
  // Throwing here is intentional: without these the app cannot work at all,
  // and a clear console message beats a blank screen with no explanation.
  throw new Error(
    'Supabase environment variables are missing. Define VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in your .env.local file.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Keep the user signed in across page refreshes and tabs.
    // The default storage key is kept so existing sessions survive.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});