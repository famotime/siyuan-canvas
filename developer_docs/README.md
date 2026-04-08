# 思源插件开发文档

本目录是针对思源笔记插件开发的本地参考文档。

## 适用范围

- 适用版本：SiYuan `v3.5.7`（核对日期：2026-02-21）
- 官方仓库同步到：`siyuan-note/siyuan@master` + Release `v3.5.7`（2026-02-14）
- 主要受众：插件开发者（TypeScript/JavaScript）
- 数据来源：官方仓库、官方模板、社区开发文档、已验证实践

## 同步策略

- 主文档层（`01`~`06`）：面向插件开发实战，保持精炼。
- 附录索引层（`07`）：面向官方全量 API 和路由风险追踪。

## 推荐阅读路径

1. 入门与总结（含速查+完整）：`reference/01-start/插件开发入门与工程实践.md`
2. 关键概念与数据架构速览：`reference/01-start/关键概念与数据架构速览.md`
3. 插件 API：`reference/02-plugin-api/`
4. 内核 API：`reference/03-kernel-api/`
5. 数据库与 AV：`reference/04-database-av/`
6. 块模型：`reference/05-block-model/块模型与属性规范.md`
7. 调试与发布：`reference/06-guides/调试与发布流程.md`
8. 官方全量索引：`reference/07-official-index/官方API全量索引-按模块.md`
9. 路由风险索引：`reference/07-official-index/router路由变更与风险索引.md`

## 目录

- `01-start/`：环境、模板、最小插件骨架、关键概念与数据架构
- `02-plugin-api/`：Plugin 生命周期、方法、事件总线、类型索引
- `03-kernel-api/`：公开 API 导航、非公开 API 风险、弃用迁移、调用示例
- `04-database-av/`：属性视图（数据库）增删改查、实战示例、SQL 结构详解
- `05-block-model/`：块类型、块属性、映射详表与实践限制
- `06-guides/`：siyuan-sdk 边界、调试、发布、版本策略
- `07-official-index/`：官方 API 全量索引与路由风险索引

## 文档使用约定

每篇核心文档都包含固定字段：

- 适用版本
- 官方仓库同步到
- 最后核对日期
- 稳定性（stable/internal/deprecated）
- 权威来源链接

## 快速入口

- 入门与总结（含速查+完整）：`reference/01-start/插件开发入门与工程实践.md`
- 关键概念与数据架构速览：`reference/01-start/关键概念与数据架构速览.md`
- 官方 API 全量索引：`reference/07-official-index/官方API全量索引-按模块.md`
- router 风险索引：`reference/07-official-index/router路由变更与风险索引.md`
