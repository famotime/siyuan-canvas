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

export type {
  SiyuanResolvedBlock,
  SiyuanResolvedAsset,
  SiyuanResolvedDocument,
} from "@/canvas/siyuan-file-node-lookups"
