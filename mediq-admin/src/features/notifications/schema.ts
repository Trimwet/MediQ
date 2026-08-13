import { z } from 'zod'

export const notificationTypes = [
  'appointment',
  'queue',
  'summary',
  'system',
] as const
export type NotificationType = (typeof notificationTypes)[number]

export const notificationChannels = ['email', 'push', 'sms', 'in_app'] as const
export type NotificationChannel = (typeof notificationChannels)[number]

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum(notificationTypes),
  channel: z.enum(notificationChannels),
  title: z.string(),
  message: z.string(),
  createdAt: z.string(), // ISO 8601
  read: z.boolean(),
})
export type AppNotification = z.infer<typeof notificationSchema>

export const notificationTypeLabel: Record<NotificationType, string> = {
  appointment: 'Appointment',
  queue: 'Queue',
  summary: 'Daily summary',
  system: 'System',
}

export const notificationChannelLabel: Record<NotificationChannel, string> = {
  email: 'Email',
  push: 'Push',
  sms: 'SMS',
  in_app: 'In-app',
}

/** "just now", "5m ago", "3h ago", "2d ago" */
export function timeAgo(iso: string): string {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  )
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
