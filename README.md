# SiYuan Canvas

SiYuan Canvas is a SiYuan plugin for importing, editing, and exporting Obsidian `.canvas` files using the open JSON Canvas format.
![image](https://raw.githubusercontent.com/famotime/siyuan-canvas/main/assets/image-20260501190639-s2lebrh.png)


## What it does

- Opens standard `.canvas` files from the SiYuan workspace
- Imports local `.canvas` files for editing inside SiYuan
- Edits `text`, `file`, `link`, and `group` nodes
- Creates and edits edges with side anchors and labels
- Saves back to the workspace as a standard `.canvas` file
- Preserves unknown JSON Canvas fields during parse and save

<video controls="controls" src="https://raw.githubusercontent.com/famotime/siyuan-canvas/main/assets/4月22日1-20260422214002-iw8j5j0.mp4"></video>

## Current interaction model

- Open a blank canvas from the top bar or command palette
- Use the top toolbar to start a new canvas, import a local `.canvas` file, or save the current workspace file
- Activate the canvas surface to reveal the bottom toolbar for adding text, file, connect, and group actions
- Drag node headers to move cards
- Drag the bottom-right handle to resize cards
- Edit node and edge properties in the right inspector
- Double-click link nodes to open the URL
- Double-click `.canvas` file nodes to open them in a new plugin tab
- Use the create-edge dialog or floating edge toolbar to create and adjust connections

## Project structure

- `src/index.ts` keeps the plugin lifecycle thin and delegates runtime detection, tab wiring, and settings UI to focused helpers in `src/canvas/`.
- `src/canvas/use-canvas-editor.ts` is the editor composition entry, with file actions, file-node metadata, and pointer gestures split into dedicated `use-canvas-editor-*` modules.
- `src/components/canvas/CanvasWorkspace.vue` remains the main workspace composition view, with `CanvasFileCard.vue` and `CanvasCreateEdgeDialog.vue` extracting file preview and edge-dialog UI from the large SFC.
- `src/canvas/file-target-resolution.ts`, `src/canvas/file-target-preview.ts`, and `src/canvas/file-preview-fallbacks.ts` now form the primary file preview pipeline, while older `file-node-*` modules are compatibility adapters.
- `src/canvas/siyuan-file-node-lookups.ts` contains pure lookup logic for SiYuan document and asset resolution, with runtime SQL access isolated in `src/canvas/siyuan-kernel-file-node-lookups.ts`.
- `tests/` mirrors the canvas modules with focused Vitest coverage for editor flows, plugin lifecycle, theme sync, display helpers, parsing, geometry, and persistence.

## Notes

- The plugin targets the open JSON Canvas format maintained by `obsidianmd/jsoncanvas`.
- The current implementation prioritizes file-format compatibility and core editing over full visual parity with Obsidian Canvas.
