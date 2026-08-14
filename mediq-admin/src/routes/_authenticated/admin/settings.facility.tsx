import { createFileRoute } from '@tanstack/react-router'
import { SettingsFacility } from '@/features/settings/facility'

export const Route = createFileRoute('/_authenticated/admin/settings/facility')(
  {
    component: SettingsFacility,
  }
)
