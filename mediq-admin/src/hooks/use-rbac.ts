import { useCallback } from 'react'
import { can, hasRole, type Permission, type Role } from '@/config/rbac'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Reactive RBAC helpers bound to the signed-in user's roles.
 * Components should ask "can I do X?" via `can`, never compare role names.
 */
export function useRbac() {
  const roles = useAuthStore((state) => state.auth.user?.role ?? [])

  return {
    roles,
    can: useCallback(
      (permission: Permission) => can(roles, permission),
      [roles]
    ),
    hasRole: useCallback((role: Role) => hasRole(roles, role), [roles]),
  }
}
