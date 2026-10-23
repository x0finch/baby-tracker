import { m } from '../../paraglide/messages.js'
import { MIN_PASSWORD_LENGTH, normalizeEmail } from './password'

/** Have I Been Pwned's range API: only the first 5 hex digits of the SHA-1 are sent. */
const BREACH_API = 'https://api.pwnedpasswords.com/range/'
/** Past this the check is skipped, so a slow network never blocks signing up. */
const BREACH_TIMEOUT_MS = 3_000

/** A new password the app refuses; its message says why. */
export class PasswordRefused extends Error {}

async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

/** Whether the password is in a known breach; false when the check can't be reached. */
export async function isBreached(password: string, request: typeof fetch = fetch) {
  try {
    const hash = await sha1Hex(password)
    const response = await request(BREACH_API + hash.slice(0, 5), {
      // Pads the answer with fake entries (count 0), so its size says nothing either.
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(BREACH_TIMEOUT_MS),
    })
    if (!response.ok) return false
    const suffix = hash.slice(5)
    return (await response.text()).split('\n').some((line) => {
      const [candidate, count] = line.trim().split(':')
      return candidate === suffix && Number(count) > 0
    })
  } catch {
    // Offline or blocked: the length and pattern checks still apply.
    return false
  }
}

/** Too easy to guess whatever the breach lists say: one character, only digits, the email. */
function isObvious(email: string, password: string): boolean {
  const lower = password.toLowerCase()
  const address = normalizeEmail(email)
  const name = address.split('@')[0] ?? ''
  return (
    new Set(password).size === 1 ||
    /^\d+$/.test(password) ||
    lower === address ||
    (name.length >= 4 && lower.includes(name))
  )
}

/** Throws `PasswordRefused` for a new password that is too short, obvious or breached. */
export async function checkNewPassword(
  email: string,
  password: string,
  request: typeof fetch = fetch,
): Promise<void> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordRefused(m.passwordTooShort({ min: MIN_PASSWORD_LENGTH }))
  }
  if (isObvious(email, password)) throw new PasswordRefused(m.passwordObvious())
  if (await isBreached(password, request)) throw new PasswordRefused(m.passwordBreached())
}
