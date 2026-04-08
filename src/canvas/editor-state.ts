import type {
  CanvasDocument,
  CanvasIssue,
} from "@/canvas/types"
import { createEmptyCanvasDocument } from "@/canvas/document"

interface CanvasEditorService {
  load: (path: string) => Promise<{
    parseResult: {
      document: CanvasDocument | null
      errors: CanvasIssue[]
      warnings: CanvasIssue[]
    }
    path: string
  }>
  save: (path: string, document: CanvasDocument) => Promise<string>
}

export class CanvasEditorState {
  public document: CanvasDocument = createEmptyCanvasDocument()
  public filePath = ""
  public isDirty = false
  public issues: { errors: CanvasIssue[], warnings: CanvasIssue[] } = {
    errors: [],
    warnings: [],
  }

  public selectedEdgeId = ""
  public selectedNodeId = ""

  constructor(private readonly service: CanvasEditorService) {}

  async open(path: string): Promise<void> {
    const result = await this.service.load(path)
    this.filePath = result.path
    this.document = result.parseResult.document ?? createEmptyCanvasDocument()
    this.issues = {
      errors: result.parseResult.errors,
      warnings: result.parseResult.warnings,
    }
    this.isDirty = false
    this.selectedNodeId = ""
    this.selectedEdgeId = ""
  }

  replaceDocument(document: CanvasDocument, filePath = this.filePath): void {
    this.document = document
    this.filePath = filePath
    this.issues = {
      errors: [],
      warnings: [],
    }
    this.isDirty = false
  }

  patchDocument(document: CanvasDocument): void {
    this.document = document
    this.isDirty = true
  }

  selectNode(nodeId = ""): void {
    this.selectedNodeId = nodeId
    this.selectedEdgeId = ""
  }

  selectEdge(edgeId = ""): void {
    this.selectedEdgeId = edgeId
    this.selectedNodeId = ""
  }

  async save(path = this.filePath): Promise<void> {
    if (!path) {
      throw new Error("A file path is required before saving.")
    }

    await this.service.save(path, this.document)
    this.filePath = path
    this.isDirty = false
  }
}
