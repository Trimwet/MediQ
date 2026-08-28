/**
 * RBAC configuration for MediQ.
 *
 * Roles group permissions; components and route guards check permissions,
 * never role names directly. The auth store models roles as `string[]`, so a
 * user can hold several roles. Unknown roles are denied by default.
 *
 * This is the UI/UX layer of authorization. The backend MUST enforce the same
 * rules server-side (see src/types/domain.ts for the ownership scoping
 * contract), because hiding a route in the frontend is not security.
 */

export const ROLES = ['admin', 'front_desk', 'doctor', 'patient'] as const
export type Role = (typeof ROLES)[number]

export const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  front_desk: 'Front Desk',
  doctor: 'Doctor',
  patient: 'Patient',
}

export const PERMISSIONS = [
  'dashboard:view',
  'appointments:view',
  'appointments:book',
  'appointments:manage',
  'queue:view',
  'queue:manage',
  'patients:view',
  'patients:manage',
  'doctors:view',
  'doctors:manage',
  'staff:view',
  'staff:manage',
  'rooms:view',
  'rooms:manage',
  'notifications:view',
  'settings:view',
  'users:view',
  'users:manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export const rolePermissions: Record<Role, readonly Permission[]> = {
  // Clinic manager / administrator: everything
  admin: PERMISSIONS,
  // Receptionist: runs the front desk — books, checks in and cancels
  // appointments, manages the live queue. No directory/management surfaces.
  front_desk: [
    'dashboard:view',
    'appointments:view',
    'appointments:book',
    'appointments:manage',
    'queue:view',
    'queue:manage',
    'patients:view',
    'patients:manage',
    'notifications:view',
  ],
  // Clinician: sees their own work, cannot book or administer.
  // NOTE: doctors intentionally lack 'queue:manage' at the RBAC layer so the
  // UI hides Call next / Start visit / Complete / Mark left buttons. The RLS
  // policy on queue_entries UPDATE is permissive (user_in_clinic covers all
  // clinic members including doctors), so a doctor *could* bypass the UI and
  // update queue entries via the API. If that becomes a concern, tighten the
  // RLS to require role IN ('admin','front_desk') for UPDATE.
  doctor: [
    'dashboard:view',
    'appointments:view',
    'queue:view',
    'patients:view',
    'notifications:view',
  ],
  // Patient: a visitor who booked online without signing up. Can only see
  // their own appointments (row-level scoping — see src/types/domain.ts).
  patient: ['dashboard:view', 'appointments:view', 'notifications:view'],
}

export function can(roles: readonly string[], permission: Permission): boolean {
  return roles.some((role) =>
    (rolePermissions[role as Role] ?? []).includes(permission)
  )
}

export function hasRole(roles: readonly string[], role: Role): boolean {
  return roles.includes(role)
}

/**
 * Routes that require a specific permission to open.
 * Unlisted routes are open to every signed-in role. Row-level scoping
 * (doctors seeing only their own patients) lives in the backend, not here.
 */
export const routePermissions: Record<string, Permission> = {
  '/admin/appointments': 'appointments:view',
  '/admin/queue': 'queue:view',
  '/admin/patients': 'patients:view',
  '/admin/doctors': 'doctors:view',
  '/admin/staff': 'staff:view',
  '/admin/rooms': 'rooms:view',
  '/admin/notifications': 'notifications:view',
  '/admin/settings': 'settings:view',
  '/users': 'users:view',
}

/**
 * Resolve the permission required to open `pathname`, matching the longest
 * registered route prefix (so `/admin/settings/account` inherits
 * `/admin/settings`). Returns undefined for unlisted routes, which are open
 * to every signed-in role.
 */
export function requiredPermissionFor(
  pathname: string
): Permission | undefined {
  const match = Object.entries(routePermissions)
    .filter(([path]) => pathname === path || pathname.startsWith(`${path}/`))
    .sort(([a], [b]) => b.length - a.length)[0]
  return match?.[1]
}
