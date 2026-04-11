export interface SiyuanResolvedDocument {
  hpath: string
  id: string
  path: string
  title: string
}

export interface SiyuanResolvedAsset {
  name: string
  openPath: string
  path: string
  title?: string
}

type QueryRows = (statement: string) => Promise<any[]>

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''")
}

function getFileName(path: string): string {
  const parts = path.split("/")
  return parts[parts.length - 1] || path
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

export function createDocumentPathCandidates(path: string): { hpaths: string[], storagePaths: string[] } {
  const trimmed = path.trim()
  const withoutMarkdownExtension = trimmed.replace(/\.(markdown|md)$/i, "")
  return {
    hpaths: uniqueValues([
      trimmed.startsWith("/") ? trimmed : `/${trimmed}`,
      withoutMarkdownExtension.startsWith("/") ? withoutMarkdownExtension : `/${withoutMarkdownExtension}`,
    ]),
    storagePaths: uniqueValues([
      trimmed,
      trimmed.startsWith("/") ? trimmed : `/${trimmed}`,
    ].filter((candidate) => candidate.endsWith(".sy"))),
  }
}

export function createAssetPathCandidates(path: string): string[] {
  const trimmed = path.trim().replace(/\\/g, "/")
  return uniqueValues([
    trimmed,
    trimmed.replace(/^\/data\//, ""),
    trimmed.replace(/^\//, ""),
  ])
}

export async function resolveSiyuanDocumentByPath(
  path: string,
  queryRows: QueryRows,
): Promise<SiyuanResolvedDocument | null> {
  const candidates = createDocumentPathCandidates(path)

  for (const storagePath of candidates.storagePaths) {
    const rows = await queryRows(
      `SELECT id, path, hpath, content
       FROM blocks
       WHERE type = 'd' AND path = '${escapeSqlString(storagePath)}'
       LIMIT 1`,
    )
    const row = rows[0]
    if (row) {
      return {
        hpath: row.hpath,
        id: row.id,
        path: row.path,
        title: row.content || getFileName(row.path),
      }
    }
  }

  for (const hpath of candidates.hpaths) {
    const rows = await queryRows(
      `SELECT id, path, hpath, content
       FROM blocks
       WHERE type = 'd' AND hpath = '${escapeSqlString(hpath)}'
       LIMIT 1`,
    )
    const row = rows[0]
    if (row) {
      return {
        hpath: row.hpath,
        id: row.id,
        path: row.path,
        title: row.content || getFileName(row.path),
      }
    }
  }

  return null
}

export async function resolveSiyuanAssetByPath(
  path: string,
  queryRows: QueryRows,
): Promise<SiyuanResolvedAsset | null> {
  for (const candidate of createAssetPathCandidates(path)) {
    const rows = await queryRows(
      `SELECT path, name, title
       FROM assets
       WHERE path = '${escapeSqlString(candidate)}'
       LIMIT 1`,
    )
    const row = rows[0]
    if (row) {
      const assetPath = row.path as string
      return {
        name: row.name || getFileName(assetPath),
        openPath: assetPath.startsWith("/data/") ? assetPath : `/data/${assetPath.replace(/^\//, "")}`,
        path: assetPath,
        title: row.title || undefined,
      }
    }
  }

  return null
}
