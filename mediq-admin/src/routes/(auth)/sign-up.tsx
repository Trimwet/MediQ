import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { SignUp } from '@/features/auth/sign-up'

const searchSchema = z.object({
  redirect: z.string().optional(),
  business: z.string().optional(),
})

// helper to forward ?redirect= when linking between auth pages
export const getRedirectSearch = (redirect?: string) =>
  redirect ? { redirect } : undefined

export const Route = createFileRoute('/(auth)/sign-up')({
  component: SignUp,
  validateSearch: searchSchema,
})
