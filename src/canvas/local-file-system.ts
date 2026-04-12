interface NodeFileSystemAccess {
  access: (path: string) => Promise<void>
  readFile: (path: string, encoding: "utf8") => Promise<string>
  writeFile: (path: string, text: string) => Promise<void>
}

function getNodeFileSystemAccess(): NodeFileSystemAccess | null {
  try {
    return require("node:fs/promises") as NodeFileSystemAccess
  } catch {
    return null
  }
}

export function getSelectedLocalPath(file: File): string {
  const candidate = (file as File & { path?: string }).path
  return typeof candidate === "string" ? candidate.trim() : ""
}

export async function localPathExists(path: string): Promise<boolean> {
  const fileSystem = getNodeFileSystemAccess()
  if (!fileSystem || !path) {
    return false
  }

  try {
    await fileSystem.access(path)
    return true
  } catch {
    return false
  }
}

export async function readLocalFileText(path: string): Promise<string> {
  const fileSystem = getNodeFileSystemAccess()
  if (!fileSystem) {
    throw new Error("Local file access is not available in this environment.")
  }

  return fileSystem.readFile(path, "utf8")
}

export async function writeLocalFileText(path: string, text: string): Promise<void> {
  const fileSystem = getNodeFileSystemAccess()
  if (!fileSystem) {
    throw new Error("Local file access is not available in this environment.")
  }

  await fileSystem.writeFile(path, text)
}
