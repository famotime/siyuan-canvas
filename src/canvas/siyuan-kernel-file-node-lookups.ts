import {
  fetchSyncPost,
  type IWebSocketData,
} from "siyuan"

import {
  resolveSiyuanAssetByPath,
  resolveSiyuanDocumentByPath,
  type SiyuanResolvedAsset,
  type SiyuanResolvedDocument,
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

export async function findSiyuanAssetByPath(path: string): Promise<SiyuanResolvedAsset | null> {
  return resolveSiyuanAssetByPath(path, querySiyuanSql)
}

export type {
  SiyuanResolvedAsset,
  SiyuanResolvedDocument,
} from "@/canvas/siyuan-file-node-lookups"
