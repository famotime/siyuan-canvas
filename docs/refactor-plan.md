# 重构计划

## 1. 项目快照

- 生成日期：2026-04-11
- 范围：`src/index.ts`、`src/main.ts`、`src/App.vue`、`src/api.ts`、`src/canvas/**`、`src/components/canvas/**`、`tests/**`
- 目标：在不改变当前画布编辑行为的前提下，降低编辑器组合层和工作区视图层的复杂度，补齐生命周期与集成测试边界，并为后续功能迭代建立稳定模块边界
- 文档刷新目标：`docs/project-structure.md`、`README.md`
- 基线验证：
  - [x] `pnpm test`（2026-04-11，16/16 文件通过，90/90 用例通过）
- 当前仓库状态：
  - `docs/project-structure.md` 尚不存在，获批范围完成后需要新增
  - 当前工作区无待处理的未提交改动

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 插件入口与挂载 | `src/index.ts`、`src/main.ts`、`src/App.vue` | 负责插件启动、Tab 注册、设置面板、Vue 挂载与主题同步 | `src/index.ts` 同时承担平台探测、命令注册、设置持久化、Tab 生命周期；`src/main.ts` 还夹带主题同步逻辑，入口边界偏厚 | 有 `tests/canvas-theme-sync.test.ts`，但缺少插件生命周期、设置面板、最近文件持久化测试 |
| 编辑器组合层 | `src/canvas/use-canvas-editor.ts` | 聚合文件读写、状态管理、节点/边编辑、拖拽、缩放、快捷键、最近文件、冲突处理、文件节点解析 | 单文件约 1341 行，职责覆盖“文件生命周期 + 交互手势 + 视图状态 + 业务动作”；公共返回面过宽，内部隐式不变式较多，重构难度和回归风险最高 | 通过 `tests/canvas-selection-toolbar.test.ts`、`tests/canvas-workspace.test.ts` 间接覆盖，但缺少针对组合层动作编排的直接测试 |
| 工作区视图层 | `src/components/canvas/CanvasWorkspace.vue` | 渲染工具栏、舞台、节点、边、悬浮工具栏、侧边检查器，并处理局部 DOM 行为 | 单文件约 2110 行，模板、交互辅助函数、主题观察、样式全部集中；表现层与控制层边界弱，维护成本高 | `tests/canvas-workspace.test.ts` 覆盖较多 UI 行为，但缺少子组件级隔离测试 |
| 纯文档与几何逻辑 | `src/canvas/document.ts`、`src/canvas/node-interaction.ts`、`src/canvas/selection-toolbar.ts`、`src/canvas/viewport.ts`、`src/canvas/board.ts` | 负责文档 CRUD、布局计算、分组边界、连接锚点、视口与工具栏几何计算 | `document.ts` 同时承载 CRUD、布局、分组、边界推导，仍可继续拆分；但整体已偏纯函数，边界相对清晰 | 覆盖强，`tests/canvas-document.test.ts`、`tests/canvas-selection-toolbar.test.ts`、`tests/canvas-node-interaction.test.ts`、`tests/canvas-viewport.test.ts`、`tests/canvas-board.test.ts` 已覆盖核心行为 |
| 文件解析与预览链路 | `src/canvas/file-service.ts`、`src/canvas/siyuan-text-gateway.ts`、`src/canvas/file-node-resolution.ts`、`src/canvas/file-node-preview.ts`、`src/canvas/format.ts`、`src/canvas/markdown-preview.ts` | 负责 `.canvas` 解析/序列化、SiYuan 文本网关、文件节点解析与预览生成 | 单模块体量不大，但组合层直接拼接太多依赖；预览与解析策略分散在组合层周围 | 单元测试较完整，缺口主要在“组合层如何调用这些服务”的集成场景 |
| 插件数据与本地化 | `src/canvas/plugin-data.ts`、`src/i18n/canvas.ts`、`src/types/**` | 插件设置、最近文件、翻译和类型边界 | 风险较低，问题主要是被厚组合层直接耦合，缺少更明确的应用服务边界 | `tests/canvas-plugin-data.test.ts`、`tests/canvas-i18n.test.ts` 已提供基础覆盖 |
| SiYuan API 适配 | `src/api.ts` | 提供模板继承下来的大量 API 包装，并包含当前画布真正使用的文档/资源解析查询 | 文件体量大、风格与仓库其他文件不一致、导出面远超当前插件使用范围；当前画布只依赖少量函数，认知负担偏高 | 目前无直接测试；若重构需先提取纯辅助函数并补测试 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | P0 | 拆分编辑器组合层 | `src/canvas/use-canvas-editor.ts`，计划新增 `src/canvas/editor-*` 或 `src/canvas/use-*` 子模块，必要时同步调整 `tests/canvas-selection-toolbar.test.ts`、`tests/canvas-workspace.test.ts` | 将“文件生命周期/最近文件/冲突处理”“节点与边动作”“视口与手势”“文件节点元数据刷新”拆成明确子模块，保留 `CanvasWorkspace` 当前对外行为与返回绑定契约 | 高 | - [x] 补充组合层直测，覆盖 `new/open/import/save/export/conflict/recentFiles` 基本流程；- [x] 定向执行 `pnpm test -- tests/canvas-selection-toolbar.test.ts`; - [x] 定向执行 `pnpm test -- tests/canvas-workspace.test.ts`; - [x] 定向执行 `pnpm test -- tests/canvas-editor-state.test.ts tests/canvas-file-service.test.ts` | `docs/project-structure.md`：新增编辑器子模块结构；`README.md`：如开发结构说明发生变化则更新 | done |
| RF-002 | P1 | 拆分工作区视图层 | `src/components/canvas/CanvasWorkspace.vue`，计划新增 `src/components/canvas/*` 子组件或提取共享显示辅助模块，必要时同步调整 `tests/canvas-workspace.test.ts` | 将工具栏、舞台节点层、浮动选择工具栏、检查器面板从超大单文件中抽离，保留现有 DOM 行为、主题同步和关键测试钩子 | 中高 | - [x] 定向执行 `pnpm test -- tests/canvas-workspace.test.ts`; - [x] 定向执行 `pnpm test -- tests/canvas-selection-toolbar.test.ts`; - [x] 先补充子组件/显示辅助测试，覆盖颜色映射、内联编辑和选择工具栏显隐 | `docs/project-structure.md`：补充组件层级与职责；`README.md`：一般无需改用户能力描述，若开发结构说明新增则更新 | done |
| RF-003 | P1 | 精简插件入口与设置/Tab 生命周期 | `src/index.ts`、`src/main.ts`、`src/App.vue`，计划新增入口辅助模块；必要时新增 `tests/canvas-plugin-lifecycle.test.ts` | 将平台探测、Tab 注册、设置 UI 构建、最近文件持久化与 Vue 挂载主题同步拆开，入口仅保留插件生命周期编排 | 中 | - [x] 新增入口直测，覆盖 `openCanvasTab`、设置默认值、最近文件记录上限、主题绑定清理；- [x] 定向执行 `pnpm test -- tests/canvas-theme-sync.test.ts`; - [x] 定向执行 `pnpm test -- tests/canvas-plugin-data.test.ts` | `docs/project-structure.md`：补充插件入口职责图；`README.md`：同步开发说明与配置入口 | done |
| RF-004 | P2 | 缩小 SiYuan API 适配暴露面 | `src/api.ts`，计划提取仅供画布使用的查询辅助模块并补测试 | 把当前插件真正使用的文档/资源解析逻辑从通用模板 API 中剥离，降低 `use-canvas-editor.ts` 对超大 API 文件的直接耦合 | 中 | - [x] 先为路径候选与查询辅助逻辑补充纯函数测试；- [x] 再定向执行 `pnpm test -- tests/canvas-file-node-resolution.test.ts tests/canvas-workspace.test.ts` | `docs/project-structure.md`：补充 API 边界；`README.md`：通常无需变更 | done |

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
| BASELINE | 2026-04-11 | 2026-04-11 | `pnpm test` | pass | 无 | 16/16 文件通过，90/90 用例通过 |
| RF-001 | 2026-04-11 | 2026-04-11 | `pnpm test -- tests/canvas-use-editor-actions.test.ts`; `pnpm test -- tests/canvas-selection-toolbar.test.ts`; `pnpm test -- tests/canvas-workspace.test.ts tests/canvas-editor-state.test.ts tests/canvas-file-service.test.ts`; `pnpm test` | pass | `docs/refactor-plan.md` | 新增 `tests/canvas-use-editor-actions.test.ts`；拆出 `use-canvas-editor-file-actions.ts`、`use-canvas-editor-file-nodes.ts`、`use-canvas-editor-gestures.ts`、`use-canvas-editor-shared.ts` |
| RF-002 | 2026-04-11 | 2026-04-11 | `pnpm test -- tests/canvas-workspace-display.test.ts`; `pnpm test -- tests/canvas-workspace.test.ts`; `pnpm test -- tests/canvas-selection-toolbar.test.ts`; `pnpm test` | pass | `docs/refactor-plan.md` | 新增 `canvas-workspace-display.ts`、`canvas-selection-toolbar-icon.ts`、`use-canvas-workspace-behavior.ts` 与 `tests/canvas-workspace-display.test.ts`，将视图显示与悬浮工具栏行为从 `CanvasWorkspace.vue` 中拆出 |
| RF-003 | 2026-04-11 | 2026-04-11 | `pnpm test -- tests/canvas-plugin-lifecycle.test.ts`; `pnpm test -- tests/canvas-theme-sync.test.ts`; `pnpm test -- tests/canvas-plugin-data.test.ts`; `pnpm test` | pass | `docs/refactor-plan.md` | 新增 `canvas-plugin-lifecycle.test.ts`；拆出 `plugin-runtime.ts`、`plugin-settings-panel.ts`、`plugin-tabs.ts`，将 `src/index.ts` 精简为生命周期编排层 |
| RF-004 | 2026-04-11 | 2026-04-11 | `pnpm test -- tests/canvas-siyuan-file-node-lookups.test.ts`; `pnpm test -- tests/canvas-file-node-resolution.test.ts tests/canvas-workspace.test.ts`; `pnpm test -- tests/canvas-selection-toolbar.test.ts tests/canvas-use-editor-actions.test.ts`; `pnpm test` | pass | `docs/refactor-plan.md`、`docs/project-structure.md`、`README.md` | 新增 `siyuan-file-node-lookups.ts`、`siyuan-kernel-file-node-lookups.ts` 与 `tests/canvas-siyuan-file-node-lookups.test.ts`；`src/api.ts` 改为兼容层并委托画布专用 lookup 模块 |

## 5. 决策与确认

- 用户批准的条目：`RF-001`、`RF-002`、`RF-003`、`RF-004`（2026-04-11）
- 延后的条目：无
- 阻塞条目及原因：
- 建议执行顺序：`RF-001` -> `RF-002` -> `RF-003` -> `RF-004`
- 建议首批批准范围：至少先批准 `RF-001`；如果希望一次完成主干结构整理，可一并批准 `RF-002` 与 `RF-003`

## 6. 文档刷新

- `docs/project-structure.md`：
  - 已新增并同步当前模块结构、文件清单与职责映射
- `README.md`：
  - 已同步开发结构说明、命令与项目结构入口说明
- 最终同步检查：
  - `docs/project-structure.md` 已反映重构后的入口层、编辑器组合层、工作区视图层与 SiYuan lookup 边界
  - `README.md` 已补充 `pnpm dev` 与当前项目结构说明
  - 最终验证已执行 `pnpm test` 与 `pnpm build`

## 7. 下一步

1. 如需继续发布流程，可在当前结构基础上执行 `pnpm build`、打包插件并进行发布前检查。
2. 若后续继续收缩模板遗留的 `src/api.ts` 兼容面，可独立立项，不必再牵动画布主流程模块。
3. 后续新增画布能力时，优先在现有分层上扩展对应 helper/composable，而不是回填到单个大文件。
