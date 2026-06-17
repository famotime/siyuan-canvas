# 重构计划

## 1. 项目快照

- 生成日期：2026-06-17
- 范围：`D:\MyCodingProjects\siyuan-canvas`
- 目标：在不改变 JSON Canvas 行为、SiYuan 插件生命周期和现有 UI 交互的前提下，继续拆分高耦合模块，提高可测性与后续维护效率。
- 文档刷新目标：`docs/project-structure.md`、`README.md`
- 当前仓库状态：开始分析时 `git status --short` 无输出，工作区干净。
- 基线验证：`pnpm test` 通过，47 个测试文件、499 个测试用例全部通过。

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 插件入口与生命周期 | `src/index.ts`、`src/main.ts`、`src/canvas/plugin-runtime.ts`、`src/canvas/plugin-tabs.ts`、`src/canvas/plugin-settings-panel.ts` | 插件启动、命令注册、设置面板、标签页挂载、最近文件持久化、嵌入画布命令 | `src/index.ts` 仍包含嵌入画布命令的路径归一化、目标文档解析、调试日志与 UI 提示；生命周期职责与命令业务职责混在同一个类中 | `tests/canvas-plugin-lifecycle.test.ts` 覆盖插件加载、命令注册、设置、最近文件、嵌入命令主流程；缺少面向路径归一化与目标文档解析的纯函数级测试 |
| 编辑器组合入口 | `src/canvas/use-canvas-editor.ts` 及 `use-canvas-editor-*` 子模块 | 聚合状态、视口、选择、文件操作、节点/边动作、手势、快捷键、搜索、演示模式 | 主文件约 1535 行，仍承担大量 computed、UI 状态和动作编排；部分行为虽已委托，但返回对象和依赖注入面较大，继续扩展时容易回归 | `tests/canvas-use-editor-actions.test.ts`、`tests/canvas-editor-*.test.ts` 覆盖广；重构前需补充即将抽取部分的定向测试，避免只依赖大型组合测试 |
| 工作区文档树 | `src/canvas/use-canvas-editor-workspace-tree.ts`、`src/components/canvas/CanvasWorkspaceTree.vue` | 读取目录树、排序、展开折叠、创建/删除/复制/重命名/移动文件夹与画布文件 | 文件约 528 行，纯目录树算法、SiYuan 文件 API 调用、确认/输入弹窗、英文硬编码提示混在同一 factory；部分测试以注释说明由集成测试覆盖，单测对创建、删除、重命名路径不足 | `tests/canvas-editor-workspace-tree.test.ts` 覆盖读取、排序、展开折叠、移动与最近文件；创建/删除/重命名仍有测试缺口 |
| UI 工作区壳层 | `src/components/canvas/CanvasWorkspace.vue`、`src/components/canvas/canvas-workspace.scss`、`CanvasFileCard.vue`、`CanvasCreateEdgeDialog.vue`、`CanvasInspector.vue` | 主画布视图、工具栏、舞台、上下文菜单、文件选择器、PNG 导出、检查器联动 | `CanvasWorkspace.vue` 约 2756 行，样式约 2351 行；模板和本地交互状态复杂，继续加功能时认知成本高 | `tests/canvas-workspace.test.ts`、`tests/canvas-file-card.test.ts`、`tests/canvas-create-edge-dialog.test.ts` 覆盖关键交互；如拆分 UI，需要补充子组件行为测试 |
| 文档与格式核心 | `src/canvas/document.ts`、`document-layout.ts`、`document-group.ts`、`format.ts`、`canvas-history.ts` | JSON Canvas 解析、校验、序列化、节点/边 CRUD、布局、分组、历史 | 已经拆分较清晰；当前不是最高价值重构点 | `tests/canvas-document*.test.ts`、`tests/canvas-format.test.ts`、`tests/canvas-history.test.ts` 覆盖较好 |
| 文件节点与预览 | `src/canvas/file-target-resolution.ts`、`file-target-preview.ts`、`file-preview-fallbacks.ts`、`file-node-*` | 文件目标解析、预览、兼容旧 file-node API | 主链路已清晰，遗留兼容适配层需要保持稳定，不适合本轮优先改动 | `tests/canvas-file-*.test.ts` 覆盖较完整 |
| 类型与边界 | `src/canvas/types.ts`、`src/types/*`、`src/canvas/use-canvas-editor-shared.ts` | Canvas 类型、SiYuan ambient typings、插件 bridge 类型 | bridge 类型随着编辑器拆分增长，后续抽模块时需要同步收窄依赖 | 多数通过调用方测试间接覆盖 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | P0 | 工作区文档树操作拆分 | `src/canvas/use-canvas-editor-workspace-tree.ts`、`src/canvas/workspace-tree-core.ts`、`tests/canvas-editor-workspace-tree.test.ts`、`tests/canvas-workspace-tree-core.test.ts` | 将目录树读取、排序、路径/文件名处理、递归收集等纯逻辑从 UI 弹窗与 SiYuan 文件 API 操作中拆出；保留原 factory 对外 API 不变 | 中 | - [x] 读取空目录、嵌套目录、非 `.canvas` 文件过滤；- [x] 按名称、更新时间、创建时间排序且文件夹优先；- [x] 收集文件夹路径与画布文件路径；- [x] 移动前同目录与同名冲突由原测试保持覆盖；- [x] 重命名/复制的文件名清洗与 `.canvas` 后缀处理 | `docs/project-structure.md`：新增纯 workspace tree 模块职责；`README.md`：项目结构描述更新 | done |
| RF-002 | P0 | 嵌入画布命令从插件入口抽离 | `src/index.ts`、`src/canvas/canvas-embed-command.ts`、`tests/canvas-plugin-lifecycle.test.ts`、`tests/canvas-embed-command.test.ts` | 把嵌入画布命令的路径归一化、工作区绝对路径转换、目标文档解析、文件读取与插入流程从插件类中抽出；插件入口只负责注册命令和传入依赖 | 中高 | - [x] 输入为空、带引号路径、工作区绝对路径转换；- [x] 指定 protyle、最后活跃 protyle、编辑器列表、DOM fallback 的目标文档解析顺序；- [x] 读文件失败、无目标文档、插入失败时提示不变；- [x] debug 开关通过入口注入保持原行为 | `docs/project-structure.md`：入口职责更薄，新增嵌入命令模块；`README.md`：项目结构描述更新 | done |
| RF-003 | P1 | 编辑器选择与浮层编排收窄 | `src/canvas/use-canvas-editor.ts`、`src/canvas/use-canvas-editor-selection-ui.ts`、`tests/canvas-use-editor-actions.test.ts`、`tests/canvas-editor-selection-ui.test.ts` | 抽出 selection toolbar、edge toolbar、popover、尺寸更新与位置计算编排，降低 `use-canvas-editor.ts` 文件长度和返回对象局部复杂度 | 中高 | - [x] 多选节点时选择工具栏位置与尺寸更新；- [x] 选中边时边工具栏位置、端点手柄、标签编辑器位置不变；- [x] 关闭颜色/布局/方向 popover 行为不变；- [x] 演示模式或只读状态下相关交互由原组合测试保持覆盖 | `docs/project-structure.md`：记录 selection UI composable；`README.md`：项目结构描述可能更新 | done |
| RF-004 | P1 | `CanvasWorkspace.vue` 本地交互状态拆分 | `src/components/canvas/CanvasWorkspace.vue`、`src/components/canvas/use-canvas-workspace-context-menu.ts`、`tests/canvas-workspace-context-menu.test.ts`、`tests/canvas-workspace.test.ts` | 把上下文菜单本地 UI 状态拆为小 composable，模板接口保持不变 | 中 | - [x] 右键菜单打开、关闭、重命名、复制、删除分派正确；- [x] 文件路径复制归一化；- [x] 现有 CanvasWorkspace 交互测试保持通过 | `docs/project-structure.md`：新增 UI composable；`README.md`：项目结构描述可能更新 | done |
| RF-005 | P2 | 文案与依赖边界一致性清理 | `src/canvas/use-canvas-editor-workspace-tree.ts`、`src/i18n/canvas.ts`、`src/i18n/*.json`、相关测试 | 梳理工作区树中硬编码英文提示，改为注入或 i18n key；减少模块直接依赖弹窗实现 | 低中 | - [x] 创建/删除/重命名/移动提示文案仍能显示；- [x] 中英文 i18n key 完整；- [x] 现有 UI 测试不因文案缺失失败 | `docs/project-structure.md`：说明文案边界；`README.md`：项目结构描述更新 | done |

优先级说明：
- `P0`：价值和风险都最高，优先执行。
- `P1`：价值或风险中等，放在 `P0` 之后。
- `P2`：低风险清理项，最后执行。

状态说明：
- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| BASELINE | 2026-06-17 | 2026-06-17 | `pnpm test` | pass：47 个测试文件、499 个测试用例通过 | 无 | 重构前基线验证 |
| RF-001 | 2026-06-17 | 2026-06-17 | `pnpm test -- tests/canvas-workspace-tree-core.test.ts tests/canvas-editor-workspace-tree.test.ts`；`pnpm test` | pass：48 个测试文件、505 个测试用例通过 | 待最终刷新 | 新增 `workspace-tree-core.ts` 和 6 个纯函数测试，原 workspace tree factory 委托核心函数 |
| RF-002 | 2026-06-17 | 2026-06-17 | `pnpm test -- tests/canvas-embed-command.test.ts tests/canvas-plugin-lifecycle.test.ts`；`pnpm test` | pass：49 个测试文件、510 个测试用例通过 | 待最终刷新 | 新增 `canvas-embed-command.ts` 和 5 个定向测试，`src/index.ts` 移除嵌入命令内部解析逻辑 |
| RF-003 | 2026-06-17 | 2026-06-17 | `pnpm test -- tests/canvas-editor-selection-ui.test.ts tests/canvas-selection-toolbar.test.ts`；`pnpm test -- tests/canvas-use-editor-actions.test.ts tests/canvas-editor-shortcuts.test.ts`；`pnpm test` | pass：50 个测试文件、512 个测试用例通过 | 待最终刷新 | 新增 `use-canvas-editor-selection-ui.ts` 和 2 个定向测试，主编辑器委托 toolbar/popover 计算 |
| RF-004 | 2026-06-17 | 2026-06-17 | `pnpm test -- tests/canvas-workspace-context-menu.test.ts tests/canvas-workspace.test.ts`；`pnpm test` | pass：51 个测试文件、515 个测试用例通过 | 待最终刷新 | 新增 `use-canvas-workspace-context-menu.ts` 和 3 个定向测试，`CanvasWorkspace.vue` 委托上下文菜单状态 |
| RF-005 | 2026-06-17 | 2026-06-17 | `pnpm test -- tests/canvas-editor-workspace-tree.test.ts tests/canvas-i18n.test.ts`；`pnpm test` | pass：51 个测试文件、516 个测试用例通过 | 待最终刷新 | Workspace tree 支持 labels/prompt/confirm 注入，主编辑器传入 i18n 文案，新增中英文 workspace 文案 key |

## 5. 决策与确认

- 用户批准的条目：RF-001、RF-002、RF-003、RF-004、RF-005。
- 延后的条目：无。
- 阻塞条目及原因：暂无。
- 建议执行顺序：先执行 `RF-001`，因为它的纯逻辑边界最清晰、现有测试最集中，能先降低工作区树后续改动风险；随后执行 `RF-002`，继续收窄插件入口职责；`RF-003` 和 `RF-004` 适合在前两项稳定后分批执行；`RF-005` 可在工作区树结构稳定后作为清理项处理。

## 6. 文档刷新

- `docs/project-structure.md`：已刷新，新增 `workspace-tree-core.ts`、`canvas-embed-command.ts`、`use-canvas-editor-selection-ui.ts`、`use-canvas-workspace-context-menu.ts` 及对应测试说明。
- `README.md`：已刷新 Project structure 小节，用户可见能力描述保持不变，仅更新内部模块结构。
- 最终同步检查：2026-06-17 完成，最终验证命令为 `pnpm test`。

## 7. 下一步

1. 如需发布，按常规流程执行 `pnpm build` 或 release 脚本。
2. 如需提交，建议提交信息：`refactor: 拆分工作区树与画布嵌入命令边界`。
3. 后续可继续拆分 `CanvasWorkspace.vue` 的文件选择器键盘导航与颜色主题弹层状态。
