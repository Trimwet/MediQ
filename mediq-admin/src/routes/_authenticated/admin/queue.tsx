import { createFileRoute } from '@tanstack/react-router'
import { Queue } from '@/features/queue'

export const Route = createFileRoute('/_authenticated/admin/queue')({
  component: Queue,
})
