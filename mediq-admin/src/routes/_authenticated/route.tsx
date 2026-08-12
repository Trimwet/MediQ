import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { can, requiredPermissionFor } from '@/config/rbac'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    const user = useAuthStore.getState().auth.user

    // Not signed in: send to sign-in and remember where they were going
    if (!user) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
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
