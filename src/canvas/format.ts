import type {
  CanvasDocument,
  CanvasEdge,
  CanvasIssue,
  CanvasNode,
  CanvasNodeType,
  CanvasParseResult,
  CanvasSide,
} from "@/canvas/types"

const VALID_NODE_TYPES: CanvasNodeType[] = ["file", "group", "link", "text"]
const VALID_SIDES: CanvasSide[] = ["bottom", "left", "right", "top"]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function asNode(candidate: unknown, index: number, errors: CanvasIssue[]): CanvasNode | null {
  if (!isRecord(candidate)) {
    errors.push({
      code: "node.invalid",
      level: "error",
      message: "Node must be an object.",
      path: `nodes[${index}]`,
    })
    return null
  }

  if (typeof candidate.id !== "string" || !candidate.id) {
    errors.push({
      code: "node.id",
      level: "error",
      message: "Node id is required.",
      path: `nodes[${index}].id`,
    })
    return null
  }

  if (!VALID_NODE_TYPES.includes(candidate.type as CanvasNodeType)) {
    errors.push({
      code: "node.type",
      level: "error",
      message: `Unsupported node type: ${String(candidate.type)}`,
      path: `nodes[${index}].type`,
    })
    return null
  }

  for (const key of ["x", "y", "width", "height"] as const) {
    if (!isFiniteNumber(candidate[key])) {
      errors.push({
        code: `node.${key}`,
        level: "error",
        message: `Node ${key} must be a finite number.`,
        path: `nodes[${index}].${key}`,
      })
      return null
    }
  }

  switch (candidate.type) {
    case "text":
      if (typeof candidate.text !== "string") {
        errors.push({
          code: "node.text",
          level: "error",
          message: "Text node requires a text field.",
          path: `nodes[${index}].text`,
        })
        return null
      }
      break
    case "file":
      if (typeof candidate.file !== "string" || !candidate.file) {
        errors.push({
          code: "node.file",
          level: "error",
          message: "File node requires a file path.",
          path: `nodes[${index}].file`,
        })
        return null
      }
      break
    case "group":
      break
    case "link":
      if (typeof candidate.url !== "string" || !candidate.url) {
        errors.push({
          code: "node.url",
          level: "error",
          message: "Link node requires a url.",
          path: `nodes[${index}].url`,
        })
        return null
      }
      break
    default:
      return null
  }

  return candidate as CanvasNode
}

function asEdge(candidate: unknown, index: number, errors: CanvasIssue[]): CanvasEdge | null {
  if (!isRecord(candidate)) {
    errors.push({
      code: "edge.invalid",
      level: "error",
      message: "Edge must be an object.",
      path: `edges[${index}]`,
    })
    return null
  }

  for (const key of ["id", "fromNode", "toNode"] as const) {
    if (typeof candidate[key] !== "string" || !candidate[key]) {
      errors.push({
        code: `edge.${key}`,
        level: "error",
        message: `Edge ${key} is required.`,
        path: `edges[${index}].${key}`,
      })
      return null
    }
  }

  for (const key of ["fromSide", "toSide"] as const) {
    if (!VALID_SIDES.includes(candidate[key] as CanvasSide)) {
      errors.push({
        code: `edge.${key}`,
        level: "error",
        message: `Edge ${key} must be one of ${VALID_SIDES.join(", ")}.`,
        path: `edges[${index}].${key}`,
      })
      return null
    }
  }

  return candidate as CanvasEdge
}

export function validateCanvasDocument(document: CanvasDocument): {
  errors: CanvasIssue[]
  warnings: CanvasIssue[]
} {
  const errors: CanvasIssue[] = []
  const warnings: CanvasIssue[] = []
  const seenNodes = new Set<string>()

  document.nodes.forEach((node, index) => {
    if (seenNodes.has(node.id)) {
      errors.push({
        code: "node.duplicate-id",
        level: "error",
        message: `Duplicate node id "${node.id}".`,
        path: `nodes[${index}].id`,
      })
      return
    }

    seenNodes.add(node.id)
  })

  const seenEdges = new Set<string>()
  document.edges.forEach((edge, index) => {
    if (seenEdges.has(edge.id)) {
      errors.push({
        code: "edge.duplicate-id",
        level: "error",
        message: `Duplicate edge id "${edge.id}".`,
        path: `edges[${index}].id`,
      })
    } else {
      seenEdges.add(edge.id)
    }

    if (!seenNodes.has(edge.fromNode) || !seenNodes.has(edge.toNode)) {
      errors.push({
        code: "edge.missing-node",
        level: "error",
        message: `Edge "${edge.id}" references a missing node.`,
        path: `edges[${index}]`,
      })
    }
  })

  return {
    errors,
    warnings,
  }
}

export function parseCanvasDocument(raw: string): CanvasParseResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return {
      document: null,
      errors: [
        {
          code: "document.invalid-json",
          level: "error",
          message: error instanceof Error ? error.message : "Invalid JSON document.",
        },
      ],
      warnings: [],
    }
  }

  if (!isRecord(parsed)) {
    return {
      document: null,
      errors: [
        {
          code: "document.invalid-root",
          level: "error",
          message: "Canvas root must be an object.",
        },
      ],
      warnings: [],
    }
  }

  const errors: CanvasIssue[] = []
  const warnings: CanvasIssue[] = []
  const {
    edges: rawEdges,
    nodes: rawNodes,
    ...extraFields
  } = parsed

  if (!Array.isArray(rawNodes)) {
    errors.push({
      code: "document.nodes",
      level: "error",
      message: "Canvas document requires a nodes array.",
      path: "nodes",
    })
  }

  if (!Array.isArray(rawEdges)) {
    errors.push({
      code: "document.edges",
      level: "error",
      message: "Canvas document requires an edges array.",
      path: "edges",
    })
  }

  const nodes = Array.isArray(rawNodes)
    ? rawNodes
        .map((candidate, index) => asNode(candidate, index, errors))
        .filter((node): node is CanvasNode => node !== null)
    : []

  const edges = Array.isArray(rawEdges)
    ? rawEdges
        .map((candidate, index) => asEdge(candidate, index, errors))
        .filter((edge): edge is CanvasEdge => edge !== null)
    : []

  const document: CanvasDocument = {
    ...extraFields,
    nodes,
    edges,
  }

  const validation = validateCanvasDocument(document)
  errors.push(...validation.errors)
  warnings.push(...validation.warnings)

  return {
    document,
    errors,
    warnings,
  }
}

export function stringifyCanvasDocument(document: CanvasDocument): string {
  return `${JSON.stringify(document, null, "\t")}\n`
}
