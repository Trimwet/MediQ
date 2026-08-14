import { useMemo, useState } from 'react'
import {
  useAppointments,
  useApproveAppointment,
  useCreateAppointment,
  useDoctors,
  useRejectAppointment,
  useUpdateAppointmentStatus,
} from '@/data/hooks'
import { CalendarPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
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
import { AppointmentDialog } from './components/appointment-dialog'
import { ApproveDialog } from './components/approve-dialog'
import { RejectDialog } from './components/reject-dialog'
import { AppointmentsTable } from './components/appointments-table'
import { type Appointment, type AppointmentStatus } from './schema'

export function Appointments() {
  const { can } = useRbac()
  const canBook = can('appointments:book')
  const canManage = can('appointments:manage')
  const user = useAuthStore((state) => state.auth.user)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [approveTarget, setApproveTarget] = useState<Appointment | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Appointment | null>(null)

  const appointmentsQuery = useAppointments()
  const doctorsQuery = useDoctors()
  const createAppointment = useCreateAppointment()
  const updateStatus = useUpdateAppointmentStatus()
  const approve = useApproveAppointment()
  const reject = useRejectAppointment()

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

  function handleApprove(appointment: Appointment) {
    // Requests without a doctor need one assigned as part of the approval.
    if (!appointment.doctorId) {
      setApproveTarget(appointment)
      return
    }
    approve.mutate(
      { id: appointment.id },
      {
        onSuccess: () =>
          toast.success(`Request approved for ${appointment.patientName}`),
      }
    )
  }

  function handleApproveWithDoctor(doctorId: string, doctorName: string) {
    if (!approveTarget) return
    approve.mutate(
      { id: approveTarget.id, doctor: { id: doctorId, name: doctorName } },
      {
        onSuccess: () =>
          toast.success(
            `Request approved for ${approveTarget.patientName} — assigned to ${doctorName}`
          ),
      }
    )
    setApproveTarget(null)
  }

  function handleReject(appointment: Appointment) {
    setRejectTarget(appointment)
  }

  function handleRejectConfirm(reason: string | undefined) {
    if (!rejectTarget) return
    reject.mutate(
      { id: rejectTarget.id, reason },
      {
        onSuccess: () =>
          toast.success(`Request declined for ${rejectTarget.patientName}`),
      }
    )
    setRejectTarget(null)
  }

  return (
    <>
      <Header>
        <HeaderNav active='appointments' />
        <Search />
        <NotificationBell />
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
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </Main>

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
      <ApproveDialog
        appointment={approveTarget}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        onConfirm={handleApproveWithDoctor}
      />
      <RejectDialog
        appointment={rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        onConfirm={handleRejectConfirm}
      />
    </>
  )
}
