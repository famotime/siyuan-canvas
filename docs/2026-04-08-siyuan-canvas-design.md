# SiYuan Canvas Design And Implementation

## Goal

Build a SiYuan plugin that can import, edit, save, and export Obsidian `.canvas` files in a way that remains interoperable with Obsidian.

## Chosen architecture

- Host the editor in a SiYuan custom tab rather than a block widget
- Use JSON Canvas as the primary document model
- Keep plugin runtime state outside the `.canvas` file
- Read and write workspace files through `/api/file/getFile` and `/api/file/putFile`

## Data model

- `CanvasDocument`
  - `nodes`
  - `edges`
- Supported node types
  - `text`
  - `file`
  - `link`
  - `group`
- Supported edge fields
  - `id`
  - `fromNode`
  - `fromSide`
  - `toNode`
  - `toSide`
  - `label`

The parser preserves unknown root, node, and edge fields so the plugin does not discard forward-compatible JSON Canvas data during round trips.

## Implemented modules

- `src/canvas/format.ts`
  - JSON parsing, validation, serialization
- `src/canvas/document.ts`
  - Pure document mutation helpers for nodes and edges
- `src/canvas/file-service.ts`
  - Document load/save abstraction
- `src/canvas/editor-state.ts`
  - Editor state for document, path, selection, dirty state, and issues
- `src/canvas/siyuan-text-gateway.ts`
  - SiYuan file API adapter
- `src/canvas/use-canvas-editor.ts`
  - Vue-facing editor logic
- `src/components/canvas/CanvasWorkspace.vue`
  - Main editing UI

## Core interaction

- Toolbar actions
  - new canvas
  - open workspace path
  - import local file
  - save to workspace
  - export standard `.canvas`
  - add node types
  - zoom and reset viewport
- Stage interactions
  - pan by dragging the background
  - drag node headers to move nodes
  - resize nodes from the bottom-right handle
  - click to select nodes or edges
- Inspector interactions
  - edit geometry and type-specific fields
  - create edges from the selected node
  - edit edge label and side anchors

## Compatibility decisions

- The plugin writes standard JSON Canvas output only
- No SiYuan-private fields are injected into exported `.canvas` files
- File nodes keep their original path strings unless the user edits them
- Unknown JSON Canvas fields are preserved on round trip

## Verification completed

- Automated tests cover:
  - parsing the provided sample `.canvas`
  - unknown-field preservation
  - broken edge validation
  - document mutation helpers
  - file service load/save
  - editor state dirty/save flow
- Production build completes successfully with Vite

## Known gaps after this implementation

- No recent-file list or settings panel yet
- No external file change conflict detection yet
- No full Obsidian interaction parity such as multi-select, keyboard map parity, or advanced preview cards
- File-node activation only deepens support for `.canvas` chaining and basic path visibility, not full SiYuan document resolution
