# router 路由变更与风险索引

- 适用版本：SiYuan `v3.5.7`
- 官方仓库同步到：`siyuan-note/siyuan@master` + Release `v3.5.7`（2026-02-14）
- 最后核对：2026-02-21
- 稳定性：internal-risk-index
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/blob/master/kernel/api/router.go>

说明：
- 本页来自 `router.go` 注释与路由定义，不等同公开 API 稳定承诺。
- 若与公开文档冲突，以公开 API 文档为优先，并记录迁移策略。

## 1. 计划删除 / 请勿使用（高风险）

|路由|风险级别|状态|目标日期|替代建议|证据|
|---|---|---|---|---|---|
|`/api/system/reloadUI`|high|计划删除|2026-06-30 后|`/api/ui/reloadUI`|<https://github.com/siyuan-note/siyuan/issues/15308#issuecomment-3077675356>|
|`/api/storage/setLocalStorage`|high|计划删除|2026-06-30 后|`/api/storage/setLocalStorageVal`|<https://github.com/siyuan-note/siyuan/issues/16664#issuecomment-3694774305>|
|`/api/filetree/refreshFiletree`|high|计划删除|2026-06-30 后|`/api/system/rebuildDataIndex`|<https://github.com/siyuan-note/siyuan/issues/15663#issuecomment-3219296189>|
|`/api/av/searchAttributeViewNonRelationKey`|high|请勿使用+计划删除|2026-06-30 后|避免依赖，改用关系/过滤相关端点组合|<https://github.com/siyuan-note/siyuan/issues/15727>|

## 2. 参数迁移（中风险）

|接口|迁移内容|风险级别|目标日期|证据|
|---|---|---|---|---|
|`/api/av/batchSetAttributeViewBlockAttrs`|`rowID` 迁移为 `itemID`|medium|2026-06-30 后|<https://github.com/siyuan-note/siyuan/issues/15310#issuecomment-3239696237>|

## 3. 推荐兼容策略

1. 新功能默认使用新接口/新参数。
2. 旧功能保留短期 fallback，且打印迁移日志。
3. 每次发版前回归以下场景：
   - UI 刷新相关功能
   - 本地存储相关功能
   - AV 批量写值与行定位

## 4. 与主文档映射

- 迁移清单：`reference/03-kernel-api/弃用接口迁移清单-2026H1.md`
- 公开 API 导航：`reference/03-kernel-api/公开API导航.md`
