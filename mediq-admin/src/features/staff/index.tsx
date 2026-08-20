import { useState } from 'react'
import { useCreateStaff, useDeleteStaff, useStaff } from '@/data/hooks'
import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useRbac } from '@/hooks/use-rbac'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { HeaderNav } from '@/components/layout/header-nav'
import { Main } from '@/components/layout/main'
import { NotificationBell } from '@/components/notification-bell'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { StaffDialog } from './components/staff-dialog'
import { StaffTable } from './components/staff-table'
import { type Staff } from './schema'

export function Staff() {
  const { can } = useRbac()
  const canManage = can('staff:manage')

  const staffQuery = useStaff()
  const createStaff = useCreateStaff()
  const deleteStaff = useDeleteStaff()
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleCreated(member: Omit<Staff, 'id'>) {
    createStaff.mutate(member, {
      onSuccess: (created) =>
        toast.success(`${created.name} invited — share the invite link`),
    })
  }

  function handleDelete(id: string) {
    if (confirm('Are you sure you want to remove this staff member?')) {
      deleteStaff.mutate(id, {
        onSuccess: () => toast.success('Staff member removed.'),
        onError: (err) => toast.error(`Failed to remove: ${err.message}`),
      })
    }
  }

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
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold tracking-tight'>Staff</h1>
            <p className='text-sm text-muted-foreground'>
              Clinic staff directory
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setDialogOpen(true)}>
              <UserPlus />
              Invite staff
            </Button>
          )}
        </div>

        <StaffTable
          data={staffQuery.data ?? []}
          loading={staffQuery.isPending}
          onDelete={canManage ? handleDelete : undefined}
        />
      </Main>

      <StaffDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </>
  )
}
