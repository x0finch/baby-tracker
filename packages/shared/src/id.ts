import { decodeTime, isValid, monotonicFactory } from 'ulid'
import { z } from 'zod'

const generate = monotonicFactory()

/**
 * Creates a new record id. ULIDs are generated on the client so records can be created
 * offline; they sort by creation time and are monotonic within one client.
 */
export function newId(now: number = Date.now()): string {
  return generate(now)
}

/** When an id was made (epoch ms). */
export const idTime = (id: string): number => decodeTime(id)

export const idSchema = z.string().refine(isValid, { message: 'Invalid ULID' })
