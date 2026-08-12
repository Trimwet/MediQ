import { CheckCircle2, Clock, DoorOpen, LogIn, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDuration, minutesBetween } from '../data'
import { type QueueEntry } from '../schema'

type QueueBoardProps = {
  waitingCount: number
  serving: QueueEntry[]
  doneCount: number
  averageWaitMinutes: number
  canManage: boolean
  onInRoom: (entry: QueueEntry) => void
  onDone: (entry: QueueEntry) => void
  onLeft: (entry: QueueEntry) => void
}

export function QueueBoard({
  waitingCount,
  serving,
  doneCount,
  averageWaitMinutes,
  canManage,
  onInRoom,
  onDone,
  onLeft,
}: QueueBoardProps) {
  const stats = [
    { label: 'Waiting', value: waitingCount, icon: Users },
    { label: 'Now serving', value: serving.length, icon: Clock },
    { label: 'Served today', value: doneCount, icon: CheckCircle2 },
    {
      label: 'Avg wait',
      value: averageWaitMinutes > 0 ? formatDuration(averageWaitMinutes) : '—',
      icon: LogIn,
    },
  ]

  return (
    <div className='space-y-4'>
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

      <div>
        <h2 className='text-lg font-semibold tracking-tight'>
          Now serving
        </h2>
        {serving.length === 0 ? (
          <Card className='mt-3'>
            <CardContent className='flex items-center justify-center py-10 text-sm text-muted-foreground'>
              No one is being served right now. Call the next patient to begin.
            </CardContent>
          </Card>
        ) : (
          <div className='mt-3 grid gap-4 sm:grid-cols-2'>
            {serving.map((entry) => (
              <Card
                key={entry.id}
                className='border-primary/25 bg-primary/[0.03]'
              >
                <CardContent className='pt-6'>
                  <div className='flex items-start justify-between gap-2'>
                    <div>
                      <p className='font-semibold'>{entry.patientName}</p>
                      <p className='text-sm text-muted-foreground'>
                        {entry.doctorName}
                      </p>
                    </div>
                    <Badge variant='outline' className='shrink-0'>
                      {entry.status === 'in_room' ? 'In room' : 'Called'}
                    </Badge>
                  </div>
                  <div className='mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground'>
                    <span className='inline-flex items-center gap-1.5'>
                      <Clock className='size-3.5' />
                      {entry.calledAt
                        ? `Called ${formatDuration(minutesBetween(entry.calledAt, new Date().toISOString()))} ago`
                        : 'Called'}
                    </span>
                    <span className='inline-flex items-center gap-1.5'>
                      <DoorOpen className='size-3.5' />
                      {entry.room ?? 'Room not set'}
                    </span>
                  </div>
                  {canManage && (
                    <div className='mt-4 flex flex-wrap gap-2'>
                      {entry.status === 'called' && (
                        <Button size='sm' onClick={() => onInRoom(entry)}>
                          <DoorOpen />
                          Start visit
                        </Button>
                      )}
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => onDone(entry)}
                      >
                        <CheckCircle2 />
                        Complete
                      </Button>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => onLeft(entry)}
                      >
                        Mark left
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
