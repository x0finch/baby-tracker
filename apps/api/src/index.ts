import { deleteOldConversations } from './agent/retention'
import { createApp } from './app'
import type { Env } from './env'
import { dispatchReminders } from './reminders'

const app = createApp()

export default {
  fetch: app.fetch,
  // Every minute (wrangler.jsonc): send reminders that have come due. On the hour, also
  // delete conversations older than 30 days.
  async scheduled(controller, env) {
    const now = controller.scheduledTime
    await dispatchReminders(env, now)
    if (new Date(now).getUTCMinutes() === 0) await deleteOldConversations(env.DB, now)
  },
} satisfies ExportedHandler<Env>
