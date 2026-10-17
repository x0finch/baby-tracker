import { chat } from '@tanstack/ai'
import { OPENAI_CHAT_MODELS, createOpenaiChat } from '@tanstack/ai-openai'
import { z } from 'zod'

/**
 * What the model turns a sentence into. Every field is present (null when not said), which
 * strict structured outputs require; the server then builds and validates real records.
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

export const voiceParseSchema = z.object({
  actions: z.array(voiceActionSchema),
  /** Set instead of actions when the sentence is not about logging baby care. */
  unclear: z.boolean(),
})

export type VoiceAction = z.infer<typeof voiceActionSchema>
export type VoiceParse = z.infer<typeof voiceParseSchema>

export interface ParseContext {
  text: string
  babyNames: string[]
  /** Local date and time now, e.g. "2026-10-17 21:05 星期五". */
  localNow: string
}

/** Turns a sentence into actions; tests pass a fake, production calls the model. */
export type VoiceParser = (context: ParseContext) => Promise<VoiceParse>

const INSTRUCTIONS = `You turn one sentence a parent said to Siri, in Chinese, into baby-care log actions.
Rules:
- One action per thing that happened; a sentence may contain several, for one or more babies.
- type: diaper (换尿布/尿了/拉了), bottle (瓶喂/喝奶/喂奶 with an amount), breast (亲喂/母乳/吃奶 at the breast),
  solids (辅食/吃了某样食物), sleep (睡着了/睡了/开始睡), wake (醒了), pumping (吸奶/挤奶),
  temperature (体温/发烧 with a number), medication (吃药/喂药), note (anything else worth noting),
  undo (撤销/删掉刚才的/记错了).
- diaper: wet for 尿, dirty for 便便/拉, mixed for both; null if only "换尿布" was said.
- bottle: milk is breast for 母乳, formula for 奶粉/配方奶, mixed for both, null if not said.
  "喂奶120毫升" is a bottle. "喂奶" with no amount and no bottle word is breast.
- breast: side left/right/both if said. durationMinutes if a length was said.
- sleep with durationMinutes means a finished sleep of that length; without, a sleep starting.
- Times: copy a clock time to time as HH:MM (下午三点 is 15:00); relative times go to minutesAgo.
  Leave both null when no time was said.
- Amounts: convert to ml (1 oz = 30 ml). Temperatures in °C.
- baby: the name as said if one was mentioned, else null. Known babies are listed below.
- Set unclear to true and return no actions if the sentence is not about baby care.`

type ChatModel = (typeof OPENAI_CHAT_MODELS)[number]

/** Small, fast and cheap, with strict structured outputs. Override with VOICE_MODEL. */
export const DEFAULT_MODEL: ChatModel = 'gpt-5.4-mini'

const isChatModel = (model: string): model is ChatModel =>
  (OPENAI_CHAT_MODELS as readonly string[]).includes(model)

/**
 * The production parser: TanStack AI with the OpenAI adapter and a strict output schema.
 * Reasoning is off; this is extraction, and Siri is waiting.
 */
export function openaiParser(apiKey: string, model: string = DEFAULT_MODEL): VoiceParser {
  const known = isChatModel(model) ? model : DEFAULT_MODEL
  return async ({ text, babyNames, localNow }) =>
    chat({
      adapter: createOpenaiChat(known, apiKey),
      systemPrompts: [
        INSTRUCTIONS,
        `Now: ${localNow}. Known babies: ${babyNames.join('、') || '(none)'}.`,
      ],
      messages: [{ role: 'user', content: text }],
      outputSchema: voiceParseSchema,
    })
}
