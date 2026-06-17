# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

思源笔记插件，用于导入、编辑和导出 Obsidian `.canvas` 文件（JSON Canvas 格式）。显示名称 "Canvas" / "无界"。

## 常用命令

- `pnpm build` / `npm run build` — 生产构建（Vite library 模式，输出到 `./dist` 并打包为 `package.zip`）。
- `pnpm dev` — `vite build --watch`，监听构建。若设置了环境变量 `VITE_SIYUAN_WORKSPACE_PATH`，构建产物会直接写入 `${workspace}/data/plugins/siyuan-canvas`，配合 `rollup-plugin-livereload` 在思源中热更新；否则输出到 `./dev`。
- `pnpm test` — 运行 Vitest（一次性）。
- `pnpm test:watch` — Vitest watch 模式。
- 跑单个测试：`pnpm test -- tests/<file>.test.ts`，或加 `-t "<test name>"` 过滤用例。
- 发布版本：`pnpm release` / `release:patch` / `release:minor` / `release:major` / `release:manual`（运行 `release.js`）。
- 仓库未配置独立的 lint 脚本；`@antfu/eslint-config` + ESLint 9 已安装，可直接 `npx eslint .`。

## 架构概览

### 插件生命周期

`src/index.ts` (SiyuanCanvasPlugin extends Plugin) → 注册命令、顶栏图标、自定义 Tab 类型 → 打开 Tab 时 `src/main.ts` 创建 Vue 应用挂载 `App.vue` → `CanvasWorkspace.vue` 渲染完整的画布 UI。

各子组合式函数通过 `CanvasPluginBridge` 接口（定义在 `use-canvas-editor-shared.ts`）与宿主插件通信，该接口扩展了 siyuan `Plugin` 并暴露设置、UI 状态、最近文件等方法。

### 编辑器组合式函数

`src/canvas/use-canvas-editor.ts` 是核心组合入口（~1430 行），组装响应式状态并委托给多个子模块：

- `use-canvas-editor-gestures.ts` — 指针手势：平移、框选、拖拽、连线创建、缩放、边重连
- `use-canvas-editor-file-actions.ts` — 工作区路径、导入/导出、保存/冲突处理
- `use-canvas-editor-node-edge-actions.ts` — 节点/边编辑命令
- `use-canvas-editor-shortcuts.ts` — 键盘快捷键
- `use-canvas-editor-lifecycle.ts` — 编辑器初始化
- `use-canvas-editor-file-nodes.ts` — 文件节点元数据刷新
- `use-canvas-editor-node-activation.ts` — 双击激活节点
- `use-canvas-editor-file-picker.ts` — 文件选择器
- `use-canvas-editor-stage-drop.ts` — 拖放创建文件节点
- `use-canvas-editor-workspace-tree.ts` — 工作区文档树编排：展开折叠、CRUD、拖拽移动、文案/弹窗依赖注入
- `workspace-tree-core.ts` — 工作区树纯函数：递归目录读取、排序、路径收集、文件名规范化
- `canvas-embed-command.ts` — 嵌入画布命令：路径规范化、目标文档解析、文件读取、插入流程
- `use-canvas-editor-selection-ui.ts` — 选择/边工具栏 UI：位置计算、popover 状态、尺寸跟踪、端点手柄位置

### 数据流

Canvas 文件通过 `format.ts`（JSON Canvas 规范）解析为 `CanvasDocument`（nodes + edges）。`CanvasEditorState` 管理活动文档、选区、脏状态和冲突。`CanvasFileService` 通过 `CanvasTextGateway` 抽象层处理读写。解析/保存须保留未知 JSON Canvas 字段（与上游 `obsidianmd/jsoncanvas` 兼容）。

### 文档变换

`document.ts`（314 行）提供节点/边 CRUD 纯函数（创建、增删、几何变换、颜色），通过 barrel re-export 暴露分层模块的公共 API：

- `document-layout.ts` — `applyCanvasNodeLayout`：左/右/上/下对齐、水平/垂直居中、行/列/网格排列、分布、拉伸
- `document-group.ts` — `createCanvasGroupForNodes`、`findCanvasNodesInGroup`

### Markdown 预览与安全

`markdown-sanitize.ts`（~220 行）集中管理 XSS 防护：HTML 转义、CSS 颜色值验证（hex/rgb/named）、kramdown `{: }` 属性剥离、`<img>/<span>/<font>` 白名单解析。`markdown-preview.ts`（260 行）负责截断、标题提取和 Markdown→HTML 块渲染。渲染层单向依赖 sanitize 层，无循环引用。

### 图标系统

`canvas-icon-registry.ts`（~110 行）定义 `CanvasIconName` 联合类型（48 个图标名）和 `CANVAS_ICON_MARKUP` SVG 字典。`canvas-icon.ts`（83 行）提供 `CanvasIcon` Vue 渲染组件和 `hardenStrokeOnlySvgFill`（stroke-only shape fill="none" 自动修正），通过 re-export 向后兼容。

### 文件预览管线

新路径：`file-target-resolution.ts` → `file-target-preview.ts` → `file-preview-fallbacks.ts`。`file-node-resolution.ts` 与 `file-node-preview.ts` 是遗留兼容适配器，新功能应走新管线。`siyuan-file-node-lookups.ts` 是纯查找逻辑，运行时 SQL 访问隔离在 `siyuan-kernel-file-node-lookups.ts`。

### 构建系统

Vite library mode（CJS 输出），`siyuan` 和 `process` 为外部依赖，输出 `index.js` + `index.css`，静态资源（`plugin.json`、`icon.png`、`preview.png`、`README*.md`、`src/i18n/*.json`）通过 `vite-plugin-static-copy` 复制到 `dist/`，再由 `vite-plugin-zip-pack` 打包为 `package.zip`。测试配置在 `vite.config.ts` 的 `test` 字段中（非独立 vitest.config），排除了 `.worktrees/`、`dist/`、`dev/` 目录。

## 目录结构约定

- `src/canvas/` — 核心画布逻辑、类型、格式解析、编辑器状态、文档变换、Markdown 安全
- `src/components/canvas/` — 画布 Vue 组件与 UI 组合逻辑（CanvasWorkspace、CanvasWorkspaceTree、CanvasInspector、CanvasPngExportDialog、CanvasFileCard、use-canvas-workspace-context-menu 等）
- `src/components/SiyuanTheme/` — 思源风格 UI 组件（SyButton、SyInput 等）
- `src/i18n/` — 国际化（en_US/zh_CN，zh_CN 为回退语言），`canvas.ts` 导出 `createCanvasI18n` 翻译函数。缺失的 en_US 键会自动回退到 zh_CN
- `src/icons/` — 顶栏图标和 Tab 图标 SVG 字符串
- `src/utils/` — 通用工具函数
- `src/types/` — 思源 API 类型声明
- `src/api.ts` — 思源 kernel API 封装
- `tests/` — Vitest 测试文件，命名与源码对应（新模块需配套测试）。测试时 `siyuan` 模块通过 vite alias 映射到 `tests/__mocks__/siyuan.ts`（提供 `showMessage`、`openTab`、`confirm` 等 stub）
- `docs/` — 设计文档、重构计划、JSON Canvas 规范
- `plugin-sample-vite-vue/` — 官方思源插件开发样板项目（参考用，勿改）
- `developer_docs/` — 思源插件开发 API 参考文档

## 编码规范

- 2 空格缩进，UTF-8，文件末尾换行（`.editorconfig`）
- ESLint 使用 `@antfu/eslint-config`，单引号，多行尾逗号。另有 `eslint-plugin-perfectionist` 用于排序规则
- Vue 组件用 PascalCase（`CanvasWorkspace.vue`），画布模块用 kebab-case（`selection-toolbar.ts`）
- Vue SFC 块顺序：template → script → style
- 样式使用 SCSS（Sass），全局样式入口 `src/index.scss`
- 测试文件放在 `tests/*.test.ts`，命名与源码对应（如 `viewport.ts` → `canvas-viewport.test.ts`），新模块需配套测试
- 路径别名：`@/*` → `./src/*`（vite alias），TS path 中亦可见 `@/libs/*` → `./src/libs/*`
- TypeScript `strict: false`，`noUnusedLocals`/`noUnusedParameters` 为 `true`

## 提交规范

使用 Conventional Commits 前缀：`feat:`、`fix:`、`docs:`、`refactor:` 等，中文提交信息。

