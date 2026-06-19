import {
  describe,
  expect,
  it,
} from "vitest"

import {
  renderMarkdownPreview,
} from "@/canvas/markdown-preview"

describe("canvas markdown preview", () => {
  it("renders basic markdown blocks and inline styles", () => {
    const html = renderMarkdownPreview(`# Title

Paragraph with **bold**, \`code\`, and [link](https://example.com).

- one
- two

> quoted`)

    expect(html).toContain("<h1>Title</h1>")
    expect(html).toContain("<p>Paragraph with <strong>bold</strong>, <code>code</code>, and <a href=\"https://example.com\"")
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>")
    expect(html).toContain("<blockquote><p>quoted</p></blockquote>")
  })

  it("escapes raw html before rendering markdown", () => {
    const html = renderMarkdownPreview("<script>alert(1)</script> and **safe**")

    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; and <strong>safe</strong>")
  })

  it("renders allowed inline font color and span highlight styles", () => {
    const html = renderMarkdownPreview(`<font color="#e36c09">Orange text</font> and <span style="background: rgba(255, 77, 79, 0.5); color: #ffffff">highlight</span>`)

    expect(html).toContain('<font color="#e36c09">Orange text</font>')
    expect(html).toContain('<span style="background: rgba(255, 77, 79, 0.5); color: #ffffff">highlight</span>')
  })

  it("preserves whitelisted canvas search mark tags for highlighted matches", () => {
    const html = renderMarkdownPreview(`<mark class="canvas-search-mark">Alpha</mark> <mark class="canvas-search-mark canvas-search-mark--current">Beta</mark>`)

    expect(html).toContain('<mark class="canvas-search-mark">Alpha</mark>')
    expect(html).toContain('<mark class="canvas-search-mark canvas-search-mark--current">Beta</mark>')
  })

  it("renders allowed inline color html alongside markdown formatting", () => {
    const html = renderMarkdownPreview(`### Title

<font color="#e36c09">**Bold orange**</font> and <span style="background-color: #222">plain</span>`)

    expect(html).toContain("<h3>Title</h3>")
    expect(html).toContain('<font color="#e36c09"><strong>Bold orange</strong></font>')
    expect(html).toContain('<span style="background-color: #222">plain</span>')
  })

  it("auto-closes allowed inline color tags that run to the end of a line", () => {
    const html = renderMarkdownPreview(`<font color="#e36c09">Orange text

<span style="background: rgba(255, 77, 79, 0.5)">highlight`)

    expect(html).toContain('<p><font color="#e36c09">Orange text</font></p>')
    expect(html).toContain('<p><span style="background: rgba(255, 77, 79, 0.5)">highlight</span></p>')
  })

  it("keeps non-whitelisted inline html escaped", () => {
    const html = renderMarkdownPreview(`<span style="font-size: 20px" onclick="alert(1)">bad</span>`)

    expect(html).not.toContain("<span")
    expect(html).toContain("&lt;span style=&quot;font-size: 20px&quot; onclick=&quot;alert(1)&quot;&gt;bad&lt;/span&gt;")
  })

  it("omits kramdown block attributes and renders markdown images", () => {
    const html = renderMarkdownPreview(`![架构图](assets/diagram.png)
{: id="20260412094047-ihhbskn" updated="20260412100000"}

正文
{: id="20260412094047-abcdefg"}`)

    expect(html).toContain('<img src="/data/assets/diagram.png" alt="架构图">')
    expect(html).toContain("<p>正文</p>")
    expect(html).not.toContain("{:")
    expect(html).not.toContain("20260412094047-ihhbskn")
    expect(html).not.toContain("updated=")
  })

  it("renders sanitized html images from document markdown", () => {
    const html = renderMarkdownPreview(`<img src="assets/diagram.png" alt="架构图" title="预览图">

正文`)

    expect(html).toContain('<img src="/data/assets/diagram.png" alt="架构图" title="预览图">')
    expect(html).toContain("<p>正文</p>")
  })

  it("omits inline kramdown attributes that precede list item content", () => {
    const html = renderMarkdownPreview(`* {: id="20260412094047-ihhbskn"}第一项
* {: id="20260412094047-abcdefg"}第二项`)

    expect(html).toContain("<ul><li>第一项</li><li>第二项</li></ul>")
    expect(html).not.toContain("{:")
    expect(html).not.toContain("20260412094047-ihhbskn")
  })

  it("renders raw and markdown YouTube links to iframe video cards", () => {
    const html = renderMarkdownPreview(`Here is a video: https://www.youtube.com/watch?v=dQw4w9WgXcQ
And a markdown link: [My Favorite Video](https://youtu.be/dQw4w9WgXcQ)`)

    expect(html).toContain('<div class="video-card video-card--youtube">')
    expect(html).toContain('<iframe class="video-card__iframe" width="100%" height="100%" src="https://www.youtube.com/embed/dQw4w9WgXcQ"')
    expect(html).toContain('<span class="video-card__title">YouTube Video</span>')
    expect(html).toContain('<span class="video-card__title">My Favorite Video</span>')
    expect(html).toContain('href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"')
    expect(html).toContain('href="https://youtu.be/dQw4w9WgXcQ"')
  })

  it("renders raw and markdown Bilibili links to iframe video cards", () => {
    const html = renderMarkdownPreview(`Raw B站: https://www.bilibili.com/video/BV1xx411c7Fz
Markdown B站: [Bilibili](https://www.bilibili.com/video/av123456)`)

    expect(html).toContain('<div class="video-card video-card--bilibili">')
    expect(html).toContain('src="https://player.bilibili.com/player.html?bvid=BV1xx411c7Fz&amp;p=1&amp;autoplay=0&amp;high_quality=1&amp;danmaku=0&amp;as_wide=1"')
    expect(html).toContain('src="https://player.bilibili.com/player.html?aid=123456&amp;p=1&amp;autoplay=0&amp;high_quality=1&amp;danmaku=0&amp;as_wide=1"')
    expect(html).toContain('<span class="video-card__title">Bilibili Video</span>')
    expect(html).toContain('<span class="video-card__title">Bilibili</span>')
  })

  it("renders shared Bilibili links with the desktop player embed", () => {
    const html = renderMarkdownPreview("https://www.bilibili.com/video/BV1ijLQ67EWd/?share_source=copy_web")

    expect(html).toContain('src="https://player.bilibili.com/player.html?bvid=BV1ijLQ67EWd&amp;p=1&amp;autoplay=0&amp;high_quality=1&amp;danmaku=0&amp;as_wide=1"')
  })

  it("does not render normal links or video links in code blocks as iframes", () => {
    const html = renderMarkdownPreview(`Normal link: [Google](https://google.com)
Code block:
\`\`\`
https://www.youtube.com/watch?v=dQw4w9WgXcQ
\`\`\`
Inline code: \`https://www.bilibili.com/video/BV1xx411c7Fz\``)

    expect(html).toContain('<a href="https://google.com"')
    expect(html).not.toContain('video-card')
    expect(html).toContain('<code>https://www.youtube.com/watch?v=dQw4w9WgXcQ</code>')
    expect(html).toContain('<code>https://www.bilibili.com/video/BV1xx411c7Fz</code>')
  })

  it("renders solo video links as direct blocks without P tag wrapping", () => {
    // Solo plain URL
    const html1 = renderMarkdownPreview("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    expect(html1).toContain('<div class="video-card video-card--youtube">')
    expect(html1).not.toContain("<p>")
    expect(html1).not.toContain("</p>")

    // Solo markdown link
    const html2 = renderMarkdownPreview("[Bilibili Video](https://www.bilibili.com/video/BV1xx411c7Fz)")
    expect(html2).toContain('<div class="video-card video-card--bilibili">')
    expect(html2).not.toContain("<p>")
    expect(html2).not.toContain("</p>")

    // Sibling paragraphs are split correctly
    const html3 = renderMarkdownPreview(`Paragraph before.
https://www.youtube.com/watch?v=dQw4w9WgXcQ
Paragraph after.`)
    expect(html3).toContain("<p>Paragraph before.</p>")
    expect(html3).toContain('<div class="video-card video-card--youtube">')
    expect(html3).toContain("<p>Paragraph after.</p>")
  })
})

