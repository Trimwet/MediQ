import { z } from 'zod'

export const staffRoles = ['front_desk', 'admin'] as const
export type StaffRole = (typeof staffRoles)[number]

export const staffStatuses = ['active', 'inactive'] as const
export type StaffStatus = (typeof staffStatuses)[number]

export const staffSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(staffRoles),
  phone: z.string(),
  email: z.string(),
  status: z.enum(staffStatuses),
})
export type Staff = z.infer<typeof staffSchema>

export const staffRoleBadge: Record<StaffRole, string> = {
  front_desk: 'bg-sky-200/40 text-sky-900 dark:text-sky-100 border-sky-300',
  admin: 'bg-indigo-200/40 text-indigo-900 dark:text-indigo-100 border-indigo-300',
}

export const staffStatusBadge: Record<StaffStatus, string> = {
  active: 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200',
  inactive: 'bg-neutral-300/40 border-neutral-300',
}
