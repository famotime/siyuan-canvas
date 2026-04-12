function getCanvasAssetDirectory(canvasPath: string): string {
  return canvasPath.replace(/\.canvas$/i, ".assets")
}

export function buildWorkspaceImagePath(canvasPath: string, fileName: string, now = Date.now()): string {
  const assetDirectory = getCanvasAssetDirectory(canvasPath)
  const extension = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : ".png"
  return `${assetDirectory}/${now}${extension}`
}

export async function writeWorkspaceImageFile(
  canvasPath: string,
  file: File,
  putFile: (path: string, isDir: boolean, file: Blob) => Promise<unknown>,
): Promise<string> {
  const targetPath = buildWorkspaceImagePath(canvasPath, file.name || "pasted.png")
  await putFile(targetPath, false, file)
  return targetPath
}
