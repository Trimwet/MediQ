import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'

export function useSupabaseAuthSync() {
  const setUser = useAuthStore((state) => state.auth.setUser)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'PASSWORD_RECOVERY') {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single()

          setUser({
            accountNo: session.user.id,
            email: session.user.email ?? '',
            role: profile?.role ? [profile.role] : ['patient'],
            // expires_at is a Unix timestamp in seconds. Multiplying by 1000
            // gives ms for comparison with Date.now().
            // Use Infinity when undefined (e.g. magic-link sessions without
            // an explicit expiry) so the session isn't immediately invalidated
            // by the `user.exp < Date.now()` guard in the route loader.
            exp: session.expires_at != null ? session.expires_at * 1000 : Infinity,
          })
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [setUser])
}