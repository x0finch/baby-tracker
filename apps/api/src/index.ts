import { createApp } from './app'
import type { Env } from './env'
import { dispatchReminders } from './reminders'

const app = createApp()

export default {
  fetch: app.fetch,
  // Every minute (wrangler.jsonc): send reminders that have come due.
  async scheduled(controller, env) {
    await dispatchReminders(env, controller.scheduledTime)
  },
} satisfies ExportedHandler<Env>
