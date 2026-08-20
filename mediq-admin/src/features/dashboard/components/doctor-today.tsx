import { useMemo } from 'react'
import { format } from 'date-fns'
import { Activity, CalendarCheck, Clock, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { type Appointment } from '@/features/appointments/schema'
import { queueStatusBadge, type QueueEntry } from '@/features/queue/schema'

interface DoctorTodayProps {
  appointments: Appointment[]
  queue: QueueEntry[]
  doctorName: string
}

export function DoctorToday({
  appointments,
  queue,
  doctorName,
}: DoctorTodayProps) {
  // Today's appointments sorted by time
  const today = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)

    return appointments
      .filter((a) => {
        const t = new Date(a.scheduledFor).getTime()
        return t >= start.getTime() && t <= end.getTime()
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledFor).getTime() -
          new Date(b.scheduledFor).getTime()
      )
  }, [appointments])

  // My queue entries
  const myQueue = useMemo(
    () => queue.filter((e) => e.doctorName === doctorName),
    [queue, doctorName]
  )

  const waitingCount = myQueue.filter((e) => e.status === 'waiting').length
  const completedToday = today.filter((a) => a.status === 'completed').length
  const inProgressToday = today.filter((a) => a.status === 'in_progress').length

  // Quick stats for the doctor
  const stats = [
    {
      label: "Today's appointments",
      value: today.length,
      icon: CalendarCheck,
    },
    {
      label: 'Waiting for me',
      value: waitingCount,
      icon: Users,
    },
    {
      label: 'In progress',
      value: inProgressToday,
      icon: Activity,
    },
    {
      label: 'Completed',
      value: completedToday,
      icon: Clock,
    },
  ]

  return (
    <div className='space-y-6'>
      {/* Quick stats */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className='pt-6'>
              <div className='flex items-center gap-2'>
                <stat.icon className='h-4 w-4 text-primary' />
                <p className='text-sm text-muted-foreground'>{stat.label}</p>
              </div>
              <p className='mt-1 text-3xl font-bold tracking-tight'>
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        {/* Today's appointments timeline */}
        <Card className='lg:col-span-2'>
          <CardContent className='pt-6'>
            <h3 className='mb-4 text-sm font-semibold tracking-wider text-muted-foreground uppercase'>
              Today's schedule
            </h3>
            {today.length === 0 ? (
              <p className='py-8 text-center text-sm text-muted-foreground'>
                No appointments scheduled for today.
              </p>
            ) : (
              <div className='space-y-0'>
                {today.map((apt, i) => (
                  <div key={apt.id}>
                    <div className='flex items-start gap-3 py-3'>
                      <div className='mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums'>
                        {format(new Date(apt.scheduledFor), 'h')}
                        <span className='ml-0.5 text-[10px]'>
                          {format(new Date(apt.scheduledFor), 'a')}
                        </span>
                      </div>
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-center gap-2'>
                          <p className='truncate font-medium'>
                            {apt.patientName}
                          </p>
                          <Badge
                            variant='outline'
                            className={`shrink-0 ${
                              apt.status === 'in_progress'
                                ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                : apt.status === 'completed'
                                  ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-300'
                                  : apt.status === 'arrived'
                                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                    : ''
                            }`}
                          >
                            {apt.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        {apt.reason && (
                          <p className='mt-0.5 text-xs text-muted-foreground'>
                            {apt.reason}
                          </p>
                        )}
                      </div>
                    </div>
                    {i < today.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Queue status */}
        <Card>
          <CardContent className='pt-6'>
            <h3 className='mb-4 text-sm font-semibold tracking-wider text-muted-foreground uppercase'>
              Queue status
            </h3>
            {myQueue.length === 0 ? (
              <p className='py-8 text-center text-sm text-muted-foreground'>
                No patients in your queue.
              </p>
            ) : (
              <div className='space-y-3'>
                {myQueue.map((entry) => (
                  <div
                    key={entry.id}
                    className='flex items-center justify-between gap-2'
                  >
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-medium'>
                        {entry.patientName}
                      </p>
                      {entry.room && (
                        <p className='text-xs text-muted-foreground'>
                          Room {entry.room}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant='outline'
                      className={`shrink-0 ${queueStatusBadge[entry.status]}`}
                    >
                      {entry.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
