import { describe, expect, it } from 'vitest'
import {
  escapeHtml,
  escapeHtmlAttribute,
  extractHtmlAttribute,
  normalizeMarkdownImageSource,
  sanitizeMarkdownPreviewSource,
  sanitizeColorValue,
  sanitizeInlineStyle,
  parseAllowedInlineOpenTag,
  parseAllowedImageTag,
} from '@/canvas/markdown-sanitize'

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------

describe('escapeHtml', () => {
  it('escapes ampersand, angle brackets, and quotes', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;')
  })

  it('passes through plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('escapes XSS payload in text content', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    )
  })
})

// ---------------------------------------------------------------------------
// escapeHtmlAttribute
// ---------------------------------------------------------------------------

describe('escapeHtmlAttribute', () => {
  it('escapes quotes and ampersands', () => {
    expect(escapeHtmlAttribute('a&b"c')).toBe('a&amp;b&quot;c')
  })

  it('handles normal values', () => {
    expect(escapeHtmlAttribute('normal-value')).toBe('normal-value')
  })
})

// ---------------------------------------------------------------------------
// extractHtmlAttribute
// ---------------------------------------------------------------------------

describe('extractHtmlAttribute', () => {
  it('extracts a quoted attribute value', () => {
    expect(extractHtmlAttribute('<img src="photo.png" />', 'src')).toBe('photo.png')
  })

  it('returns null for missing attribute', () => {
    expect(extractHtmlAttribute('<img />', 'src')).toBeNull()
  })

  it('handles single-quoted values', () => {
    expect(extractHtmlAttribute("<img src='photo.png' />", 'src')).toBe('photo.png')
  })
})

// ---------------------------------------------------------------------------
// normalizeMarkdownImageSource
// ---------------------------------------------------------------------------

describe('normalizeMarkdownImageSource', () => {
  it('returns empty string for null/undefined input', () => {
    expect(normalizeMarkdownImageSource('')).toBe('')
  })

  it('preserves http URLs', () => {
    expect(normalizeMarkdownImageSource('https://example.com/img.png')).toBe('https://example.com/img.png')
  })

  it('preserves data URIs', () => {
    expect(normalizeMarkdownImageSource('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
  })
})

// ---------------------------------------------------------------------------
// sanitizeMarkdownPreviewSource — XSS regression
// ---------------------------------------------------------------------------

describe('sanitizeMarkdownPreviewSource', () => {
  it('strips kramdown block attributes {: ... }', () => {
    expect(sanitizeMarkdownPreviewSource('text {: .class #id}')).not.toContain('{:')
  })

  it('strips kramdown inline attributes {:.class}', () => {
    expect(sanitizeMarkdownPreviewSource('text {:.highlight}')).not.toContain('{:')
  })

  it('preserves content inside code blocks', () => {
    const input = '```\n{: .class}\n```'
    const result = sanitizeMarkdownPreviewSource(input)
    expect(result).toContain('{: .class}')
  })

  it('handles multiple lines with mixed kramdown', () => {
    const input = 'line1 {: .a}\nline2\nline3 {: .b}'
    const result = sanitizeMarkdownPreviewSource(input)
    expect(result).not.toContain('{:')
    expect(result).toContain('line1')
    expect(result).toContain('line2')
    expect(result).toContain('line3')
  })

  it('normalizes CRLF line endings', () => {
    const result = sanitizeMarkdownPreviewSource('line1\r\nline2')
    expect(result).toContain('line1')
    expect(result).toContain('line2')
  })
})

// ---------------------------------------------------------------------------
// sanitizeColorValue — CSS color validation
// ---------------------------------------------------------------------------

describe('sanitizeColorValue', () => {
  it('accepts hex colors', () => {
    expect(sanitizeColorValue('#ff0000')).toBe('#ff0000')
    expect(sanitizeColorValue('#abc')).toBe('#abc')
  })

  it('accepts rgb/rgba colors', () => {
    expect(sanitizeColorValue('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)')
    expect(sanitizeColorValue('rgba(0, 0, 0, 0.5)')).toBe('rgba(0, 0, 0, 0.5)')
  })

  it('accepts named CSS colors', () => {
    expect(sanitizeColorValue('red')).toBe('red')
    expect(sanitizeColorValue('transparent')).toBe('transparent')
  })

  it('rejects url() injection', () => {
    expect(sanitizeColorValue('url(evil)')).toBeNull()
  })

  it('rejects expression() injection', () => {
    expect(sanitizeColorValue('expression(alert(1))')).toBeNull()
  })

  it('rejects javascript: protocol', () => {
    expect(sanitizeColorValue('javascript:alert(1)')).toBeNull()
  })

  it('rejects empty string', () => {
    expect(sanitizeColorValue('')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// sanitizeInlineStyle
// ---------------------------------------------------------------------------

describe('sanitizeInlineStyle', () => {
  it('allows color property with valid value', () => {
    const result = sanitizeInlineStyle('color: red')
    expect(result).toContain('color')
    expect(result).toContain('red')
  })

  it('allows background-color with hex value', () => {
    const result = sanitizeInlineStyle('background-color: #ff0000')
    expect(result).toContain('background-color')
  })

  it('rejects position: fixed (not in allowed properties)', () => {
    expect(sanitizeInlineStyle('position: fixed')).toBeNull()
  })

  it('rejects background-image with url()', () => {
    expect(sanitizeInlineStyle('background-image: url(evil)')).toBeNull()
  })

  it('returns null for empty style', () => {
    expect(sanitizeInlineStyle('')).toBeNull()
  })

  it('returns null if any declaration has invalid color', () => {
    expect(sanitizeInlineStyle('color: red; background-color: url(evil)')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseAllowedInlineOpenTag — whitelist parsing
// ---------------------------------------------------------------------------

describe('parseAllowedInlineOpenTag', () => {
  it('parses a span tag with valid color style', () => {
    const result = parseAllowedInlineOpenTag('<span style="color: red">')
    expect(result).not.toBeNull()
    expect(result!.html).toContain('<span')
    expect(result!.closeTag).toBe('</span>')
  })

  it('parses a font tag with color attribute', () => {
    const result = parseAllowedInlineOpenTag('<font color="red">')
    expect(result).not.toBeNull()
    expect(result!.html).toContain('<font')
    expect(result!.closeTag).toBe('</font>')
  })

  it('rejects div tags (not in whitelist)', () => {
    expect(parseAllowedInlineOpenTag('<div>')).toBeNull()
  })

  it('rejects script tags', () => {
    expect(parseAllowedInlineOpenTag('<script>')).toBeNull()
  })

  it('rejects span with invalid style', () => {
    expect(parseAllowedInlineOpenTag('<span style="position: fixed">')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseAllowedImageTag
// ---------------------------------------------------------------------------

describe('parseAllowedImageTag', () => {
  it('parses a valid img tag', () => {
    const result = parseAllowedImageTag('<img src="photo.png" alt="Photo">')
    expect(result).not.toBeNull()
    expect(result!.html).toContain('photo.png')
  })

  it('returns null for non-img tags', () => {
    expect(parseAllowedImageTag('<video src="v.mp4">')).toBeNull()
  })

  it('returns null for incomplete img tag', () => {
    expect(parseAllowedImageTag('<img')).toBeNull()
  })
})
