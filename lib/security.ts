const PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/g
const HAS_CONTROL_CHARS_PATTERN = /[\u0000-\u001F\u007F]/

export const DEFAULT_AUTH_REDIRECT = '/dashboard'
export const MAX_DEAL_PROMPT_FIELD_LENGTH = 200

export function normalizeAuthRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT
) {
  const trimmed = value?.trim() ?? ''

  if (!trimmed) return fallback
  if (!trimmed.startsWith('/')) return fallback
  if (trimmed.startsWith('//')) return fallback
  if (PROTOCOL_PATTERN.test(trimmed)) return fallback
  if (HAS_CONTROL_CHARS_PATTERN.test(trimmed)) return fallback

  return trimmed
}

export function buildAuthCallbackUrl(origin: string, redirect: string | null | undefined) {
  const url = new URL('/auth/callback', origin)
  url.searchParams.set('redirect', normalizeAuthRedirectPath(redirect))
  return url.toString()
}

export function sanitizeDealPromptText(
  value: string | null | undefined,
  maxLength = MAX_DEAL_PROMPT_FIELD_LENGTH
) {
  if (typeof value !== 'string') return null

  const normalized = value
    .replace(CONTROL_CHAR_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return null
  return normalized.slice(0, maxLength)
}
