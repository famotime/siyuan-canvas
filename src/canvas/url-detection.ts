export function isWebUrl(text: string): boolean {
  const trimmed = text.trim()
  return /^https?:\/\/[^\s]+$/.test(trimmed)
}
