import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, Circle, PartyPopper } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import { useCurrentClinic } from '@/lib/clinic-context'
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
    // No href — you're already on /patient where the queue banner lives.
    // Done is derived from hasQueue (arrived/in_progress/waiting).
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

  // Derive appointment status — strict email/name match only, clinic-scoped.
  const userEmail = user?.email?.toLowerCase() ?? ''
  const userName =
    ((user as unknown as { name?: string })?.name ?? user?.email?.split('@')[0] ?? '').toLowerCase()
  const { clinicId } = useCurrentClinic()
  const allAppointments = appointmentsQuery.data ?? []
  const myAppointments = allAppointments.filter((a) => {
    const emailMatch = !!userEmail && a.patientEmail?.toLowerCase() === userEmail
    const nameMatch = !!userName && a.patientName?.toLowerCase() === userName
    return emailMatch || nameMatch
  })
  const hasLocalBookingFlag = (() => {
    try {
      if (!clinicId || !userEmail) return false
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
      const scopedKey = `mediq_has_booked:${clinicId}`
      const raw = localStorage.getItem(scopedKey)
      if (raw) {
        try {
          const obj = JSON.parse(raw)
          if (obj && typeof obj.email === 'string' && typeof obj.at === 'number') {
            if (obj.email.toLowerCase() !== userEmail) return false
            if (Date.now() - obj.at > SEVEN_DAYS_MS) return false
            return true
          }
        } catch {}
        if (raw === 'true') {
          const bookedEmail = localStorage.getItem(`mediq_has_booked_email:${clinicId}`)
          if (bookedEmail && bookedEmail.toLowerCase() !== userEmail) return false
          const atRaw = localStorage.getItem(`mediq_has_booked_at:${clinicId}`)
          if (atRaw) {
            const at = Number(atRaw)
            if (!Number.isNaN(at) && Date.now() - at > SEVEN_DAYS_MS) return false
          }
          return true
        }
      }
      const emailScopedKey = `mediq_has_booked:${clinicId}:${userEmail}`
      if (localStorage.getItem(emailScopedKey) === 'true') {
        const atRaw = localStorage.getItem(`mediq_has_booked_at:${clinicId}:${userEmail}`)
        if (atRaw) {
          const at = Number(atRaw)
          if (!Number.isNaN(at) && Date.now() - at > SEVEN_DAYS_MS) return false
        }
        return true
      }
      return false
    } catch {
      return false
    }
  })()
  // Strict: only myAppointments counts — no allAppointments fallback
  const hasAppointment = hasLocalBookingFlag || myAppointments.length > 0

  // Derive queue status — only via actual queue entry, only arrived/in_progress/waiting
  const hasQueue = (queueQuery.data ?? []).some((entry) => {
    const entryName = entry.patientName?.toLowerCase()
    const isUserEntry =
      myAppointments.some(
        (a) =>
          (entry.appointmentId && entry.appointmentId === a.id) ||
          a.patientName?.toLowerCase() === entryName
      ) || entryName === userName
    if (!isUserEntry) return false
    if (entry.status === 'waiting') return true
    const linked = myAppointments.find((a) => a.id === entry.appointmentId)
    if (linked && ['arrived', 'in_progress', 'waiting'].includes(linked.status)) return true
    if (['arrived', 'in_progress', 'waiting'].includes(entry.status as string)) return true
    return false
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
            const isClickable = !!task.href || task.id === 'queue'
            return (
              <li key={task.id}>
                <div
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm',
                    isClickable && !done
                      ? 'cursor-pointer transition-colors hover:bg-muted/60'
                      : isClickable && done
                        ? 'cursor-pointer transition-colors hover:bg-muted/40'
                        : ''
                  )}
                  onClick={() => {
                    if (task.id === 'queue') {
                      const el = document.getElementById('patient-queue-banner')
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      else window.scrollTo({ top: 0, behavior: 'smooth' })
                    }
                  }}
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

                  {/* Action — queue row shows "View" that scrolls; others show Go */}
                  {task.id === 'queue' ? (
                    <button
                      type='button'
                      onClick={(e) => {
                        e.stopPropagation()
                        const el = document.getElementById('patient-queue-banner')
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        else window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className={cn(
                        'shrink-0 text-xs font-medium underline-offset-2 hover:underline',
                        done ? 'text-muted-foreground' : 'text-primary'
                      )}
                    >
                      {done ? 'View' : 'View'}
                    </button>
                  ) : (
                    !done &&
                    task.href && (
                      <Link
                        to={task.href}
                        onClick={(e) => e.stopPropagation()}
                        className='shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline'
                      >
                        Go
                      </Link>
                    )
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
