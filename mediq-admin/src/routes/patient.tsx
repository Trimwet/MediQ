import { createFileRoute } from '@tanstack/react-router'
import { PatientPortal } from '@/features/patient'

export const Route = createFileRoute('/patient')({
  component: PatientPortal,
})
