import { Outlet } from '@tanstack/react-router'
import { Bell, Building2, Monitor, Palette, User, UserCog } from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { HeaderNav } from '@/components/layout/header-nav'
import { NotificationBell } from '@/components/notification-bell'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { SidebarNav } from './components/sidebar-nav'

const navItems = [
  {
    href: '/admin/settings',
    title: 'Profile',
    icon: <User className='size-4' />,
  },
  {
    href: '/admin/settings/account',
    title: 'Account',
    icon: <UserCog className='size-4' />,
  },
  {
    href: '/admin/settings/appearance',
    title: 'Appearance',
    icon: <Palette className='size-4' />,
  },
  {
    href: '/admin/settings/notifications',
    title: 'Notifications',
    icon: <Bell className='size-4' />,
  },
  {
    href: '/admin/settings/display',
    title: 'Display',
    icon: <Monitor className='size-4' />,
  },
  {
    href: '/admin/settings/facility',
    title: 'Facility',
    icon: <Building2 className='size-4' />,
  },
]

export function SettingsLayout() {
  return (
    <>
      <Header>
        <HeaderNav />
        <Search />
        <NotificationBell />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-bold tracking-tight'>Settings</h1>
          <p className='text-sm text-muted-foreground'>
            Manage your account and preferences
          </p>
        </div>
        <div className='flex flex-1 flex-col gap-8 lg:flex-row'>
          <aside className='shrink-0 lg:w-56'>
            <SidebarNav items={navItems} />
          </aside>
          <div className='flex flex-1 flex-col'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}
