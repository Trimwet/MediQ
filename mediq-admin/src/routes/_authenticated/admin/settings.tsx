import { createFileRoute } from '@tanstack/react-router'
import { SettingsLayout } from '@/features/settings'

export const Route = createFileRoute('/_authenticated/admin/settings')({
  component: SettingsLayout,
})
