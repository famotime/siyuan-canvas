import type { CanvasTextGateway } from "@/canvas/file-service"

function getFilename(path: string): string {
  const parts = path.split("/")
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

export class SiyuanCanvasTextGateway implements CanvasTextGateway {
  async readText(path: string): Promise<string> {
    const response = await fetch("/api/file/getFile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
    })

    if (response.status !== 200) {
      throw new Error(await parseApiError(response, `Failed to read ${path}`))
    }

    return response.text()
  }

  async writeText(path: string, text: string): Promise<void> {
    const form = new FormData()
    form.append("path", path)
    form.append("isDir", "false")
    form.append("modTime", Math.floor(Date.now() / 1000).toString())
    form.append(
      "file",
      new Blob([text], { type: "application/json" }),
      getFilename(path),
    )

    const response = await fetch("/api/file/putFile", {
      method: "POST",
      body: form,
    })

    const payload = await response.json()
    if (!response.ok || payload.code !== 0) {
      throw new Error(payload.msg || `Failed to write ${path}`)
    }
  }
}
