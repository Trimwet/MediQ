import { DoorOpen, Sparkles, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  roomStatusBadge,
  roomTypeLabel,
  type Room,
  type RoomStatus,
} from '../schema'

type RoomsGridProps = {
  rooms: Room[]
  canManage: boolean
  onStatusChange: (id: string, status: RoomStatus) => void
}

export function RoomsGrid({ rooms, canManage, onStatusChange }: RoomsGridProps) {
  if (rooms.length === 0) {
    return (
      <div className='flex items-center justify-center rounded-md border py-10 text-sm text-muted-foreground'>
        No rooms yet. Add the first room.
      </div>
    )
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
      {rooms.map((room) => (
        <Card
          key={room.id}
          className={
            room.status === 'occupied'
              ? 'border-primary/25 bg-primary/[0.03]'
              : undefined
          }
        >
          <CardContent className='pt-6'>
            <div className='flex items-start justify-between gap-2'>
              <div className='flex items-center gap-3'>
                <span className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground'>
                  <DoorOpen className='size-5' />
                </span>
                <div>
                  <p className='font-semibold'>{room.number}</p>
                  <p className='text-sm text-muted-foreground'>
                    {roomTypeLabel[room.type]}
                  </p>
                </div>
              </div>
              <Badge
                variant='outline'
                className={roomStatusBadge[room.status]}
              >
                {room.status}
              </Badge>
            </div>

            {room.status === 'occupied' && (
              <div className='mt-4 space-y-1 rounded-md bg-muted/60 p-3 text-sm'>
                <p className='inline-flex items-center gap-1.5 font-medium'>
                  <Users className='size-3.5 text-primary' />
                  {room.patientName}
                </p>
                <p className='text-muted-foreground'>{room.doctorName}</p>
              </div>
            )}

            {canManage && room.status !== 'occupied' && (
              <div className='mt-4 flex flex-wrap gap-2'>
                {room.status === 'available' && (
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => onStatusChange(room.id, 'cleaning')}
                  >
                    <Sparkles />
                    Mark cleaning
                  </Button>
                )}
                {room.status === 'cleaning' && (
                  <Button
                    size='sm'
                    onClick={() => onStatusChange(room.id, 'available')}
                  >
                    Mark available
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
