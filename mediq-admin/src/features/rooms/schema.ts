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

export const roomStatusLabel: Record<RoomStatus, string> = {
  available: 'Available',
  occupied: 'Occupied',
  cleaning: 'Cleaning',
}
