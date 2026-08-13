import { useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { ArrowLeft, CalendarDays, KeyRound, LogOut } from 'lucide-react'
import { Logo } from '@/assets/logo'
import { useAppointments } from '@/data/hooks'
import { useAuthStore } from '@/stores/auth-store'
import { hasRole } from '@/config/rbac'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ThemeSwitch } from '@/components/theme-switch'
import { appointmentStatusBadge } from '@/features/appointments/schema'

export function PatientPortal() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)
  const reset = useAuthStore((state) => state.auth.reset)
  const appointmentsQuery = useAppointments()

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

  // Pending requests stay visible in Upcoming (awaiting clinic approval);
  // rejected ones move to Past.
  const upcoming = myAppointments
    .filter(
      (a) =>
        !['completed', 'cancelled', 'no_show', 'rejected'].includes(a.status)
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledFor).getTime() -
        new Date(b.scheduledFor).getTime()
    )
  const past = myAppointments
    .filter((a) =>
      ['completed', 'cancelled', 'no_show', 'rejected'].includes(a.status)
    )
    .sort(
      (a, b) =>
        new Date(b.scheduledFor).getTime() -
        new Date(a.scheduledFor).getTime()
    )

  function handleSignOut() {
    reset()
    navigate({ to: '/', replace: true })
  }

  return (
    <div className='min-h-svh bg-muted/40'>
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

      <main className='mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-bold tracking-tight'>
            My appointments
          </h1>
          <p className='text-sm text-muted-foreground'>
            Book another visit or keep track of your upcoming care.
          </p>
        </div>

        {appointmentsQuery.isPending ? (
          <div className='space-y-3' aria-label='Loading appointments'>
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className='h-24 w-full' />
            ))}
          </div>
        ) : (
          <>
            <section className='space-y-3'>
              <h2 className='text-sm font-semibold tracking-wide text-muted-foreground uppercase'>
                Upcoming
              </h2>
              {upcoming.length === 0 ? (
                <Card>
                  <CardContent className='py-10 text-center text-sm text-muted-foreground'>
                    No upcoming appointments. Book one below.
                  </CardContent>
                </Card>
              ) : (
                upcoming.map((appointment) => (
                  <Card key={appointment.id}>
                    <CardContent className='flex flex-wrap items-center justify-between gap-3 pt-6'>
                      <div>
                        <p className='font-medium'>
                          {appointment.doctorName}
                        </p>
                        <p className='text-sm text-muted-foreground'>
                          {format(
                            new Date(appointment.scheduledFor),
                            'EEEE, MMM d • h:mm a'
                          )}
                        </p>
                        {appointment.reason && (
                          <p className='mt-1 text-sm text-muted-foreground'>
                            {appointment.reason}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant='outline'
                        className={appointmentStatusBadge[appointment.status]}
                      >
                        {appointment.status.replace('_', ' ')}
                      </Badge>
                    </CardContent>
                  </Card>
                ))
              )}
            </section>

            {past.length > 0 && (
              <section className='space-y-3'>
                <h2 className='text-sm font-semibold tracking-wide text-muted-foreground uppercase'>
                  Past
                </h2>
                {past.map((appointment) => (
                  <Card key={appointment.id}>
                    <CardContent className='flex flex-wrap items-center justify-between gap-3 pt-6'>
                      <div>
                        <p className='font-medium'>
                          {appointment.doctorName}
                        </p>
                        <p className='text-sm text-muted-foreground'>
                          {format(
                            new Date(appointment.scheduledFor),
                            'MMM d, yyyy • h:mm a'
                          )}
                        </p>
                        {appointment.status === 'rejected' &&
                          appointment.rejectionReason && (
                            <p className='mt-1 text-sm text-destructive'>
                              {appointment.rejectionReason}
                            </p>
                          )}
                      </div>
                      <Badge
                        variant='outline'
                        className={appointmentStatusBadge[appointment.status]}
                      >
                        {appointment.status.replace('_', ' ')}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
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
