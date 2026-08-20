import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env — ' +
      'copy .env.example to .env and fill in your Supabase project credentials.'
  )
}

/**
 * Singleton Supabase client — used by all repository implementations and
 * the auth layer. The `Database` generic is inferred from the tables and
 * columns in supabase/migrations/20260819113813_init.sql.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// supabaseAdmin was removed.
// The service role key MUST NOT be a VITE_* env var — Vite exposes every
// VITE_* variable in the browser bundle, which would let any visitor bypass
// all Row-Level Security.
// Privileged calls (e.g. staff invite) go through the invite-staff Edge
// Function which reads SUPABASE_SERVICE_ROLE_KEY from Supabase Secrets on
// the server side. See supabase/functions/invite-staff/index.ts.
