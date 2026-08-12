import { useState } from 'react'
import { DoorOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useRbac } from '@/hooks/use-rbac'
import { useCreateRoom, useRooms, useUpdateRoomStatus } from '@/data/hooks'
import { RoomDialog } from './components/room-dialog'
import { RoomsGrid } from './components/rooms-grid'
import { type Room, type RoomStatus } from './schema'

export function Rooms() {
  const { can } = useRbac()
  const canManage = can('rooms:manage')

  const roomsQuery = useRooms()
  const createRoom = useCreateRoom()
  const updateStatus = useUpdateRoomStatus()
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleStatusChange(id: string, status: RoomStatus) {
    const number = roomsQuery.data?.find((r) => r.id === id)?.number
    updateStatus.mutate(
      { id, status },
      { onSuccess: () => toast.success(`${number} marked ${status}`) }
    )
  }

  function handleCreated(room: Omit<Room, 'id'>) {
    createRoom.mutate(room, {
      onSuccess: (created) => toast.success(`${created.number} added`),
    })
  }

  return (
    <>
      <Header>
        <TopNav links={topNav} className='me-auto' />
        <Search />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold tracking-tight'>Rooms</h1>
            <p className='text-sm text-muted-foreground'>
              Clinic rooms and availability
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setDialogOpen(true)}>
              <DoorOpen />
              Add room
            </Button>
          )}
        </div>

        {roomsQuery.isPending ? (
          <RoomsGridSkeleton />
        ) : (
          <RoomsGrid
            rooms={roomsQuery.data ?? []}
            canManage={canManage}
            onStatusChange={handleStatusChange}
          />
        )}
      </Main>

      <RoomDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
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

const topNav = [
  {
    title: 'Overview',
    href: '/admin/dashboard',
    isActive: false,
    disabled: false,
  },
  {
    title: 'Appointments',
    href: '/admin/appointments',
    isActive: false,
    disabled: false,
  },
  {
    title: 'Queue',
    href: '/admin/queue',
    isActive: false,
    disabled: false,
  },
]
