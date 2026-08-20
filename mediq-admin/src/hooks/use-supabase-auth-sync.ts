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

          // Preserve existing clinic fields so auth-sync doesn't wipe the
          // current clinic context (clinicId, clinicRole, clinicName).
          const prev = useAuthStore.getState().auth.user

          setUser({
            accountNo: session.user.id,
            email: session.user.email ?? '',
            role: profile?.role ? [profile.role] : ['patient'],
            exp: session.expires_at != null ? session.expires_at * 1000 : Infinity,
            ...(prev?.clinicId ? { clinicId: prev.clinicId } : {}),
            ...(prev?.clinicRole ? { clinicRole: prev.clinicRole } : {}),
            ...(prev?.clinicName ? { clinicName: prev.clinicName } : {}),
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