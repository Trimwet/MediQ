import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { HeaderNav } from '@/components/layout/header-nav'
import { Main } from '@/components/layout/main'
import { NotificationBell } from '@/components/notification-bell'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { UsersTable } from './components/users-table'

export function Users() {
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
          <h1 className='text-2xl font-bold tracking-tight'>Users & Roles</h1>
          <p className='text-sm text-muted-foreground'>
            Manage your users and their roles here.
          </p>
        </div>
        <UsersTable />
      </Main>
    </>
  )
}
