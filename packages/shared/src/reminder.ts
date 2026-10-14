import { z } from 'zod'

/** Kinds of "it's been a while" reminders: since the last event of that type started. */
export const reminderKindSchema = z.enum(['feeding', 'diaper'])
export type ReminderKind = z.infer<typeof reminderKindSchema>

export const MIN_REMINDER_MINUTES = 30
export const MAX_REMINDER_MINUTES = 12 * 60

export const reminderSchema = z.object({
  babyId: z.string().min(1).max(64),
  kind: reminderKindSchema,
  intervalMinutes: z.number().int().min(MIN_REMINDER_MINUTES).max(MAX_REMINDER_MINUTES),
  enabled: z.boolean(),
})
export type Reminder = z.infer<typeof reminderSchema>

/** A browser's PushSubscription as sent by the app (PushSubscription.toJSON()). */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(64),
  }),
})
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>

/** Payload of a notification, shown by the service worker. */
export interface PushMessage {
  title: string
  body: string
  /** Notifications with the same tag replace each other. */
  tag: string
  /** Path opened when the notification is tapped. */
  url: string
}
