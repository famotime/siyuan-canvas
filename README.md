# SiYuan Canvas

SiYuan Canvas is a SiYuan plugin for importing, editing, and exporting Obsidian `.canvas` files using the open JSON Canvas format.

## What it does

- Opens standard `.canvas` files from the SiYuan workspace
- Imports local `.canvas` files for editing inside SiYuan
- Edits `text`, `file`, `link`, and `group` nodes
- Creates and edits edges with side anchors and labels
- Saves back to the workspace or exports a standard `.canvas` file for Obsidian
- Preserves unknown JSON Canvas fields during parse and export

## Current interaction model

- Open a blank canvas from the top bar or command palette
- Use the toolbar to open a workspace path, import a local file, save, or export
- Add nodes from the toolbar
- Drag node headers to move cards
- Drag the bottom-right handle to resize cards
- Edit node and edge properties in the right inspector
- Double-click link nodes to open the URL
- Double-click `.canvas` file nodes to open them in a new plugin tab

## Development

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

Set `VITE_SIYUAN_WORKSPACE_PATH` in `.env` if you want `pnpm dev` to build directly into a local SiYuan workspace.

## Project structure

- `src/index.ts` keeps the plugin lifecycle thin and delegates runtime detection, tab wiring, and settings UI to focused helpers in `src/canvas/`.
- `src/canvas/use-canvas-editor.ts` is the editor composition entry, with file actions, file-node metadata, and pointer gestures split into dedicated `use-canvas-editor-*` modules.
- `src/components/canvas/CanvasWorkspace.vue` remains the main workspace view, while shared toolbar icons, display helpers, and inline-editing behavior live in `src/components/canvas/*.ts`.
- `src/canvas/siyuan-file-node-lookups.ts` contains pure lookup logic for SiYuan document and asset resolution, with runtime SQL access isolated in `src/canvas/siyuan-kernel-file-node-lookups.ts`.
- `tests/` mirrors the canvas modules with focused Vitest coverage for editor flows, plugin lifecycle, theme sync, display helpers, parsing, geometry, and persistence.

## Notes

- The plugin targets the open JSON Canvas format maintained by `obsidianmd/jsoncanvas`.
- The current implementation prioritizes file-format compatibility and core editing over full visual parity with Obsidian Canvas.
- A detailed file-by-file map is maintained in `docs/project-structure.md`.
