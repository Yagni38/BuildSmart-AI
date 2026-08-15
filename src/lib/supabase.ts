import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client initialization.
 *
 * Reads configuration from Vite environment variables:
 *   - VITE_SUPABASE_URL
 *   - VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * These values must be defined in a local `.env.local` file (which is
 * git-ignored) or in the deployment environment. No credentials are
 * hardcoded in this file.
 */

const supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey: string | undefined = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Validates that the required Supabase environment variables are present.
 * Throws a descriptive error at module load time if they are missing,
 * so misconfiguration is caught early during development/build.
 */
function validateSupabaseEnv(): void {
  const missing: string[] = [];

  if (!supabaseUrl) {
    missing.push('VITE_SUPABASE_URL');
  }

  if (!supabaseAnonKey) {
    missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  if (missing.length > 0) {
    throw new Error(
      `Supabase environment variables are missing: ${missing.join(', ')}. ` +
      'Please add them to your .env.local file. ' +
      'Example:\n' +
      'VITE_SUPABASE_URL=https://your-project-ref.supabase.co\n' +
      'VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-publishable-key'
    );
  }
}

// Validate environment variables at module load time.
validateSupabaseEnv();

/**
 * The shared Supabase client instance.
 *
 * The non-null assertions are safe here because validateSupabaseEnv()
 * has already guaranteed both values are defined at runtime.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl as string,
  supabaseAnonKey as string
);

export default supabase;