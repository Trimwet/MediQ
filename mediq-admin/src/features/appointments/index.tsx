import { useMemo, useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useRbac } from '@/hooks/use-rbac'
import { useAuthStore } from '@/stores/auth-store'
import {
  useAppointments,
  useCreateAppointment,
  useDoctors,
  useUpdateAppointmentStatus,
} from '@/data/hooks'
import { AppointmentDialog } from './components/appointment-dialog'
import { AppointmentsTable } from './components/appointments-table'
import { type Appointment, type AppointmentStatus } from './schema'

export function Appointments() {
  const { can } = useRbac()
  const canBook = can('appointments:book')
  const canManage = can('appointments:manage')
  const user = useAuthStore((state) => state.auth.user)

  const [dialogOpen, setDialogOpen] = useState(false)

  const appointmentsQuery = useAppointments()
  const doctorsQuery = useDoctors()
  const createAppointment = useCreateAppointment()
  const updateStatus = useUpdateAppointmentStatus()

  /**
   * Row-level scoping demo: doctors only see appointments assigned to the
   * doctor matching their account email. In production the backend MUST
   * enforce this server-side; this is the UI mirror (see types/domain.ts).
   */
  const isDoctor = user?.role.includes('doctor')
  const visibleAppointments = useMemo(() => {
    const appointments = appointmentsQuery.data ?? []
    if (!user || !isDoctor) return appointments
    const doctor = doctorsQuery.data?.find((d) => d.email === user.email)
    if (!doctor) return []
    return appointments.filter((a) => a.doctorId === doctor.id)
  }, [appointmentsQuery.data, doctorsQuery.data, isDoctor, user])

  function handleStatusChange(id: string, status: AppointmentStatus) {
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: () =>
          toast.success(`Appointment marked ${status.replace('_', ' ')}`),
      }
    )
  }

  function handleCreated(input: Omit<Appointment, 'id' | 'status'>) {
    createAppointment.mutate(input, {
      onSuccess: (created) =>
        toast.success(`Appointment booked for ${created.patientName}`),
    })
  }

  return (
    <>
      <Header>
        <TopNav links={topNav} className='me-auto' />
        <Search />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold tracking-tight'>Appointments</h1>
            <p className='text-sm text-muted-foreground'>
              Book and manage patient visits
            </p>
          </div>
          {canBook && (
            <Button onClick={() => setDialogOpen(true)}>
              <CalendarPlus />
              New appointment
            </Button>
          )}
        </div>

        <AppointmentsTable
          data={visibleAppointments}
          loading={appointmentsQuery.isPending}
          canManage={canManage}
          onStatusChange={handleStatusChange}
        />
      </Main>

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
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
    isActive: true,
    disabled: false,
  },
  {
    title: 'Queue',
    href: '/admin/queue',
    isActive: false,
    disabled: false,
  },
]
