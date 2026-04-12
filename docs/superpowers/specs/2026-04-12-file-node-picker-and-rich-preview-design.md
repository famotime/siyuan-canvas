# File Node Picker And Rich Preview Design

Date: 2026-04-12

## Goal

Upgrade the existing bottom-toolbar `文件` action so it creates real `file` nodes backed by selected SiYuan documents, `.canvas` files, and image targets instead of inserting a fixed placeholder path.

The approved behavior is:

- keep the toolbar label as `文件`
- keep using JSON Canvas `file` nodes instead of adding a new node type
- open a global picker that can search all SiYuan documents, workspace `.canvas` files, and image resources
- render document nodes with real content preview, clipped to a fixed card-preview viewport height
- render `.canvas` nodes with a real static thumbnail of the referenced canvas
- render image nodes as image cards
- allow manual target edits in the right inspector by path or block ID
- support pasting images into a saved workspace canvas, storing pasted files in the workspace filesystem next to the canvas
- continue opening the referenced target on double-click

## Scope

In scope:

- replacing placeholder `file` node creation with a picker-backed flow
- global search across SiYuan documents and image resources
- workspace-wide discovery for `.canvas` files
- target resolution from path or block ID
- rich preview data loading for document, `.canvas`, and image targets
- image paste support for saved workspace canvases
- inspector editing and re-resolution of file-node targets
- targeted tests for creation, resolution, preview refresh, paste flows, and double-click behavior

Out of scope:

- introducing a new `note` or `image` node type
- changing the `.canvas` document format beyond standard `file` node paths and optional subpath usage
- local non-workspace paste-to-disk support
- background synchronization of external file changes beyond the existing canvas file conflict handling
- special hidden SiYuan binding documents for pasted workspace images

## Existing Context

Current behavior in the repository:

- the bottom toolbar `文件` button calls `editor.addNode('file')` in `src/components/canvas/CanvasWorkspace.vue`
- `createCanvasNode('file')` in `src/canvas/document.ts` creates a placeholder node with `file: "assets/example.md"`
- `activateNode()` in `src/canvas/use-canvas-editor.ts` already supports double-click opening for:
  - nested `.canvas`
  - resolved SiYuan documents
  - resolved SiYuan assets
  - unresolved fallback paths
- `src/canvas/file-node-resolution.ts` currently resolves a file path into one of:
  - `canvas`
  - `document`
  - `asset`
  - `file`
- `src/canvas/file-node-preview.ts` already provides badge/headline/detail/helper metadata for file-node cards
- `src/canvas/markdown-preview.ts` already renders sanitized markdown previews for text nodes
- current asset lookup only resolves by asset path, not by block ID
- current editor has no picker dialog for file nodes and no clipboard image ingestion flow

Repository constraints relevant to this design:

- the plugin stores and edits standard JSON Canvas files
- SiYuan SQL is treated as read-only query support
- official APIs are used for file writes, block queries, block attrs, and asset upload

## Alternatives Considered

### 1. Recommended: keep the existing `file` node type and add a unified target-resolution plus rich-preview pipeline

Why this is recommended:

- it preserves JSON Canvas compatibility
- it reuses the existing double-click activation path
- it keeps new behavior additive instead of changing the document schema
- it centralizes the complexity of path and block-ID resolution instead of scattering it across the UI

### 2. Add a new `note` node type and separate image-specific node types

Rejected because:

- it would expand the JSON format and reduce interoperability
- it would duplicate much of the current `file` node rendering and activation logic
- it is unnecessary for the approved behavior

### 3. Treat pasted images as SiYuan assets and maintain hidden binding state so they are never cleaned up as unused assets

Rejected because:

- it introduces persistence and cleanup coupling that is much larger than the requested UI change
- current plugin architecture centers on workspace `.canvas` files, not document-backed canvas blocks
- pasted images can instead live beside the canvas in the workspace filesystem while still remaining valid JSON Canvas file targets

## Design

### 1. Node Model

The plugin continues to serialize all inserted references as standard JSON Canvas `file` nodes.

No new node type is added. The meaning of a `file` node becomes:

- a SiYuan document target
- a workspace `.canvas` target
- a SiYuan image resource target
- a workspace image file target created from clipboard paste
- an unresolved fallback path

The persisted `file` field remains the primary storage key. Existing files continue to open and render.

### 2. Picker Flow

Clicking the bottom-toolbar `文件` button opens a new picker dialog instead of inserting a placeholder node.

The picker supports one query box and three result groups:

- Documents
- Canvas files
- Images

Selection behavior:

- choosing a result immediately creates a `file` node at the standard insertion position
- the new node is selected
- target metadata and preview content are loaded asynchronously after insertion
- if the picker is closed or no result is chosen, no node is created

Search sources:

- Documents: query SiYuan documents from `blocks` using SQL-assisted search
- Images: query SiYuan `assets` records, limited to image file extensions
- Canvas files: scan workspace files for `.canvas` entries and filter in memory

Canvas-file discovery should be cached in memory for the session and refreshed when the current canvas is opened or saved so the dialog does not recursively scan the workspace on every keystroke.

### 3. Target Resolution

Introduce a dedicated target-resolution layer used by picker creation, inspector edits, initial document load, and paste flows.

The resolver accepts:

- raw path input
- raw block ID input

The resolver returns a normalized target model:

- `document`
- `canvas`
- `image`
- `file`

Resolution rules:

- if the input matches block-ID format:
  - first query image assets by `assets.block_id`
  - if found, resolve to `image`
  - otherwise query `blocks` for the block and resolve to its containing document
- if the input is a path:
  - resolve `.canvas` by extension first
  - resolve SiYuan documents by path or hpath
  - resolve SiYuan image assets by asset path
  - if not found, treat it as a generic file path

This keeps all entry points consistent. The UI never implements its own path-type branching.

### 4. Rich Preview Model

Replace the current badge-only file preview model with a richer target-preview payload that still preserves fallback card metadata.

Preview variants:

- Document preview
  - title
  - path or human path
  - sanitized rendered markdown excerpt
  - visual clipping inside the card viewport
- Canvas preview
  - title
  - path
  - static thumbnail generated from parsed target canvas nodes and edges
- Image preview
  - title
  - path
  - displayable image source
- Fallback file preview
  - title
  - path
  - unresolved helper copy

Document excerpt policy:

- load the leading document content from SiYuan APIs
- render with the existing markdown preview sanitizer
- clip with CSS inside the node instead of truncating the source string aggressively
- target a fixed card-preview viewport height so long documents do not dominate the node

Canvas thumbnail policy:

- load the referenced `.canvas` file as text
- parse it through the existing canvas parser
- compute a bounded static overview of nodes and edges
- render it as a non-interactive miniature stage inside the file card
- on parse failure, fall back to a canvas-flavored placeholder card

Image preview policy:

- for SiYuan image assets, use the resolved asset open path
- for workspace image files, load image data from the workspace file path and expose it as a displayable source
- non-image assets continue to fall back to the generic file card

### 5. Inspector Editing

The right inspector keeps a manual file-target field.

The field accepts either:

- a path
- a block ID

On change:

- update the node `file` field with the raw input value
- trigger re-resolution
- refresh the preview
- preserve the node even if resolution fails

Failed resolution is non-destructive. The node stays in the document and falls back to the unresolved file-card state.

### 6. Clipboard Image Paste

Add image-paste handling to the canvas surface with the following constraints:

- only active when the current canvas is a saved workspace `.canvas` file
- if the canvas is unsaved or opened as a local non-workspace file, image paste is rejected with a user-facing message
- pasted images are written to a sibling asset directory derived from the canvas filename

Recommended directory layout:

- `/path/to/example.canvas`
- `/path/to/example.assets/<generated-name>.png`

Paste flow:

1. detect an image item on paste
2. read the image blob
3. write the blob into the derived workspace asset directory through the official file API
4. create a `file` node pointing at the written image file
5. select the node and refresh preview metadata

This keeps pasted images independent from SiYuan asset-garbage-collection rules while preserving valid JSON Canvas file references.

### 7. Activation Behavior

Double-click behavior remains target-type driven:

- document target: open the SiYuan document tab
- canvas target: open the canvas tab
- image target: open the asset viewer when backed by a SiYuan asset, or keep the current node selected without additional navigation for workspace images
- unresolved target: keep the current informational fallback

For workspace image files created by clipboard paste, the first implementation does not need a specialized external viewer. Reliable preview inside the card is the primary behavior.

### 8. Module Boundaries

Recommended code split:

- `src/canvas/file-target-resolution.ts`
  - normalize path or block-ID input into a resolved target type
- `src/canvas/file-target-preview.ts`
  - load preview payloads for resolved targets
- `src/canvas/file-picker-dialog.ts`
  - dialog state and search orchestration
- `src/canvas/workspace-image-files.ts`
  - derive sibling asset directories and write pasted images
- existing `use-canvas-editor-file-nodes.ts`
  - consume the new resolver/preview services
- existing `CanvasWorkspace.vue`
  - render the picker dialog, richer file cards, and paste wiring

The existing `file-node-resolution.ts` and `file-node-preview.ts` may be adapted into the new layers or retained as compatibility helpers, but the final state should avoid having two separate target-model pipelines.

### 9. Error Handling

Failure rules:

- picker search failure shows empty results and a user-facing error message, but does not alter the document
- preview load failure does not remove nodes; it degrades to placeholder rendering
- invalid inspector input leaves the raw value in place and shows unresolved fallback UI
- paste write failure shows an error and does not create a node
- missing target files after load remain visible as unresolved nodes instead of being auto-deleted

### 10. Testing

Add targeted tests for:

- file-button flow opens the picker instead of inserting a placeholder node
- picker selection creates document, `.canvas`, and image targets correctly
- target resolution by:
  - document path
  - `.canvas` path
  - image asset path
  - image block ID
  - generic block ID resolving to containing document
  - invalid raw input
- document preview rendering and clipping behavior
- canvas-thumbnail fallback behavior on parse failure
- inspector edits causing preview refresh
- clipboard image paste for:
  - saved workspace canvas
  - unsaved canvas rejection
  - local file rejection
  - write failure rejection
- double-click activation for document, `.canvas`, and image targets

## Open Questions Closed During Design

These decisions were made during the design conversation:

- keep the toolbar label as `文件`
- keep the persisted node type as JSON Canvas `file`
- allow picker search across the whole SiYuan workspace
- allow manual inspector edits
- support block-ID input in the inspector
- support real document previews rather than title-only cards
- render real `.canvas` thumbnails rather than summary cards
- allow selecting existing SiYuan image resources
- support clipboard image paste
- store pasted images in workspace filesystem assets beside the current saved canvas instead of in SiYuan assets

## Implementation Notes

This design intentionally keeps pasted workspace images separate from SiYuan asset-index semantics. Existing SiYuan image resources remain selectable and openable through current SiYuan asset resolution, while pasted images become ordinary filesystem-backed JSON Canvas file targets.
