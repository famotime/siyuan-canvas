# AV 增删改查实战示例

- 适用版本：SiYuan `v3.5.7`
- 官方仓库同步到：`siyuan-note/siyuan@master` + Release `v3.5.7`（2026-02-14）
- 最后核对：2026-02-21
- 稳定性：stable（含迁移项）
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/blob/master/kernel/api/router.go>
  - <https://github.com/siyuan-note/siyuan/issues/15310#issuecomment-3079412833>
  - <https://github.com/siyuan-community/siyuan-developer-docs/tree/main/docs/zh-Hans/reference/database>

## 1. 统一请求封装

```ts
import { fetchSyncPost, showMessage } from "siyuan";

export async function requestApi<T = any>(url: string, data?: any): Promise<T> {
  const res = await fetchSyncPost(url, data);
  if (res.code !== 0) {
    showMessage(res.msg || url, 5000, "error");
    throw new Error(res.msg || url);
  }
  return res.data as T;
}
```

## 2. 新增行（非绑定块）

适合纯结构化录入，直接附带列值。

```ts
await requestApi("/api/av/appendAttributeViewDetachedBlocksWithValues", {
  avID: "20241017094451-2urncs9",
  blocksValues: [
    [
      { keyID: "20241017094451-jwfegvp", block: { content: "Title" } },
      { keyID: "20241017095436-2wlgb7o", number: { content: 123 } },
      { keyID: "20241017094451-fu1pv7s", mSelect: [{ content: "Fiction" }] }
    ]
  ]
});
```

## 3. 新增行（绑定块）与批量写值

绑定块更易与文档结构一致，常用“两段式”。

```ts
await requestApi("/api/av/addAttributeViewBlocks", {
  avID: "20241017094451-2urncs9",
  srcs: [{ id: "20240107212802-727hsjv", isDetached: false }]
});

await requestApi("/api/av/batchSetAttributeViewBlockAttrs", {
  avID: "20241017094451-2urncs9",
  values: [
    {
      keyID: "20241017094451-jwfegvp",
      rowID: "20240107212802-727hsjv",
      value: { text: { content: "Bound Title" } }
    }
  ]
});
```

## 4. 查询与结果归一化

```ts
const data = await requestApi("/api/av/renderAttributeView", {
  id: "20241017094451-2urncs9",
  query: "",
  pageSize: 50
});

const viewType = data.viewType;
const rowField = viewType === "gallery" ? "cards" : "rows";
const colField = viewType === "gallery" ? "fields" : "columns";
const rows = data.view?.group ? data.view.groups.flatMap((g: any) => g.rows) : data.view[rowField];
const columns = data.view[colField];
```

## 5. 获取列 ID 与行 ID

```ts
const keys = await requestApi("/api/av/getAttributeViewKeysByAvID", {
  avID: "20241017094451-2urncs9"
});
```

行 ID 可从 `renderAttributeView` 的行数据中解析，或通过映射接口获取。

## 6. rowID 与 itemID 迁移

```ts
const map = await requestApi("/api/av/getAttributeViewItemIDsByBoundIDs", {
  avID: "20241017094451-2urncs9",
  boundIDs: ["20240107212802-727hsjv"]
});
```

迁移期建议同时兼容 `rowID` 与 `itemID`。

## 7. 删除行

```ts
await requestApi("/api/av/removeAttributeViewBlocks", {
  avID: "20241017094451-2urncs9",
  srcIDs: ["20240107212802-727hsjv"]
});
```

## 8. 本章如何使用

- 先选“绑定块”还是“非绑定块”，再设计数据写入流程。
- 解析结果时统一做视图归一化，避免 UI 改动导致崩溃。
- 迁移期统一在基础层兼容 `rowID` 与 `itemID`。
