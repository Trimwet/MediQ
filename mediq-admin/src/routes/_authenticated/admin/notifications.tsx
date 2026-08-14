import { createFileRoute } from '@tanstack/react-router'
import { Notifications } from '@/features/notifications'

export const Route = createFileRoute('/_authenticated/admin/notifications')({
  component: Notifications,
})
