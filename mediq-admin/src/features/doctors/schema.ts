import { z } from 'zod'

export const doctorStatuses = ['active', 'away'] as const
export type DoctorStatus = (typeof doctorStatuses)[number]

export const doctorSchema = z.object({
  id: z.string(),
  name: z.string(),
  specialization: z.string(),
  email: z.string(),
  status: z.enum(doctorStatuses),
  todayAppointments: z.number().optional(),
})
export type Doctor = z.infer<typeof doctorSchema>

export const doctorStatusBadge: Record<DoctorStatus, string> = {
  active: 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200',
  away: 'bg-amber-200/40 text-amber-900 dark:text-amber-100 border-amber-300',
}

export const specializations = [
  'Cardiology',
  'Pediatrics',
  'General Practice',
  'Dermatology',
  'Neurology',
  'Orthopedics',
] as const
