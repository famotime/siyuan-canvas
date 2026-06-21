# SiYuan Canvas

**English** · [简体中文](README_zh_CN.md)

> Canvas unbounded, thinking structured. Deconstruct, connect, converge — break boundaries to link nodes, gather thoughts into blueprints.

## Preface

I don't actually use canvas features that often. It's just that I had some Obsidian Canvas files shared by others, and my original intent was simply to open and read them directly in SiYuan Notes without switching back to Obsidian. I still have an obsession with "All-in-One" — since I've already gone through the trouble of migrating to SiYuan Notes, I want all my notes to converge in one place, all operations completed in one workbench. I don't want to be a multi-tool user constantly switching back and forth.

I looked into it and discovered that Obsidian has open-sourced the `.canvas` file format ([obsidianmd/jsoncanvas: An open file format for infinite canvas data.](https://github.com/obsidianmd/jsoncanvas)). Great — this makes parsing files and ensuring compatibility much easier. And so, after a few intense days of work, the "SiYuan Canvas" plugin was born.

![image](https://raw.githubusercontent.com/famotime/siyuan-canvas/main/assets/image-20260501190639-s2lebrh.png)

<video controls="controls" src="https://raw.githubusercontent.com/famotime/siyuan-canvas/main/assets/4月22日1-20260422214002-iw8j5j0.mp4"></video>

## Core Features & Use Cases

Open, edit, and export Obsidian `.canvas` files inside SiYuan Notes. Built on the open JSON Canvas format, enabling canvas interoperability between the two note-taking tools. We've crafted an immersive workflow, and **canvases auto-save by default** so you can focus on your thoughts without interruption.

**Knowledge Structuring** — Put scattered notes and materials onto a canvas, create connections to establish relationships, use groups to categorize by theme, forming a visual knowledge network.

**Presentations & Briefings** — **(New)** Use "Presentation Mode" to record a playback path through your cards. Like a slideshow, it dims the background step by step and highlights the current node, letting you tell a linear story from a networked knowledge graph.

**Project Planning** — List tasks with text cards, denote dependencies with edges, group by phases, color-code priorities, and quickly adjust layout by dragging.

**File Management** — Browse all workspace canvas files through the right sidebar "Canvas Files" panel — create, rename, copy, delete, open containing folder — all without leaving your workspace.

**Material Collection** — Copy images from your browser and paste them directly onto the canvas. Search for SiYuan documents and image assets to add as cards. All reference materials centralized on one canvas.

**Anytime, Anywhere Access** — **(New)** Fully supports mobile view-only mode with pinch-to-zoom, so you can review your mental landscape anywhere.

**Cross-Tool Collaboration** — `.canvas` files created in Obsidian open directly in SiYuan for editing. Save back to standard format — seamless flow between the two tools.

![image](https://raw.githubusercontent.com/famotime/siyuan-canvas/main/assets/image-20260501190509-pq8cjvq.png)

### Powerful Presentation Mode (Path Recording)

No longer just a static graph — you can bring your canvas to life:

- **Path Recording**: Select nodes and add them to a playback path, freely arranging the order of your presentation.
- **Mask Highlighting**: During playback, a mask background is automatically generated to highlight the current node, focusing your audience on the part you're explaining.
- **Flexible Editing**: Continue recording mid-playback or truncate the path to adjust your presentation logic at any time.

### Personalization & Visual Experience

- **New Theme Color Palettes**: A variety of carefully crafted color themes built in, including Cool Rainbow, Cyber Neon, and more — your canvas doesn't have to be monotonous.
- **Pure Card Design (New Default)**: Cards now render without title bars by default, presenting content directly for a cleaner, distraction-free look. Drag anywhere on a card to move it. Toggle headers back on in settings if preferred.
- **One-Line Card Defaults**: New text/file/link cards default to 250×50px (single-line height), with minimum dimensions of 50×50px, keeping the canvas compact and tidy.
- **Full Anchor Visibility**: Connection anchor circles now render completely beyond the card edges, no longer clipped into half-circles.

### Four Card Types

| Card | Purpose | Example |
| ---- | ----------------------------------- | ----------------------------------------------- |
| **Text** | Write thoughts, notes, memos | Record meeting points, jot down inspiration fragments (double-click empty space creates a text card by default) |
| **File** | Link to SiYuan documents, images, or other canvases | Drag relevant note cards onto the canvas to form a knowledge map |
| **Link** | Place web URLs | Entry points for reference materials and external documents |
| **Group** | Categorize and cluster related cards | Group by theme, phase, or priority |

- Text cards support Markdown rendering — headings, lists, code blocks, blockquotes, and more are previewed directly
- File cards recognize SiYuan documents, block IDs, image assets, and nested canvases; double-click to jump to the corresponding content
- Images pasted from the clipboard are automatically saved as file cards

### Connections & Relationships

- Drag from the anchor points on any side of a card to create a connection; release on empty space to choose a card type from a popup menu
- **Add Text Card**: Directly create a text card and connect it
- **Add Note Card (New)**: Opens the file picker to select a SiYuan document; after selection, a file card is automatically created and connected
- Edges support text labels to annotate relationship types (e.g., "causes", "belongs to", "references")
- Configurable arrow direction (none, one-way, bidirectional) and color
- **Click Near Edge Endpoint (New)**: Directly start endpoint reconnection dragging without selecting the edge first
- Drag endpoints to reconnect to other cards, or release on empty space for the popup menu to create a new card
- **Refined Bezier Curves**: Control points calculated using Euclidean distance with a 0.5 factor (clamped 40–120px), producing more natural, flowing connections

![image](https://raw.githubusercontent.com/famotime/siyuan-canvas/main/assets/image-20260501191812-6nsesw1.png)

### Layout & Alignment

After selecting multiple cards, a floating toolbar provides various layout operations:

- **Align** — Left / Horizontal Center / Right / Top / Vertical Center / Bottom
- **Arrange** — Row, Column, Grid (auto-calculates column count)
- **Distribute** — Evenly distribute horizontally or vertically
- **Stretch** — Stretch to fill selection horizontally or vertically

![image](https://raw.githubusercontent.com/famotime/siyuan-canvas/main/assets/image-20260501190246-cbut0pi.png)

### Inspector Panel & Sidebar

- **Right Inspector Panel**: When a card or edge is selected, the panel displays a "Selection" tab for editing position, size, color, text content, edge anchor direction, labels, and other properties. The original document browsing functionality has been moved to the right sidebar.
- **Right Sidebar File Browser (New)**: Click the "Canvas Files" icon in the right sidebar to quickly browse all canvas files in your workspace. Supports creating canvases/folders, sorting by name or edit time (auto-refreshes after save/rename/copy), right-click context menu (rename, copy, copy path, delete, open containing folder), and one-click file opening in a tab. The file list auto-refreshes on any file change (create, save, rename, delete).
- **Open Containing Folder (New)**: From the file tree or sidebar context menu, quickly open the system folder containing a canvas file (supports Windows, macOS, Linux).

## Current Interaction Model

- Open a blank canvas from the top bar, command palette, or the right sidebar file browser.
- Use the top toolbar to start a new canvas, import a local `.canvas` file, or use "Save As".
- **Right sidebar file browser (New)**: Browse workspace canvas files, create/copy/rename/delete, sort by name or edit time with auto-refresh, open containing folder from context menu.
- Activate the canvas surface to reveal the bottom toolbar for adding text, file, connect, and group actions.
- Drag any part of a card to move it (title bars are hidden by default; toggle them back in settings).
- Hold `Shift` while dragging to constrain movement to horizontal or vertical axis only.
- Hold `Alt` (Windows) or `Option` (macOS) while dragging to duplicate the card and drag the copy.
- Drag card edge handles to resize, or drag the bottom-right corner to resize width and height simultaneously.
- Toggle Grid Snap in the toolbar to snap cards to a 20px grid for precise alignment.
- **Drag from a card's anchor point** to create a new edge — release on another card to connect, or release on empty space for a popup menu (Add Text Card / Add Note Card).
- **Click near an edge endpoint** to start reconnecting it to a different card.
- **Add Note Card**: Opens the SiYuan file picker; after selecting a document, the card is created and the edge connects automatically.
- Edit node and edge properties in the right inspector (dedicated Selection tab; document browsing moved to sidebar).
- Double-click link nodes to open the URL.
- Double-click `.canvas` file nodes to open them in a new plugin tab.
- Use the create-edge dialog or floating edge toolbar to create and adjust connections.
- Fast preview: Use `Ctrl+Shift+Alt+C` to insert a canvas preview right into your current document.

### Canvas Operations

| Operation | Description |
| ---------------------------------- | --------------------------------------------------- |
| Left-click card | Select |
| `Ctrl`/`Shift` + Click | Multi-select |
| Drag any part of card | Move card (title bars hidden by default, drag card directly) |
| `Shift` + Drag card | Constrain movement to horizontal/vertical axis |
| `Alt`/`Option` + Drag card | Duplicate card and drag the copy |
| `Alt` + `Shift` + Drag card | Duplicate card with axis-constrained movement |
| Drag card edge handles | Resize from any side |
| Drag bottom-right corner | Resize width and height simultaneously |
| Drag card anchor point | Create edge (release on empty space for card type menu) |
| Click near edge endpoint | Start endpoint reconnection dragging |
| Drag-select on empty space | Batch-select cards and edges within the selection rectangle |
| Drag file/folder in sidebar | Move to another folder to reorganize hierarchy |
| Right-drag canvas | Pan view |
| Scroll to zoom | Zoom centered on cursor position (0.1x ~ 2.5x), mobile supports pinch-to-zoom |
| Double-click text card | Enter edit mode |
| Double-click file card | Open the corresponding document or canvas |
| Click Grid Snap button | Toggle snap-to-grid for precise alignment |
| `Ctrl+Shift+Alt+C` | Quick-insert Canvas preview popup at cursor in current document |
| Right sidebar "Canvas Files" | Browse workspace canvas files, create/sort/context menu |

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
- Unknown JSON Canvas fields are preserved during parse and save for maximum compatibility with Obsidian.
- The current implementation prioritizes file-format compatibility and core editing over full visual parity with Obsidian Canvas.

## Appendix

- For feedback and suggestions about this plugin, leave a comment at: [画布"无界"，思考有方 —— 一个兼容 Obsidian Canvas 的思源笔记插件 - 链滴](https://ld246.com/article/1777692508369)
- Related post: [为了让思源笔记用起来更顺手，我打算开发 10 个插件，目前进度…… - 链滴](https://ld246.com/article/1775894033664)
