import { useState } from 'react'
import {
  useAppointments,
  useApproveAppointment,
  useCreateAppointment,
  useRejectAppointment,
  useUpdateAppointmentStatus,
} from '@/data/hooks'
import { CalendarPlus } from 'lucide-react'
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
import { AppointmentDialog } from './components/appointment-dialog'
import { AppointmentsTable } from './components/appointments-table'
import { ApproveDialog } from './components/approve-dialog'
import { RejectDialog } from './components/reject-dialog'
import { type Appointment, type AppointmentStatus } from './schema'

export function Appointments() {
  const { can } = useRbac()
  const canBook = can('appointments:book')
  const canManage = can('appointments:manage')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [approveTarget, setApproveTarget] = useState<Appointment | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Appointment | null>(null)

  const appointmentsQuery = useAppointments()
  const createAppointment = useCreateAppointment()
  const updateStatus = useUpdateAppointmentStatus()
  const approve = useApproveAppointment()
  const reject = useRejectAppointment()

  // RLS scopes appointment rows server-side per role (admin/front_desk = all,
  // doctor = their own, patient = their own). No client-side filter needed.
  const visibleAppointments = appointmentsQuery.data ?? []

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
