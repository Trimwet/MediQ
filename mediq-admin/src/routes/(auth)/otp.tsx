import { z } from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Otp } from '@/features/auth/otp'

const searchSchema = z.object({
  email: z.string().email().optional(),
  purpose: z.enum(['signin', 'signup', 'reset']).optional(),
})

export const Route = createFileRoute('/(auth)/otp')({
  component: Otp,
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    if (!search.email || !search.purpose) {
      throw redirect({ to: '/sign-in' })
    }
  },
})