import {
  escapeHtml,
  escapeHtmlAttribute,
  normalizeMarkdownImageSource,
  parseAllowedImageTag,
  parseAllowedInlineOpenTag,
  sanitizeMarkdownPreviewSource,
} from "@/canvas/markdown-sanitize"

export {
  escapeHtml,
  escapeHtmlAttribute,
  extractHtmlAttribute,
  normalizeMarkdownImageSource,
  sanitizeMarkdownPreviewSource,
  sanitizeColorValue,
  sanitizeInlineStyle,
  parseAllowedInlineOpenTag,
  parseAllowedImageTag,
  type AllowedInlineOpenTag,
  type SanitizedImageTag,
} from "@/canvas/markdown-sanitize"

const HEADING_PATTERN = /^(#{1,6})\s+/

export const MARKDOWN_PREVIEW_TEXT_LIMIT = 1200

function restorePlaceholders(value: string, prefix: string, placeholders: string[]): string {
  return placeholders.reduce(
    (current, html, index) => current.replaceAll(`%%${prefix}_${index}%%`, html),
    value,
  )
}

export function truncateMarkdownPreviewSource(markdown: string, limit = MARKDOWN_PREVIEW_TEXT_LIMIT): string {
  const normalized = sanitizeMarkdownPreviewSource(markdown)
  if (normalized.length <= limit) {
    return normalized
  }

  return `${normalized.slice(0, limit).trimEnd()}…`
}

export function extractHeadingSectionMarkdown(markdown: string, limit = MARKDOWN_PREVIEW_TEXT_LIMIT): string {
  const normalized = sanitizeMarkdownPreviewSource(markdown)
  if (!normalized) {
    return ""
  }

  const lines = normalized.split("\n")
  const firstHeadingIndex = lines.findIndex((line) => HEADING_PATTERN.test(line.trim()))
  if (firstHeadingIndex < 0) {
    return truncateMarkdownPreviewSource(normalized, limit)
  }

  const headingLevel = lines[firstHeadingIndex]!.trim().match(HEADING_PATTERN)?.[1].length ?? 6
  const sectionLines = [lines[firstHeadingIndex]!]

  for (let index = firstHeadingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]!
    const headingMatch = line.trim().match(HEADING_PATTERN)
    if (headingMatch && headingMatch[1].length <= headingLevel) {
      break
    }
    sectionLines.push(line)
  }

  return truncateMarkdownPreviewSource(sectionLines.join("\n"), limit)
}

export interface MarkdownHeadingBlock {
  id: string
  level: number
  title: string
}

export function extractMarkdownHeadingBlocks(markdown: string): MarkdownHeadingBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
  const headings: MarkdownHeadingBlock[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index]!.trim().match(/^(#{1,6})\s+(.+)$/)
    if (!headingMatch) {
      continue
    }

    const id = lines[index + 1]?.match(/\{\:\s*[^}]*\bid="(\d{14}-[a-z0-9]{7})"[^}]*\}/i)?.[1]
    if (!id) {
      continue
    }

    headings.push({
      id,
      level: headingMatch[1]!.length,
      title: headingMatch[2]!.trim(),
    })
  }

  return headings
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

    const imageTag = parseAllowedImageTag(value.slice(openIndex))
    if (imageTag) {
      const placeholder = `%%HTML_${placeholders.length}%%`
      placeholders.push(imageTag.html)
      text += placeholder
      index = openIndex + imageTag.length
      continue
    }

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
