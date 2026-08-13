import { useState } from 'react'
import { useCreateRoom, useRooms, useUpdateRoomStatus } from '@/data/hooks'
import { DoorOpen } from 'lucide-react'
import { toast } from 'sonner'
import { formatRoom, useFacilityStore } from '@/stores/facility-store'
import { useRbac } from '@/hooks/use-rbac'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { HeaderNav } from '@/components/layout/header-nav'
import { NotificationBell } from '@/components/notification-bell'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { RoomDialog } from './components/room-dialog'
import { RoomsGrid } from './components/rooms-grid'
import { type Room, type RoomStatus } from './schema'

export function Rooms() {
  const { can } = useRbac()
  const canManage = can('rooms:manage')
  const { trackRooms, roomLabel } = useFacilityStore()

  const roomsQuery = useRooms()
  const createRoom = useCreateRoom()
  const updateStatus = useUpdateRoomStatus()
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleStatusChange(id: string, status: RoomStatus) {
    const number = roomsQuery.data?.find((r) => r.id === id)?.number
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: () =>
          toast.success(`${formatRoom(number, roomLabel)} marked ${status}`),
      }
    )
  }

  function handleCreated(room: Omit<Room, 'id'>) {
    createRoom.mutate(room, {
      onSuccess: (created) =>
        toast.success(`${formatRoom(created.number, roomLabel)} added`),
    })
  }

  return (
    <>
      <Header>
        <HeaderNav />
        <Search />
        <NotificationBell />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div className='space-y-1'>
            {' '}
            <h1 className='text-2xl font-bold tracking-tight'>
              {trackRooms ? `${roomLabel}s` : 'Rooms'}
            </h1>
            <p className='text-sm text-muted-foreground'>
              Clinic {roomLabel.toLowerCase()}s and availability
            </p>
          </div>
          {canManage && trackRooms && (
            <Button onClick={() => setDialogOpen(true)}>
              <DoorOpen />
              Add {roomLabel.toLowerCase()}
            </Button>
          )}
        </div>

        {!trackRooms ? (
          <Card>
            <CardContent className='flex items-center justify-center py-10 text-sm text-muted-foreground'>
              Room tracking is turned off. Enable it in Settings &rarr; Facility
              to manage {roomLabel.toLowerCase()}s.
            </CardContent>
          </Card>
        ) : roomsQuery.isPending ? (
          <RoomsGridSkeleton />
        ) : (
          <RoomsGrid
            rooms={roomsQuery.data ?? []}
            canManage={canManage}
            onStatusChange={handleStatusChange}
          />
        )}
      </Main>

      {trackRooms && (
        <RoomDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}

function RoomsGridSkeleton() {
  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className='h-32 animate-pulse rounded-xl border bg-muted/40'
        />
      ))}
    </div>
  )
}
