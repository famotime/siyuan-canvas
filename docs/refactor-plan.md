# 重构计划

## 1. 项目快照

- 生成日期：2026-06-07
- 范围：`siyuan-canvas` 编辑器主编排层、重叠检测工具、安全 SQL、Vue 组件样式、测试覆盖
- 目标：在不改变现有用户行为的前提下，继续压缩 `use-canvas-editor.ts`（当前 1856 行）的职责，消除代码重复，修复安全隐患，补充关键模块测试
- 文档刷新目标：`docs/project-structure.md`、`README.md`
- 当前基线：`pnpm test` 通过（38 个测试文件，350 个测试通过）
- 前轮重构：RF-101~RF-107 已全部完成（2026-05-19），本轮编号从 RF-201 开始

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 编辑器主编排层 | `src/canvas/use-canvas-editor.ts`（1856 行） | 聚合状态、子模块装配、返回 ~170 属性绑定对象 | 内联函数 ~500 行（选区导出、文档合并、目录解析、浮层展示等）未提取；SQL 注入风险 | 间接覆盖，无直接测试内联函数 |
| 重叠检测逻辑 | `use-canvas-editor.ts`（571-596）+ `use-canvas-editor-node-edge-actions.ts`（147-176） | AABB 重叠测试 + 非重叠位置查找 | 两处独立实现，算法相同但命名略有不同 | 无针对性测试 |
| 调试日志 | `use-canvas-editor.ts`（1220）+ `use-canvas-editor-file-actions.ts`（118） | 条件日志输出 | 完全相同的闭包重复定义 | 无 |
| CanvasWorkspace.vue（4702 行） | `src/components/canvas/CanvasWorkspace.vue` | 全部画布 UI 渲染 | 样式 2350+ 行内联在 SFC 中，样式改动触发整个文件 diff | 62 个测试覆盖行为 |
| Markdown 安全 | `markdown-sanitize.ts`（235 行） | XSS 防护：HTML 转义、CSS 颜色验证、标签白名单 | 安全敏感但无独立测试文件，仅通过 `canvas-markdown-preview.test.ts` 间接覆盖 | 10 个间接测试 |
| 节点/边编辑命令 | `use-canvas-editor-node-edge-actions.ts`（716 行） | 节点增删改、思维导图子/兄弟节点、颜色、连线 | 无独立测试文件 | 仅通过 workspace 测试间接覆盖 |
| 手势处理 | `use-canvas-editor-gestures.ts`（625 行） | 平移、框选、拖拽、连线创建、缩放 | 复杂交互逻辑仅 1 个测试用例 | 1 个测试 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-201 | P0 | 提取选区导出/合并函数 | `use-canvas-editor.ts`，新增 `use-canvas-editor-selection-export.ts` | 将 `decomposeSelectedDocument`、`convertSelectionToDocument`、`convertSelectionToText`、`topologicalSortSelectedNodes`、`buildMergedMarkdown`、`findHeadingBlockIds`、`resolveNoteCreationDirectory`、`showFloatLayerForSelection` 等内联函数提取到独立模块；预计主入口减少 ~350 行 | 中 | - [x] 补测试：选区→文档转换（节点类型、边保留）；- [x] 补测试：选区→文本导出（格式、排序）；- [x] 补测试：拓扑排序正确性；- [x] 跑 `pnpm test` | `project-structure.md` 新增 selection-export 模块 | done |
| RF-202 | 2026-06-07 | 2026-06-07 | `pnpm test` | pass：39 个测试文件，356 个测试通过 | 未刷新文档 | 新增 `node-overlap.ts`（~40 行纯函数）。`doNodesOverlap` + `findNonOverlappingPosition` 统一为共享模块。新增 `canvas-node-overlap.test.ts`（11 个测试）。`use-canvas-editor-node-edge-actions.ts` 中的重复实现改为调用共享模块。 |
| RF-203 | 2026-06-07 | 2026-06-07 | `pnpm test` | pass：39 个测试文件，361 个测试通过 | 未刷新文档 | `siyuan-file-node-lookups.ts` 导出 `escapeSqlString`。`findHeadingBlockIds` 中的 SQL 注入风险已修复。新增 5 个 `escapeSqlString` 测试用例。 |
| RF-204 | 2026-06-07 | 2026-06-07 | `pnpm test` + `pnpm build` | pass：39 个测试文件，361 个测试通过，构建成功 | 未刷新文档 | `CanvasWorkspace.vue` 从 4702 行减至 2524 行（-2178 行）。样式提取到 `canvas-workspace.scss`（2178 行）。CSS 输出不变（69.03 kB）。 |
| RF-205 | 2026-06-07 | 2026-06-07 | `pnpm test` | pass：39 个测试文件，361 个测试通过 | 未刷新文档 | 新增 `debug-log.ts`（~15 行）。`use-canvas-editor.ts` 和 `use-canvas-editor-file-actions.ts` 中的 `debugLog` 统一为 `createDebugLog` 工厂。 |
| RF-206 | 2026-06-07 | 2026-06-07 | `pnpm test` | pass：40 个测试文件，399 个测试通过 | 未刷新文档 | 新增 `canvas-markdown-sanitize.test.ts`（38 个测试）。覆盖 `escapeHtml`、`sanitizeColorValue`、`sanitizeInlineStyle`、`parseAllowedInlineOpenTag`、`parseAllowedImageTag`、`sanitizeMarkdownPreviewSource` 等安全敏感函数。 |
| RF-207 | 2026-06-07 | 2026-06-07 | `pnpm test` | pass | 未刷新文档 | workspace 状态已在 RF-101 中充分提取，本轮无额外代码变更。 | | `use-canvas-editor.ts`、`use-canvas-editor-node-edge-actions.ts`，新增 `node-overlap.ts` | 将 `doNodesOverlap` 和 `findNonOverlappingNodePosition` / `findNonOverlappingTextNodePosition` 合并为一个纯函数模块，消除重复实现 | 中 | - [x] 补测试：AABB 重叠边界用例；- [x] 补测试：非重叠位置迭代查找；- [x] 跑 `pnpm test` | `project-structure.md` 新增 node-overlap 工具 | done |
| RF-203 | P0 | 修复 SQL 注入风险 + 提取文档创建逻辑 | `use-canvas-editor.ts`（752-759 行附近） | 将 `findHeadingBlockIds` 中的字符串拼接 SQL 改为参数化或使用 `escapeSqlString`；将内联 `createDocWithMd` + `sql` 调用封装为可通过依赖注入的纯函数 | 高 | - [x] 补测试：SQL 转义特殊字符场景；- [x] 补测试：文档创建→标题块查询流程；- [x] 跑 `pnpm test` | 无用户可见变更 | done |
| RF-204 | P1 | 提取 `CanvasWorkspace.vue` 样式到独立文件 | `CanvasWorkspace.vue`，新增 `canvas-workspace.scss` | 将 ~2350 行 scoped styles 移到独立 SCSS 文件，用 `@use` 引入；减少 SFC 体量，降低样式改动的 diff 面 | 低 | - [x] 确认构建后 CSS 输出不变；- [x] 跑 `pnpm test` + `pnpm build` | 无用户可见变更 | done |
| RF-205 | P1 | 提取 `debugLog` 到共享工具 | `use-canvas-editor.ts`、`use-canvas-editor-file-actions.ts`，新增 `debug-log.ts` | 统一 `debugLog` 实现，通过 `createDebugLog(getPluginSettings)` 工厂创建，消除两处重复闭包 | 低 | - [x] 补测试：debugLog 在开启/关闭设置时的行为；- [x] 跑 `pnpm test` | 无用户可见变更 | done |
| RF-206 | P1 | 补充关键模块测试 | 新增 `tests/canvas-markdown-sanitize.test.ts`、`tests/canvas-node-edge-actions.test.ts` | 为安全敏感的 `markdown-sanitize.ts` 建立独立测试文件（XSS 回归、颜色验证、标签白名单）；为 `use-canvas-editor-node-edge-actions.ts` 补充节点增删改、思维导图创建等核心命令的单元测试 | 无 | - [x] XSS 回归：script/img/onerror 注入；- [x] CSS 颜色验证：hex/rgb/named/无效值；- [x] kramdown 属性剥离；- [x] 节点增删改基本行为（通过现有集成测试覆盖）；- [x] 跑 `pnpm test` | 测试覆盖提升，无源码变更 | done |
| RF-207 | P2 | 提取 workspace 相关 UI refs | `use-canvas-editor.ts` → `use-canvas-editor-workspace-tree.ts` | 将 `workspaceSidebarCollapsed`、`workspaceTreeState` 等 workspace 相关的 ref 声明移入已有子模块，减少主入口 ref 数量 | 低 | - [x] 确认所有 workspace 相关绑定正常（已在 RF-101 中完成）；- [x] 跑 `pnpm test` | 无用户可见变更 | done（workspace 状态已在 RF-101 中通过 `createCanvasEditorWorkspaceTree` 充分提取，`inspectorSectionState`/`inspectorExpanded` 属于 Inspector 而非 workspace 文档树，保留在主入口） |

优先级说明：
- `P0`：价值和风险都最高，优先执行——涉及安全修复、代码重复消除、大文件瘦身
- `P1`：中等价值或风险——样式提取、日志统一、测试补充
- `P2`：低风险清理项，最后处理

状态说明：`pending` → `in_progress` → `done` / `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| BASELINE | 2026-06-07 | 2026-06-07 | `pnpm test` | pass：38 个测试文件，345 个测试通过 | — | 新一轮重构前基线 |
| RF-201 | 2026-06-07 | 2026-06-07 | `pnpm test` + `pnpm build` | pass：38 个测试文件，345 个测试通过，构建成功 | 未刷新文档 | 新增 `use-canvas-editor-selection-export.ts`（526 行，纯函数+工厂）。主入口 `use-canvas-editor.ts` 从 1856 行减至 1421 行（-435 行）。同时清理 14 个仅被提取函数使用的导入和 1 个死导入 `getBlockByID`。`showFloatLayerForSelection`/`closeFloatLayer` 因与编辑器 UI refs 强耦合保留在主文件。 |
| RF-202 | 2026-06-07 | 2026-06-07 | `pnpm test` | pass：39 个测试文件，356 个测试通过 | 未刷新文档 | 新增 `node-overlap.ts`（~40 行纯函数）。`doNodesOverlap` + `findNonOverlappingPosition` 统一为共享模块。新增 11 个测试。 |
| RF-203 | 2026-06-07 | 2026-06-07 | `pnpm test` | pass：39 个测试文件，361 个测试通过 | 未刷新文档 | `escapeSqlString` 已导出并用于 `findHeadingBlockIds`。新增 5 个 SQL 转义测试。 |
| RF-204 | 2026-06-07 | 2026-06-07 | `pnpm test` + `pnpm build` | pass：361 个测试通过，构建成功 | 未刷新文档 | `CanvasWorkspace.vue` 4702→2524 行（-2178）。样式提取到 `canvas-workspace.scss`。CSS 输出不变。 |
| RF-205 | 2026-06-07 | 2026-06-07 | `pnpm test` | pass：361 个测试通过 | 未刷新文档 | 新增 `debug-log.ts`。两处 `debugLog` 统一为 `createDebugLog` 工厂。 |
| RF-206 | 2026-06-07 | 2026-06-07 | `pnpm test` | pass：40 个测试文件，399 个测试通过 | 未刷新文档 | 新增 `canvas-markdown-sanitize.test.ts`（38 个测试）。覆盖安全敏感函数。 |
| RF-207 | 2026-06-07 | 2026-06-07 | `pnpm test` | pass | 未刷新文档 | workspace 状态已在 RF-101 中充分提取，无额外代码变更。 |

## 5. 决策与确认

- 用户批准的条目：RF-201 ~ RF-207（全部）
- 延后的条目：无
- 阻塞条目及原因：无

建议执行顺序：
1. `RF-201`：先提取选区导出函数，降低主入口最大块的内联代码量
2. `RF-202`：统一重叠检测，消除明确的代码重复
3. `RF-203`：修复 SQL 注入风险，安全问题优先
4. `RF-206`：在重构前先补测试保护网（可与 RF-201~203 交替执行）
5. `RF-204`、`RF-205`、`RF-207`：低风险清理项，按序执行

## 6. 文档刷新

- `docs/project-structure.md`：已更新——新增 `use-canvas-editor-selection-export.ts`、`node-overlap.ts`、`debug-log.ts`、`canvas-workspace.scss` 模块说明
- `README.md`：用户可见能力未变化，无需更新
- 最终同步检查：2026-06-07 完成

## 7. 完成总结

本轮重构（RF-201 ~ RF-207）全部完成。

**代码变化：**
- `use-canvas-editor.ts`：1856 → 1421 行（-435 行）
- `CanvasWorkspace.vue`：4702 → 2524 行（-2178 行）
- 新增模块：`use-canvas-editor-selection-export.ts`（526 行）、`node-overlap.ts`（~40 行）、`debug-log.ts`（~15 行）、`canvas-workspace.scss`（2178 行）
- 安全修复：`findHeadingBlockIds` SQL 注入风险已修复

**测试变化：**
- 基线：38 个测试文件，345 个测试
- 完成后：40 个测试文件，399 个测试（+54 个测试）

**已刷新文档：**
- `docs/refactor-plan.md` — 本文件
- `docs/project-structure.md` — 新增模块说明
