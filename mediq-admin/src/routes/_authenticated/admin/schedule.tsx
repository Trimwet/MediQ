import { createFileRoute } from '@tanstack/react-router'
import { Schedule } from '@/features/schedule'

export const Route = createFileRoute('/_authenticated/admin/schedule')({
  component: Schedule,
})
