import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, Circle, PartyPopper } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

interface Task {
  id: string
  label: string
  /** URL to navigate to when the action link is clicked */
  href?: string
}

const TASKS: Task[] = [
  {
    id: 'profile',
    label: 'Complete your profile',
    href: '/settings',
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
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  const total = TASKS.length
  const done = completed.size
  const allDone = done === total
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  function toggle(id: string) {
    setCompleted((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

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
              {done} of {total} done
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
            const isDone = completed.has(task.id)
            return (
              <li key={task.id}>
                <button
                  type='button'
                  onClick={() => toggle(task.id)}
                  className='flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/60'
                >
                  {/* Marker */}
                  <span className='flex size-5 shrink-0 items-center justify-center'>
                    {isDone ? (
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
                      isDone &&
                        'text-muted-foreground line-through decoration-muted-foreground/40'
                    )}
                  >
                    {task.label}
                  </span>

                  {/* Action link — hidden when done */}
                  {!isDone && task.href && (
                    <Link
                      to={task.href}
                      onClick={(e) => e.stopPropagation()}
                      className='shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline'
                    >
                      Go
                    </Link>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
