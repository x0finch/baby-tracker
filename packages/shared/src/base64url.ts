// Provided by browsers, Workers and Node; this package doesn't load the DOM typings.
declare function atob(data: string): string
declare function btoa(data: string): string

/** Unpadded base64url (RFC 4648 §5), as used by Web Push keys, JWTs and URL tokens. */
export function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/** Decodes base64url, padded or not. Throws on characters outside the alphabet. */
export function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (char: string) => char.charCodeAt(0))
}
