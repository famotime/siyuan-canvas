# Bottom Toolbar And Collapsible Inspector Design

Date: 2026-04-12

## Goal

Rework the canvas workspace controls so node creation moves out of the top bar and into a bottom floating toolbar, while the right inspector sections gain collapsible headers with persisted state.

The approved behavior is:

- remove `导出`、`设置`、`文本`、`文件`、`链接`、`分组`、`删除` from the top toolbar
- add a bottom floating toolbar with icon actions for `文本`、`文件`、`连线`、`分组`
- show that floating toolbar only when the canvas area is focused or otherwise editable
- open a connection dialog from the toolbar, using the same fields and creation logic as the current inspector edge-creation block
- make every inspector module expandable and collapsible
- persist inspector collapse state across plugin reopen

## Scope

In scope:

- top toolbar action removal
- bottom floating toolbar rendering, styling, icons, and visibility rules
- connection dialog UI and submit flow
- collapsible inspector sections
- persisted inspector section state in plugin data
- tests for the new UI states and persistence normalization

Out of scope:

- new export or settings entry points
- bringing back delete as a visible primary action
- changing drag-to-connect anchor behavior on nodes
- redesigning the existing single-selection floating toolbar
- changing canvas document format

## Existing Context

Current workspace structure in `src/components/canvas/CanvasWorkspace.vue` has:

- a top toolbar containing file actions, node-creation actions, delete, zoom, and status
- a stage area with node drag-connect anchors and the existing selection floating toolbar
- a right inspector with six always-expanded sections:
  - document
  - recent files
  - multi-selection summary
  - node editor
  - edge creation
  - edge editor

Current edge creation already exists in the inspector and is driven by editor state in `src/canvas/use-canvas-editor.ts`:

- `newEdgeTargetId`
- `newEdgeLabel`
- `newEdgeFromSide`
- `newEdgeToSide`
- `createEdgeFromSelection()`

Plugin persistence currently stores only:

- `settings`
- `recentFiles`

in `src/canvas/plugin-data.ts`.

## Alternatives Considered

### 1. Recommended: keep file and viewport controls in the top bar, move only creation controls to a bottom floating toolbar, persist inspector UI state in a new `ui` object

Why this is recommended:

- it preserves the current document and zoom status layout
- it keeps creation actions spatially closer to the stage
- it avoids mixing pure UI state into business settings
- it reuses the existing edge-creation state with minimal behavioral churn

### 2. Put all removed actions into the inspector

Rejected because:

- it would make creation slower and more panel-dependent
- it fights the requested bottom-toolbar interaction
- it adds more inspector clutter just before making that area collapsible

### 3. Persist collapse state inside `settings`

Rejected because:

- section expansion is per-UI preference, not plugin behavior configuration
- it would make `settings` harder to reason about over time

## Approved Design

### Top toolbar

Keep these top-bar elements:

- `新建`
- `打开`
- `保存`
- zoom out
- zoom percent reset button
- zoom in
- current file label
- graph stats
- dirty or saved state

Remove these top-bar buttons entirely:

- `导出`
- `设置`
- `文本`
- `文件`
- `链接`
- `分组`
- `删除`

No replacement top-bar overflow or secondary menu is added for the removed actions.

### Bottom floating toolbar

Add a stage-level floating toolbar anchored to the bottom center of the visible canvas area.

Actions:

1. add text node
2. add file node
3. open connection dialog
4. add group node

Behavior:

- icon-first presentation, matching the compact interaction style already used by the selection toolbar
- visible only when the canvas area is active for editing
- hidden when the tab is not focused on the stage and the workspace is not in an editable canvas interaction state
- rendered outside the scaled world content so zoom does not change its hit area

### Toolbar visibility model

Use an editor-owned boolean state that tracks whether the stage is active.

The toolbar becomes visible when any of the following happens:

- the user clicks or pointer-downs inside the stage
- the user starts a stage interaction such as panning, selecting, dragging, resizing, or connecting
- a node interaction keeps the canvas in the active editing context

The toolbar hides when focus leaves the canvas shell to another unrelated control area or tab context.

Practical rule for implementation:

- treat the toolbar as visible while the canvas shell contains the active element or while the most recent pointer interaction happened inside the stage
- do not hide it just because the user opened the connection dialog from the toolbar

### Connection dialog

Add a modal dialog opened from the bottom toolbar, while keeping the existing inspector edge-creation section available and collapsible.

Dialog fields are identical to the current inspector edge-creation UI:

- target node
- edge label
- from side
- to side

Behavior:

- only available when exactly one source node is selected
- if the user opens the dialog without a valid single selected node, show a lightweight message and do not open the dialog
- submit reuses the existing `createEdgeFromSelection()` logic
- cancel leaves the current selection untouched
- after successful creation, keep the existing behavior of selecting the created edge

The dialog should use the same dialog style direction as existing text and confirm dialogs in `src/canvas/text-input-dialog.ts` and `src/canvas/confirm-dialog.ts`, but it needs a dedicated helper because it contains multiple fields.

### Inspector sections

Make every inspector block a shared collapsible section component or section pattern with:

- header title
- toggle button
- expanded content body

Sections to support:

- document
- recent files
- selection
- node
- create edge
- edge

Rendering rules:

- the section header always remains visible when the inspector itself is expanded
- the body mounts only when expanded
- existing conditional sections still depend on selection state first, then expansion state

Examples:

- if there is no selected edge, the `edge` section stays absent rather than collapsed
- if there is a selected node, the `node` section appears and can then be expanded or collapsed

### Persisted UI state

Extend plugin data with a dedicated `ui` object.

Recommended shape:

```ts
interface CanvasPluginUiState {
  inspectorSections: {
    createEdge: boolean
    document: boolean
    edge: boolean
    node: boolean
    recent: boolean
    selection: boolean
  }
}
```

Persistence rules:

- `true` means expanded
- default all sections to `true`
- normalize missing or invalid persisted values back to defaults
- keep this state separate from `settings`

This state should round-trip through the same plugin-data normalization path already used for recent files and settings.

## Architecture

### Plugin data layer

Update `src/canvas/plugin-data.ts` to:

- define the new UI-state types
- provide default UI-state factories
- normalize persisted values
- include UI state in the plugin data versioned shape

The version can remain `1` if normalization is backward compatible and tolerant of missing `ui`. No document migration is needed beyond defaulting absent fields.

### Editor layer

Extend `src/canvas/use-canvas-editor.ts` with:

- bottom-toolbar visibility state
- methods to mark the stage active and inactive
- connection-dialog form state and open or close methods
- a method to toggle persisted inspector section state through the plugin bridge

Prefer editor methods such as:

- `activateCanvasSurface()`
- `deactivateCanvasSurface()`
- `openCreateEdgeDialog()`
- `closeCreateEdgeDialog()`
- `toggleInspectorSection(sectionKey)`

Keep the actual edge creation logic centralized in the existing action method so both old and new callers do not diverge.

### Workspace component

Update `src/components/canvas/CanvasWorkspace.vue` to:

- remove the retired top-bar buttons
- render the bottom floating toolbar
- wire stage focus and pointer activity into the editor active-state methods
- replace inspector section headers with collapsible toggles
- keep the inline inspector edge-creation form body, but place it inside a collapsible section
- render the create-edge dialog markup when requested

Recommended final behavior:

- keep the inspector `create edge` section as the detailed inline form
- add the dialog as a stage-adjacent shortcut that reuses the same form state and creation action
- make both entry points behave consistently and stay backed by one shared edge-creation state

### Icon strategy

Reuse the existing canvas toolbar icon component approach in `src/components/canvas/canvas-selection-toolbar-icon.ts`.

Add icons for:

- text
- file
- edge or connect
- group
- section collapse chevron if not already available through plain text

Keep labels accessible through `title`, `aria-label`, and tooltip text even when the button body is icon-only.

## Error Handling And Constraints

- Opening the connection dialog with no single selected node should not throw; show a message and keep the toolbar visible.
- If the selected source node disappears while the dialog is open, submit should no-op with a user message and close the dialog.
- Inspector collapse state must survive missing or partial persisted data.
- Toolbar visibility logic must not depend on browser focus quirks alone; pointer activity should also keep it stable.
- Removing top-bar delete must not break keyboard delete or existing selection-toolbar delete.

## Testing Strategy

Follow TDD.

### Plugin-data tests

Add failing tests first for:

- default UI-state creation
- normalization when `ui` is absent
- normalization when section flags are invalid

### Editor tests

Add failing tests first for:

- opening the connection dialog only with a valid single selected node
- dialog submit reusing edge-creation state and action flow
- inspector section toggle updating persisted UI state
- bottom toolbar visibility changing with stage activation

### Workspace tests

Add failing tests first for:

- removed top-bar buttons are no longer rendered
- bottom floating toolbar renders with icon buttons
- toolbar hidden before canvas activation and visible after stage interaction
- clicking the connect button opens the dialog
- inspector sections render collapse toggles
- collapsed sections hide their bodies
- persisted collapsed state is reflected on mount

## Implementation Sequence

1. Add plugin-data failing tests for the new UI state.
2. Implement UI-state defaults and normalization until green.
3. Add editor failing tests for toolbar visibility, dialog gating, and inspector state toggling.
4. Implement editor support state and actions until green.
5. Add workspace failing tests for the bottom toolbar, dialog, and collapsible inspector sections.
6. Implement the Vue template and styling until green.
7. Run targeted test files.
8. Run the broader canvas test suite for regression confidence.

## Open Decisions Resolved

The following choices were resolved with the user:

- the bottom floating toolbar shows only when the canvas area has focus or is otherwise in an editable state
- `导出`、`设置`、`删除` are removed from the UI entirely because other entry points already exist
- inspector section collapse state must persist across plugin reopen
- the recommended architecture is the chosen one

## Success Criteria

The change is complete when:

- the top toolbar no longer shows the removed action buttons
- the bottom floating toolbar appears only in the approved active-canvas cases
- text, file, connect, and group actions are available from bottom toolbar icons
- the connect action opens a dialog matching the previous edge-creation fields
- successful dialog submission creates an edge through the existing creation flow
- inspector sections can be expanded and collapsed independently
- inspector collapse state persists after reopening the plugin
- tests cover persistence, editor behavior, and workspace rendering
