# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the plugin source. Keep core canvas logic in `src/canvas/`, shared UI in `src/components/`, locale files in `src/i18n/`, and ambient typings in `src/types/`. Entry points live in `src/index.ts`, `src/main.ts`, and `src/App.vue`.

`tests/` holds Vitest coverage for the canvas modules; mirror production names when adding specs, for example `src/canvas/viewport.ts` -> `tests/canvas-viewport.test.ts`. Use `docs/` for design notes and JSON Canvas references, `developer_docs/` for bundled SiYuan API documentation, `asset/` for static assets, and `sample_canvas/` for example files. Build output goes to `dist/`.

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

PRs should explain the user-visible change, list verification steps (`pnpm test`, relevant manual canvas flows), link any issue or spec, and include screenshots or short recordings for UI changes.
