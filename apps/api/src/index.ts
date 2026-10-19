import { createApp } from './app'
import type { Env } from './env'
import { runScheduled } from './scheduled'

const app = createApp()

export default {
  fetch: app.fetch,
  async scheduled(controller, env) {
    await runScheduled(env, controller.scheduledTime)
  },
} satisfies ExportedHandler<Env>
