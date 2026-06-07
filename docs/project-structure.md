# Project Structure

## Entry And Host Integration

- `src/index.ts`
  SiYuan plugin entry. Owns lifecycle orchestration, command registration, recent-file persistence, and delegates runtime detection, settings UI, and tab wiring to focused helpers.
- `src/main.ts`
  Vue mount/unmount bridge for canvas tabs. Binds the plugin instance, mounts `App.vue`, and keeps host theme state synchronized with the canvas root.
- `src/App.vue`
  Thin application shell that forwards plugin bootstrap props into `CanvasWorkspace`.

## Canvas Domain

- `src/canvas/types.ts`
  Shared canvas document, node, edge, geometry, and issue types.
- `src/canvas/format.ts`
  JSON Canvas parse, validate, and stringify pipeline.
- `src/canvas/document.ts`
  Pure document mutations and layout/group operations.
- `src/canvas/node-interaction.ts`
  Edge-anchor lookup and resize math.
- `src/canvas/selection-toolbar.ts`
  Selection bounds, marquee selection, drag-group expansion, and toolbar placement helpers.
- `src/canvas/viewport.ts`
  Zoom scale clamping and cursor-anchored viewport scaling.
- `src/canvas/board.ts`
  Board metrics and coordinate conversion between canvas space and rendered stage space.
- `src/canvas/editor-state.ts`
  Stateful editor model for open/save/conflict handling and selection state.
- `src/canvas/file-service.ts`
  Canvas document load/save service over a text gateway.
- `src/canvas/siyuan-text-gateway.ts`
  Minimal SiYuan file API bridge used by `CanvasFileService`.
- `src/canvas/file-node-resolution.ts`
  Legacy compatibility adapter that now delegates file-node parsing to `file-target-resolution.ts` and maps results back into the older `file/document/asset/canvas` shape used by compatibility tests.
- `src/canvas/file-node-preview.ts`
  Compatibility preview wrapper for the older file-node model. Current preview semantics stay aligned with `file-target-preview.ts`.
- `src/canvas/file-target-resolution.ts`
  Normalizes file-node input from paths and block IDs into document, canvas, image, or fallback targets.
- `src/canvas/file-target-preview.ts`
  Builds rich preview payloads for document excerpts, canvas thumbnails, and image cards.
- `src/canvas/file-preview-fallbacks.ts`
  Shared image-source fallback helpers for file cards and rendered document previews.
- `src/canvas/file-picker-dialog.ts`
  Groups picker-search results for the bottom-toolbar file action.
- `src/canvas/workspace-image-files.ts`
  Derives sibling asset directories and writes pasted workspace image files.
- `src/canvas/plugin-data.ts`
  Plugin settings and recent-file normalization helpers.
- `src/canvas/plugin-runtime.ts`
  Runtime/platform detection used during plugin startup.
- `src/canvas/plugin-settings-panel.ts`
  Settings panel builder for canvas-specific plugin options.
- `src/canvas/plugin-tabs.ts`
  Shared tab registration and tab opening helpers.
- `src/canvas/use-canvas-editor.ts`
  Main composition entry for the editor. Coordinates state, computed view models, node/edge actions, and keyboard shortcuts.
- `src/canvas/use-canvas-editor-selection-export.ts`
  Selection export and document merge logic: decompose, convert selection to document/text, topological sort, markdown merge. Pure helpers exported directly; impure functions via factory with injected dependencies.
- `src/canvas/use-canvas-editor-file-actions.ts`
  Workspace path normalization, import/export, save/conflict flows, and recent-file refresh logic.
- `src/canvas/use-canvas-editor-file-nodes.ts`
  File-node metadata refresh and preview/title helpers.
- `src/canvas/use-canvas-editor-gestures.ts`
  Pointer gestures for pan, marquee selection, drag, connection creation, and resize.
- `src/canvas/use-canvas-editor-shared.ts`
  Shared editor/plugin bridge types and small cross-module helpers.
- `src/canvas/siyuan-file-node-lookups.ts`
  Pure path candidate generation and query-order logic for SiYuan document/asset resolution.
- `src/canvas/siyuan-kernel-file-node-lookups.ts`
  Runtime SiYuan SQL bridge that plugs kernel queries into the pure lookup helpers.
- `src/canvas/node-overlap.ts`
  Shared AABB overlap detection and non-overlapping position finder for node placement.
- `src/canvas/debug-log.ts`
  Shared conditional debug logging factory (`createDebugLog`).

## UI Layer

- `src/components/canvas/CanvasWorkspace.vue`
  Main canvas workspace composition view. Renders toolbar, stage, floating selection toolbar, file picker, and inspector while delegating file-card and create-edge dialog markup to child components. Scoped styles extracted to `canvas-workspace.scss`.
- `src/components/canvas/canvas-workspace.scss`
  Scoped styles for `CanvasWorkspace.vue` (~2178 lines). Extracted from SFC for reduced diff surface.
- `src/components/canvas/CanvasFileCard.vue`
  Focused file-node card renderer for badges, canvas thumbnails, image previews, and document preview HTML.
- `src/components/canvas/CanvasCreateEdgeDialog.vue`
  Dedicated create-edge dialog with embedded source/target node pickers and submission controls.
- `src/components/canvas/canvas-selection-toolbar-icon.ts`
  Selection toolbar icon map and render component.
- `src/components/canvas/canvas-workspace-display.ts`
  Shared card color, swatch, and group-label display helpers.
- `src/components/canvas/use-canvas-workspace-behavior.ts`
  Inline text editing and floating-toolbar/theme observer behavior.
- `src/components/SiyuanTheme/*`
  Reusable theme-aligned form controls for the inspector.

## API Boundary

- `src/api.ts`
  Compatibility-oriented SiYuan API surface inherited from the template. Canvas-specific file-node lookups now delegate to `src/canvas/siyuan-kernel-file-node-lookups.ts` instead of embedding query logic directly here.

## Tests

- `tests/canvas-use-editor-actions.test.ts`
  Direct editor composition tests for open/import/save/export/conflict/recent-file flows.
- `tests/canvas-workspace.test.ts`
  Workspace rendering and interaction tests.
- `tests/canvas-file-card.test.ts`
  Focused file-card rendering and image/document preview fallback event coverage.
- `tests/canvas-create-edge-dialog.test.ts`
  Dedicated create-edge dialog picker and footer-action coverage.
- `tests/canvas-file-preview-fallbacks.test.ts`
  Pure helper coverage for preview image candidate generation and HTML source replacement.
- `tests/canvas-workspace-display.test.ts`
  Pure display helper coverage for color and group-label styling.
- `tests/canvas-plugin-lifecycle.test.ts`
  Plugin entry lifecycle, settings panel, and tab opening coverage.
- `tests/canvas-theme-sync.test.ts`
  Mount/unmount theme synchronization coverage.
- `tests/canvas-siyuan-file-node-lookups.test.ts`
  Pure path-candidate and query-order coverage for SiYuan file-node lookup logic.
- `tests/canvas-*.test.ts`
  Remaining focused module tests for parsing, geometry, persistence, i18n, file-node resolution, workspace helpers, node overlap, and markdown sanitization.
