import { createFileRoute } from '@tanstack/react-router'
import { Appointments } from '@/features/appointments'

export const Route = createFileRoute('/_authenticated/admin/appointments')({
  component: Appointments,
})
