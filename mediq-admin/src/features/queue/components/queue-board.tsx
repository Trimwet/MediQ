import { Fragment } from 'react'
import { CheckCircle2, Clock, DoorOpen, LogIn, Users } from 'lucide-react'
import {
  formatRoom,
  inStageLabel,
  useFacilityStore,
} from '@/stores/facility-store'
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
  /** Disable all action buttons while a mutation is in-flight. */
  isActionsDisabled?: boolean
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
  isActionsDisabled = false,
  onInRoom,
  onDone,
  onLeft,
}: QueueBoardProps) {
  const { trackRooms, roomLabel } = useFacilityStore()

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
        <h2 className='text-lg font-semibold tracking-tight'>Now serving</h2>
        {serving.length === 0 ? (
          <Card className='mt-3'>
            <CardContent className='flex items-center justify-center py-10 text-sm text-muted-foreground'>
              No one is being served right now. Call the next patient to begin.
            </CardContent>
          </Card>
        ) : (
          <div className='mt-3 grid gap-4 sm:grid-cols-2'>
            {serving.map((entry) => (
              <div key={entry.id} className='serving-card'>
                <p className='serving-card-name'>{entry.patientName}</p>
                <p className='serving-card-sub'>{entry.doctorName}</p>
                <ServingProgress
                  status={entry.status}
                  trackRooms={trackRooms}
                  roomLabel={roomLabel}
                />
                <div className='serving-card-meta'>
                  <span className='inline-flex items-center gap-1.5'>
                    <Clock className='size-3.5' />
                    {entry.calledAt
                      ? `Called ${formatDuration(minutesBetween(entry.calledAt, new Date().toISOString()))} ago`
                      : 'Called'}
                  </span>
                  {trackRooms && (
                    <span className='inline-flex items-center gap-1.5'>
                      <DoorOpen className='size-3.5' />
                      {formatRoom(entry.room, roomLabel)}
                    </span>
                  )}
                </div>
                {canManage && (
                  <div className='serving-card-actions'>
                    {entry.status === 'called' && (
                      <Button size='sm' disabled={isActionsDisabled} onClick={() => onInRoom(entry)}>
                        <DoorOpen />
                        Start visit
                      </Button>
                    )}
                    <Button
                      size='sm'
                      variant='outline'
                      disabled={isActionsDisabled}
                      onClick={() => onDone(entry)}
                    >
                      <CheckCircle2 />
                      Complete
                    </Button>
                    <Button
                      size='sm'
                      variant='ghost'
                      disabled={isActionsDisabled}
                      onClick={() => onLeft(entry)}
                    >
                      Mark left
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ServingProgress({
  status,
  trackRooms,
  roomLabel,
}: {
  status: QueueEntry['status']
  trackRooms: boolean
  roomLabel: string
}) {
  const isInRoom = status === 'in_room'
  const roomStage = inStageLabel(trackRooms, roomLabel)
  const steps = [
    { label: 'Called', state: isInRoom ? 'done' : 'active' },
    { label: roomStage, state: isInRoom ? 'active' : 'pending' },
    { label: 'Done', state: 'pending' },
  ] as const

  return (
    <div
      className={`serving-card-progress ${isInRoom ? 'serving-card-progress--room' : 'serving-card-progress--called'}`}
      role='img'
      aria-label={`Status: ${isInRoom ? roomStage : 'Called'}`}
    >
      {steps.map((step, index) => (
        <Fragment key={step.label}>
          {index > 0 && (
            <span className='serving-card-progress-line' aria-hidden='true' />
          )}
          <span
            className={`serving-card-progress-step serving-card-progress-step--${step.state}`}
          >
            <span className='serving-card-progress-dot' aria-hidden='true' />
            {step.label}
          </span>
        </Fragment>
      ))}
    </div>
  )
}
