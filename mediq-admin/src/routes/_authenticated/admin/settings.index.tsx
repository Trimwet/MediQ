import { createFileRoute } from '@tanstack/react-router'
import { SettingsProfile } from '@/features/settings/profile'

export const Route = createFileRoute('/_authenticated/admin/settings/')({
  component: SettingsProfile,
})
