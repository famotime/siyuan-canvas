## 项目概述

思源笔记插件，用于导入、编辑和导出 Obsidian `.canvas` 文件（JSON Canvas 格式）。显示名称 "Canvas" / "无界"。

## 架构概览

### 插件生命周期

`src/index.ts` (SiyuanCanvasPlugin extends Plugin) → 注册命令、顶栏图标、自定义 Tab 类型 → 打开 Tab 时 `src/main.ts` 创建 Vue 应用挂载 `App.vue` → `CanvasWorkspace.vue` 渲染完整的画布 UI。

### 编辑器组合式函数

`src/canvas/use-canvas-editor.ts` 是核心组合入口（~935 行），组装响应式状态并委托给多个子模块：

- `use-canvas-editor-gestures.ts` - 指针手势：平移、框选、拖拽、连线创建、缩放、边重连
- `use-canvas-editor-file-actions.ts` - 工作区路径、导入/导出、保存/冲突处理
- `use-canvas-editor-node-edge-actions.ts` - 节点/边编辑命令
- `use-canvas-editor-shortcuts.ts` - 键盘快捷键
- `use-canvas-editor-lifecycle.ts` - 编辑器初始化
- `use-canvas-editor-file-nodes.ts` - 文件节点元数据刷新
- `use-canvas-editor-node-activation.ts` - 双击激活节点
- `use-canvas-editor-file-picker.ts` - 文件选择器

### 数据流

Canvas 文件通过 `format.ts`（JSON Canvas 规范）解析为 `CanvasDocument`（nodes + edges）。`CanvasEditorState` 管理活动文档、选区、脏状态和冲突。`CanvasFileService` 通过 `CanvasTextGateway` 抽象层处理读写。

### 文件预览管线

`file-target-resolution.ts` → `file-target-preview.ts` → `file-preview-fallbacks.ts`（新路径）。`file-node-resolution.ts` 和 `file-node-preview.ts` 是遗留兼容适配器。

### 构建系统

Vite library mode（CJS 输出），`siyuan` 和 `process` 为外部依赖，输出 `index.js` + `index.css`，静态资源通过 `vite-plugin-static-copy` 复制到 `dist/`，打包为 `package.zip`。测试配置在 `vite.config.ts` 的 `test` 字段中（非独立 vitest.config），排除了 `.worktrees/`、`dist/`、`dev/` 目录。

## 目录结构约定

- `src/canvas/` - 核心画布逻辑、类型、格式解析、编辑器状态
- `src/components/canvas/` - 画布 Vue 组件（CanvasWorkspace、CanvasFileCard 等）
- `src/components/SiyuanTheme/` - 思源风格 UI 组件（SyButton、SyInput 等）
- `src/i18n/` - 国际化（en_US/zh_CN，133 个键值，zh_CN 为回退语言）
- `src/types/` - 思源 API 类型声明
- `src/api.ts` - 思源 kernel API 封装
- `tests/` - Vitest 测试文件（28 个），命名与源码对应
- `docs/` - 设计文档、重构计划、JSON Canvas 规范
- `plugin-sample-vite-vue/` - 官方思源插件开发样板项目
- `developer_docs/` - 思源插件开发 API 参考文档

## 编码规范

- 2 空格缩进，UTF-8，文件末尾换行（`.editorconfig`）
- ESLint 使用 `@antfu/eslint-config`，单引号，多行尾逗号
- Vue 组件用 PascalCase（`CanvasWorkspace.vue`），画布模块用 kebab-case（`selection-toolbar.ts`）
- Vue SFC 块顺序：template → script → style
- 测试文件放在 `tests/*.test.ts`，命名与源码对应（如 `viewport.ts` → `canvas-viewport.test.ts`），新模块需配套测试
- 路径别名：`@/*` → `./src/*`，`@/libs/*` → `./src/libs/*`
- TypeScript `strict: false`，`noUnusedLocals`/`noUnusedParameters` 为 `true`

## 提交规范

使用 Conventional Commits 前缀：`feat:`、`fix:`、`docs:`、`refactor:` 等，中文提交信息。
