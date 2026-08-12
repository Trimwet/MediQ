import { z } from 'zod'

export const patientSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().optional(),
  lastVisit: z.string().nullable(), // ISO 8601, null if never visited
  visits: z.number(),
})
export type Patient = z.infer<typeof patientSchema>
