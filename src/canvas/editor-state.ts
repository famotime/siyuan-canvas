import type {
  CanvasDocument,
  CanvasIssue,
} from "@/canvas/types"
import { createEmptyCanvasDocument } from "@/canvas/document"
import { CanvasExternalChangeError } from "@/canvas/file-service"

interface CanvasEditorService {
  load: (path: string) => Promise<{
    raw: string
    parseResult: {
      document: CanvasDocument | null
      errors: CanvasIssue[]
      warnings: CanvasIssue[]
    }
    path: string
  }>
  save: (
    path: string,
    document: CanvasDocument,
    options?: {
      baseRaw?: string
      detectExternalChanges?: boolean
    },
  ) => Promise<string>
}

interface CanvasEditorConflict {
  document: CanvasDocument | null
  issues: { errors: CanvasIssue[], warnings: CanvasIssue[] }
  path: string
  raw: string
}

export class CanvasEditorState {
  public document: CanvasDocument = createEmptyCanvasDocument()
  public conflict: CanvasEditorConflict | null = null
  public filePath = ""
  public isDirty = false
  public issues: { errors: CanvasIssue[], warnings: CanvasIssue[] } = {
    errors: [],
    warnings: [],
  }
  public lastSavedRaw = ""

  public selectedEdgeId = ""
  public selectedNodeId = ""
  public selectedNodeIds: string[] = []
  public pendingEditNodeId = ""

  constructor(private readonly service: CanvasEditorService) {}

  async open(path: string): Promise<void> {
    const result = await this.service.load(path)
    this.filePath = result.path
    this.document = result.parseResult.document ?? createEmptyCanvasDocument()
    this.conflict = null
    this.issues = {
      errors: result.parseResult.errors,
      warnings: result.parseResult.warnings,
    }
    this.isDirty = false
    this.lastSavedRaw = result.raw
    this.selectedNodeId = ""
    this.selectedNodeIds = []
    this.selectedEdgeId = ""
    this.pendingEditNodeId = ""
  }

  replaceDocument(
    document: CanvasDocument,
    filePath = this.filePath,
    options: {
      raw?: string
    } = {},
  ): void {
    this.document = document
    this.filePath = filePath
    this.conflict = null
    this.issues = {
      errors: [],
      warnings: [],
    }
    this.isDirty = false
    this.lastSavedRaw = options.raw ?? ""
    this.selectedNodeId = ""
    this.selectedNodeIds = []
    this.selectedEdgeId = ""
    this.pendingEditNodeId = ""
  }

  patchDocument(document: CanvasDocument): void {
    this.document = document
    this.isDirty = true
    this.selectedNodeIds = this.selectedNodeIds.filter((nodeId) =>
      document.nodes.some((node) => node.id === nodeId),
    )
    if (this.selectedNodeId && !this.selectedNodeIds.includes(this.selectedNodeId)) {
      this.selectedNodeId = this.selectedNodeIds[this.selectedNodeIds.length - 1] || ""
    }
  }

  selectNodes(nodeIds: string[], options: { additive?: boolean } = {}): void {
    const validNodeIds = nodeIds.filter((nodeId, index) =>
      nodeIds.indexOf(nodeId) === index
      && this.document.nodes.some((node) => node.id === nodeId),
    )

    if (options.additive) {
      const mergedNodeIds = [...this.selectedNodeIds]

      for (const nodeId of validNodeIds) {
        if (!mergedNodeIds.includes(nodeId)) {
          mergedNodeIds.push(nodeId)
        }
      }

      this.selectedNodeIds = mergedNodeIds
      this.selectedNodeId = validNodeIds[validNodeIds.length - 1]
        || this.selectedNodeIds[this.selectedNodeIds.length - 1]
        || ""
      this.selectedEdgeId = ""
      return
    }

    this.selectedNodeIds = validNodeIds
    this.selectedNodeId = validNodeIds[validNodeIds.length - 1] || ""
    this.selectedEdgeId = ""
  }

  selectNode(nodeId = "", options: { additive?: boolean } = {}): void {
    if (!nodeId) {
      this.selectedNodeId = ""
      this.selectedNodeIds = []
      this.selectedEdgeId = ""
      return
    }

    if (options.additive) {
      if (this.selectedNodeIds.includes(nodeId)) {
        this.selectedNodeIds = this.selectedNodeIds.filter((candidate) => candidate !== nodeId)
        this.selectedNodeId = this.selectedNodeIds[this.selectedNodeIds.length - 1] || ""
      } else {
        this.selectedNodeIds = [...this.selectedNodeIds, nodeId]
        this.selectedNodeId = nodeId
      }
      this.selectedEdgeId = ""
      return
    }

    this.selectedNodeId = nodeId
    this.selectedNodeIds = [nodeId]
    this.selectedEdgeId = ""
  }

  selectEdge(edgeId = ""): void {
    this.selectedEdgeId = edgeId
    this.selectedNodeId = ""
    this.selectedNodeIds = []
  }

  selectAllNodes(): void {
    this.selectedNodeIds = this.document.nodes.map((node) => node.id)
    this.selectedNodeId = this.selectedNodeIds[this.selectedNodeIds.length - 1] || ""
    this.selectedEdgeId = ""
  }

  clearConflict(): void {
    this.conflict = null
  }

  loadConflictVersion(): void {
    if (!this.conflict?.document) {
      return
    }

    this.document = this.conflict.document
    this.filePath = this.conflict.path
    this.issues = this.conflict.issues
    this.lastSavedRaw = this.conflict.raw
    this.isDirty = false
    this.conflict = null
    this.selectedNodeId = ""
    this.selectedNodeIds = []
    this.selectedEdgeId = ""
  }

  async save(
    path = this.filePath,
    options: {
      detectExternalChanges?: boolean
      force?: boolean
    } = {},
  ): Promise<void> {
    if (!path) {
      throw new Error("A file path is required before saving.")
    }

    try {
      const raw = await this.service.save(path, this.document, {
        baseRaw: !options.force && path === this.filePath && this.lastSavedRaw
          ? this.lastSavedRaw
          : undefined,
        detectExternalChanges: options.detectExternalChanges && !options.force,
      })
      this.filePath = path
      this.isDirty = false
      this.lastSavedRaw = raw
      this.conflict = null
    } catch (error) {
      if (error instanceof CanvasExternalChangeError) {
        this.conflict = {
          document: error.parseResult.document,
          issues: {
            errors: error.parseResult.errors,
            warnings: error.parseResult.warnings,
          },
          path: error.path,
          raw: error.raw,
        }
      }
      throw error
    }
  }
}
