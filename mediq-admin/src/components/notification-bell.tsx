import { Link } from '@tanstack/react-router'
import { useMarkAllNotificationsRead, useNotifications } from '@/data/hooks'
import { Bell, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  notificationTypeLabel,
  timeAgo,
  type AppNotification,
} from '@/features/notifications/schema'

export function NotificationBell() {
  const { data: notifications = [], isPending } = useNotifications()
  const markAllRead = useMarkAllNotificationsRead()

  const unread = notifications.filter((n) => !n.read).length
  const recent = [...notifications]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='outline'
          size='icon'
          className='relative'
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
          }
        >
          <Bell className='size-4' />
          {unread > 0 && (
            <span className='absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground'>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-80'>
        <DropdownMenuLabel className='flex items-center justify-between gap-2'>
          <span>Notifications</span>
          {unread > 0 && (
            <Button
              variant='ghost'
              size='sm'
              className='h-6 px-2 text-xs'
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isPending ? (
          <div className='space-y-2 p-3'>
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className='h-12 w-full' />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className='px-3 py-6 text-center text-sm text-muted-foreground'>
            No notifications yet.
          </p>
        ) : (
          <DropdownMenuGroup>
            {recent.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
              />
            ))}
          </DropdownMenuGroup>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to='/admin/notifications' className='justify-center'>
            View all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NotificationItem({ notification }: { notification: AppNotification }) {
  return (
    <DropdownMenuItem className='flex items-start gap-3 py-2'>
      <span
        className={cn(
          'mt-1.5 size-2 shrink-0 rounded-full',
          notification.read ? 'bg-border' : 'bg-primary'
        )}
        aria-hidden='true'
      />
      <span className='min-w-0 flex-1'>
        <span className='flex items-baseline justify-between gap-2'>
          <span className='truncate text-sm font-medium'>
            {notification.title}
          </span>
          <span className='shrink-0 text-xs text-muted-foreground'>
            {timeAgo(notification.createdAt)}
          </span>
        </span>
        <span className='mt-0.5 line-clamp-2 text-xs text-muted-foreground'>
          {notification.message}
        </span>
        <span className='mt-0.5 block text-[11px] tracking-wide text-muted-foreground/70 uppercase'>
          {notificationTypeLabel[notification.type]}
        </span>
      </span>
    </DropdownMenuItem>
  )
}
