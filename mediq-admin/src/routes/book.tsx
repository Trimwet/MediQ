import { createFileRoute } from '@tanstack/react-router'
import { Booking } from '@/features/booking'

export const Route = createFileRoute('/book')({
  component: Booking,
})
