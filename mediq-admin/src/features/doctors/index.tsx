import { useState } from 'react'
import {
  useCreateDoctor,
  useDeleteDoctor,
  useDoctors,
  useUpdateDoctorStatus,
} from '@/data/hooks'
import { Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import { useRbac } from '@/hooks/use-rbac'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { HeaderNav } from '@/components/layout/header-nav'
import { NotificationBell } from '@/components/notification-bell'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { DoctorDialog } from './components/doctor-dialog'
import { DoctorsTable } from './components/doctors-table'
import { type Doctor, type DoctorStatus } from './schema'

export function Doctors() {
  const { can } = useRbac()
  const canManage = can('doctors:manage')

  const doctorsQuery = useDoctors()
  const createDoctor = useCreateDoctor()
  const updateStatus = useUpdateDoctorStatus()
  const deleteDoctor = useDeleteDoctor()
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleStatusChange(id: string, status: DoctorStatus) {
    const name = doctorsQuery.data?.find((d) => d.id === id)?.name
    updateStatus.mutate(
      { id, status },
      { onSuccess: () => toast.success(`${name} marked ${status}`) }
    )
  }

  function handleCreated(doctor: Omit<Doctor, 'id'>) {
    createDoctor.mutate(doctor, {
      onSuccess: (created) =>
        toast.success(`${created.name} added to the directory`),
    })
  }

  function handleDelete(id: string) {
    if (confirm('Are you sure you want to remove this doctor from the directory?')) {
      deleteDoctor.mutate(id, {
        onSuccess: () => toast.success('Doctor removed.'),
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
            <h1 className='text-2xl font-bold tracking-tight'>Doctors</h1>
            <p className='text-sm text-muted-foreground'>
              Clinic doctors and availability
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setDialogOpen(true)}>
              <Stethoscope />
              Add doctor
            </Button>
          )}
        </div>

        <DoctorsTable
          data={doctorsQuery.data ?? []}
          loading={doctorsQuery.isPending}
          canManage={canManage}
          onStatusChange={handleStatusChange}
          onDelete={canManage ? handleDelete : undefined}
        />
      </Main>

      <DoctorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </>
  )
}
