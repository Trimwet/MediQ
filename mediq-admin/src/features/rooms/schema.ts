import { z } from 'zod'

export const roomTypes = ['consultation', 'procedure', 'recovery'] as const
export type RoomType = (typeof roomTypes)[number]

export const roomStatuses = ['available', 'occupied', 'cleaning'] as const
export type RoomStatus = (typeof roomStatuses)[number]

export const roomSchema = z.object({
  id: z.string(),
  number: z.string(),
  type: z.enum(roomTypes),
  status: z.enum(roomStatuses),
  doctorName: z.string().optional(),
  patientName: z.string().optional(),
})
export type Room = z.infer<typeof roomSchema>

export const roomTypeLabel: Record<RoomType, string> = {
  consultation: 'Consultation',
  procedure: 'Procedure',
  recovery: 'Recovery',
}

export const roomStatusBadge: Record<RoomStatus, string> = {
  available: 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200',
  occupied: 'bg-indigo-200/40 text-indigo-900 dark:text-indigo-100 border-indigo-300',
  cleaning: 'bg-amber-200/40 text-amber-900 dark:text-amber-100 border-amber-300',
}
