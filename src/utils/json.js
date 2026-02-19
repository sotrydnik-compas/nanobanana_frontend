export function safeJsonParse(s, fallback = null) {
  try {
    if (s == null) return fallback
    if (typeof s === 'object') return s
    return JSON.parse(String(s))
  } catch {
    return fallback
  }
}
