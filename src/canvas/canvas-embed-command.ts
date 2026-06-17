import type { IProtyle } from "siyuan"

export interface CanvasEmbedCommandMessages {
  insertCanvasEmbedFailed: string
  insertCanvasEmbedNoDocument: string
  insertCanvasEmbedSuccess: string
  messageUnableOpenCanvasFile: string
}

export interface CanvasEmbedTargetOptions {
  commandProtyle?: IProtyle | null
  getAllEditor?: () => Array<{ protyle?: IProtyle | null }>
  lastActiveProtyle?: IProtyle | null
}

export interface RunCanvasEmbedCommandOptions extends CanvasEmbedTargetOptions {
  canvasPath: string
  debugLog: (message: string, payload: Record<string, unknown>) => void
  getFileText: (path: string) => Promise<string>
  getWorkspaceDir: () => Promise<string | undefined>
  insertCanvasEmbed: (options: {
    canvasPath: string
    canvasRaw: string
    parentBlockId: string
  }) => Promise<string | undefined>
  messages: CanvasEmbedCommandMessages
  showMessage: (message: string, timeout?: number, type?: string) => void
}

export async function normalizeCanvasEmbedPath(
  path: string,
  getWorkspaceDir: () => Promise<string | undefined>,
): Promise<string> {
  let canvasPath = path.trim().replace(/^["']|["']$/g, '')
  if (!canvasPath) {
    return ""
  }

  if (!/^[a-zA-Z]:[/\\]/.test(canvasPath)) {
    return canvasPath
  }

  try {
    const workspaceDir = await getWorkspaceDir()
    if (!workspaceDir) {
      return canvasPath
    }

    const normalizedWorkspace = workspaceDir.replace(/\\/g, '/').replace(/\/+$/, '')
    const normalizedPath = canvasPath.replace(/\\/g, '/')
    if (normalizedPath.toLowerCase().startsWith(normalizedWorkspace.toLowerCase())) {
      canvasPath = normalizedPath.slice(normalizedWorkspace.length)
      if (!canvasPath.startsWith('/')) {
        canvasPath = `/${canvasPath}`
      }
    }
  } catch {
    return canvasPath
  }

  return canvasPath
}

export function getProtyleRootId(protyle?: IProtyle | null): string {
  return protyle?.block?.rootID
    || protyle?.block?.id
    || protyle?.element?.querySelector<HTMLElement>(".protyle-wysiwyg[data-node-id]")?.getAttribute("data-node-id")
    || ""
}

export function resolveCanvasEmbedTargetDocumentId(options: CanvasEmbedTargetOptions): string {
  const fromCommand = getProtyleRootId(options.commandProtyle)
  if (fromCommand) {
    return fromCommand
  }

  const fromLastActive = getProtyleRootId(options.lastActiveProtyle)
  if (fromLastActive) {
    return fromLastActive
  }

  const fromEditorList = options.getAllEditor?.()
    ?.map(editor => getProtyleRootId(editor.protyle))
    .find(Boolean)
  if (fromEditorList) {
    return fromEditorList
  }

  const wysiwyg = document.querySelector<HTMLElement>(".protyle-wysiwyg[data-node-id]")
  const fromWysiwyg = wysiwyg?.getAttribute("data-node-id")
  if (fromWysiwyg) {
    return fromWysiwyg
  }

  const docRoot = document.querySelector<HTMLElement>(".protyle-wysiwyg [data-node-id][data-type='NodeDocument']")
  return docRoot?.getAttribute("data-node-id") || ""
}

export async function runCanvasEmbedCommand(options: RunCanvasEmbedCommandOptions): Promise<string | undefined> {
  const canvasPath = await normalizeCanvasEmbedPath(options.canvasPath, options.getWorkspaceDir)
  if (!canvasPath) {
    return undefined
  }

  try {
    const rawStr = await options.getFileText(canvasPath)
    if (!rawStr) {
      options.debugLog("unable to read canvas file", { canvasPath })
      options.showMessage(options.messages.messageUnableOpenCanvasFile, 4000, "error")
      return undefined
    }

    const docId = resolveCanvasEmbedTargetDocumentId(options)
    if (!docId) {
      options.debugLog("no target document found", {
        activeElement: document.activeElement?.className,
        canvasPath,
        editorCount: options.getAllEditor?.()?.length ?? 0,
        hasCommandProtyle: Boolean(options.commandProtyle),
        hasLastActiveProtyle: Boolean(options.lastActiveProtyle),
        protyleCount: document.querySelectorAll(".protyle").length,
        wysiwygCount: document.querySelectorAll(".protyle-wysiwyg").length,
      })
      options.showMessage(options.messages.insertCanvasEmbedNoDocument, 4000, "warning")
      return undefined
    }

    const blockId = await options.insertCanvasEmbed({
      canvasPath,
      canvasRaw: rawStr,
      parentBlockId: docId,
    })
    if (blockId) {
      options.showMessage(options.messages.insertCanvasEmbedSuccess, 3000)
      return blockId
    }

    options.showMessage(options.messages.insertCanvasEmbedFailed, 4000, "error")
  } catch (error) {
    options.debugLog("insert failed", { canvasPath, error })
    options.showMessage(options.messages.insertCanvasEmbedFailed, 4000, "error")
  }

  return undefined
}
