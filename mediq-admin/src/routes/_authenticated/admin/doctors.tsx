import { createFileRoute } from '@tanstack/react-router'
import { Doctors } from '@/features/doctors'

export const Route = createFileRoute('/_authenticated/admin/doctors')({
  component: Doctors,
})
