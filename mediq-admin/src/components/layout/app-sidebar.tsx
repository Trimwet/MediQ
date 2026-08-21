import { type Permission, type Role, routePermissions } from '@/config/rbac'
import { useAuthStore } from '@/stores/auth-store'
import { useFacilityStore } from '@/stores/facility-store'
import { useLayout } from '@/context/layout-provider'
import { useRbac } from '@/hooks/use-rbac'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'
import { type NavItem } from './types'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { can, hasRole } = useRbac()
  const user = useAuthStore((state) => state.auth.user)
  // Select primitives individually — Zustand v5 / useSyncExternalStore
  // requires getSnapshot to return a referentially stable value. Destructuring
  // a whole-store call like `useFacilityStore()` can break that guarantee when
  // the persist middleware rehydrates, triggering "Maximum update depth exceeded".
  const trackRooms = useFacilityStore((s) => s.trackRooms)
  const roomLabel = useFacilityStore((s) => s.roomLabel)

  // Hides the Rooms module entirely when the facility does not track rooms,
  // and renames it to match the configured label (e.g. "Offices").
  const isVisible = (item: NavItem) =>
    keepItem(item, can, hasRole) &&
    (item.url === '/admin/rooms' ? trackRooms : true)

  const navGroups = sidebarData.navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(isVisible).map((item) => {
        const next = item.items
          ? { ...item, items: item.items.filter(isVisible) }
          : item
        return next.url === '/admin/rooms' && trackRooms
          ? { ...next, title: `${roomLabel}s` }
          : next
      }),
    }))
    .filter((group) => group.items.length > 0)

  const currentUser = user
    ? {
        name: user.email.split('@')[0],
        email: user.email,
      }
    : sidebarData.user

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={currentUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function keepItem(
  item: NavItem,
  can: (permission: Permission) => boolean,
  hasRole: (role: Role) => boolean
): boolean {
  if (item.roles) return item.roles.some(hasRole)

  const permission = item.url ? routePermissions[item.url] : undefined
  return permission ? can(permission) : true
}
