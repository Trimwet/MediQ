import { z } from 'zod'

export const appointmentStatuses = [
  'pending',
  'booked',
  'arrived',
  'in_progress',
  'completed',
  'no_show',
  'cancelled',
  'rejected',
] as const
export type AppointmentStatus = (typeof appointmentStatuses)[number]

export const appointmentSchema = z.object({
  id: z.string(),
  patientName: z.string(),
  /** Set for self-service online bookings; links the appointment to a patient account. */
  patientEmail: z.string().optional(),
  doctorId: z.string(),
  doctorName: z.string(),
  scheduledFor: z.string(), // ISO 8601
  status: z.enum(appointmentStatuses),
  reason: z.string().optional(),
  /** Filled when a pending request is rejected, so the patient knows why. */
  rejectionReason: z.string().optional(),
})
export type Appointment = z.infer<typeof appointmentSchema>

export const appointmentStatusBadge: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-200/40 text-amber-900 dark:text-amber-100 border-amber-300',
  booked: 'bg-sky-200/40 text-sky-900 dark:text-sky-100 border-sky-300',
  arrived: 'bg-amber-200/40 text-amber-900 dark:text-amber-100 border-amber-300',
  in_progress: 'bg-indigo-200/40 text-indigo-900 dark:text-indigo-100 border-indigo-300',
  completed: 'bg-emerald-100/30 text-emerald-900 dark:text-emerald-200 border-emerald-200',
  no_show: 'bg-neutral-300/40 border-neutral-300',
  cancelled: 'bg-destructive/10 dark:bg-destructive/50 text-destructive dark:text-primary border-destructive/10',
  rejected: 'bg-destructive/10 dark:bg-destructive/50 text-destructive dark:text-primary border-destructive/10',
}

/**
 * Next status in the visit flow. `undefined` means no further transition
 * from that status (terminal states).
 */
export const nextStatus: Partial<
  Record<AppointmentStatus, AppointmentStatus>
> = {
  booked: 'arrived',
  arrived: 'in_progress',
  in_progress: 'completed',
}

/** Statuses that can be cancelled or marked as no-show from. */
export const canCancel: AppointmentStatus[] = ['booked', 'arrived']
export const canNoShow: AppointmentStatus[] = ['booked', 'arrived']

/** Pending self-service requests awaiting staff approval. */
export const canApprove: AppointmentStatus[] = ['pending']
export const canReject: AppointmentStatus[] = ['pending']

/** Statuses that count as confirmed visits (not requests or dead ends). */
export const confirmedStatuses: AppointmentStatus[] = [
  'booked',
  'arrived',
  'in_progress',
  'completed',
]
