import { createFileRoute } from '@tanstack/react-router'
import { SettingsNotifications } from '@/features/settings/notifications'

export const Route = createFileRoute(
  '/_authenticated/admin/settings/notifications'
)({
  component: SettingsNotifications,
})
