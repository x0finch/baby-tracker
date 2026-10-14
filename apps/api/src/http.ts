import { HTTPException } from 'hono/http-exception'
import { validator } from 'hono/validator'

/** Error codes the API answers with, as `{ error }`. */
export type ErrorCode = 'invalid' | 'forbidden' | 'not_found'

const STATUS = { invalid: 400, forbidden: 403, not_found: 404 } as const

/** Stops the request with `{ error: code }`; `onError` turns it into the response. */
export function fail(code: ErrorCode): never {
  throw new HTTPException(STATUS[code], { message: code })
}

interface Schema<T> {
  safeParse: (value: unknown) => { success: true; data: T } | { success: false }
}

/** Validates the JSON body against a shared schema; handlers read `c.req.valid('json')`. */
export const json = <T>(schema: Schema<T>) =>
  validator('json', (value): T => {
    const parsed = schema.safeParse(value)
    if (!parsed.success) fail('invalid')
    return parsed.data
  })

/** Maps thrown errors to JSON: HTTP errors keep their status, anything else is a 500. */
export function errorResponse(error: Error): Response {
  if (error instanceof HTTPException) {
    // Hono's own 400s (malformed JSON, wrong content type) carry prose, not a code.
    const code = error.status === 400 ? 'invalid' : error.message
    return Response.json({ error: code }, { status: error.status })
  }
  console.error(error)
  return Response.json({ error: 'internal_error' }, { status: 500 })
}
