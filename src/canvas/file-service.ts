import type {
  CanvasDocument,
  CanvasParseResult,
} from "@/canvas/types"
import {
  parseCanvasDocument,
  stringifyCanvasDocument,
} from "@/canvas/format"

export interface CanvasTextGateway {
  readText: (path: string) => Promise<string>
  writeText: (path: string, text: string) => Promise<void>
}

export interface CanvasLoadResult {
  path: string
  raw: string
  parseResult: CanvasParseResult
}

export interface CanvasSaveOptions {
  baseRaw?: string
  detectExternalChanges?: boolean
}

export class CanvasExternalChangeError extends Error {
  constructor(
    public readonly path: string,
    public readonly raw: string,
    public readonly parseResult: CanvasParseResult,
  ) {
    super(`Canvas file changed on disk: ${path}`)
    this.name = "CanvasExternalChangeError"
  }
}

export class CanvasFileService {
  constructor(private readonly gateway: CanvasTextGateway) {}

  async load(path: string): Promise<CanvasLoadResult> {
    const raw = await this.gateway.readText(path)

    return {
      path,
      raw,
      parseResult: parseCanvasDocument(raw),
    }
  }

  async save(path: string, document: CanvasDocument, options: CanvasSaveOptions = {}): Promise<string> {
    if (options.detectExternalChanges && options.baseRaw !== undefined) {
      const currentRaw = await this.gateway.readText(path)
      if (currentRaw !== options.baseRaw) {
        throw new CanvasExternalChangeError(path, currentRaw, parseCanvasDocument(currentRaw))
      }
    }

    const raw = stringifyCanvasDocument(document)
    await this.gateway.writeText(path, raw)
    return raw
  }
}
