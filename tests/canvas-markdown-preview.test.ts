import {
  describe,
  expect,
  it,
} from "vitest"

import { renderMarkdownPreview } from "@/canvas/markdown-preview"

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
})
