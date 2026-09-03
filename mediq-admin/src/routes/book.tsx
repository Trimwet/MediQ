import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Booking } from '@/features/booking'

const bookSearchSchema = z.object({
  clinicId: z.string().optional(),
})

export const Route = createFileRoute('/book')({
  component: Booking,
  validateSearch: bookSearchSchema,
})
