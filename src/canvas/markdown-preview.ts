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

export interface MarkdownHeadingSection {
  level: number
  text: string
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

export function extractMarkdownHeadingSections(markdown: string): MarkdownHeadingSection[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
  const headingIndexes: Array<{ index: number, level: number, title: string }> = []

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = lines[index]!.trim().match(/^(#{1,6})\s+(.+)$/)
    if (!headingMatch) {
      continue
    }

    headingIndexes.push({
      index,
      level: headingMatch[1]!.length,
      title: headingMatch[2]!.trim(),
    })
  }

  return headingIndexes.map((heading, index) => {
    const nextHeading = headingIndexes[index + 1]
    const sectionLines = lines.slice(heading.index, nextHeading?.index ?? lines.length)
    return {
      level: heading.level,
      text: sectionLines.join("\n").trim(),
      title: heading.title,
    }
  })
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

export function getVideoEmbedUrl(url: string): { type: "youtube" | "bilibili"; embedUrl: string } | null {
  const cleanUrl = url.trim()
  let parsed: URL
  try {
    parsed = new URL(cleanUrl)
  } catch {
    // Try prepending https:// if it has no protocol
    if (!/^[a-zA-Z]+:\/\//i.test(cleanUrl)) {
      try {
        parsed = new URL(`https://${cleanUrl}`)
      } catch {
        return null
      }
    } else {
      return null
    }
  }

  const host = parsed.hostname.toLowerCase()
  const path = parsed.pathname

  // YouTube
  if (host.includes("youtube.com") || host.includes("youtu.be") || host.includes("youtube-nocookie.com")) {
    let videoId: string | null = null
    if (host.includes("youtu.be")) {
      videoId = path.slice(1)
    } else if (host.includes("youtube.com") || host.includes("youtube-nocookie.com")) {
      if (path.startsWith("/embed/")) {
        videoId = path.slice(7)
      } else if (path.startsWith("/shorts/")) {
        videoId = path.slice(8)
      } else if (path === "/watch") {
        videoId = parsed.searchParams.get("v")
      }
    }
    if (videoId) {
      videoId = videoId.split("?")[0].split("&")[0].split("/")[0]
      if (videoId) {
        return {
          type: "youtube",
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
        }
      }
    }
  }

  // Bilibili
  if (host.includes("bilibili.com") || host.includes("b23.tv")) {
    if (host.includes("player.bilibili.com")) {
      return {
        type: "bilibili",
        embedUrl: cleanUrl,
      }
    }
    const match = path.match(/\/video\/(BV[a-zA-Z0-9]+|av\d+)/i)
    if (match) {
      const id = match[1]
      if (id.toLowerCase().startsWith("bv")) {
        return {
          type: "bilibili",
          embedUrl: createBilibiliEmbedUrl({ bvid: id }),
        }
      } else {
        const aid = id.slice(2)
        return {
          type: "bilibili",
          embedUrl: createBilibiliEmbedUrl({ aid }),
        }
      }
    }
    const bvid = parsed.searchParams.get("bvid")
    const aid = parsed.searchParams.get("aid")
    if (bvid) {
      return {
        type: "bilibili",
        embedUrl: createBilibiliEmbedUrl({ bvid }),
      }
    }
    if (aid) {
      return {
        type: "bilibili",
        embedUrl: createBilibiliEmbedUrl({ aid }),
      }
    }
  }

  return null
}

function createBilibiliEmbedUrl(params: { aid?: string, bvid?: string }): string {
  const searchParams = new URLSearchParams()

  if (params.bvid) {
    searchParams.set("bvid", params.bvid)
  } else if (params.aid) {
    searchParams.set("aid", params.aid)
  }

  searchParams.set("p", "1")
  searchParams.set("autoplay", "0")
  searchParams.set("high_quality", "1")
  searchParams.set("danmaku", "0")
  searchParams.set("as_wide", "1")

  return `https://player.bilibili.com/player.html?${searchParams.toString()}`
}

function createVideoIframeHtml(
  type: "youtube" | "bilibili",
  embedUrl: string,
  originalUrl: string,
  label?: string,
): string {
  const safeEmbedUrl = escapeHtmlAttribute(embedUrl)
  const safeOriginalUrl = escapeHtmlAttribute(originalUrl)
  const displayLabel = label?.trim() || (type === "youtube" ? "YouTube Video" : "Bilibili Video")
  const safeLabel = escapeHtml(displayLabel)

  const youtubeIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="color: #ff0000; display: inline-block; vertical-align: middle;"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.516 0-9.387.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11C4.483 20.455 12 20.455 12 20.455s7.517 0 9.387-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`
  const bilibiliIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="color: #00aeec; display: inline-block; vertical-align: middle;"><path d="M17.877 1.258l1.49 1.336-2.617 2.923c.712.28 1.4.636 2.054 1.058l2.977-2.658 1.488 1.338-3.993 3.566c.866.93 1.547 2.003 2.005 3.197.643 1.678.711 3.447.195 5.17a10.278 10.278 0 0 1-5.116 6.305c-1.637.893-3.447 1.242-5.26 1.018a10.354 10.354 0 0 1-6.19-2.993 10.024 10.024 0 0 1-2.695-5.918c-.378-2.029.071-4.093 1.272-5.86.883-1.3 2.046-2.333 3.39-3.007L2.9 3.585l1.488-1.337 2.976 2.657c.654-.422 1.342-.777 2.055-1.057L6.802 1.258V1.26l1.488 1.336 3.187 3.56c.415-.058.835-.088 1.257-.088.423 0 .843.03 1.258.087l3.187-3.56 1.489.317c.07-.107.139-.214.21-.32zm-3.076 11.233c-.63 0-1.144.577-1.144 1.288s.514 1.288 1.144 1.288 1.144-.577 1.144-1.288-.514-1.288-1.144-1.288zm-5.602 0c-.63 0-1.144.577-1.144 1.288s.514 1.288 1.144 1.288 1.144-.577 1.144-1.288-.514-1.288-1.144-1.288z"/></svg>`

  const icon = type === "youtube" ? youtubeIcon : bilibiliIcon

  return `<div class="video-card video-card--${type}">`
    + `<div class="video-card__header">`
    + `<span class="video-card__platform-icon">${icon}</span>`
    + `<span class="video-card__title">${safeLabel}</span>`
    + `<a class="video-card__open-link" href="${safeOriginalUrl}" target="_blank" rel="noopener noreferrer" title="在新标签页打开">↗</a>`
    + `</div>`
    + `<div class="video-card__iframe-container">`
    + `<iframe class="video-card__iframe" width="100%" height="100%" src="${safeEmbedUrl}" scrolling="no" border="0" frameborder="no" framespacing="0" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"></iframe>`
    + `</div>`
    + `</div>`
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

  // Extract Bilibili and YouTube links to video placeholders
  const videoPlaceholders: string[] = []
  rendered = rendered.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, label: string, url: string) => {
    const videoInfo = getVideoEmbedUrl(url)
    if (videoInfo) {
      const placeholder = `%%VIDEO_${videoPlaceholders.length}%%`
      videoPlaceholders.push(createVideoIframeHtml(videoInfo.type, videoInfo.embedUrl, url, label))
      return placeholder
    }
    return match
  })

  rendered = rendered.replace(/(https?:\/\/[^\s)<>"]+)/g, (match) => {
    const videoInfo = getVideoEmbedUrl(match)
    if (videoInfo) {
      const placeholder = `%%VIDEO_${videoPlaceholders.length}%%`
      videoPlaceholders.push(createVideoIframeHtml(videoInfo.type, videoInfo.embedUrl, match, ""))
      return placeholder
    }
    return match
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
  rendered = restorePlaceholders(rendered, "VIDEO", videoPlaceholders)
  return restorePlaceholders(rendered, "CODE", codePlaceholders)
}

function parseSoloVideoLink(line: string): { type: "youtube" | "bilibili"; embedUrl: string; originalUrl: string; label?: string } | null {
  const trimmed = line.trim()
  if (!trimmed) {
    return null
  }

  // Try matching markdown link format: [label](url)
  const mdLinkMatch = trimmed.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
  if (mdLinkMatch) {
    const label = mdLinkMatch[1]!
    const url = mdLinkMatch[2]!
    const videoInfo = getVideoEmbedUrl(url)
    if (videoInfo) {
      return {
        type: videoInfo.type,
        embedUrl: videoInfo.embedUrl,
        originalUrl: url,
        label,
      }
    }
  }

  // Try matching plain URL format: url
  const urlMatch = trimmed.match(/^(https?:\/\/[^\s)<>"]+)$/)
  if (urlMatch) {
    const url = urlMatch[1]!
    const videoInfo = getVideoEmbedUrl(url)
    if (videoInfo) {
      return {
        type: videoInfo.type,
        embedUrl: videoInfo.embedUrl,
        originalUrl: url,
      }
    }
  }

  return null
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

    const soloVideo = parseSoloVideoLink(trimmed)
    if (soloVideo) {
      blocks.push(createVideoIframeHtml(soloVideo.type, soloVideo.embedUrl, soloVideo.originalUrl, soloVideo.label))
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
      if (
        !next ||
        next.startsWith("```") ||
        /^>\s?/.test(next) ||
        /^(#{1,6})\s+/.test(next) ||
        /^([-*+]\s+|\d+\.\s+)/.test(next) ||
        parseSoloVideoLink(next)
      ) {
        break
      }
      paragraphLines.push(next)
      index += 1
    }
    blocks.push(renderParagraph(paragraphLines))
  }

  return blocks.join("")
}
