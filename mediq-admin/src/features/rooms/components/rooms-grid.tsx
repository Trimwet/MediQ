import { DoorOpen, Sparkles, Users } from 'lucide-react'
import { formatRoom, useFacilityStore } from '@/stores/facility-store'
import { Button } from '@/components/ui/button'
import {
  roomStatusLabel,
  roomTypeLabel,
  type Room,
  type RoomStatus,
} from '../schema'

type RoomsGridProps = {
  rooms: Room[]
  canManage: boolean
  onStatusChange: (id: string, status: RoomStatus) => void
}

export function RoomsGrid({
  rooms,
  canManage,
  onStatusChange,
}: RoomsGridProps) {
  const roomLabel = useFacilityStore((s) => s.roomLabel)

  if (rooms.length === 0) {
    return (
      <div className='flex items-center justify-center rounded-md border py-10 text-sm text-muted-foreground'>
        No {roomLabel.toLowerCase()}s yet. Add the first{' '}
        {roomLabel.toLowerCase()}.
      </div>
    )
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
      {rooms.map((room) => (
        <div key={room.id} className='room-card'>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex items-center gap-3'>
              <span className='room-card-icon'>
                <DoorOpen className='size-5' />
              </span>
              <div>
                <p className='room-card-name'>
                  {formatRoom(room.number, roomLabel)}
                </p>
                <p className='room-card-sub'>{roomTypeLabel[room.type]}</p>
              </div>
            </div>
            <span className='room-card-status'>
              <span
                className={`room-card-status-dot room-card-status-dot--${room.status}`}
              />
              {roomStatusLabel[room.status]}
            </span>
          </div>

          {room.status === 'occupied' && (
            <div className='room-card-occupied'>
              <p className='inline-flex items-center gap-1.5 font-medium'>
                <Users className='size-3.5 text-muted-foreground' />
                {room.patientName}
              </p>
              <p className='text-muted-foreground'>{room.doctorName}</p>
            </div>
          )}

          {canManage && room.status !== 'occupied' && (
            <div className='room-card-actions'>
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
        </div>
      ))}
    </div>
  )
}
