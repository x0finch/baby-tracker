// Conversations with the voice agent are kept 30 days after they were last used, then
// deleted: what was said, the runs, the questions waiting for an answer and the undo log.

export const KEEP_MS = 30 * 86_400_000

/** Deletes conversations older than 30 days, with everything about them. */
export async function deleteOldConversations(db: D1Database, now: number) {
  const cutoff = now - KEEP_MS
  await db.batch([
    db.prepare('delete from voice_ops where created_at < ?').bind(cutoff),
    db.prepare('delete from chat_interrupts where requested_at < ?').bind(cutoff),
    db.prepare('delete from chat_runs where started_at < ?').bind(cutoff),
    db.prepare('delete from chat_threads where updated_at < ?').bind(cutoff),
  ])
}
