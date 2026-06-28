import {
  fetchSyncPost,
  type IWebSocketData,
} from "siyuan"

import {
  resolveImageAssetByBlockId,
  resolveSiyuanBlockById,
  resolveSiyuanAssetByPath,
  resolveSiyuanDocumentByBlockId,
  resolveSiyuanDocumentByPath,
  searchSiyuanBlocks,
  searchSiyuanDocuments,
  searchSiyuanImageAssets,
  escapeSqlString,
  type SiyuanResolvedBlock,
  type SiyuanResolvedAsset,
  type SiyuanResolvedDocument,
  type SiyuanSearchBlockResult,
  type SiyuanSearchDocumentResult,
  type SiyuanSearchImageResult,
} from "@/canvas/siyuan-file-node-lookups"

async function querySiyuanSql(statement: string): Promise<any[]> {
  const response = await fetchSyncPost("/api/query/sql", {
    stmt: statement,
  }) as IWebSocketData

  return response.code === 0 ? response.data : []
}

export async function findSiyuanDocumentByPath(path: string): Promise<SiyuanResolvedDocument | null> {
  return resolveSiyuanDocumentByPath(path, querySiyuanSql)
}

export async function findSiyuanDocumentByBlockId(blockId: string): Promise<SiyuanResolvedDocument | null> {
  return resolveSiyuanDocumentByBlockId(blockId, querySiyuanSql)
}

export async function findSiyuanBlockById(blockId: string): Promise<SiyuanResolvedBlock | null> {
  return resolveSiyuanBlockById(blockId, querySiyuanSql)
}

export async function findSiyuanAssetByPath(path: string): Promise<SiyuanResolvedAsset | null> {
  return resolveSiyuanAssetByPath(path, querySiyuanSql)
}

export async function findSiyuanImageAssetByBlockId(blockId: string): Promise<SiyuanResolvedAsset | null> {
  return resolveImageAssetByBlockId(blockId, querySiyuanSql)
}

export async function findSiyuanDocumentsByQuery(query: string): Promise<SiyuanSearchDocumentResult[]> {
  return searchSiyuanDocuments(query, querySiyuanSql)
}

export async function findSiyuanBlocksByQuery(query: string): Promise<SiyuanSearchBlockResult[]> {
  return searchSiyuanBlocks(query, querySiyuanSql)
}

export async function findSiyuanImageAssetsByQuery(query: string): Promise<SiyuanSearchImageResult[]> {
  return searchSiyuanImageAssets(query, querySiyuanSql)
}

export async function getSiyuanBlockMarkdown(blockId: string): Promise<string> {
  const response = await fetchSyncPost("/api/block/getBlockKramdown", {
    id: blockId,
  }) as IWebSocketData

  return response.code === 0 ? String(response.data?.kramdown || "") : ""
}

export async function getSiyuanHeadingBlockMarkdown(blockId: string): Promise<string> {
  async function fetchBlockWithDescendants(id: string): Promise<string> {
    const blockMarkdown = await getSiyuanBlockMarkdown(id)

    const response = await fetchSyncPost("/api/block/getChildBlocks", {
      id,
    }) as IWebSocketData

    const childBlocks = response.code === 0 && Array.isArray(response.data)
      ? response.data as Array<{ id?: string }>
      : []
    const childMarkdown = await Promise.all(
      childBlocks
        .filter((block) => block.id)
        .map((block) => fetchBlockWithDescendants(String(block.id))),
    )

    return [blockMarkdown, ...childMarkdown].filter(Boolean).join("\n\n")
  }

  return fetchBlockWithDescendants(blockId)
}

export async function getSiyuanDocumentMarkdown(documentId: string): Promise<string> {
  return getSiyuanBlockMarkdown(documentId)
}

export async function getSiyuanBlockDOM(blockId: string): Promise<string> {
  const response = await fetchSyncPost("/api/block/getBlockDOM", {
    id: blockId,
  }) as IWebSocketData

  return response.code === 0 ? String(response.data?.dom || "") : ""
}

export async function getSiyuanHeadingBlockDOM(blockId: string): Promise<string> {
  async function fetchBlockWithDescendants(id: string): Promise<string> {
    const blockDOM = await getSiyuanBlockDOM(id)

    const response = await fetchSyncPost("/api/block/getChildBlocks", {
      id,
    }) as IWebSocketData

    const childBlocks = response.code === 0 && Array.isArray(response.data)
      ? response.data as Array<{ id?: string }>
      : []
    const childDOMs = await Promise.all(
      childBlocks
        .filter((block) => block.id)
        .map((block) => fetchBlockWithDescendants(String(block.id))),
    )

    return [blockDOM, ...childDOMs].filter(Boolean).join("")
  }

  return fetchBlockWithDescendants(blockId)
}

export type {
  SiyuanResolvedBlock,
  SiyuanResolvedAsset,
  SiyuanResolvedDocument,
} from "@/canvas/siyuan-file-node-lookups"

export interface SproutRelationItem {
  id: string
  title: string
  path: string
  hpath: string
}

export async function findSproutRelations(docId: string): Promise<{
  inlinks: SproutRelationItem[]
  outlinks: SproutRelationItem[]
  children: SproutRelationItem[]
}> {
  const escapedDocId = escapeSqlString(docId)

  // 首先解析出该块所属的根文档 ID 及其路径
  const docRows = await querySiyuanSql(`SELECT root_id, path FROM blocks WHERE id = '${escapedDocId}' LIMIT 1`)
  let rootDocId = escapedDocId
  let parentPath = ""
  if (docRows.length > 0) {
    rootDocId = docRows[0].root_id || escapedDocId
    // 块的 path 属于其对应的根文档路径
    parentPath = docRows[0].path || ""
  }

  const escapedRootId = escapeSqlString(rootDocId)

  // 1. 查询入链
  const inlinksQuery = `
    SELECT DISTINCT b.id, b.content AS title, b.path, b.hpath
    FROM refs r
    JOIN blocks b ON r.root_id = b.id
    WHERE r.def_block_root_id = '${escapedRootId}' AND r.root_id != '${escapedRootId}' AND b.type = 'd'
  `
  const inlinks = await querySiyuanSql(inlinksQuery)

  // 2. 查询出链
  const outlinksQuery = `
    SELECT DISTINCT b.id, b.content AS title, b.path, b.hpath
    FROM refs r
    JOIN blocks b ON r.def_block_root_id = b.id
    WHERE r.root_id = '${escapedRootId}' AND r.def_block_root_id != '${escapedRootId}' AND b.type = 'd'
  `
  const outlinks = await querySiyuanSql(outlinksQuery)

  // 3. 查询子文档
  let children: any[] = []
  if (parentPath) {
    const parentPathWithoutSy = parentPath.replace(/\.sy$/, "")
    const descendantsQuery = `
      SELECT id, content AS title, path, hpath
      FROM blocks
      WHERE type = 'd' AND path LIKE '${escapeSqlString(parentPathWithoutSy)}/%'
    `
    const allDescendants = await querySiyuanSql(descendantsQuery)
    children = allDescendants.filter((doc) => {
      const relativePath = String(doc.path || "").substring(parentPathWithoutSy.length + 1)
      return !relativePath.includes("/")
    })
  }

  const mapRow = (r: any): SproutRelationItem => {
    const filename = String(r.path || "").split("/").pop() || ""
    const fallbackTitle = filename.replace(/\.sy$/, "")
    return {
      id: String(r.id || ""),
      title: String(r.title || fallbackTitle || ""),
      path: String(r.path || ""),
      hpath: String(r.hpath || ""),
    }
  }

  return {
    inlinks: inlinks.map(mapRow),
    outlinks: outlinks.map(mapRow),
    children: children.map(mapRow),
  }
}
