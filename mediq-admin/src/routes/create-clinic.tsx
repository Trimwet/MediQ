import { createFileRoute } from '@tanstack/react-router'
import { CreateClinic } from '@/features/create-clinic'

export const Route = createFileRoute('/create-clinic')({
  component: CreateClinic,
})
