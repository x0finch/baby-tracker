import { z } from 'zod'

import { checkTimestamps, syncFields, timestampSchema } from './common'
import { idSchema } from './id'

export const babySexSchema = z.enum(['female', 'male', 'unspecified'])
export const avatarColorSchema = z.enum(['green', 'blue', 'orange', 'purple', 'pink', 'yellow'])

export const babySchema = z
  .object({
    id: idSchema,
    /** Null while the baby only exists locally (signed out). */
    familyId: idSchema.nullable(),
    name: z.string().trim().min(1).max(40),
    /** Calendar date without time zone, e.g. "2026-09-30". */
    birthDate: z.iso.date(),
    sex: babySexSchema,
    avatarColor: avatarColorSchema,
    archivedAt: timestampSchema.nullable(),
    ...syncFields,
  })
  .superRefine(checkTimestamps)

export type Baby = z.infer<typeof babySchema>
export type BabySex = z.infer<typeof babySexSchema>
export type AvatarColor = z.infer<typeof avatarColorSchema>
