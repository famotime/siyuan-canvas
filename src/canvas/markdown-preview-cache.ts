import { renderMarkdownPreview } from "@/canvas/markdown-preview"

const DEFAULT_MAX_CACHE_SIZE = 1000

export class MarkdownPreviewCache {
  private cache = new Map<string, string>()
  private maxSize: number

  constructor(maxSize = DEFAULT_MAX_CACHE_SIZE) {
    this.maxSize = maxSize
  }

  get(key: string): string | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      // LRU: 刷新最新访问
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set(key: string, value: string): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // 淘汰最早的一项
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }
    this.cache.set(key, value)
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

export const globalMarkdownPreviewCache = new MarkdownPreviewCache()

export function getCachedMarkdownPreview(
  markdown: string,
  renderer: (md: string) => string = renderMarkdownPreview,
): string {
  if (!markdown) {
    return ""
  }

  const cached = globalMarkdownPreviewCache.get(markdown)
  if (cached !== undefined) {
    return cached
  }

  const rendered = renderer(markdown)
  globalMarkdownPreviewCache.set(markdown, rendered)
  return rendered
}
