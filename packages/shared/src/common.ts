import { z } from 'zod'

/** UTC epoch milliseconds. All instants are stored this way and formatted on display. */
export const timestampSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

/** Better Auth user id; null for records created while signed out. */
export const userIdSchema = z.string().min(1).max(64)

/** Fields every synced record carries, so sync can be added without migrations. */
export const syncFields = {
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  /** Soft delete marker; deletions must propagate through sync. */
  deletedAt: timestampSchema.nullable(),
  createdBy: userIdSchema.nullable(),
}

export function checkTimestamps(
  record: { createdAt: number; updatedAt: number },
  ctx: z.RefinementCtx,
) {
  if (record.updatedAt < record.createdAt) {
    ctx.addIssue({
      code: 'custom',
      message: 'updatedAt must not be before createdAt',
      path: ['updatedAt'],
    })
  }
}
