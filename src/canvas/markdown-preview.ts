function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
}

const VALID_HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const VALID_NAMED_COLOR_PATTERN = /^[a-z-]+$/i
const VALID_RGB_COLOR_PATTERN = /^rgba?\(\s*(?:\d{1,3}%?\s*,\s*){2}\d{1,3}%?(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i
const ALLOWED_INLINE_STYLE_PROPERTIES = new Set(["background", "background-color", "color"])

type AllowedInlineOpenTag = {
  closeTag: string
  html: string
  length: number
}

const KRAMDOWN_INLINE_ATTRIBUTE_PATTERN = /\s*\{\:\s*[^}]*\}\s*$/i
const KRAMDOWN_ATTRIBUTE_LINE_PATTERN = /^\s*\{\:\s*[^}]*\}\s*$/i
const KRAMDOWN_LEADING_ATTRIBUTE_PATTERN = /^(\s*)\{\:\s*[^}]*\}\s*/
const KRAMDOWN_LIST_ITEM_ATTRIBUTE_PATTERN = /^(\s*(?:[-+*]|\d+\.)\s+)\{\:\s*[^}]*\}\s*/

function restorePlaceholders(value: string, prefix: string, placeholders: string[]): string {
  return placeholders.reduce(
    (current, html, index) => current.replaceAll(`%%${prefix}_${index}%%`, html),
    value,
  )
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value)
}

function normalizeMarkdownImageSource(source: string): string {
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

function sanitizeMarkdownPreviewSource(markdown: string): string {
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

function sanitizeColorValue(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (VALID_HEX_COLOR_PATTERN.test(trimmed) || VALID_RGB_COLOR_PATTERN.test(trimmed) || VALID_NAMED_COLOR_PATTERN.test(trimmed)) {
    return trimmed
  }

  return null
}

function sanitizeInlineStyle(style: string): string | null {
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

function parseAllowedInlineOpenTag(value: string): AllowedInlineOpenTag | null {
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

function extractAllowedInlineHtml(value: string): { placeholders: string[], text: string } {
  const placeholders: string[] = []
  let text = ""
  let index = 0

  while (index < value.length) {
    const openIndex = value.indexOf("<", index)
    if (openIndex === -1) {
      text += value.slice(index)
      break
    }

    text += value.slice(index, openIndex)

    const openTag = parseAllowedInlineOpenTag(value.slice(openIndex))
    if (!openTag) {
      text += value[openIndex]!
      index = openIndex + 1
      continue
    }

    const contentStart = openIndex + openTag.length
    const closeIndex = value.toLowerCase().indexOf(openTag.closeTag, contentStart)
    const contentEnd = closeIndex >= 0 ? closeIndex : value.length
    const innerHtml = renderInlineMarkdown(value.slice(contentStart, contentEnd))
    const placeholder = `%%HTML_${placeholders.length}%%`

    placeholders.push(`${openTag.html}${innerHtml}${openTag.closeTag}`)
    text += placeholder
    index = closeIndex >= 0 ? contentEnd + openTag.closeTag.length : value.length
  }

  return {
    placeholders,
    text,
  }
}

function renderInlineMarkdown(value: string): string {
  const codePlaceholders: string[] = []
  let rendered = value.replace(/`([^`\n]+)`/g, (_, code: string) => {
    const placeholder = `%%CODE_${codePlaceholders.length}%%`
    codePlaceholders.push(`<code>${escapeHtml(code)}</code>`)
    return placeholder
  })
  const imagePlaceholders: string[] = []
  rendered = rendered.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_match, alt: string, source: string, title?: string) => {
    const placeholder = `%%IMAGE_${imagePlaceholders.length}%%`
    const src = escapeHtmlAttribute(normalizeMarkdownImageSource(source))
    const escapedAlt = escapeHtmlAttribute(alt)
    const titleAttribute = title ? ` title="${escapeHtmlAttribute(title)}"` : ""

    imagePlaceholders.push(`<img src="${src}" alt="${escapedAlt}"${titleAttribute}>`)
    return placeholder
  })
  const { placeholders: htmlPlaceholders, text } = extractAllowedInlineHtml(rendered)
  rendered = escapeHtml(text)

  rendered = rendered
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, url: string) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")

  rendered = restorePlaceholders(rendered, "HTML", htmlPlaceholders)
  rendered = restorePlaceholders(rendered, "IMAGE", imagePlaceholders)
  return restorePlaceholders(rendered, "CODE", codePlaceholders)
}

function renderParagraph(lines: string[]): string {
  return `<p>${lines.map((line) => renderInlineMarkdown(line)).join("<br>")}</p>`
}

export function renderMarkdownPreview(markdown: string): string {
  const normalized = sanitizeMarkdownPreviewSource(markdown)
  if (!normalized) {
    return ""
  }

  const lines = normalized.split("\n")
  const blocks: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]!.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    if (trimmed.startsWith("```")) {
      index += 1
      const codeLines: string[] = []
      while (index < lines.length && !lines[index]!.trim().startsWith("```")) {
        codeLines.push(lines[index]!)
        index += 1
      }
      blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`)
      index += 1
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2]!)}</h${level}>`)
      index += 1
      continue
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index]!.trim())) {
        quoteLines.push(lines[index]!.trim().replace(/^>\s?/, ""))
        index += 1
      }
      blocks.push(`<blockquote>${renderParagraph(quoteLines)}</blockquote>`)
      continue
    }

    if (/^([-*+]\s+|\d+\.\s+)/.test(trimmed)) {
      const items: string[] = []
      const isOrdered = /^\d+\.\s+/.test(trimmed)
      const pattern = isOrdered ? /^\d+\.\s+/ : /^[-*+]\s+/
      while (index < lines.length && pattern.test(lines[index]!.trim())) {
        items.push(`<li>${renderInlineMarkdown(lines[index]!.trim().replace(pattern, ""))}</li>`)
        index += 1
      }
      blocks.push(`<${isOrdered ? "ol" : "ul"}>${items.join("")}</${isOrdered ? "ol" : "ul"}>`)
      continue
    }

    const paragraphLines = [trimmed]
    index += 1
    while (index < lines.length) {
      const next = lines[index]!.trim()
      if (!next || next.startsWith("```") || /^>\s?/.test(next) || /^(#{1,6})\s+/.test(next) || /^([-*+]\s+|\d+\.\s+)/.test(next)) {
        break
      }
      paragraphLines.push(next)
      index += 1
    }
    blocks.push(renderParagraph(paragraphLines))
  }

  return blocks.join("")
}
