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

/**
 * Admin client — uses the service-role key to call privileged APIs such as
 * `auth.admin.createUser`. Only used for staff invites; never exposed to
 * non-admin code paths.
 */
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as
  | string
  | undefined

export const supabaseAdmin = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: 'mediq-admin-service-role',
      },
    })
  : null
