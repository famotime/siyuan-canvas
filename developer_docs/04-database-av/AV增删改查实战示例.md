# AV 增删改查实战示例

- 适用版本：SiYuan `v3.8.3`
- 官方仓库同步到：`siyuan-note/siyuan@master` + Release `v3.8.3`（2026-09-13）
- 最后核对：2026-09-13
- 稳定性：stable
- 权威来源：
  - [../03-kernel-api/official/API_zh_CN.md](../03-kernel-api/official/API_zh_CN.md)
  - [../03-kernel-api/official/router.go](../03-kernel-api/official/router.go)

## 1. 统一请求函数

```ts
import { fetchSyncPost, showMessage } from "siyuan";

export async function requestApi<T = any>(url: string, data: Record<string, unknown> = {}): Promise<T> {
  const res = await fetchSyncPost(url, data);
  if (res.code !== 0) {
    showMessage(res.msg || `请求 ${url} 失败`, 5000, "error");
    throw new Error(`[API Error ${res.code}] ${res.msg}`);
  }
  return res.data as T;
}
```

## 2. 插入非绑定块行（纯结构化录入，带 Kramdown 富文本）

```ts
export async function createDetachedRowWithRichText(avID: string, keyTitleID: string, keyScoreID: string) {
  return await requestApi("/api/av/appendAttributeViewDetachedBlocksWithValues", {
    avID,
    blocksValues: [
      [
        {
          keyID: keyTitleID,
          text: {
            content: "调研报告",
            rich: "**调研报告** [参考文档](siyuan://blocks/20260913080000-xxxx)"
          }
        },
        {
          keyID: keyScoreID,
          number: {
            content: 95
          }
        }
      ]
    ]
  });
}
```

## 3. 绑定已有块并批量写入多列值（两段式）

```ts
export async function bindBlockAndSetValues(
  avID: string,
  blockID: string,
  keyMap: { statusKeyID: string; tagKeyID: string }
) {
  // 1. 绑定块到属性视图
  await requestApi("/api/av/addAttributeViewBlocks", {
    avID,
    srcs: [{ id: blockID, isDetached: false }]
  });

  // 2. 批量设置该行各列值
  await requestApi("/api/av/batchSetAttributeViewBlockAttrs", {
    avID,
    values: [
      {
        keyID: keyMap.statusKeyID,
        itemID: blockID,
        value: { select: { content: "已就绪" } }
      },
      {
        keyID: keyMap.tagKeyID,
        itemID: blockID,
        value: { mSelect: [{ content: "内核" }, { content: "v3.8.3" }] }
      }
    ]
  });
}
```

## 4. 动态设置上下文过滤 (v3.8.3 新增)

```ts
export async function applyContextFilter(avID: string, viewID: string, currentDocID: string) {
  await requestApi("/api/av/setAttrViewContextFilter", {
    avID,
    viewID,
    contextFilter: {
      key: "doc_relation",
      operator: "equal",
      value: currentDocID
    }
  });
}
```

## 5. 文档与属性视图双向转换 (v3.8.3 新增)

```ts
// 将现有普通文档转换为属性视图 (数据库)
export async function convertDocToDatabase(docID: string) {
  const result = await requestApi<{ avID: string }>("/api/av/convertDocToAttrView", {
    id: docID
  });
  console.log("转换成功，新属性视图 ID:", result.avID);
  return result.avID;
}

// 将属性视图转换回普通文档
export async function convertDatabaseToDoc(avID: string) {
  const result = await requestApi<{ docID: string }>("/api/av/convertAttrViewToDoc", {
    id: avID
  });
  console.log("降维转换成功，恢复文档 ID:", result.docID);
  return result.docID;
}
```

## 6. 查询视图数据并归一化解析

```ts
export async function fetchAndParseAV(avID: string, viewID?: string) {
  const res = await requestApi<any>("/api/av/renderAttributeView", {
    id: avID,
    viewID: viewID || "",
    pageSize: 50,
    page: 1
  });

  const viewType = res.viewType; // "table" | "gallery" | "kanban"
  const rawItems = res.view?.group
    ? res.view.groups.flatMap((g: any) => (viewType === "gallery" ? g.cards : g.rows))
    : (viewType === "gallery" ? res.view.cards : res.view.rows);

  console.log(`获取到 ${rawItems?.length || 0} 行数据，当前视图类型: ${viewType}`);
  return {
    viewType,
    columns: viewType === "gallery" ? res.view.fields : res.view.columns,
    items: rawItems || []
  };
}
```

## 7. 移除指定行

```ts
export async function removeRow(avID: string, itemID: string) {
  await requestApi("/api/av/removeAttributeViewBlocks", {
    avID,
    srcIDs: [itemID]
  });
}
```
