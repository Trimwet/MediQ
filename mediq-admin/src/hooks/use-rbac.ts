import { useCallback } from 'react'
import { can, hasRole, type Permission, type Role } from '@/config/rbac'
import { useAuthStore } from '@/stores/auth-store'

// Stable empty-array sentinel so the Zustand selector never creates a fresh
// `[]` on each call (which would break useSyncExternalStore's getSnapshot
// caching and cause "Maximum update depth exceeded").
const EMPTY_ROLES: readonly string[] = []

/**
 * Reactive RBAC helpers bound to the signed-in user's roles.
 * Components should ask "can I do X?" via `can`, never compare role names.
 */
export function useRbac() {
  const roles = useAuthStore(
    (state) => (state.auth.user?.role as readonly string[] | undefined) ?? EMPTY_ROLES
  )

  return {
    roles,
    can: useCallback(
      (permission: Permission) => can(roles, permission),
      [roles]
    ),
    hasRole: useCallback((role: Role) => hasRole(roles, role), [roles]),
  }
}
