import { describe, expect, it, vi } from "vitest"
import {
  getCachedMarkdownPreview,
  globalMarkdownPreviewCache,
  MarkdownPreviewCache,
} from "@/canvas/markdown-preview-cache"

describe("MarkdownPreviewCache", () => {
  it("hits cache and invokes renderer only once for identical markdown text", () => {
    const mockRenderer = vi.fn((md: string) => `<p>${md}</p>`)
    const testMd = "## Hello Performance Cache"

    const first = getCachedMarkdownPreview(testMd, mockRenderer)
    const second = getCachedMarkdownPreview(testMd, mockRenderer)

    expect(first).toBe("<p>## Hello Performance Cache</p>")
    expect(second).toBe(first)
    expect(mockRenderer).toHaveBeenCalledTimes(1)
  })

  it("handles empty markdown string safely", () => {
    const mockRenderer = vi.fn()
    const result = getCachedMarkdownPreview("", mockRenderer)
    expect(result).toBe("")
    expect(mockRenderer).not.toHaveBeenCalled()
  })

  it("evicts oldest entry when reaching maximum capacity", () => {
    const cache = new MarkdownPreviewCache(2)
    cache.set("a", "result-a")
    cache.set("b", "result-b")

    expect(cache.size).toBe(2)
    expect(cache.get("a")).toBe("result-a") // 访问 a，使得 b 成为最旧的

    cache.set("c", "result-c") // 应该淘汰 b
    expect(cache.size).toBe(2)
    expect(cache.has("b")).toBe(false)
    expect(cache.has("a")).toBe(true)
    expect(cache.has("c")).toBe(true)
  })

  it("clears cache completely when clear is called", () => {
    const cache = new MarkdownPreviewCache(10)
    cache.set("item1", "val1")
    cache.set("item2", "val2")
    expect(cache.size).toBe(2)

    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.get("item1")).toBeUndefined()
  })
})
