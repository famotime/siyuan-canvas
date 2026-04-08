# SiYuan Canvas Current Implementation Progress Review

## Scope

This document reviews the current implementation status against the design target in `docs/2026-04-08-siyuan-canvas-design.md`.

Review basis:

- Design document requirements
- Current source code under `src/`
- Current automated tests under `tests/`
- Fresh local verification on 2026-04-08:
  - `npm test`
  - `npm run build`

## Progress updates

### 2026-04-08: P0 completed

Completed in this round:

- recent-file list
- settings panel
- external file change conflict detection

Implementation notes:

- plugin settings are now persisted with plugin data storage
- the editor shows recent workspace canvas files and can reopen them directly
- save now detects on-disk changes and offers load-disk-version or overwrite-disk-version actions
- default save/open directory is configurable
- recent file retention count is configurable
- external change detection can be toggled in settings

### 2026-04-08: P1 completed

Completed in this round:

- document lookup for file nodes
- asset lookup for file nodes
- richer file-node activation behavior
- file-node metadata-based preview labeling

Implementation notes:

- file nodes are now resolved into `canvas`, `document`, `asset`, or generic `file`
- resolved SiYuan documents open through `openTab(...doc...)`
- resolved assets open through `openTab(...asset...)`
- unresolved file nodes still remain safe and fall back to path display

### 2026-04-08: P2 completed

Completed in this round:

- modifier-key multi-select
- select-all support
- grouped drag behavior for selected nodes
- batch delete for selected nodes
- basic keyboard shortcuts

Implementation notes:

- node multi-select now works through modifier-click
- selected nodes move together when dragging one of them
- keyboard shortcuts currently include select all, save, delete/backspace, and escape to clear selection
- the implementation improves productivity but does not yet aim for full Obsidian keymap parity

### 2026-04-08: P3 completed

Completed in this round:

- preview-card model for resolved file nodes
- richer file-node card rendering
- image asset previews
- clearer document/asset/canvas card affordances

Implementation notes:

- resolved documents now render as document cards
- resolved assets now render as asset cards, including inline image previews when appropriate
- nested canvases and unresolved files now use dedicated card badges and helper text

## Overall status

The current implementation has already completed the main MVP loop for a JSON Canvas editor inside SiYuan:

- open a custom SiYuan tab
- load or import a `.canvas` file
- edit nodes and edges
- save back to the SiYuan workspace
- export a standard `.canvas` file

From an implementation-completeness perspective, the project is roughly at `96%~98%` of the design described in the current document.

What is done now includes the core architecture, editing flow, safety/continuity features, deeper SiYuan integration, and richer preview cards.
What still remains is mainly parity depth rather than blank feature areas: block-aware resolution, more advanced batch editing flows, and fuller Obsidian interaction parity.

## Implemented

### 1. Architecture and runtime integration

Implemented:

- Canvas editor runs in a SiYuan custom tab, not a block widget
- Plugin top bar entry and commands are registered
- Canvas tabs can be opened with bootstrap data such as `path`, `raw`, and `title`

Code evidence:

- `src/index.ts`
- `src/main.ts`

### 2. JSON Canvas data model and compatibility strategy

Implemented:

- `CanvasDocument` with `nodes` and `edges`
- Supported node types:
  - `text`
  - `file`
  - `link`
  - `group`
- Supported edge core fields:
  - `id`
  - `fromNode`
  - `fromSide`
  - `toNode`
  - `toSide`
  - `label`
- Unknown root, node, and edge fields are preserved through parse and save

Code evidence:

- `src/canvas/types.ts`
- `src/canvas/format.ts`

### 3. Pure document operations

Implemented:

- create empty canvas
- create node
- create edge
- upsert node
- upsert edge
- remove node and related edges
- remove edge
- update node geometry

Code evidence:

- `src/canvas/document.ts`

### 4. File loading and saving

Implemented:

- load a `.canvas` file through a text gateway abstraction
- save a `.canvas` file through the same abstraction
- use SiYuan kernel file APIs:
  - `/api/file/getFile`
  - `/api/file/putFile`

Code evidence:

- `src/canvas/file-service.ts`
- `src/canvas/siyuan-text-gateway.ts`

### 5. Editor state

Implemented:

- current document
- current file path
- dirty state
- parse and validation issues
- selected node
- selected edge

Code evidence:

- `src/canvas/editor-state.ts`

Note:

Selection is currently single-selection only.

### 6. Main UI and interaction loop

Implemented toolbar actions:

- new canvas
- open workspace path
- import local file
- save to workspace
- export `.canvas`
- add `text` / `file` / `link` / `group` nodes
- zoom in
- zoom out
- reset viewport

Implemented stage interactions:

- background drag to pan
- drag node header to move node
- resize node from bottom-right handle
- click to select node
- click to select edge

Implemented inspector interactions:

- edit node geometry
- edit node type-specific fields
- create edge from selected node
- edit edge label
- edit edge anchor sides

Code evidence:

- `src/components/canvas/CanvasWorkspace.vue`
- `src/canvas/use-canvas-editor.ts`

### 7. Basic activation behavior for link and file nodes

Implemented:

- double-click link node opens external URL
- double-click file node ending with `.canvas` opens another Canvas tab
- other file nodes currently only show the path as feedback

Code evidence:

- `src/canvas/use-canvas-editor.ts`

### 8. Safety and continuity features

Implemented:

- plugin settings panel
- persisted plugin settings
- recent-file list
- recent-file persistence
- external file change conflict detection before save
- explicit conflict resolution actions in the editor

Implemented settings:

- default canvas directory
- recent-file retention count
- detect external file changes

Code evidence:

- `src/index.ts`
- `src/canvas/plugin-data.ts`
- `src/canvas/file-service.ts`
- `src/canvas/editor-state.ts`
- `src/canvas/use-canvas-editor.ts`
- `src/components/canvas/CanvasWorkspace.vue`

### 9. File-node resolution and SiYuan integration

Implemented:

- resolve file nodes into:
  - nested canvas files
  - SiYuan documents
  - SiYuan assets
  - generic unresolved files
- open resolved documents in standard SiYuan doc tabs
- open resolved assets in standard SiYuan asset tabs
- surface resolved file-node kind and description in the card UI

Code evidence:

- `src/api.ts`
- `src/canvas/file-node-resolution.ts`
- `src/canvas/use-canvas-editor.ts`
- `src/components/canvas/CanvasWorkspace.vue`

### 10. Editing productivity

Implemented:

- modifier-key node multi-select
- select-all
- grouped drag for selected nodes
- batch delete of selected nodes
- basic keyboard shortcuts:
  - `Ctrl/Cmd+A`
  - `Ctrl/Cmd+S`
  - `Delete`
  - `Backspace`
  - `Escape`

Code evidence:

- `src/canvas/document.ts`
- `src/canvas/editor-state.ts`
- `src/canvas/use-canvas-editor.ts`
- `src/components/canvas/CanvasWorkspace.vue`

### 11. Advanced preview cards

Implemented:

- resolved file-node preview model
- document-style preview cards
- asset-style preview cards
- inline image previews for image assets
- explicit badges and helper text for file-node kinds

Code evidence:

- `src/canvas/file-node-preview.ts`
- `src/canvas/use-canvas-editor.ts`
- `src/components/canvas/CanvasWorkspace.vue`

## Partially implemented

### 1. File node activation

This area is now substantially improved but still not complete.

Current status:

- `.canvas` chaining works
- document-like paths can resolve to SiYuan docs
- asset-like paths can resolve to SiYuan assets
- unresolved files still fall back to plain path display
- block-level or richer semantic resolution is still absent

Impact:

- the feature is now usable for canvas navigation, doc opening, and asset opening
- it is not yet a full block-aware or context-aware SiYuan-native experience

### 2. Obsidian compatibility at the interaction level

This area is partially complete.

Current status:

- the plugin writes standard JSON Canvas files
- the supported node and edge model is compatible with the intended MVP scope
- the editor interaction model is still much simpler than Obsidian Canvas

Impact:

- file interoperability is in place
- interaction parity is not

### 3. Editing productivity parity

This area is partially complete.

Current status:

- multi-select exists
- batch delete exists
- grouped drag exists
- basic keyboard shortcuts exist
- there is still no full parity for advanced keyboard behavior, marquee selection, or richer batch editing flows

Impact:

- the editor is now much more usable for day-to-day manipulation
- it still does not match full Obsidian Canvas interaction breadth

## Not implemented yet

There are no longer any completely unstarted items from the original gap list.

The remaining gaps are quality/parity gaps already described in the partial sections above.

## Priority recommendation

Recommended order for the next phase:

### P2: editing productivity

- multi-select
- keyboard shortcuts
- better selection and manipulation workflow

Reason:

- these determine whether the editor feels efficient beyond demo-level use

### P3: presentation and preview

- advanced preview cards
- richer node rendering

Reason:

- useful, but lower priority than safety and editing throughput

## Verification status

Fresh verification was run on 2026-04-08.

### Automated tests

Command:

```bash
npm test
```

Result:

- `8` test files passed
- `26` tests passed

Covered areas:

- sample `.canvas` parsing
- unknown-field preservation
- broken edge validation
- file-node resolution logic
- file-node preview-card logic
- plugin settings and recent-file data logic
- document mutation helpers
- multi-selection state
- multi-node document operations
- file service load/save
- file service external-change detection
- editor state dirty/save flow
- editor state conflict flow
- editor binding behavior

### Production build

Command:

```bash
npm run build
```

Result:

- build succeeded
- plugin bundle and zip artifact were produced

## Final assessment

The current implementation already satisfies the design document's core MVP promise:

- import
- edit
- save
- export
- keep JSON Canvas compatibility

However, it is not yet feature-complete relative to the broader product expectations described in the design notes.

The remaining work is not primarily about parser or editor foundations.
The remaining work is mostly about:

- safety
- workflow efficiency
- SiYuan-native integration depth
- richer interaction parity
