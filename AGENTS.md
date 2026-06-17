# Agent Instructions

1. 除非用户特别指定，否则请默认使用简体中文回复所有对话。
2. 提交代码时使用中文简要描述修改点，并使用 `feat:`, `fix:`, `docs:`, `refactor:` 等前缀进行标记。

# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the plugin source. Keep core canvas logic in `src/canvas/`, shared UI in `src/components/`, locale files in `src/i18n/`, and ambient typings in `src/types/`. Entry points live in `src/index.ts`, `src/main.ts`, and `src/App.vue`.

`src/canvas/` key modules after refactoring:
- `use-canvas-editor.ts` — main editor composable (~1430 lines), delegates to sub-modules
- `use-canvas-editor-workspace-tree.ts` — workspace document tree orchestration: expand/collapse, CRUD, drag-move, injected labels/dialog dependencies
- `workspace-tree-core.ts` — pure workspace tree helpers: recursive directory reading, sorting, path collection, filename normalization
- `canvas-embed-command.ts` — canvas embed command pipeline: path normalization, target document resolution, file loading, insertion
- `use-canvas-editor-selection-ui.ts` — selection/edge toolbar placement, popover state, handle positions, size tracking
- `document.ts` — node/edge CRUD (314 lines), barrel re-exports layout and group APIs
- `document-layout.ts` — alignment, arrangement, distribution layout algorithms
- `document-group.ts` — node grouping and group-member lookup
- `markdown-sanitize.ts` — HTML escaping, color validation, kramdown stripping, img/span/font allowlist parsing
- `markdown-preview.ts` — truncation, heading extraction, Markdown→HTML rendering (260 lines)

`src/components/canvas/` key components:
- `CanvasWorkspace.vue` — main workspace shell with stage, toolbars, and sidebar
- `CanvasWorkspaceTree.vue` — recursive workspace document tree (folder/file nodes, drag-drop)
- `CanvasInspector.vue` — selection inspector: node/edge field editors, create-edge form
- `CanvasPngExportDialog.vue` — PNG export dialog: range, background color options
- `use-canvas-workspace-context-menu.ts` — workspace tree context-menu state and action dispatch
- `canvas-icon.ts` — `CanvasIcon` Vue component + SVG stroke-fill hardening (83 lines)
- `canvas-icon-registry.ts` — `CanvasIconName` type (48 icons) + SVG markup dictionary

`tests/` holds Vitest coverage for the canvas modules; mirror production names when adding specs, for example `src/canvas/viewport.ts` -> `tests/canvas-viewport.test.ts`. New modules require companion tests. Use `docs/` for design notes and JSON Canvas references, `developer_docs/` for bundled SiYuan API documentation, `asset/` for static assets, and `sample_canvas/` for example files. Build output goes to `dist/`.

- `plugin-sample-vite-vue/` - 官方思源插件开发样板项目
- `developer_docs/` - 思源插件开发 API 参考文档

## Build, Test, and Development Commands
Use `pnpm install` to sync dependencies.

- `pnpm dev` runs Vite in watch mode for local plugin development.
- `pnpm build` creates a production bundle in `dist/`.
- `pnpm test` runs the Vitest suite once.
- `pnpm test:watch` reruns tests while you work.
- `pnpm release`, `pnpm release:patch`, `pnpm release:minor`, `pnpm release:major`, and `pnpm release:manual` package releases through `release.js`.

If you want watch builds copied into a live SiYuan workspace, set `VITE_SIYUAN_WORKSPACE_PATH` in `.env`.

## Coding Style & Naming Conventions
Follow `.editorconfig`: UTF-8, final newline, and 2-space indentation. ESLint is configured in `eslint.config.mjs` with the Antfu preset, Vue support, and formatter rules; prefer single quotes and trailing commas in multiline objects and arrays.

Use PascalCase for Vue components such as `CanvasWorkspace.vue` and `SyButton.vue`. Keep canvas/domain modules lowercase with hyphenated filenames such as `selection-toolbar.ts` and `use-canvas-editor.ts`.

## Testing Guidelines
Write Vitest tests in `tests/*.test.ts`. Cover new parsing, serialization, editor-state, and workspace behaviors alongside the implementation change. Favor small module-level tests over broad UI snapshots.

## Commit & Pull Request Guidelines
Recent history mostly follows Conventional Commit prefixes such as `feat:` and `fix:`; continue that pattern and keep subjects imperative. Branch names like `feature/floating-selection-toolbar` are already in use. Avoid vague commits like `update`.

