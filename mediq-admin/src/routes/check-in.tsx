import { createFileRoute } from '@tanstack/react-router'
import { CheckInPage } from '@/features/check-in'

export const Route = createFileRoute('/check-in')({
  component: CheckInPage,
})
