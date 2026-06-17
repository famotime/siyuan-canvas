import type {
  WorkspaceEntry,
  WorkspaceSortDirection,
  WorkspaceSortField,
  WorkspaceTreeNode,
} from "@/canvas/use-canvas-editor-workspace-tree"

export async function readWorkspaceDirectoryTree(
  dirPath: string,
  readDir: (path: string) => Promise<WorkspaceEntry[]>,
): Promise<WorkspaceTreeNode[]> {
  let entries: WorkspaceEntry[]
  try {
    entries = (await readDir(dirPath)) ?? []
  } catch {
    return []
  }

  const nodes: WorkspaceTreeNode[] = []
  for (const entry of entries) {
    const fullPath = `${dirPath}/${entry.name}`
    if (entry.isDir) {
      nodes.push({
        type: 'folder',
        path: fullPath,
        name: entry.name,
        children: await readWorkspaceDirectoryTree(fullPath, readDir),
      })
    } else if (entry.name.endsWith('.canvas')) {
      nodes.push({
        type: 'file',
        path: fullPath,
        name: entry.name,
        updated: entry.updated,
        created: entry.created,
      })
    }
  }

  return nodes
}

export function sortWorkspaceTreeNodes(
  nodes: WorkspaceTreeNode[],
  field: WorkspaceSortField,
  direction: WorkspaceSortDirection,
): WorkspaceTreeNode[] {
  const dir = direction === 'asc' ? 1 : -1
  const sorted = [...nodes].sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1
    if (a.type !== 'folder' && b.type === 'folder') return 1

    if (field === 'name') {
      return dir * a.name.localeCompare(b.name, 'zh-CN')
    }

    const aVal = a.type === 'file' ? (a[field] ?? 0) : 0
    const bVal = b.type === 'file' ? (b[field] ?? 0) : 0
    return dir * (aVal - bVal)
  })

  return sorted.map((node) =>
    node.type === 'folder'
      ? {
          ...node,
          children: sortWorkspaceTreeNodes(node.children, field, direction),
        }
      : node,
  )
}

export function collectWorkspaceFolderPaths(nodes: WorkspaceTreeNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.type === 'folder') {
      paths.push(node.path)
      paths.push(...collectWorkspaceFolderPaths(node.children))
    }
  }
  return paths
}

export function collectWorkspaceCanvasFiles(nodes: WorkspaceTreeNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.type === 'file') {
      paths.push(node.path)
    } else {
      paths.push(...collectWorkspaceCanvasFiles(node.children))
    }
  }
  return paths
}

export function sanitizeWorkspaceName(name: string): string {
  return name.trim()
    .replace(/[\\/:*?"'<>|]/g, "_")
    .replace(/[~[\]()!&{}=#%;$]/g, "")
    .replace(/[\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "")
}

export function sanitizeCanvasFileBaseName(name: string): string {
  return sanitizeWorkspaceName(name.replace(/\.canvas$/i, ''))
}

export function buildWorkspaceFilePath(directory: string, name: string): string {
  const sanitized = sanitizeCanvasFileBaseName(name)
  return `${directory}/${sanitized}.canvas`
}
