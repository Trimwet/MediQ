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
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single()

          // Only preserve clinic fields when the session belongs to the SAME
          // user — prevents Alice's clinic leaking to Bob on the same browser.
          const prev = useAuthStore.getState().auth.user
          const shouldPreserve = prev?.accountNo === session.user.id

          // If the profile fetch failed, keep the previous role rather than
          // silently falling back to 'patient'.
          const resolvedRole = (() => {
            if (profileErr || !profile) {
              return shouldPreserve && prev?.role?.length ? prev.role : ['patient']
            }
            return profile.role ? [String(profile.role)] : ['patient']
          })()

          setUser({
            accountNo: session.user.id,
            email: session.user.email ?? '',
            role: resolvedRole,
            exp: session.expires_at != null ? session.expires_at * 1000 : Infinity,
            ...(shouldPreserve && prev?.clinicId ? { clinicId: prev.clinicId } : {}),
            ...(shouldPreserve && prev?.clinicRole ? { clinicRole: prev.clinicRole } : {}),
            ...(shouldPreserve && prev?.clinicName ? { clinicName: prev.clinicName } : {}),
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