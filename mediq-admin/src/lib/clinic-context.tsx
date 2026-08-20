/**
 * Multi-tenancy context and hooks.
 *
 * `ClinicProvider` wraps the authenticated layout and resolves the user's
 * clinic membership on mount. Every repo and hook reads the current clinic
 * from `useCurrentClinic()` — never from props or URL params.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'

interface ClinicMembership {
  clinicId: string
  clinicRole: 'admin' | 'front_desk' | 'doctor'
  clinicName: string
  clinicSlug: string
  plan: string
}

interface ClinicContextValue {
  /** The user's current clinic. Null while loading or if the user has no clinic. */
  clinic: ClinicMembership | null
  /** All clinics this user belongs to (for the switcher). */
  allClinics: ClinicMembership[]
  /** Switch to a different clinic. */
  switchClinic: (clinicId: string) => void
  /** True while resolving clinic membership. */
  isLoading: boolean
  /** Error message when the user has no clinic assigned. */
  error: string | null
}

const ClinicContext = createContext<ClinicContextValue>({
  clinic: null,
  allClinics: [],
  switchClinic: () => {},
  isLoading: true,
  error: null,
})

export function useClinicContext() {
  return useContext(ClinicContext)
}

/**
 * The core hook used by repos and hooks. Returns the current clinic ID
 * and role. Throws if called outside the provider or before resolution.
 */
export function useCurrentClinic() {
  const { clinic, isLoading } = useClinicContext()
  if (isLoading) return { clinicId: null, clinicRole: null, isReady: false }
  return {
    clinicId: clinic?.clinicId ?? null,
    clinicRole: clinic?.clinicRole ?? null,
    isReady: true,
  }
}

export function ClinicProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.auth.user)
  const setUser = useAuthStore((s) => s.auth.setUser)
  const [clinic, setClinic] = useState<ClinicMembership | null>(null)
  const [allClinics, setAllClinics] = useState<ClinicMembership[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Track the last user email we fetched for to avoid duplicate fetches
  // when setUser triggers a re-render with a new object reference.
  const lastFetchedEmail = useRef<string | null>(null)

  const fetchMemberships = useCallback(async (email: string | undefined) => {
    if (!email) {
      setIsLoading(false)
      return
    }

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser) {
        setIsLoading(false)
        return
      }

      const { data: memberships, error: fetchErr } = await supabase
        .from('clinic_members')
        .select('clinic_id, role, clinics(id, name, slug, plan)')
        .eq('user_id', authUser.id)

      if (fetchErr) {
        console.error('Failed to fetch clinic memberships:', fetchErr)
        setIsLoading(false)
        return
      }

      if (!memberships?.length) {
        setError('No clinic assigned — contact your admin.')
        setIsLoading(false)
        return
      }

      const mapped: ClinicMembership[] = memberships.map(
        (m: Record<string, unknown>) => {
          const c = m.clinics as Record<string, unknown>
          return {
            clinicId: String(m.clinic_id),
            clinicRole: String(m.role) as 'admin' | 'front_desk' | 'doctor',
            clinicName: String(c.name),
            clinicSlug: String(c.slug),
            plan: String(c.plan),
          }
        }
      )

      setAllClinics(mapped)

      const currentStore = useAuthStore.getState().auth.user
      const current = mapped.find((m) => m.clinicId === currentStore?.clinicId)
      if (current) {
        setClinic(current)
        setIsLoading(false)
        return
      }

      const first = mapped[0]
      setClinic(first)
      // Only call setUser if values actually changed — prevents the re-render
      // cascade where setUser → new reference → useEffect → fetch → setUser.
      if (
        currentStore &&
        (currentStore.clinicId !== first.clinicId ||
          currentStore.clinicRole !== first.clinicRole ||
          currentStore.clinicName !== first.clinicName)
      ) {
        setUser({
          ...currentStore,
          clinicId: first.clinicId,
          clinicRole: first.clinicRole,
          clinicName: first.clinicName,
        })
      }
    } catch (err) {
      console.error('Clinic resolution failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [setUser])

  useEffect(() => {
    if (!user) {
      setIsLoading(false)
      return
    }

    // If the user already has a clinic in the auth store, use it immediately
    if (user.clinicId && user.clinicRole && user.clinicName) {
      setClinic({
        clinicId: user.clinicId,
        clinicRole: user.clinicRole,
        clinicName: user.clinicName,
        clinicSlug: 'default', // will be refreshed below
        plan: 'professional',
      })
      // Still fetch the full list for the switcher, but skip if already fetched
      if (lastFetchedEmail.current !== user.email) {
        lastFetchedEmail.current = user.email
        fetchMemberships(user.email)
      } else {
        setIsLoading(false)
      }
      return
    }

    if (lastFetchedEmail.current !== user.email) {
      lastFetchedEmail.current = user.email
      fetchMemberships(user.email)
    } else {
      setIsLoading(false)
    }
  }, [user, fetchMemberships])

  function switchClinic(newClinicId: string) {
    const target = allClinics.find((c) => c.clinicId === newClinicId)
    if (!target) return

    setClinic(target)
    setUser({
      ...user!,
      clinicId: target.clinicId,
      clinicRole: target.clinicRole,
      clinicName: target.clinicName,
    })
    // Force a full page reload so all React Query caches are invalidated
    // and every hook re-fetches with the new clinic scope.
    window.location.reload()
  }

  return (
    <ClinicContext.Provider
      value={{ clinic, allClinics, switchClinic, isLoading, error }}
    >
      {children}
    </ClinicContext.Provider>
  )
}
