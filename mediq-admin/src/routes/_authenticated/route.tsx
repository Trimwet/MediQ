import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { can, hasRole, requiredPermissionFor } from '@/config/rbac'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    const user = useAuthStore.getState().auth.user

    // Not signed in or session expired: send to sign-in and remember where they were going
    if (!user || user.exp < Date.now()) {
      if (user) {
        useAuthStore.getState().auth.reset()
      }
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }

    // Patients must stay in the patient portal — block /admin/* access
    if (hasRole(user.role, 'patient') && location.pathname.startsWith('/admin')) {
      throw redirect({ to: '/patient' })
    }

    // Signed in but not allowed on this route (longest-prefix match so
    // settings sub-paths inherit the /admin/settings permission)
    const requiredPermission = requiredPermissionFor(location.pathname)
    if (requiredPermission && !can(user.role, requiredPermission)) {
      throw redirect({ to: '/403' })
    }
  },
  component: AuthenticatedLayout,
})
