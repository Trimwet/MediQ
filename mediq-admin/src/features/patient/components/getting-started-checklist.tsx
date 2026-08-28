import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, Circle, PartyPopper } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import { useAppointments, useQueue } from '@/data/hooks'
import { Card, CardContent } from '@/components/ui/card'

interface Task {
  id: string
  label: string
  /** URL to navigate to when the action link is clicked. Undefined = no link (task is informational). */
  href?: string
}

const TASKS: Task[] = [
  {
    id: 'profile',
    label: 'Complete your profile',
    // No href — patients don't have a settings page; completion is derived from profile data.
  },
  {
    id: 'book',
    label: 'Book your first appointment',
    href: '/book',
  },
  {
    id: 'queue',
    label: 'Check your queue status',
    href: '/patient',
  },
  {
    id: 'password',
    label: 'Set a secure password',
    href: '/change-password',
  },
]

export function GettingStartedChecklist() {
  const user = useAuthStore((state) => state.auth.user)
  const appointmentsQuery = useAppointments()
  const queueQuery = useQueue()

  // Profile — for patients, having an account counts as complete (full_name is optional)
  // Fetch is best-effort; if it fails, fall back to true since the user is signed in.
  const [hasProfile, setHasProfile] = useState(true)
  useEffect(() => {
    if (!user?.accountNo) return
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.accountNo)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setHasProfile(true)
          return
        }
        const name = data.full_name?.trim() ?? ''
        setHasProfile(name.length >= 2 || !!user?.email)
      })
  }, [user?.accountNo, user?.email])

  // Derive appointment status — for patients, ANY appointment they can see counts
  // (RLS already scopes to their own rows, so any row in appointmentsQuery is theirs).
  // Also handles booking-method: patient books via /book then creates account with same email —
  // localStorage flag ensures it marks done even before the query round-trips.
  const userEmail = user?.email?.toLowerCase() ?? ''
  const userName =
    ((user as unknown as { name?: string })?.name ?? user?.email?.split('@')[0] ?? '').toLowerCase()
  const allAppointments = appointmentsQuery.data ?? []
  const myAppointments = allAppointments.filter((a) => {
    const emailMatch = !!userEmail && a.patientEmail?.toLowerCase() === userEmail
    const nameMatch = !!userName && a.patientName?.toLowerCase() === userName
    return emailMatch || nameMatch
  })
  const hasLocalBookingFlag = (() => {
    try {
      if (localStorage.getItem('mediq_has_booked') === 'true') {
        const bookedEmail = localStorage.getItem('mediq_has_booked_email')
        if (!bookedEmail) return true
        return bookedEmail.toLowerCase() === userEmail
      }
    } catch {}
    return false
  })()
  // Robust: if RLS already filtered to only their rows, any row counts as "booked"
  // Also handle case where they booked via /book with a different email — any upcoming counts
  const hasAppointment =
    hasLocalBookingFlag ||
    myAppointments.length > 0 ||
    allAppointments.length > 0 ||
    (appointmentsQuery.data ?? []).some(
      (a) => !['completed', 'cancelled', 'no_show', 'rejected'].includes(a.status)
    )

  // Derive queue status — true if patient has checked in or is in queue
  const hasQueue =
    (queueQuery.data ?? []).some((entry) => {
      const name = entry.patientName?.toLowerCase()
      return myAppointments.some(
        (a) =>
          a.patientName?.toLowerCase() === name &&
          ['arrived', 'in_progress', 'waiting', 'called'].includes(a.status)
      )
    }) ||
    // Fallback: if they have any booked/arrived appointment, they've engaged with queue flow
    myAppointments.some((a) => ['booked', 'arrived', 'in_progress', 'waiting', 'called'].includes(a.status))

  // If signed in, password is set
  const hasPassword = !!user

  const isDone = (taskId: string): boolean => {
    switch (taskId) {
      case 'profile':
        return hasProfile
      case 'book':
        return hasAppointment
      case 'queue':
        return hasQueue
      case 'password':
        return hasPassword
      default:
        return false
    }
  }

  const total = TASKS.length
  const doneCount = TASKS.filter((t) => isDone(t.id)).length
  const allDone = doneCount === total
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100)

  return (
    <Card className='overflow-hidden'>
      <CardContent className='p-5'>
        {/* Header */}
        <div className='mb-3 flex items-center justify-between'>
          <h3 className='text-sm font-semibold'>Getting started</h3>
          {allDone ? (
            <span className='flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400'>
              <PartyPopper className='size-3.5' />
              All done!
            </span>
          ) : (
            <span className='text-xs text-muted-foreground'>
              {doneCount} of {total} done
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className='mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted'>
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              allDone ? 'bg-emerald-500' : 'bg-primary'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Celebration line — shown only when every task is done */}
        {allDone && (
          <p className='mb-3 rounded-md bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'>
            🎉 You're all set — your MediQ experience begins now.
          </p>
        )}

        {/* Task list */}
        <ul className='space-y-1'>
          {TASKS.map((task) => {
            const done = isDone(task.id)
            return (
              <li key={task.id}>
                <div
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm',
                    // Show pointer + hover only for tasks with a navigable link
                    task.href && !done
                      ? 'cursor-pointer transition-colors hover:bg-muted/60'
                      : ''
                  )}
                >
                  {/* Marker */}
                  <span className='flex size-5 shrink-0 items-center justify-center'>
                    {done ? (
                      <span className='flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground'>
                        <Check className='size-3' strokeWidth={3} />
                      </span>
                    ) : (
                      <Circle className='size-5 text-muted-foreground/40' />
                    )}
                  </span>

                  {/* Label */}
                  <span
                    className={cn(
                      'flex-1 transition-all duration-300',
                      done &&
                        'text-muted-foreground line-through decoration-muted-foreground/40'
                    )}
                  >
                    {task.label}
                  </span>

                  {/* Action link — hidden when done or when no href */}
                  {!done && task.href && (
                    <Link
                      to={task.href}
                      className='shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline'
                    >
                      Go
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
