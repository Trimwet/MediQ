import { createFileRoute } from '@tanstack/react-router'
import { ChangePassword } from '@/features/change-password'

export const Route = createFileRoute('/change-password')({
  component: ChangePassword,
})
