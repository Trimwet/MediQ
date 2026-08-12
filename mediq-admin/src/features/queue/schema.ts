import { z } from 'zod'

export const queueStatuses = [
  'waiting',
  'called',
  'in_room',
  'done',
  'left',
] as const
export type QueueStatus = (typeof queueStatuses)[number]

export const queueEntrySchema = z.object({
  id: z.string(),
  appointmentId: z.string().optional(),
  patientName: z.string(),
  appointmentTime: z.string(), // ISO 8601
  checkedInAt: z.string(), // ISO 8601
  calledAt: z.string().optional(), // ISO 8601
  doctorName: z.string(),
  room: z.string().optional(),
  status: z.enum(queueStatuses),
})
export type QueueEntry = z.infer<typeof queueEntrySchema>

export const queueStatusBadge: Record<QueueStatus, string> = {
  waiting: 'bg-sky-200/40 text-sky-900 dark:text-sky-100 border-sky-300',
  called: 'bg-amber-200/40 text-amber-900 dark:text-amber-100 border-amber-300',
  in_room: 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200',
  done: 'bg-emerald-100/30 text-emerald-900 dark:text-emerald-200 border-emerald-200',
  left: 'bg-neutral-300/40 border-neutral-300',
}
