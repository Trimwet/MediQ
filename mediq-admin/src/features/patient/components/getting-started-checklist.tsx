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

  // Profile data — fetch full_name to determine if profile is complete
  const [hasProfile, setHasProfile] = useState(false)
  useEffect(() => {
    if (!user?.accountNo) return
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.accountNo)
      .single()
      .then(({ data }) => {
        setHasProfile(!!data?.full_name && data.full_name.trim().length >= 2)
      })
  }, [user?.accountNo])

  // Derive appointment status from real backend data
  const myAppointments = (appointmentsQuery.data ?? []).filter(
    (a) => a.patientEmail?.toLowerCase() === user?.email?.toLowerCase()
  )
  const hasAppointment = myAppointments.length > 0

  // Derive queue status — true if patient is in the queue today
  const hasQueue = (queueQuery.data ?? []).some((entry) => {
    const name = entry.patientName?.toLowerCase()
    return (
      myAppointments.some(
        (a) =>
          a.patientName?.toLowerCase() === name &&
          ['arrived', 'in_progress'].includes(a.status)
      )
    )
  })

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
