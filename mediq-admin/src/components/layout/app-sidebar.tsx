import { useLayout } from '@/context/layout-provider'
import { type Permission, type Role, routePermissions } from '@/config/rbac'
import { useRbac } from '@/hooks/use-rbac'
import { useAuthStore } from '@/stores/auth-store'
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

  const navGroups = sidebarData.navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => keepItem(item, can, hasRole))
        .map((item) =>
          item.items
            ? { ...item, items: item.items.filter((sub) => keepItem(sub, can, hasRole)) }
            : item
        ),
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
        <TeamSwitcher teams={sidebarData.teams} />
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
