import { useState } from 'react'
import { format, isToday } from 'date-fns'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  useAppointments,
  useCancelAppointment,
  useDoctors,
  useQueue,
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
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { GettingStartedChecklist } from './components/getting-started-checklist'

const CANCELLABLE_STATUSES = ['pending', 'booked', 'arrived'] as const

export function PatientPortal() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)
  const reset = useAuthStore((state) => state.auth.reset)

  const appointmentsQuery = useAppointments()
  const queueQuery = useQueue()
  const doctorsQuery = useDoctors()
  const cancelAppointment = useCancelAppointment()

  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  // Auth is enforced in src/routes/patient.tsx beforeLoad — keep a null fallback for the brief store hydration window.
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

  const rawQueuePosition = todayAppointment
    ? waitingQueue.findIndex(
        (e) =>
          (e.appointmentId && e.appointmentId === todayAppointment.id) ||
          e.patientName.toLowerCase() ===
            (todayAppointment.patientName ?? '').toLowerCase()
      )
    : -1

  // C3 fallback: queue RLS has no patient branch — if appointment status itself indicates queued, show #1.
  const queuePosition =
    rawQueuePosition >= 0
      ? rawQueuePosition
      : todayAppointment &&
          ['arrived', 'waiting', 'in_progress'].includes(todayAppointment.status)
        ? 0
        : -1

  function getSpecialization(appointment: Appointment) {
    return doctorsQuery.data?.find((d) => d.id === appointment.doctorId)
      ?.specialization
  }

  function handleCancel(id: string) {
    if (!myAppointments.some((a) => a.id === id)) {
      toast.error('You can only cancel your own appointments.')
      return
    }
    setConfirmId(id)
  }

  function handleConfirmCancel() {
    if (!confirmId) return
    const id = confirmId
    setPendingCancelId(id)
    setConfirmId(null)
    cancelAppointment.mutate(id, {
      onSuccess: () => toast.success('Appointment cancelled.'),
      onError: () => toast.error('Failed to cancel appointment.'),
      onSettled: () => setPendingCancelId(null),
    })
  }

  function handleSignOut() {
    supabase.auth.signOut().finally(() => {
      reset()
      navigate({ to: '/', replace: true })
    })
  }

  const isLoadingAppointments = appointmentsQuery.isPending
  const isErrorAppointments = appointmentsQuery.isError

  return (
    <div className='min-h-svh bg-muted/40'>
      {/* Header */}
      <header className='flex h-16 items-center justify-between gap-2 border-b bg-background px-4 sm:px-6'>
        <div className='flex min-w-0 items-center gap-3'>
          <Button variant='ghost' size='sm' asChild className='shrink-0'>
            <Link to='/' aria-label='Back to home'>
              <ArrowLeft aria-hidden="true" className='size-4' />
            </Link>
          </Button>
          <Link to='/' aria-label='MediQ home' className='shrink-0'>
            <Logo className='h-7 sm:h-9' />
          </Link>
        </div>
        <div className='flex shrink-0 items-center gap-1 sm:gap-1.5'>
          <span className='me-1 hidden text-sm text-muted-foreground sm:block'>
            {user.email}
          </span>
          <ThemeSwitch />
          <Button variant='ghost' size='sm' asChild className='gap-1.5'>
            <Link to='/change-password'>
              <KeyRound aria-hidden="true" className='size-4' />
              <span className='hidden sm:inline'>Change password</span>
              <span className='sm:hidden sr-only'>Change password</span>
            </Link>
          </Button>
          <Button variant='ghost' size='sm' onClick={handleSignOut} className='gap-1.5'>
            <LogOut aria-hidden="true" className='size-4' />
            <span className='hidden sm:inline'>Sign out</span>
          </Button>
        </div>
      </header>

      <main className='mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6'>
        {/* Queue position banner — sticky, live, with ETA */}
        {todayAppointment && queuePosition >= 0 && (
          <div id='patient-queue-waiting' data-testid='patient-queue-banner' className='sticky top-16 z-10 rounded-lg border bg-background/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80' role='status' aria-live='polite'>
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
          <div id='patient-queue-inprogress' data-testid='patient-queue-banner-inprogress' className='rounded-lg border bg-background p-4'>
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

        {/* Getting started checklist */}
        <GettingStartedChecklist />

        {isErrorAppointments ? (
          <Card>
            <CardContent className='py-8 text-center'>
              <p className='text-sm text-destructive'>Failed to load appointments. {String((appointmentsQuery.error as Error)?.message ?? '')}</p>
              <Button variant='outline' size='sm' className='mt-3' onClick={() => appointmentsQuery.refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : isLoadingAppointments ? (
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
                <Card className='py-4'>
                  <CardContent className='py-8 text-center'>
                    <div className='mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted'>
                      <CalendarDays aria-hidden="true" className='size-6 text-muted-foreground' />
                    </div>
                    <p className='font-medium'>No upcoming appointments</p>
                    <p className='mx-auto mt-1 max-w-sm text-sm text-muted-foreground'>Your booked appointments will appear here. Let's get your first visit scheduled.</p>
                    <Button asChild className='mt-4'>
                      <Link to='/book'>
                        <CalendarDays aria-hidden="true" className='size-4' />
                        Book an appointment
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                upcoming.map((appointment) => {
                  const spec = getSpecialization(appointment)
                  const canCancel = (
                    CANCELLABLE_STATUSES as readonly string[]
                  ).includes(appointment.status)
                  const isCancellingThis = pendingCancelId === appointment.id
                  return (
                    <Card key={appointment.id} className='py-4'>
                      <CardContent>
                        <div className='flex items-start justify-between gap-3'>
                          <div className='space-y-1'>
                            <p className='leading-tight font-medium'>
                              {appointment.doctorName}
                            </p>
                            {spec && (
                              <p className='flex items-center gap-1 text-xs text-muted-foreground'>
                                <Stethoscope aria-hidden="true" className='size-3' />
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
                              disabled={isCancellingThis}
                              aria-busy={isCancellingThis}
                            >
                              <X aria-hidden="true" className='size-3.5' />
                              {isCancellingThis ? 'Cancelling…' : 'Cancel'}
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
                    <Card key={appointment.id} className='py-4'>
                      <CardContent>
                        <div className='flex items-start justify-between gap-3'>
                          <div className='space-y-1'>
                            <p className='leading-tight font-medium'>
                              {appointment.doctorName}
                            </p>
                            {spec && (
                              <p className='flex items-center gap-1 text-xs text-muted-foreground'>
                                <Stethoscope aria-hidden="true" className='size-3' />
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
            <CalendarDays aria-hidden="true" className='size-4' />
            Book an appointment
          </Link>
        </Button>
      </main>

      <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel your appointment. You can book a new one afterwards. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmId(null)}>Keep appointment</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancel} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
              Cancel appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
