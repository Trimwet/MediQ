import { createFileRoute } from '@tanstack/react-router'
import { CreateClinic } from '@/features/create-clinic'

export const Route = createFileRoute('/_authenticated/create-clinic')({
  component: CreateClinic,
})
