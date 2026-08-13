import { useMemo } from 'react'
import { useQueue, useQueueActions } from '@/data/hooks'
import { Megaphone } from 'lucide-react'
import { toast } from 'sonner'
import { useRbac } from '@/hooks/use-rbac'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { NotificationBell } from '@/components/notification-bell'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { QueueBoard } from './components/queue-board'
import { QueueTable } from './components/queue-table'
import { minutesBetween } from './data'
import { type QueueEntry } from './schema'

export function Queue() {
  const { can } = useRbac()
  const canManage = can('queue:manage')

  const queueQuery = useQueue()
  const actions = useQueueActions()

  const entries = queueQuery.data ?? []
  const isPending = queueQuery.isPending

  const now = new Date().toISOString()
  const waiting = useMemo(
    () =>
      entries
        .filter((entry) => entry.status === 'waiting')
        .sort(
          (a, b) =>
            new Date(a.checkedInAt).getTime() -
            new Date(b.checkedInAt).getTime()
        ),
    [entries]
  )
  const serving = useMemo(
    () =>
      entries.filter((e) => e.status === 'called' || e.status === 'in_room'),
    [entries]
  )
  const doneCount = entries.filter((entry) => entry.status === 'done').length
  const averageWaitMinutes =
    waiting.length === 0
      ? 0
      : Math.round(
          waiting.reduce(
            (sum, entry) => sum + minutesBetween(entry.checkedInAt, now),
            0
          ) / waiting.length
        )

  function handleCallNext() {
    const next = waiting[0]
    if (!canManage || !next) return
    actions.callNext.mutate(undefined, {
      onSuccess: () =>
        toast.success(`${next.patientName} called for ${next.doctorName}`),
    })
  }

  function handleStartVisit(entry: QueueEntry) {
    actions.startVisit.mutate(entry.id, {
      onSuccess: () =>
        toast.success(`${entry.patientName} started their visit`),
    })
  }

  function handleComplete(entry: QueueEntry) {
    actions.complete.mutate(entry.id, {
      onSuccess: () => toast.success(`${entry.patientName} visit completed`),
    })
  }

  function handleMarkLeft(entry: QueueEntry) {
    actions.markLeft.mutate(entry.id, {
      onSuccess: () => toast(`${entry.patientName} marked as left`),
    })
  }

  return (
    <>
      <Header>
        <TopNav links={topNav} className='me-auto' />
        <Search />
        <NotificationBell />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold tracking-tight'>Queue</h1>
            <p className='text-sm text-muted-foreground'>
              Live waiting list and serving board
            </p>
          </div>
          {canManage && (
            <Button
              onClick={handleCallNext}
              disabled={waiting.length === 0 || actions.callNext.isPending}
            >
              <Megaphone />
              Call next
            </Button>
          )}
        </div>

        {isPending ? (
          <QueueSkeleton />
        ) : (
          <>
            <QueueBoard
              waitingCount={waiting.length}
              serving={serving}
              doneCount={doneCount}
              averageWaitMinutes={averageWaitMinutes}
              canManage={canManage}
              onInRoom={handleStartVisit}
              onDone={handleComplete}
              onLeft={handleMarkLeft}
            />

            <div>
              <h2 className='mb-3 text-lg font-semibold tracking-tight'>
                Waiting list
              </h2>
              <QueueTable
                waiting={waiting}
                canManage={canManage}
                onMarkLeft={handleMarkLeft}
              />
            </div>
          </>
        )}
      </Main>
    </>
  )
}

function QueueSkeleton() {
  return (
    <div className='space-y-4' aria-label='Loading queue'>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className='space-y-2 pt-6'>
              <Skeleton className='h-4 w-20' />
              <Skeleton className='h-8 w-16' />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className='h-40 w-full' />
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
    isActive: true,
    disabled: false,
  },
]
