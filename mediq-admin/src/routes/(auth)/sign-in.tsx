import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { SignIn } from '@/features/auth/sign-in'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

// helper to forward ?redirect= when linking between auth pages
export const getRedirectSearch = (redirect?: string) =>
  redirect ? { redirect } : undefined

export const Route = createFileRoute('/(auth)/sign-in')({
  component: SignIn,
  validateSearch: searchSchema,
})
