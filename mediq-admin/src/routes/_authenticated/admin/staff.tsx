import { createFileRoute } from '@tanstack/react-router'
import { Staff } from '@/features/staff'

export const Route = createFileRoute('/_authenticated/admin/staff')({
  component: Staff,
})
