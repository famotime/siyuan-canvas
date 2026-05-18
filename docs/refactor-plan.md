# 重构计划

## 1. 项目快照

- 生成日期：2026-05-18
- 范围：`siyuan-canvas` 当前编辑器编排层、工作区视图层、图标注册、文档变换与工作区文档树
- 目标：在不改变现有用户行为的前提下，继续压缩大文件职责，稳定可测试边界，降低后续功能迭代对 `CanvasWorkspace.vue` 和 `use-canvas-editor.ts` 的耦合
- 文档刷新目标：`docs/project-structure.md`、`README.md`
- 当前基线：`pnpm test` 通过（36 个测试文件，275 个测试通过）
- 工作区注意事项：开始分析时 `AGENTS.md` 已存在未提交改动，本计划不触碰该文件；实施阶段如出现与获批条目无关的新改动，应暂停确认

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 入口与宿主集成 | `src/index.ts`、`src/main.ts`、`src/App.vue` | 插件生命周期、页签挂载、主题同步、根组件注入 | 入口已较薄，当前风险主要来自下游编辑器与工作区组件的返回接口和 UI 组合 | `tests/canvas-plugin-lifecycle.test.ts`、`tests/canvas-theme-sync.test.ts` |
| 编辑器主编排层 | `src/canvas/use-canvas-editor.ts` | 聚合状态、历史栈、视口、工作区文档树、搜索桥接、文件动作、节点/边动作、手势、快捷键和返回给模板的绑定 | 单文件约 1529 行，虽然已拆出多个子模块，但仍同时承担工作区树、搜索 host、历史提交、toolbar 位置和模块装配；返回对象继续膨胀，新增功能容易回流到主入口 | `tests/canvas-use-editor-actions.test.ts`、`tests/canvas-editor-bindings.test.ts`、`tests/canvas-editor-shortcuts.test.ts`、`tests/canvas-search-bridge.test.ts`、`tests/canvas-workspace.test.ts` |
| 工作区视图层 | `src/components/canvas/CanvasWorkspace.vue`、`src/components/canvas/use-canvas-workspace-behavior.ts`、`src/components/canvas/CanvasFileCard.vue`、`src/components/canvas/CanvasCreateEdgeDialog.vue`、`src/components/canvas/CanvasCommandPalette.vue`、`src/components/canvas/CanvasMinimap.vue` | 顶栏、舞台、节点卡片、边、底部工具栏、文件选择器、浮动工具条、PNG 导出、右侧文档树/Inspector、命令面板、样式 | 单文件约 4375 行，模板约 1900 行且样式约 1700 行；文档树、Inspector、PNG 导出、浮动工具条和舞台渲染都在同一 SFC 中，导致局部改动需要理解整页上下文 | `tests/canvas-workspace.test.ts` 是主保护网，另有 `tests/canvas-file-card.test.ts`、`tests/canvas-create-edge-dialog.test.ts`、`tests/canvas-command-palette.test.ts`、`tests/canvas-minimap.test.ts` |
| 工作区文档树与文件管理 | `src/canvas/use-canvas-editor.ts` 中 `WorkspaceTreeNode`、`refreshWorkspaceDocuments`、`createWorkspaceFolder`、`renameWorkspaceDocument`、`moveWorkspaceFile`、`deleteWorkspaceDocument`，以及 `src/api.ts` | 读取默认目录下 `.canvas` 文件，排序、展开折叠、创建文件夹、重命名、删除、拖拽移动 | 领域逻辑混在编辑器主入口，UI 交互状态混在 `CanvasWorkspace.vue`；目前缺少独立的文档树纯逻辑测试，很多行为只能通过大组件测试间接保护 | `tests/canvas-use-editor-actions.test.ts` 覆盖部分列表行为，`tests/canvas-workspace.test.ts` 覆盖部分 UI 呈现与拖拽入口 |
| 搜索桥接与编辑器历史 | `src/canvas/use-canvas-editor.ts`、`src/canvas/search-bridge.ts`、`src/canvas/canvas-history.ts` | 向宿主搜索系统暴露 canvas target、同步 decoration、执行替换、记录 undo/redo 快照 | `search-bridge.ts` 纯函数较清晰，但 host 创建、订阅、提交文档和 reveal 行为仍内联在主入口；历史提交函数与 dirty/validation/search notify 耦合，是高频变更风险点 | `tests/canvas-search-bridge.test.ts`、`tests/canvas-history.test.ts`、`tests/canvas-use-editor-actions.test.ts` |
| 图标系统 | `src/components/canvas/canvas-icon.ts`、`src/components/canvas/canvas-selection-toolbar-icon.ts` | 图标名称联合类型、SVG 字符串注册、stroke-only SVG fill 修正、Vue 渲染组件 | `canvas-icon.ts` 同时包含类型、注册表、SVG 大字典和渲染逻辑；未来继续加图标会扩大 diff 和冲突面，测试目前只覆盖少数回归 | `tests/canvas-icon.test.ts`、`tests/canvas-icon-expand-all.test.ts` |
| 文档变换核心 | `src/canvas/document.ts` | 创建/更新/删除节点边、几何变换、批量布局、颜色、分组 | 单文件约 608 行，纯函数可测性好，但 edge mutation、node mutation、layout/grouping 混在一起；布局 helper 私有且集中，后续布局功能会增加文件复杂度 | `tests/canvas-document.test.ts` 覆盖较完整，适合先补边界测试再拆文件 |
| Markdown 与文件预览链路 | `src/canvas/markdown-preview.ts`、`src/canvas/file-target-preview.ts`、`src/canvas/file-target-resolution.ts`、`src/canvas/file-preview-fallbacks.ts` | Markdown 安全渲染、文件目标解析、文档/图片/子画布预览、图片 fallback | 当前边界比上一轮清晰，但 `markdown-preview.ts` 仍是较大的安全敏感模块；本轮不建议优先重构，除非先补充安全回归用例 | `tests/canvas-markdown-preview.test.ts`、`tests/canvas-file-target-*.test.ts`、`tests/canvas-file-preview-fallbacks.test.ts` |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-101 | P0 | 拆分工作区文档树与文件管理 | `src/canvas/use-canvas-editor.ts`，新增 `src/canvas/use-canvas-editor-workspace-tree.ts` 或等价模块，必要时新增 `tests/canvas-editor-workspace-tree.test.ts` | 把 `WorkspaceTreeNode`、目录读取、排序、展开折叠、创建/重命名/删除/移动等逻辑从主编辑器入口拆出，保留主入口只装配依赖与暴露绑定 | 高 | - [ ] 补/确认工作区树排序按名称、更新时间、创建时间稳定；- [ ] 补/确认嵌套目录展开/折叠、全部展开/收起；- [ ] 补/确认创建文件夹、重命名、删除、拖拽移动后的刷新行为；- [ ] 跑 `pnpm test -- tests/canvas-use-editor-actions.test.ts tests/canvas-workspace.test.ts`；- [ ] 跑 `pnpm test` | `docs/project-structure.md` 需新增工作区树模块职责；`README.md` 需同步项目结构说明 | pending |
| RF-102 | P0 | 拆分 `CanvasWorkspace.vue` 的右侧文档树/Inspector | `src/components/canvas/CanvasWorkspace.vue`，新增 `CanvasWorkspaceSidebar.vue`、`CanvasWorkspaceTree.vue`、`CanvasInspector.vue` 或等价组件，相关 tests | 将右侧文档列表、最近文件、问题/冲突、节点/边 Inspector 从主 SFC 中拆出，减少模板和样式集中度，并保持现有 testid 与交互行为 | 高 | - [ ] 补/确认文档树文件打开、删除、右键重命名、拖拽目标高亮；- [ ] 补/确认 Inspector 折叠区、节点/边字段编辑、问题与冲突区展示；- [ ] 跑 `pnpm test -- tests/canvas-workspace.test.ts`；- [ ] 跑 `pnpm test -- tests/canvas-workspace-display.test.ts tests/canvas-create-edge-dialog.test.ts tests/canvas-file-card.test.ts`；- [ ] 跑 `pnpm test` | `docs/project-structure.md` 需更新 UI 组件树；`README.md` 需同步 UI 分层说明 | pending |
| RF-103 | P1 | 提炼编辑器搜索 host 与历史提交边界 | `src/canvas/use-canvas-editor.ts`、`src/canvas/search-bridge.ts`，新增 `src/canvas/use-canvas-editor-search.ts` 或 `canvas-editor-search-host.ts`，相关 tests | 把 `createCanvasSearchHost`、搜索订阅、decoration 同步、replace/reveal 与 `commitDocument` 的关系从主入口拆出，并明确历史提交、校验、search notify 的单一出口 | 中 | - [ ] 补/确认搜索 reveal 会选中节点并居中；- [ ] 补/确认 replace 触发文档提交、dirty、validation 和 revision 更新；- [ ] 跑 `pnpm test -- tests/canvas-search-bridge.test.ts tests/canvas-use-editor-actions.test.ts`；- [ ] 跑 `pnpm test -- tests/canvas-editor-bindings.test.ts`；- [ ] 跑 `pnpm test` | `docs/project-structure.md` 需新增搜索 host/历史提交边界说明；`README.md` 通常只需结构说明微调 | pending |
| RF-104 | P1 | 拆分 `CanvasWorkspace.vue` 的浮动工具条与 PNG 导出对话框 | `src/components/canvas/CanvasWorkspace.vue`，新增 `CanvasSelectionToolbar.vue`、`CanvasEdgeToolbar.vue`、`CanvasPngExportDialog.vue` 或等价组件，相关 tests | 将选择工具条、边工具条、PNG 导出弹窗从主 SFC 中分离，保留现有事件命名与编辑器 API，不改变视觉和交互 | 中 | - [ ] 补/确认单选/多选工具条按钮、颜色、布局菜单、点击外部关闭；- [ ] 补/确认边工具条方向、颜色、标签编辑和 endpoint handle 行为；- [ ] 补/确认 PNG 导出范围、背景色、取消/确认；- [ ] 跑 `pnpm test -- tests/canvas-workspace.test.ts tests/canvas-selection-toolbar.test.ts tests/canvas-png-export.test.ts`；- [ ] 跑 `pnpm test` | `docs/project-structure.md` 需更新 UI 组件职责；`README.md` 需同步结构说明 | pending |
| RF-105 | P1 | 拆分文档变换核心 | `src/canvas/document.ts`，新增 `src/canvas/document-layout.ts`、`src/canvas/document-group.ts` 或等价模块，相关 tests | 将布局/分组 helper 与基础节点边 mutation 分层，保持公共 API 兼容或通过 barrel 继续从 `document.ts` 导出 | 中 | - [ ] 补/确认空选择、重复/缺失 ID、group 节点参与布局的边界；- [ ] 补/确认分组 padding 和 enclosed node 查找；- [ ] 跑 `pnpm test -- tests/canvas-document.test.ts`；- [ ] 跑 `pnpm test -- tests/canvas-selection-toolbar.test.ts tests/canvas-use-editor-actions.test.ts`；- [ ] 跑 `pnpm test` | `docs/project-structure.md` 需更新文档变换模块拆分；`README.md` 通常只需结构说明微调 | pending |
| RF-106 | P2 | 拆分图标注册表 | `src/components/canvas/canvas-icon.ts`，新增 `src/components/canvas/canvas-icon-registry.ts` 或等价模块，相关 tests | 将图标名称、SVG 字典、SVG harden helper、Vue 组件渲染拆开，降低新增图标时触碰渲染逻辑的概率 | 低 | - [ ] 补/确认所有导出的图标名均有 markup；- [ ] 补/确认未知图标回退到 help；- [ ] 跑 `pnpm test -- tests/canvas-icon.test.ts tests/canvas-icon-expand-all.test.ts`；- [ ] 跑 `pnpm test` | `docs/project-structure.md` 可补充图标 registry；`README.md` 通常无需用户可见更新，仅结构说明微调 | pending |
| RF-107 | P2 | 梳理 Markdown 预览安全渲染边界 | `src/canvas/markdown-preview.ts`，可能新增 `src/canvas/markdown-sanitize.ts`，相关 tests | 在不改变渲染输出的前提下，把 sanitize、inline render、block render 拆出；该项安全敏感，必须先增加 XSS/允许样式白名单回归用例 | 中 | - [ ] 补/确认危险 HTML、事件属性、未知 style 属性仍被转义/移除；- [ ] 补/确认允许的 `font/span` 颜色样式继续保留；- [ ] 跑 `pnpm test -- tests/canvas-markdown-preview.test.ts tests/canvas-file-target-preview.test.ts tests/canvas-use-editor-actions.test.ts`；- [ ] 跑 `pnpm test` | `docs/project-structure.md` 需说明 Markdown sanitize/render 分层；`README.md` 通常无需用户可见更新 | pending |

优先级说明：
- `P0`：价值和风险都最高，优先执行，并优先补独立测试
- `P1`：价值或风险中等，放在 `P0` 之后
- `P2`：低风险清理项或安全敏感但非当前瓶颈项，最后处理

状态说明：
- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| BASELINE | 2026-05-18 | 2026-05-18 | `pnpm test` | pass：36 个测试文件，275 个测试通过 | 未开始 | 新一轮重构前基线；未修改源码 |

## 5. 决策与确认

- 用户批准的条目：待确认
- 延后的条目：待确认
- 阻塞条目及原因：无

建议执行顺序：
1. `RF-101`：先拆编辑器里的工作区文档树逻辑，降低主入口复杂度，并为右侧 UI 拆分提供更清晰的数据边界。
2. `RF-102`：再拆右侧文档树/Inspector 组件，减少 `CanvasWorkspace.vue` 最大模板区块。
3. `RF-103` 或 `RF-104`：按你更关注的风险选择，前者偏编辑器核心边界，后者偏 UI 体量治理。

## 6. 文档刷新

- `docs/project-structure.md`：每完成一个获批条目后同步更新对应模块职责；全部获批范围完成后做最终一致性检查
- `README.md`：同步更新 Project structure 小节；如用户可见能力没有变化，不扩写功能列表
- 最终同步检查：待获批条目完成后执行

## 7. 下一步

1. 等待用户按条目 ID 明确批准，例如：`批准 RF-101`、`批准 RF-101 和 RF-102`，或指定新的执行顺序。
2. 获批后一次只执行一个条目：先补/调整测试，再跑定向测试，再实施重构，再跑定向测试和 `pnpm test`。
3. 每完成一项立即更新本计划的状态、验证命令、文档影响和后续事项。
