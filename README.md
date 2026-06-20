# SiYuan Canvas

**English** · [简体中文](README_zh_CN.md)

SiYuan Canvas is a SiYuan plugin for importing, editing, and exporting Obsidian `.canvas` files using the open JSON Canvas format.
![image](https://raw.githubusercontent.com/famotime/siyuan-canvas/main/assets/image-20260501190639-s2lebrh.png)

## Core Features & What it does

- **Auto-save**: Your workspace is automatically saved as you edit, allowing you to focus purely on your ideas.
- **Pure Card Design (New)**: Cards now render without title bars by default, presenting content directly for a cleaner, distraction-free look. Drag anywhere on a card to move it. Toggle headers back on in settings if preferred.
- **Right Sidebar File Browser (New)**: A persistent dock panel in the right sidebar lets you browse all canvas files. Create new canvases/folders, sort by name or edit time (auto-refreshes after save/rename/copy), right-click for rename, copy, copy path, delete, or open containing folder (Windows/macOS/Linux). The tree auto-refreshes on any file change. Click any file to open it in a tab.
- **Smart Edge Creation (New)**: Drag from any card anchor to empty space and choose "Add Text Card" or "Add Note Card" from a popup menu. "Add Note Card" opens the file picker to select a SiYuan document — the edge connects automatically after selection.
- **Edge Endpoint Reconnect (New)**: Click near either end of an existing edge to start dragging it to a new target. Release on a card to reconnect, or on empty space to create a new card with the same menu.
- **Refined Edge Curves**: Bezier curves now use Euclidean distance with a 0.5 factor (clamped 40–120px), matching Obsidian Canvas aesthetics for more natural, flowing connections.
- **Full Anchor Visibility**: Connection anchors now render as complete circles extending beyond the card edges, no longer clipped by `overflow: hidden`.
- **One-Line Card Defaults**: New text/file/link cards default to 250×50px (single-line height), with minimum dimensions of 50×50px.
- **Presentation Mode**: Record a playback path through your canvas and present your ideas linearly. During playback, the background is masked to highlight the current node, guiding your audience through complex networks of thought.
- **Mobile Support**: Fully supports view-only mode on mobile devices with pinch-to-zoom capabilities, so you can review your canvas anywhere.
- Opens standard `.canvas` files from the SiYuan workspace and imports local `.canvas` files for editing inside SiYuan.
- Edits `text`, `file`, `link`, and `group` nodes.
- Creates and edits edges with side anchors and labels.
- Preserves unknown JSON Canvas fields during parse and save for maximum compatibility.

<video controls="controls" src="https://raw.githubusercontent.com/famotime/siyuan-canvas/main/assets/4月22日1-20260422214002-iw8j5j0.mp4"></video>

## Use Cases

- **Knowledge Structuring**: Visually map out your thoughts using cards and connections. Group them by themes to form a comprehensive knowledge network.
- **Presentations & Briefings**: Use the new presentation mode to walk your audience through your canvas step by step, turning a non-linear graph into a clear, linear story.
- **Cross-Tool Collaboration**: Seamlessly share `.canvas` files between SiYuan and Obsidian. Edit in SiYuan and save back to standard `.canvas` format.
- **Project Planning**: Organize tasks using text cards, denote dependencies with edges, use groups for project phases, and color-code priorities.
- **File Management**: Browse all canvas files from the right sidebar dock — create, rename, copy, delete, and open containing folders without leaving the workspace.

## Current Interaction Model

- Open a blank canvas from the top bar, command palette, or the right sidebar file browser.
- Use the top toolbar to start a new canvas, import a local `.canvas` file, or use "Save As".
- **Right sidebar file browser (New)**: Browse workspace canvas files, create/copy/rename/delete, sort by name or edit time with auto-refresh, open containing folder from context menu.
- Activate the canvas surface to reveal the bottom toolbar for adding text, file, connect, and group actions.
- Drag any part of a card to move it (title bars are hidden by default; toggle them back in settings).
- Drag card edge handles to resize.
- **Drag from a card's anchor point** to create a new edge — release on another card to connect, or release on empty space for a popup menu (Add Text Card / Add Note Card).
- **Click near an edge endpoint** to start reconnecting it to a different card.
- **Add Note Card**: Opens the SiYuan file picker; after selecting a document, the card is created and the edge connects automatically.
- Edit node and edge properties in the right inspector (dedicated Selection tab; document browsing moved to sidebar).
- Double-click link nodes to open the URL.
- Double-click `.canvas` file nodes to open them in a new plugin tab.
- Use the create-edge dialog or floating edge toolbar to create and adjust connections.
- Fast preview: Use `Ctrl+Shift+Alt+C` to insert a canvas preview right into your current document.

## Project Structure

- `src/index.ts` keeps the plugin lifecycle thin and delegates runtime detection, tab wiring, settings UI, and canvas embed command execution to focused helpers in `src/canvas/`.
- `src/canvas/use-canvas-editor.ts` is the editor composition entry, with file actions, file-node metadata, pointer gestures, selection toolbar UI, and workspace tree helpers split into dedicated modules.
- `src/components/canvas/CanvasWorkspace.vue` remains the main workspace composition view, with `CanvasFileCard.vue`, `CanvasCreateEdgeDialog.vue`, and workspace context-menu helpers extracting focused UI behavior from the large SFC.
- `src/canvas/workspace-tree-core.ts` and `src/canvas/canvas-embed-command.ts` isolate pure workspace tree logic and embed-command orchestration behind testable dependency-injected APIs.
- `src/canvas/file-target-resolution.ts`, `src/canvas/file-target-preview.ts`, and `src/canvas/file-preview-fallbacks.ts` now form the primary file preview pipeline, while older `file-node-*` modules are compatibility adapters.
- `src/canvas/siyuan-file-node-lookups.ts` contains pure lookup logic for SiYuan document and asset resolution, with runtime SQL access isolated in `src/canvas/siyuan-kernel-file-node-lookups.ts`.
- `tests/` mirrors the canvas modules with focused Vitest coverage for editor flows, plugin lifecycle, theme sync, display helpers, parsing, geometry, and persistence.

## Notes

- The plugin targets the open JSON Canvas format maintained by `obsidianmd/jsoncanvas`.
- The current implementation prioritizes file-format compatibility and core editing over full visual parity with Obsidian Canvas.
