# rowID 到 itemID 迁移指南

- 适用版本：SiYuan `v3.5.7`
- 最后核对：2026-02-21
- 稳定性：deprecated-to-stable（参数迁移）
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/issues/15310#issuecomment-3239696237>
  - <https://github.com/siyuan-note/siyuan/blob/master/kernel/api/router.go>

## 1. 迁移背景

在 `batchSetAttributeViewBlockAttrs` 等 AV 接口中，`rowID` 计划于 **2026-06-30** 后迁移为 `itemID`。

## 2. 影响范围

- 批量写值
- 单元格定位
- 你自己保存的“行 ID + 列 ID”映射

## 3. 迁移策略（建议）

1. 统一封装参数层，业务层不直接写 `rowID` 字面量。
2. 同时兼容 `itemID` 和 `rowID`（短期过渡）。
3. 在日志中记录接口返回，确认服务端是否已经切到 `itemID`。

## 4. 兼容示例

```ts
function makeCellRef(id: string, useItemID: boolean) {
  return useItemID ? { itemID: id } : { rowID: id };
}
```

## 5. 关联接口

- `/api/av/getAttributeViewBoundBlockIDsByItemIDs`
- `/api/av/getAttributeViewItemIDsByBoundIDs`

用于在绑定块 ID 与行/项 ID 之间做转换。

## 6. 回归检查

- 写值成功且目标行正确更新
- 旧数据导入后仍能定位到正确行
- 多视图下显示一致

## 7. 本章如何使用

- 开发新功能：默认按 `itemID` 设计
- 维护旧功能：先加兼容层，再逐步移除 `rowID`
- 发布前：至少在两个思源版本做一次 AV 写入回归

