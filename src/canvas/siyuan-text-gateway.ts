import type { CanvasTextGateway } from "@/canvas/file-service"

function getFilename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/")
  return parts[parts.length - 1] || "document.canvas"
}

async function parseApiError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json()
    return payload?.msg || fallback
  } catch {
    return fallback
  }
}

function getFsModule(): any {
  try {
    const requireFn = (window as any).require || (globalThis as any).require
    if (typeof requireFn === 'function') {
      let fs: any = null
      try {
        const remote = requireFn('@electron/remote')
        if (remote) {
          if (typeof remote.require === 'function') {
            fs = remote.require('fs')
          }
          if (!fs && remote.fs) {
            fs = remote.fs
          }
        }
      } catch {}

      if (!fs) {
        try {
          fs = requireFn('fs')
        } catch {}
      }
      return fs
    }
  } catch {}
  return null
}

function getWorkspaceDir(): string {
  try {
    const workspaceDir = (window as any).siyuan?.config?.system?.workspaceDir
    return typeof workspaceDir === "string" && workspaceDir ? workspaceDir : ""
  } catch {
    return ""
  }
}

export class SiyuanCanvasTextGateway implements CanvasTextGateway {
  async readText(path: string): Promise<string> {
    const trimmed = path.trim()
    const isAbsoluteLocal = /^[a-zA-Z]:[/\\]/.test(trimmed) || /^[/\\]+[a-zA-Z]:/.test(trimmed) || trimmed.startsWith('file://')

    if (isAbsoluteLocal) {
      let localPath = trimmed
      if (localPath.startsWith('file:///')) {
        localPath = decodeURIComponent(localPath.substring(8))
      } else if (localPath.startsWith('file://')) {
        localPath = decodeURIComponent(localPath.substring(7))
      }
      localPath = localPath.replace(/^[/\\]+([a-zA-Z]:)/, '$1').replace(/\//g, '\\')

      const fs = getFsModule()
      if (fs) {
        if (typeof fs.promises?.readFile === 'function') {
          return await fs.promises.readFile(localPath, 'utf-8')
        }
        if (typeof fs.readFileSync === 'function') {
          return fs.readFileSync(localPath, 'utf-8')
        }
      }
    }

    const response = await fetch("/api/file/getFile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: trimmed }),
    })

    if (response.status !== 200) {
      throw new Error(await parseApiError(response, `Failed to read ${trimmed}`))
    }

    return response.text()
  }

  async writeText(path: string, text: string): Promise<void> {
    const trimmed = path.trim()
    const isAbsoluteLocal = /^[a-zA-Z]:[/\\]/.test(trimmed) || /^[/\\]+[a-zA-Z]:/.test(trimmed) || trimmed.startsWith('file://')

    if (isAbsoluteLocal) {
      let localPath = trimmed
      if (localPath.startsWith('file:///')) {
        localPath = decodeURIComponent(localPath.substring(8))
      } else if (localPath.startsWith('file://')) {
        localPath = decodeURIComponent(localPath.substring(7))
      }
      localPath = localPath.replace(/^[/\\]+([a-zA-Z]:)/, '$1').replace(/\//g, '\\')

      const fs = getFsModule()
      if (fs) {
        if (typeof fs.promises?.writeFile === 'function') {
          await fs.promises.writeFile(localPath, text, 'utf-8')
          return
        }
        if (typeof fs.writeFileSync === 'function') {
          fs.writeFileSync(localPath, text, 'utf-8')
          return
        }
      }
    }

    const form = new FormData()
    form.append("path", trimmed)
    form.append("isDir", "false")
    form.append("modTime", Math.floor(Date.now() / 1000).toString())
    form.append(
      "file",
      new Blob([text], { type: "application/json" }),
      getFilename(trimmed),
    )

    const response = await fetch("/api/file/putFile", {
      method: "POST",
      body: form,
    })

    const payload = await response.json()
    if (!response.ok || payload.code !== 0) {
      throw new Error(payload.msg || `Failed to write ${trimmed}`)
    }
  }

  /**
   * 直接通过 Electron fs 写入磁盘，绕过 `/api/file/putFile`。
   * 自动保存使用此方法可避免 putFile 触发思源宿主侧文件树刷新/重布局导致的画布闪烁。
   * 写入成功返回 true；环境不支持（无 fs / 无法解析工作区路径）或写入失败时返回 false，
   * 调用方应回退到 writeText（putFile）。
   */
  async writeTextDirect(path: string, text: string): Promise<boolean> {
    const fs = getFsModule()
    if (!fs) return false

    const trimmed = path.trim()
    const isAbsoluteLocal = /^[a-zA-Z]:[/\\]/.test(trimmed) || /^[/\\]+[a-zA-Z]:/.test(trimmed) || trimmed.startsWith('file://')

    let targetPath = trimmed
    if (isAbsoluteLocal) {
      if (targetPath.startsWith('file:///')) {
        targetPath = decodeURIComponent(targetPath.substring(8))
      } else if (targetPath.startsWith('file://')) {
        targetPath = decodeURIComponent(targetPath.substring(7))
      }
      targetPath = targetPath.replace(/^[/\\]+([a-zA-Z]:)/, '$1')
    } else {
      const workspaceDir = getWorkspaceDir()
      if (!workspaceDir) return false
      targetPath = `${workspaceDir.replace(/[\\/]+$/, '')}/${trimmed.replace(/^\/+/, '')}`
    }

    try {
      if (typeof fs.promises?.writeFile === 'function') {
        await fs.promises.writeFile(targetPath, text, 'utf-8')
      } else if (typeof fs.writeFileSync === 'function') {
        fs.writeFileSync(targetPath, text, 'utf-8')
      } else {
        return false
      }
      return true
    } catch {
      return false
    }
  }
}
