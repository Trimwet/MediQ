import { createFileRoute, redirect } from '@tanstack/react-router'
import { hasRole } from '@/config/rbac'
import { ClinicProvider } from '@/lib/clinic-context'
import { useAuthStore } from '@/stores/auth-store'
import { PatientPortal } from '@/features/patient'

export const Route = createFileRoute('/patient')({
  beforeLoad: ({ location }) => {
    const user = useAuthStore.getState().auth.user
    if (!user || user.exp < Date.now()) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }
    if (!hasRole(user.role, 'patient')) {
      if (
        hasRole(user.role, 'admin') ||
        hasRole(user.role, 'front_desk') ||
        hasRole(user.role, 'doctor')
      ) {
        throw redirect({ to: '/admin/dashboard' })
      }
      throw redirect({ to: '/403' })
    }
  },
  component: () => (
    <ClinicProvider>
      <PatientPortal />
    </ClinicProvider>
  ),
})
