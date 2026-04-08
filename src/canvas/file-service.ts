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

  async save(path: string, document: CanvasDocument): Promise<string> {
    const raw = stringifyCanvasDocument(document)
    await this.gateway.writeText(path, raw)
    return raw
  }
}
