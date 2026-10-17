import { z } from 'zod'

/**
 * One thing to record, as the assistant's record tool takes it. Every field is present (null
 * when not said); the server builds and validates the real records from it.
 */
export const voiceActionSchema = z.object({
  type: z.enum([
    'diaper',
    'bottle',
    'breast',
    'solids',
    'sleep',
    'wake',
    'pumping',
    'temperature',
    'medication',
    'note',
    'undo',
  ]),
  baby: z.string().nullable().meta({ description: 'Baby name as said, or null if not said' }),
  time: z
    .string()
    .nullable()
    .meta({ description: 'Clock time said for when it happened, as HH:MM (24h), else null' }),
  minutesAgo: z
    .number()
    .nullable()
    .meta({ description: 'For "半小时前" style times: minutes before now, else null' }),
  durationMinutes: z
    .number()
    .nullable()
    .meta({ description: 'How long it lasted, if said (sleep, breastfeeding), else null' }),
  diaper: z.enum(['wet', 'dirty', 'mixed']).nullable(),
  amountMl: z.number().nullable().meta({ description: 'Bottle or pumped amount in ml' }),
  milk: z.enum(['breast', 'formula', 'mixed']).nullable(),
  side: z.enum(['left', 'right', 'both']).nullable(),
  food: z.string().nullable().meta({ description: 'Solid food eaten' }),
  celsius: z.number().nullable(),
  medicine: z.string().nullable(),
  dose: z.string().nullable(),
  text: z.string().nullable().meta({ description: 'Note text, for type note' }),
})

export type VoiceAction = z.infer<typeof voiceActionSchema>
