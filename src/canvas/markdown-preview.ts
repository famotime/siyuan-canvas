function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
}

function renderInlineMarkdown(value: string): string {
  const codePlaceholders: string[] = []
  let rendered = escapeHtml(value).replace(/`([^`\n]+)`/g, (_, code: string) => {
    const placeholder = `%%CODE_${codePlaceholders.length}%%`
    codePlaceholders.push(`<code>${code}</code>`)
    return placeholder
  })

  rendered = rendered
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, url: string) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")

  return codePlaceholders.reduce(
    (current, html, index) => current.replaceAll(`%%CODE_${index}%%`, html),
    rendered,
  )
}

function renderParagraph(lines: string[]): string {
  return `<p>${lines.map((line) => renderInlineMarkdown(line)).join("<br>")}</p>`
}

export function renderMarkdownPreview(markdown: string): string {
  const normalized = markdown.replace(/\r\n?/g, "\n").trim()
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
