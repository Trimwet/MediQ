import { useMemo, useState } from 'react'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/data/hooks'
import {
  Bell,
  Calendar,
  CheckCheck,
  FileText,
  FilterX,
  Info,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { NotificationBell } from '@/components/notification-bell'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  notificationChannelLabel,
  notificationChannels,
  notificationTypeLabel,
  notificationTypes,
  timeAgo,
  type AppNotification,
  type NotificationChannel,
  type NotificationType,
} from './schema'

const typeIcons: Record<NotificationType, typeof Calendar> = {
  appointment: Calendar,
  queue: Users,
  summary: FileText,
  system: Info,
}

type FilterTab = 'all' | 'unread' | 'read'

export function Notifications() {
  const { data: notifications = [], isPending } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const [tab, setTab] = useState<FilterTab>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | NotificationType>('all')
  const [channelFilter, setChannelFilter] = useState<
    'all' | NotificationChannel
  >('all')

  const sorted = useMemo(
    () =>
      [...notifications].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [notifications]
  )

  const filtered = useMemo(
    () =>
      sorted.filter(
        (n) =>
          (tab === 'all' || (tab === 'unread' ? !n.read : n.read)) &&
          (typeFilter === 'all' || n.type === typeFilter) &&
          (channelFilter === 'all' || n.channel === channelFilter)
      ),
    [sorted, tab, typeFilter, channelFilter]
  )

  const unread = notifications.filter((n) => !n.read).length
  const isFiltered =
    tab !== 'all' || typeFilter !== 'all' || channelFilter !== 'all'

  function clearFilters() {
    setTab('all')
    setTypeFilter('all')
    setChannelFilter('all')
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
            <h1 className='text-2xl font-bold tracking-tight'>Notifications</h1>
            <p className='text-sm text-muted-foreground'>
              Reminders and updates sent to you
            </p>
          </div>
          {unread > 0 && (
            <Button
              variant='outline'
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck />
              Mark all as read
            </Button>
          )}
        </div>

        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as FilterTab)}
          >
            <TabsList>
              <TabsTrigger value='all'>
                All
                <span className='text-muted-foreground'>
                  {notifications.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value='unread'>
                Unread
                <span className='text-muted-foreground'>{unread}</span>
              </TabsTrigger>
              <TabsTrigger value='read'>
                Read
                <span className='text-muted-foreground'>
                  {notifications.length - unread}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className='flex flex-wrap items-center gap-2'>
            <Select
              value={typeFilter}
              onValueChange={(value) =>
                setTypeFilter(value as 'all' | NotificationType)
              }
            >
              <SelectTrigger className='h-8 w-auto gap-2 text-xs'>
                <SelectValue placeholder='All types' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All types</SelectItem>
                {notificationTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {notificationTypeLabel[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={channelFilter}
              onValueChange={(value) =>
                setChannelFilter(value as 'all' | NotificationChannel)
              }
            >
              <SelectTrigger className='h-8 w-auto gap-2 text-xs'>
                <SelectValue placeholder='All channels' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All channels</SelectItem>
                {notificationChannels.map((channel) => (
                  <SelectItem key={channel} value={channel}>
                    {notificationChannelLabel[channel]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isFiltered && (
              <Button
                variant='ghost'
                size='sm'
                className='h-8 text-xs'
                onClick={clearFilters}
              >
                <FilterX />
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {isPending ? (
          <NotificationsSkeleton />
        ) : sorted.length === 0 ? (
          <div className='flex flex-col items-center justify-center gap-2 rounded-xl border py-16 text-sm text-muted-foreground'>
            <Bell className='size-8 text-muted-foreground/50' />
            <p>No notifications yet.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className='flex flex-col items-center justify-center gap-3 rounded-xl border py-16 text-sm text-muted-foreground'>
            <FilterX className='size-8 text-muted-foreground/50' />
            <p>No notifications match your filters.</p>
            <Button variant='outline' size='sm' onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className='overflow-hidden rounded-xl border bg-card'>
            {filtered.map((notification, index) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                isLast={index === filtered.length - 1}
                onOpen={() => markRead.mutate(notification.id)}
              />
            ))}
          </div>
        )}
      </Main>
    </>
  )
}

function NotificationRow({
  notification,
  isLast,
  onOpen,
}: {
  notification: AppNotification
  isLast: boolean
  onOpen: () => void
}) {
  const Icon = typeIcons[notification.type]

  return (
    <button
      type='button'
      onClick={onOpen}
      className={[
        'flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-secondary/40',
        !isLast && 'border-b',
        !notification.read && 'bg-secondary/20',
      ].join(' ')}
    >
      <span className='mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-secondary text-muted-foreground'>
        <Icon className='size-4' />
      </span>
      <span className='min-w-0 flex-1'>
        <span className='flex items-baseline justify-between gap-2'>
          <span className='truncate text-sm font-medium'>
            {notification.title}
          </span>
          <span className='shrink-0 text-xs text-muted-foreground'>
            {timeAgo(notification.createdAt)}
          </span>
        </span>
        <span className='mt-0.5 block text-sm text-muted-foreground'>
          {notification.message}
        </span>
        <span className='mt-1 flex items-center gap-2 text-[11px] tracking-wide text-muted-foreground/70 uppercase'>
          <span>{notificationTypeLabel[notification.type]}</span>
          <span className='size-0.5 rounded-full bg-border' />
          <span>via {notificationChannelLabel[notification.channel]}</span>
        </span>
      </span>
      {!notification.read && (
        <span
          className='mt-1.5 size-2 shrink-0 rounded-full bg-primary'
          aria-label='Unread'
        />
      )}
    </button>
  )
}

function NotificationsSkeleton() {
  return (
    <div className='space-y-3' aria-label='Loading notifications'>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className='flex items-center gap-3'>
          <Skeleton className='size-9 rounded-lg' />
          <div className='flex-1 space-y-2'>
            <Skeleton className='h-4 w-1/3' />
            <Skeleton className='h-3 w-2/3' />
          </div>
        </div>
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
