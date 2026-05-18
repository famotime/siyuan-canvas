export interface SiyuanResolvedDocument {
  hpath: string
  id: string
  path: string
  title: string
}

export interface SiyuanSearchDocumentResult extends SiyuanResolvedDocument {}
export interface SiyuanResolvedBlock {
  hpath: string
  id: string
  path: string
  rootId: string
  type?: string
  title: string
}
export interface SiyuanSearchBlockResult extends SiyuanResolvedBlock {}

export interface SiyuanSearchImageResult extends SiyuanResolvedAsset {}

export interface SiyuanResolvedAsset {
  blockId?: string
  name: string
  openPath: string
  path: string
  title?: string
}

type QueryRows = (statement: string) => Promise<any[]>
type ParsedImageReference = {
  path: string
  title?: string
}

const MARKDOWN_IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/i
const HTML_IMAGE_PATTERN = /<img\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)')[^>]*>/i
const HTML_ALT_PATTERN = /\balt=(?:"([^"]*)"|'([^']*)')/i
const HTML_TITLE_PATTERN = /\btitle=(?:"([^"]*)"|'([^']*)')/i
const IMAGE_PATH_PATTERN = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(?:$|[?#])/i
const SIYUAN_ASSET_PATH_PATTERN = /^(?:\/?data\/)?assets\//i
const BLOCK_ID_PATTERN = /^\d{14}-[a-z0-9]{7}$/i

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

function toOpenAssetPath(path: string): string {
  return path.startsWith("/data/") ? path : `/data/${path.replace(/^\//, "")}`
}

function toStoredAssetPath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/data\//, "")
    .replace(/^data\//, "")
}

function createResolvedAsset(
  assetPath: string,
  options: {
    blockId?: string
    name?: string
    title?: string
  } = {},
): SiyuanResolvedAsset {
  return {
    blockId: options.blockId,
    name: options.name || getFileName(assetPath),
    openPath: toOpenAssetPath(assetPath),
    path: assetPath,
    title: options.title || undefined,
  }
}

async function resolveRootDocumentRow(rootId: string, queryRows: QueryRows): Promise<any | null> {
  const rootRows = await queryRows(
    `SELECT id, path, hpath, content
     FROM blocks
     WHERE id = '${escapeSqlString(rootId)}'
     LIMIT 1`,
  )
  return rootRows[0] || null
}

function createResolvedBlock(row: any, rootRow: any): SiyuanResolvedBlock {
  return {
    hpath: rootRow?.hpath || row.hpath || row.path,
    id: row.id,
    path: rootRow?.path || row.path,
    rootId: row.root_id || rootRow?.id || row.id,
    type: row.type || undefined,
    title: row.content || getFileName(rootRow?.path || row.path),
  }
}

function extractImageReferenceFromMarkdown(markdown: string): ParsedImageReference | null {
  const markdownMatch = markdown.match(MARKDOWN_IMAGE_PATTERN)
  if (markdownMatch) {
    return {
      path: markdownMatch[2]!.trim(),
      title: markdownMatch[3] || markdownMatch[1] || undefined,
    }
  }

  const htmlMatch = markdown.match(HTML_IMAGE_PATTERN)
  if (!htmlMatch) {
    return null
  }

  const source = htmlMatch[1] || htmlMatch[2]
  if (!source) {
    return null
  }

  const altMatch = markdown.match(HTML_ALT_PATTERN)
  const titleMatch = markdown.match(HTML_TITLE_PATTERN)
  return {
    path: source.trim(),
    title: titleMatch?.[1] || titleMatch?.[2] || altMatch?.[1] || altMatch?.[2] || undefined,
  }
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
      `SELECT block_id, path, name, title
       FROM assets
       WHERE path = '${escapeSqlString(candidate)}'
       LIMIT 1`,
    )
    const row = rows[0]
    if (row) {
      return createResolvedAsset(row.path as string, {
        blockId: row.block_id || undefined,
        name: row.name || undefined,
        title: row.title || undefined,
      })
    }
  }

  return null
}

export async function resolveSiyuanDocumentByBlockId(
  blockId: string,
  queryRows: QueryRows,
): Promise<SiyuanResolvedDocument | null> {
  const rows = await queryRows(
    `SELECT id, root_id, path, hpath, content, type
     FROM blocks
     WHERE id = '${escapeSqlString(blockId)}'
     LIMIT 1`,
  )
  const row = rows[0]
  if (!row) {
    return null
  }

  if (row.type === "d") {
    return {
      hpath: row.hpath,
      id: row.id,
      path: row.path,
      title: row.content || getFileName(row.path),
    }
  }

  const rootRow = await resolveRootDocumentRow(String(row.root_id), queryRows)
  if (!rootRow) {
    return null
  }

  return {
    hpath: rootRow.hpath,
    id: rootRow.id,
    path: rootRow.path,
    title: rootRow.content || getFileName(rootRow.path),
  }
}

export async function resolveSiyuanBlockById(
  blockId: string,
  queryRows: QueryRows,
): Promise<SiyuanResolvedBlock | null> {
  const rows = await queryRows(
    `SELECT id, root_id, path, hpath, content, type
     FROM blocks
     WHERE id = '${escapeSqlString(blockId)}'
     LIMIT 1`,
  )
  const row = rows[0]
  if (!row || row.type === "d") {
    return null
  }

  const rootRow = await resolveRootDocumentRow(String(row.root_id), queryRows)
  if (!rootRow) {
    return null
  }

  return createResolvedBlock(row, rootRow)
}

export async function resolveImageAssetByBlockId(
  blockId: string,
  queryRows: QueryRows,
): Promise<SiyuanResolvedAsset | null> {
  const rows = await queryRows(
    `SELECT block_id, path, name, title
     FROM assets
     WHERE block_id = '${escapeSqlString(blockId)}'
     LIMIT 1`,
  )
  const row = rows[0]
  if (row) {
    return createResolvedAsset(row.path as string, {
      blockId: row.block_id as string,
      name: row.name || undefined,
      title: row.title || undefined,
    })
  }

  const blockRows = await queryRows(
    `SELECT markdown, content
     FROM blocks
     WHERE id = '${escapeSqlString(blockId)}'
     LIMIT 1`,
  )
  const blockRow = blockRows[0]
  const imageReference = blockRow ? extractImageReferenceFromMarkdown(String(blockRow.markdown || "")) : null
  if (!imageReference || !IMAGE_PATH_PATTERN.test(imageReference.path)) {
    return null
  }

  const resolvedByPath = await resolveSiyuanAssetByPath(imageReference.path, queryRows)
  if (resolvedByPath) {
    return {
      ...resolvedByPath,
      blockId,
      title: resolvedByPath.title || imageReference.title || undefined,
    }
  }

  if (!SIYUAN_ASSET_PATH_PATTERN.test(imageReference.path)) {
    return null
  }

  const assetPath = toStoredAssetPath(imageReference.path)
  return createResolvedAsset(assetPath, {
    blockId,
    title: imageReference.title || blockRow?.content || undefined,
  })
}

export async function searchSiyuanDocuments(
  query: string,
  queryRows: QueryRows,
): Promise<SiyuanSearchDocumentResult[]> {
  const trimmed = query.trim()
  if (!trimmed) {
    return []
  }

  const escaped = escapeSqlString(trimmed)
  const rows = await queryRows(
    `SELECT id, path, hpath, content
     FROM blocks
     WHERE type = 'd'
       AND (content LIKE '%${escaped}%' OR hpath LIKE '%${escaped}%')
     LIMIT 20`,
  )

  return rows.map((row) => ({
    hpath: row.hpath,
    id: row.id,
    path: row.path,
    title: row.content || getFileName(row.path),
  }))
}

export async function searchSiyuanBlocks(
  query: string,
  queryRows: QueryRows,
): Promise<SiyuanSearchBlockResult[]> {
  const trimmed = query.trim()
  if (!trimmed) {
    return []
  }

  if (BLOCK_ID_PATTERN.test(trimmed)) {
    const resolved = await resolveSiyuanBlockById(trimmed, queryRows)
    return resolved ? [resolved] : []
  }

  const escaped = escapeSqlString(trimmed)
  const rows = await queryRows(
    `SELECT id, root_id, path, hpath, content, type
     FROM blocks
     WHERE type != 'd'
       AND (id LIKE '%${escaped}%' OR content LIKE '%${escaped}%' OR hpath LIKE '%${escaped}%' OR markdown LIKE '%${escaped}%')
     LIMIT 20`,
  )

  const resolved = await Promise.all(rows.map(async (row) => {
    const rootRow = await resolveRootDocumentRow(String(row.root_id), queryRows)
    return rootRow ? createResolvedBlock(row, rootRow) : null
  }))

  return resolved.filter((row): row is SiyuanResolvedBlock => row !== null)
}

export async function searchSiyuanImageAssets(
  query: string,
  queryRows: QueryRows,
): Promise<SiyuanSearchImageResult[]> {
  const trimmed = query.trim()
  if (!trimmed) {
    return []
  }

  const escaped = escapeSqlString(trimmed)
  const rows = await queryRows(
    `SELECT block_id, path, name, title
     FROM assets
     WHERE (name LIKE '%${escaped}%' OR title LIKE '%${escaped}%' OR path LIKE '%${escaped}%')
       AND (
         path LIKE '%.png' OR path LIKE '%.jpg' OR path LIKE '%.jpeg'
         OR path LIKE '%.gif' OR path LIKE '%.webp' OR path LIKE '%.svg'
         OR path LIKE '%.bmp' OR path LIKE '%.avif'
       )
     LIMIT 20`,
  )

  return rows.map((row) => {
    const assetPath = row.path as string
    return {
      blockId: row.block_id as string,
      name: row.name || getFileName(assetPath),
      openPath: assetPath.startsWith("/data/") ? assetPath : `/data/${assetPath.replace(/^\//, "")}`,
      path: assetPath,
      title: row.title || row.name || getFileName(assetPath),
    }
  })
}
