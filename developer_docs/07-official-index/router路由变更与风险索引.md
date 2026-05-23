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

## 1. 推荐兼容策略

1. 新功能默认使用新接口/新参数。
2. 不同视图类型统一走解析适配层。
3. 每次发版前回归以下场景：
   - UI 刷新相关功能
   - 本地存储相关功能
   - AV 批量写值与行定位

## 2. 与主文档映射

- 迁移清单：`reference/03-kernel-api/official/router.go`
- 公开 API 导航：`reference/03-kernel-api/公开API导航.md`
