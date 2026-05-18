const VALID_HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const VALID_NAMED_COLOR_PATTERN = /^[a-z-]+$/i
const VALID_RGB_COLOR_PATTERN = /^rgba?\(\s*(?:\d{1,3}%?\s*,\s*){2}\d{1,3}%?(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i
const ALLOWED_INLINE_STYLE_PROPERTIES = new Set(["background", "background-color", "color"])

const KRAMDOWN_INLINE_ATTRIBUTE_PATTERN = /\s*\{\:\s*[^}]*\}\s*$/i
const KRAMDOWN_ATTRIBUTE_LINE_PATTERN = /^\s*\{\:\s*[^}]*\}\s*$/i
const KRAMDOWN_LEADING_ATTRIBUTE_PATTERN = /^(\s*)\{\:\s*[^}]*\}\s*/
const KRAMDOWN_LIST_ITEM_ATTRIBUTE_PATTERN = /^(\s*(?:[-+*]|\d+\.)\s+)\{\:\s*[^}]*\}\s*/

export type AllowedInlineOpenTag = {
  closeTag: string
  html: string
  length: number
}

export type SanitizedImageTag = {
  html: string
  length: number
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
}

export function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value)
}

export function extractHtmlAttribute(value: string, attribute: string): string | null {
  const pattern = new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i")
  const match = value.match(pattern)
  return match?.[1] ?? match?.[2] ?? null
}

export function normalizeMarkdownImageSource(source: string): string {
  const trimmed = source.trim()
  if (!trimmed || /^(?:[a-z]+:)?\/\//i.test(trimmed) || /^(?:data|blob):/i.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed
  }

  if (trimmed.startsWith("assets/")) {
    return `/data/${trimmed}`
  }

  if (trimmed.startsWith("data/")) {
    return `/${trimmed}`
  }

  return trimmed
}

function stripKramdownAttributes(line: string): string {
  if (KRAMDOWN_ATTRIBUTE_LINE_PATTERN.test(line)) {
    return ""
  }

  let sanitized = line.replace(KRAMDOWN_INLINE_ATTRIBUTE_PATTERN, "")

  while (KRAMDOWN_LEADING_ATTRIBUTE_PATTERN.test(sanitized)) {
    sanitized = sanitized.replace(KRAMDOWN_LEADING_ATTRIBUTE_PATTERN, "$1")
  }

  while (KRAMDOWN_LIST_ITEM_ATTRIBUTE_PATTERN.test(sanitized)) {
    sanitized = sanitized.replace(KRAMDOWN_LIST_ITEM_ATTRIBUTE_PATTERN, "$1")
  }

  return sanitized
}

export function sanitizeMarkdownPreviewSource(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
  const sanitized: string[] = []
  let inCodeBlock = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock
      sanitized.push(line)
      continue
    }

    sanitized.push(inCodeBlock ? line : stripKramdownAttributes(line))
  }

  return sanitized.join("\n").trim()
}

export function sanitizeColorValue(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (VALID_HEX_COLOR_PATTERN.test(trimmed) || VALID_RGB_COLOR_PATTERN.test(trimmed) || VALID_NAMED_COLOR_PATTERN.test(trimmed)) {
    return trimmed
  }

  return null
}

export function sanitizeInlineStyle(style: string): string | null {
  const declarations = style
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)

  if (!declarations.length) {
    return null
  }

  const sanitizedDeclarations = declarations.map((declaration) => {
    const separatorIndex = declaration.indexOf(":")
    if (separatorIndex <= 0) {
      return null
    }

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase()
    const value = declaration.slice(separatorIndex + 1).trim()
    if (!ALLOWED_INLINE_STYLE_PROPERTIES.has(property)) {
      return null
    }

    const sanitizedValue = sanitizeColorValue(value)
    if (!sanitizedValue) {
      return null
    }

    return `${property}: ${sanitizedValue}`
  })

  if (sanitizedDeclarations.some((declaration) => declaration === null)) {
    return null
  }

  return sanitizedDeclarations.join("; ")
}

export function parseAllowedInlineOpenTag(value: string): AllowedInlineOpenTag | null {
  const spanMatch = value.match(/^<span\s+style\s*=\s*(?:"([^"]*)"|'([^']*)')\s*>/i)
  if (spanMatch) {
    const sanitizedStyle = sanitizeInlineStyle(spanMatch[1] ?? spanMatch[2] ?? "")
    if (!sanitizedStyle) {
      return null
    }

    return {
      closeTag: "</span>",
      html: `<span style="${escapeHtml(sanitizedStyle)}">`,
      length: spanMatch[0].length,
    }
  }

  const fontMatch = value.match(/^<font\s+color\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))\s*>/i)
  if (fontMatch) {
    const sanitizedColor = sanitizeColorValue(fontMatch[1] ?? fontMatch[2] ?? fontMatch[3] ?? "")
    if (!sanitizedColor) {
      return null
    }

    return {
      closeTag: "</font>",
      html: `<font color="${escapeHtml(sanitizedColor)}">`,
      length: fontMatch[0].length,
    }
  }

  return null
}

export function parseAllowedImageTag(value: string): SanitizedImageTag | null {
  const match = value.match(/^<img\b[^>]*>/i)
  if (!match) {
    return null
  }

  const source = extractHtmlAttribute(match[0], "src")
  if (!source) {
    return null
  }

  const src = normalizeMarkdownImageSource(source)
  if (!src) {
    return null
  }

  const alt = extractHtmlAttribute(match[0], "alt")
  const title = extractHtmlAttribute(match[0], "title")
  return {
    html: `<img src="${escapeHtmlAttribute(src)}" alt="${escapeHtmlAttribute(alt || "")}"${title ? ` title="${escapeHtmlAttribute(title)}"` : ""}>`,
    length: match[0].length,
  }
}
