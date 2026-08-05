import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

export function Settings() {
  return (
    <>
      <Header>
        <TopNav links={topNav} className='me-auto' />
        <Search />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>
      <Main>
        <div className='space-y-1'>
          <h1 className='text-2xl font-bold tracking-tight'>Settings</h1>
          <p className='text-sm text-muted-foreground'>
            Manage your account and preferences
          </p>
        </div>
      </Main>
    </>
  )
}

const topNav = [
  {
    title: 'Overview',
    href: '/admin/dashboard',
    isActive: false,
    disabled: false,
  },
  {
    title: 'Appointments',
    href: '/admin/appointments',
    isActive: false,
    disabled: false,
  },
  {
    title: 'Queue',
    href: '/admin/queue',
    isActive: false,
    disabled: false,
  },
  {
    title: 'Reports',
    href: '/admin/reports',
    isActive: false,
    disabled: true,
  },
]
