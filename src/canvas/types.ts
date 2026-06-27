export type CanvasNodeType = "file" | "group" | "link" | "text"

export type CanvasSide = "bottom" | "left" | "right" | "top"

export type CanvasIssueLevel = "error" | "warning"

export interface CanvasIssue {
  code: string
  level: CanvasIssueLevel
  message: string
  path?: string
}

export interface CanvasNodeBase {
  id: string
  type: CanvasNodeType
  x: number
  y: number
  width: number
  height: number
  color?: string
  [key: string]: unknown
}

export interface CanvasTextNode extends CanvasNodeBase {
  type: "text"
  text: string
}

export interface CanvasFileNode extends CanvasNodeBase {
  type: "file"
  file: string
  subpath?: string
}

export interface CanvasLinkNode extends CanvasNodeBase {
  type: "link"
  url: string
}

export interface CanvasGroupNode extends CanvasNodeBase {
  type: "group"
  label?: string
  background?: string
  backgroundStyle?: string
  collapsed?: boolean
  originalWidth?: number
  originalHeight?: number
  collapsedNodes?: CanvasNode[]
  collapsedEdges?: CanvasEdge[]
}

export type CanvasNode =
  | CanvasFileNode
  | CanvasGroupNode
  | CanvasLinkNode
  | CanvasTextNode

export interface CanvasEdge {
  id: string
  fromNode: string
  fromSide: CanvasSide
  startArrow?: boolean
  toNode: string
  toSide: CanvasSide
  endArrow?: boolean
  label?: string
  color?: string
  collapsedOriginalFromNode?: string
  collapsedOriginalToNode?: string
  [key: string]: unknown
}

export interface CanvasDocument {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  [key: string]: unknown
}

export interface CanvasParseResult {
  document: CanvasDocument | null
  errors: CanvasIssue[]
  warnings: CanvasIssue[]
}

export interface CanvasGeometryPatch {
  height?: number
  width?: number
  x?: number
  y?: number
}

export interface CanvasBounds {
  x: number
  y: number
  width: number
  height: number
}

export type CanvasNodeLayoutAction =
  | "left-align"
  | "center-horizontal"
  | "right-align"
  | "top-align"
  | "center-vertical"
  | "bottom-align"
  | "arrange-row"
  | "arrange-column"
  | "arrange-grid"
  | "distribute-horizontal"
  | "distribute-vertical"
  | "stretch-horizontal"
  | "stretch-vertical"
