import {
  fetchSyncPost,
  type IWebSocketData,
} from "siyuan"

import {
  resolveImageAssetByBlockId,
  resolveSiyuanAssetByPath,
  resolveSiyuanDocumentByBlockId,
  resolveSiyuanDocumentByPath,
  searchSiyuanDocuments,
  searchSiyuanImageAssets,
  type SiyuanResolvedAsset,
  type SiyuanResolvedDocument,
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

export async function findSiyuanAssetByPath(path: string): Promise<SiyuanResolvedAsset | null> {
  return resolveSiyuanAssetByPath(path, querySiyuanSql)
}

export async function findSiyuanImageAssetByBlockId(blockId: string): Promise<SiyuanResolvedAsset | null> {
  return resolveImageAssetByBlockId(blockId, querySiyuanSql)
}

export async function findSiyuanDocumentsByQuery(query: string): Promise<SiyuanSearchDocumentResult[]> {
  return searchSiyuanDocuments(query, querySiyuanSql)
}

export async function findSiyuanImageAssetsByQuery(query: string): Promise<SiyuanSearchImageResult[]> {
  return searchSiyuanImageAssets(query, querySiyuanSql)
}

export async function getSiyuanDocumentMarkdown(documentId: string): Promise<string> {
  const response = await fetchSyncPost("/api/block/getBlockKramdown", {
    id: documentId,
  }) as IWebSocketData

  return response.code === 0 ? String(response.data?.kramdown || "") : ""
}

export type {
  SiyuanResolvedAsset,
  SiyuanResolvedDocument,
} from "@/canvas/siyuan-file-node-lookups"
