import type { Appointment } from '@/features/appointments/schema'
import type { AuthUser } from '@/stores/auth-store'

export function isMyAppointment(
  appointment: Appointment,
  user: AuthUser | null | undefined
): boolean {
  if (!user?.email) return false
  const userEmail = user.email.toLowerCase()
  const userName = (user as unknown as { name?: string })?.name?.toLowerCase() ??
    user.email.split('@')[0]?.toLowerCase() ??
    ''
  const emailMatch = !!appointment.patientEmail && appointment.patientEmail.toLowerCase() === userEmail
  const nameMatch = !!userName && appointment.patientName?.toLowerCase() === userName
  return emailMatch || nameMatch
}
