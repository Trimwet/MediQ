import { useEffect } from 'react'
import { format, isToday } from 'date-fns'
import { Link, useNavigate } from '@tanstack/react-router'
import { hasRole } from '@/config/rbac'
import {
  useAppointments,
  useCancelAppointment,
  useDoctors,
  useQueue,
  useRealtimeAppointments,
  useRealtimeQueue,
} from '@/data/hooks'
import {
  ArrowLeft,
  CalendarDays,
  KeyRound,
  LogOut,
  Stethoscope,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/assets/logo'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  type Appointment,
  appointmentStatusBadge,
} from '@/features/appointments/schema'

const CANCELLABLE_STATUSES = ['pending', 'booked'] as const

export function PatientPortal() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)
  const reset = useAuthStore((state) => state.auth.reset)

  useRealtimeAppointments()
  useRealtimeQueue()
  const appointmentsQuery = useAppointments()
  const queueQuery = useQueue()
  const doctorsQuery = useDoctors()
  const cancelAppointment = useCancelAppointment()

  // Route guard: signed in as a patient only.
  useEffect(() => {
    if (!user) {
      navigate({ to: '/sign-in', replace: true })
      return
    }
    if (!hasRole(user.role, 'patient')) {
      navigate({ to: '/', replace: true })
    }
  }, [user, navigate])

  if (!user) return null

  const myAppointments = (appointmentsQuery.data ?? []).filter(
    (a) => a.patientEmail?.toLowerCase() === user.email?.toLowerCase()
  )

  const upcoming = myAppointments
    .filter(
      (a) =>
        !['completed', 'cancelled', 'no_show', 'rejected'].includes(a.status)
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
    )

  const past = myAppointments
    .filter((a) =>
      ['completed', 'cancelled', 'no_show', 'rejected'].includes(a.status)
    )
    .sort(
      (a, b) =>
        new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime()
    )

  // Find today's confirmed appointment and locate this patient in the live queue
  const todayAppointment = upcoming.find(
    (a) =>
      isToday(new Date(a.scheduledFor)) &&
      ['booked', 'arrived', 'in_progress'].includes(a.status)
  )

  const waitingQueue = (queueQuery.data ?? []).filter(
    (e) => e.status === 'waiting'
  )

  const queuePosition = todayAppointment
    ? waitingQueue.findIndex(
        (e) =>
          e.patientName.toLowerCase() ===
          (todayAppointment.patientName ?? '').toLowerCase()
      )
    : -1

  function getSpecialization(appointment: Appointment) {
    return doctorsQuery.data?.find((d) => d.id === appointment.doctorId)
      ?.specialization
  }

  function handleCancel(id: string) {
    if (confirm('Are you sure you want to cancel this appointment?')) {
      cancelAppointment.mutate(id, {
        onSuccess: () => toast.success('Appointment cancelled.'),
        onError: () => toast.error('Failed to cancel appointment.'),
      })
    }
  }

  function handleSignOut() {
    reset()
    navigate({ to: '/', replace: true })
  }

  return (
    <div className='min-h-svh bg-muted/40'>
      {/* Header */}
      <header className='flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6'>
        <div className='flex items-center gap-2'>
          <Button variant='ghost' size='sm' asChild>
            <Link to='/' aria-label='Back to home'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          <Link to='/' aria-label='MediQ home'>
            <Logo className='h-9' />
          </Link>
        </div>
        <div className='flex items-center gap-1.5'>
          <span className='me-1 hidden text-sm text-muted-foreground sm:block'>
            {user.email}
          </span>
          <ThemeSwitch />
          <Button variant='ghost' size='sm' asChild>
            <Link to='/change-password'>
              <KeyRound />
              Change password
            </Link>
          </Button>
          <Button variant='outline' size='sm' onClick={handleSignOut}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </header>

      <main className='mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6'>
        {/* Queue position banner — only when they're in today's queue */}
        {todayAppointment && queuePosition >= 0 && (
          <div className='rounded-lg border bg-background p-4'>
            <div className='flex items-start justify-between gap-4'>
              <div className='space-y-0.5'>
                <p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
                  Queue position · Today
                </p>
                <p className='text-2xl font-bold tabular-nums'>
                  #{queuePosition + 1}
                  <span className='ml-2 text-sm font-normal text-muted-foreground'>
                    in line
                  </span>
                </p>
                <p className='text-sm text-muted-foreground'>
                  With {todayAppointment.doctorName} ·{' '}
                  {format(new Date(todayAppointment.scheduledFor), 'h:mm a')}
                </p>
              </div>
              <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-xl font-bold tabular-nums'>
                {queuePosition + 1}
              </div>
            </div>
          </div>
        )}

        {/* In-progress banner */}
        {todayAppointment?.status === 'in_progress' && (
          <div className='rounded-lg border bg-background p-4'>
            <p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
              Currently with doctor
            </p>
            <p className='mt-0.5 font-medium'>
              Your visit with {todayAppointment.doctorName} is in progress.
            </p>
          </div>
        )}

        {/* Page title */}
        <div className='space-y-1'>
          <h1 className='text-2xl font-bold tracking-tight'>My appointments</h1>
          <p className='text-sm text-muted-foreground'>
            Track your care or book a new visit below.
          </p>
        </div>

        {appointmentsQuery.isPending ? (
          <div className='space-y-3'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-24 w-full' />
            ))}
          </div>
        ) : (
          <>
            {/* Upcoming */}
            <section className='space-y-3'>
              <h2 className='text-xs font-semibold tracking-wider text-muted-foreground uppercase'>
                Upcoming
              </h2>

              {upcoming.length === 0 ? (
                <Card>
                  <CardContent className='py-10 text-center text-sm text-muted-foreground'>
                    No upcoming appointments. Book one below.
                  </CardContent>
                </Card>
              ) : (
                upcoming.map((appointment) => {
                  const spec = getSpecialization(appointment)
                  const canCancel = (
                    CANCELLABLE_STATUSES as readonly string[]
                  ).includes(appointment.status)
                  return (
                    <Card key={appointment.id}>
                      <CardContent className='pt-5 pb-4'>
                        <div className='flex items-start justify-between gap-3'>
                          <div className='space-y-1'>
                            <p className='leading-tight font-medium'>
                              {appointment.doctorName}
                            </p>
                            {spec && (
                              <p className='flex items-center gap-1 text-xs text-muted-foreground'>
                                <Stethoscope className='size-3' />
                                {spec}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant='outline'
                            className={
                              appointmentStatusBadge[appointment.status]
                            }
                          >
                            {appointment.status.replace('_', ' ')}
                          </Badge>
                        </div>

                        <Separator className='my-3' />

                        <div className='flex items-end justify-between gap-2'>
                          <div className='space-y-0.5'>
                            <p className='text-sm text-muted-foreground'>
                              {format(
                                new Date(appointment.scheduledFor),
                                'EEEE, MMM d · h:mm a'
                              )}
                            </p>
                            {appointment.reason && (
                              <p className='text-sm text-muted-foreground'>
                                {appointment.reason}
                              </p>
                            )}
                          </div>

                          {canCancel && (
                            <Button
                              variant='ghost'
                              size='sm'
                              className='shrink-0 text-muted-foreground hover:text-destructive'
                              onClick={() => handleCancel(appointment.id)}
                              disabled={cancelAppointment.isPending}
                            >
                              <X className='size-3.5' />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </section>

            {/* Past */}
            {past.length > 0 && (
              <section className='space-y-3'>
                <h2 className='text-xs font-semibold tracking-wider text-muted-foreground uppercase'>
                  Past
                </h2>
                {past.map((appointment) => {
                  const spec = getSpecialization(appointment)
                  return (
                    <Card key={appointment.id}>
                      <CardContent className='pt-5 pb-4'>
                        <div className='flex items-start justify-between gap-3'>
                          <div className='space-y-1'>
                            <p className='leading-tight font-medium'>
                              {appointment.doctorName}
                            </p>
                            {spec && (
                              <p className='flex items-center gap-1 text-xs text-muted-foreground'>
                                <Stethoscope className='size-3' />
                                {spec}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant='outline'
                            className={
                              appointmentStatusBadge[appointment.status]
                            }
                          >
                            {appointment.status.replace('_', ' ')}
                          </Badge>
                        </div>

                        <Separator className='my-3' />

                        <div className='space-y-0.5'>
                          <p className='text-sm text-muted-foreground'>
                            {format(
                              new Date(appointment.scheduledFor),
                              'MMM d, yyyy · h:mm a'
                            )}
                          </p>
                          {appointment.reason && (
                            <p className='text-sm text-muted-foreground'>
                              {appointment.reason}
                            </p>
                          )}
                          {appointment.status === 'rejected' &&
                            appointment.rejectionReason && (
                              <p className='text-sm text-destructive'>
                                {appointment.rejectionReason}
                              </p>
                            )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </section>
            )}
          </>
        )}

        <Button className='self-start' asChild>
          <Link to='/book'>
            <CalendarDays />
            Book an appointment
          </Link>
        </Button>
      </main>
    </div>
  )
}
