# 重构计划

## 1. 项目快照

- 生成日期：2026-04-14
- 范围：`siyuan-canvas` 编辑器编排层、工作区视图层、文件预览解析链路
- 目标：在不改变现有行为的前提下，降低 `use-canvas-editor.ts` 与 `CanvasWorkspace.vue` 的编排复杂度，收敛重复的文件预览模型，给后续功能迭代提供更稳定的模块边界
- 文档刷新目标：`docs/project-structure.md`、`README.md`
- 当前基线：`pnpm test` 通过（23 个测试文件，189 个测试通过）

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 插件入口与宿主桥接 | `src/index.ts`、`src/main.ts`、`src/App.vue` | 插件生命周期、页签挂载、主题同步、把 bootstrap 注入工作区 | 入口本身较薄，风险较低；当前主要受下游 editor/workspace 大模块牵制 | `tests/canvas-plugin-lifecycle.test.ts`、`tests/canvas-theme-sync.test.ts` |
| 编辑器主编排层 | `src/canvas/use-canvas-editor.ts` | 聚合状态、计算属性、节点/边操作、文件动作、键盘快捷键、挂载生命周期、文件选择器、节点激活 | 单文件约 42 KB，职责横跨状态、视图模型、插件桥、事件处理；新增行为时容易继续堆叠在同一入口，回归面大 | `tests/canvas-use-editor-actions.test.ts`、`tests/canvas-editor-gestures.test.ts`、`tests/canvas-editor-bindings.test.ts` |
| 文件动作与节点元数据 | `src/canvas/use-canvas-editor-file-actions.ts`、`src/canvas/use-canvas-editor-file-nodes.ts`、`src/canvas/file-target-resolution.ts`、`src/canvas/file-target-preview.ts` | 工作区/本地文件打开保存、冲突处理、文件节点解析、文档/图片/子画布预览 | `file-node-*` 与 `file-target-*` 两套模型并存，职责边界容易混淆；预览、解析、图片路径兜底分散在多处 | `tests/canvas-file-target-resolution.test.ts`、`tests/canvas-file-target-preview.test.ts`、`tests/canvas-file-node-resolution.test.ts`、`tests/canvas-use-editor-actions.test.ts` |
| 几何与手势层 | `src/canvas/use-canvas-editor-gestures.ts`、`src/canvas/document.ts`、`src/canvas/selection-toolbar.ts`、`src/canvas/node-interaction.ts` | 拖拽、缩放、框选、连线、边端点重连、纯文档变换 | 纯函数基础较好，但上层编排层仍直接拼装太多行为，导致边界未完全释放 | `tests/canvas-editor-gestures.test.ts`、`tests/canvas-selection-toolbar.test.ts`、`tests/canvas-node-interaction.test.ts`、`tests/canvas-document.test.ts` |
| 工作区视图层 | `src/components/canvas/CanvasWorkspace.vue`、`src/components/canvas/use-canvas-workspace-behavior.ts`、`src/components/canvas/canvas-workspace-display.ts` | 渲染工具栏、节点、边、文件卡片、预览、选择工具条、Inspector、对话框 | 单文件约 94 KB；模板、样式、文件卡片预览逻辑、图片回退、对话框和工具条全部堆在一个 SFC 中，可读性和可测试性都在下降 | `tests/canvas-workspace.test.ts`、`tests/canvas-workspace-display.test.ts` |
| 文档与测试资产 | `docs/project-structure.md`、`README.md`、`tests/*.test.ts` | 结构说明、用户能力说明、回归保护 | 文档目前能描述现状，但一旦做结构调整需要同步刷新；大型集成测试已经是主保护网，适合在重构前继续加固 | 全量 `pnpm test` |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | P0 | 拆分编辑器主编排层 | `src/canvas/use-canvas-editor.ts`，以及新增/调整 `src/canvas/use-canvas-editor-*.ts` 辅助模块、相关 tests | 把文件选择与节点激活、节点/边编辑命令、生命周期与快捷键等职责从 `use-canvas-editor.ts` 中继续拆出，令主入口只保留装配与绑定 | 高 | - [x] `pnpm test -- tests/canvas-use-editor-actions.test.ts` 保护打开/保存/最近文件/文件节点行为；- [x] `pnpm test -- tests/canvas-editor-gestures.test.ts` 保护手势；- [x] `pnpm test -- tests/canvas-editor-bindings.test.ts` 保护返回接口；- [x] `pnpm test` 验证全量回归 | `docs/project-structure.md` 需要更新 editor 编排分层；`README.md` 需要更新项目结构说明 | done |
| RF-002 | P0 | 拆分工作区视图层 | `src/components/canvas/CanvasWorkspace.vue`、`src/components/canvas/CanvasFileCard.vue`、`src/components/canvas/CanvasCreateEdgeDialog.vue`、相关 tests | 把文件卡片预览、创建连线对话框、底部工具栏或 Inspector 等高耦合视图片区块拆成更小组件，缩减单一 SFC 的模板和状态耦合 | 高 | - [x] `corepack pnpm test -- tests/canvas-file-card.test.ts` 覆盖 file card 渲染与图片回退事件；- [x] `corepack pnpm test -- tests/canvas-create-edge-dialog.test.ts` 覆盖 dialog 渲染与节点选择；- [x] `corepack pnpm test -- tests/canvas-workspace.test.ts`; - [x] `corepack pnpm test` | `docs/project-structure.md` 已更新组件树与职责映射；`README.md` 已更新 UI 分层说明 | done |
| RF-003 | P1 | 收敛文件预览解析模型 | `src/canvas/file-node-resolution.ts`、`src/canvas/file-node-preview.ts`、`src/canvas/file-target-resolution.ts`、`src/canvas/file-target-preview.ts`、`src/canvas/use-canvas-editor-file-nodes.ts`、相关 tests | 合并或明确 `file-node-*` 与 `file-target-*` 两套模型的边界，减少重复 badge/detail/imageSrc 组装逻辑，为后续 file node 行为扩展提供单一数据通路 | 中 | - [x] `corepack pnpm test -- tests/canvas-file-node-resolution.test.ts`; - [x] `corepack pnpm test -- tests/canvas-file-node-preview.test.ts tests/canvas-file-target-resolution.test.ts tests/canvas-file-target-preview.test.ts`; - [x] `corepack pnpm test -- tests/canvas-use-editor-actions.test.ts tests/canvas-workspace.test.ts`; - [x] `corepack pnpm test` | `docs/project-structure.md` 已更新 file preview/resolution 链路；`README.md` 已同步结构说明 | done |
| RF-004 | P2 | 提炼共享预览图片与 HTML 兜底逻辑 | `src/components/canvas/CanvasWorkspace.vue`、`src/canvas/file-preview-fallbacks.ts`、相关 tests | 把 file card 图片路径候选与 document preview 图片回退逻辑抽成可复用 helper，减少 UI 内联字符串替换与状态散落 | 中 | - [x] `corepack pnpm test -- tests/canvas-file-preview-fallbacks.test.ts`; - [x] `corepack pnpm test -- tests/canvas-workspace.test.ts tests/canvas-markdown-preview.test.ts`; - [x] `corepack pnpm test` | `docs/project-structure.md` 已补充预览辅助模块；`README.md` 已同步结构说明 | done |

优先级说明：
- `P0`：价值和风险都最高，优先执行
- `P1`：价值或风险中等，放在 `P0` 之后
- `P2`：低风险清理项，最后执行

状态说明：
- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| BASELINE | 2026-04-14 | 2026-04-14 | `pnpm test` | pass | 未开始 | 23 个测试文件，189 个测试通过，作为重构前基线 |
| RF-001 | 2026-04-14 | 2026-04-14 | `pnpm test -- tests/canvas-editor-shortcuts.test.ts`; `pnpm test -- tests/canvas-use-editor-actions.test.ts`; `pnpm test -- tests/canvas-selection-toolbar.test.ts`; `pnpm test -- tests/canvas-editor-gestures.test.ts`; `pnpm test -- tests/canvas-editor-bindings.test.ts`; `pnpm test` | pass | `docs/project-structure.md`、`README.md` | 新增 `use-canvas-editor-shortcuts.ts`、`use-canvas-editor-file-picker.ts`、`use-canvas-editor-node-activation.ts`、`use-canvas-editor-node-edge-actions.ts`、`use-canvas-editor-lifecycle.ts`；`use-canvas-editor.ts` 从 42148 B 缩减到 27323 B |
| RF-002 | 2026-04-14 | 2026-04-15 | `corepack pnpm test -- tests/canvas-file-card.test.ts`; `corepack pnpm test -- tests/canvas-create-edge-dialog.test.ts`; `corepack pnpm test -- tests/canvas-workspace.test.ts`; `corepack pnpm test` | pass | `docs/project-structure.md`、`README.md` | 新增 `CanvasFileCard.vue`、`CanvasCreateEdgeDialog.vue`；`CanvasWorkspace.vue` 去除了 file card 与 create-edge dialog 的内联模板与窗口级 picker 状态 |
| RF-003 | 2026-04-15 | 2026-04-15 | `corepack pnpm test -- tests/canvas-file-node-resolution.test.ts`; `corepack pnpm test -- tests/canvas-file-node-preview.test.ts tests/canvas-file-target-resolution.test.ts tests/canvas-file-target-preview.test.ts`; `corepack pnpm test -- tests/canvas-use-editor-actions.test.ts tests/canvas-workspace.test.ts`; `corepack pnpm test` | pass | `docs/project-structure.md`、`README.md` | `file-node-resolution.ts` 改为委托 `file-target-resolution.ts`，保留兼容返回形状；补齐 legacy resolver 对直链图片路径的回归保护 |
| RF-004 | 2026-04-15 | 2026-04-15 | `corepack pnpm test -- tests/canvas-file-preview-fallbacks.test.ts`; `corepack pnpm test -- tests/canvas-workspace.test.ts tests/canvas-markdown-preview.test.ts`; `corepack pnpm test` | pass | `docs/project-structure.md`、`README.md` | 新增 `file-preview-fallbacks.ts`，提取 file card 图片候选与预览 HTML 图片回退 helper，`CanvasWorkspace.vue` 只保留状态装配 |

## 5. 决策与确认

- 用户批准的条目：`RF-001`、`RF-002`、`RF-003`、`RF-004`（2026-04-14，用户要求“根据 docs\\refactor-plan.md 逐个执行重构计划”）
- 延后的条目：无
- 阻塞条目及原因：无

## 6. 文档刷新

- `docs/project-structure.md`：已刷新，补充工作区子组件、文件预览解析边界和预览 fallback helper
- `README.md`：已刷新，纠正当前交互模型与 UI 分层说明
- 最终同步检查：已完成

## 7. 下一步

1. 已完成 `RF-001` 到 `RF-004` 的计划条目
2. 如需继续压缩工作区复杂度，可在后续轮次考虑拆分 inspector 区块与 floating toolbar
3. 后续新增 file preview 能力时，优先沿用 `file-target-*` 与 `file-preview-fallbacks.ts` 的单一路径
