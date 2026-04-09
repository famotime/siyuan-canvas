# Floating Selection Toolbar Design

Date: 2026-04-09

## Goal

Add selection-scoped floating toolbars for canvas cards:

- Single-card selection shows 4 actions:
  - delete
  - color
  - center in viewport
  - edit
- Multi-card selection shows 5 actions:
  - delete
  - color
  - center in viewport
  - create group
  - align

The interaction should match the user's provided references: a compact toolbar anchored to the selected card or selected card set, with an align submenu for batch actions.

## Scope

In scope:

- Floating selection toolbar for node selections only
- Single-selection and multi-selection action variants
- Fixed color palette applied through the node `color` field
- Viewport centering for one node or a selected node set
- Group creation around selected nodes
- Alignment, arrangement, distribution, and stretch actions for selected nodes
- Group dragging that carries currently enclosed nodes
- Tests covering document helpers, editor behavior, and toolbar rendering

Out of scope:

- Freeform color picker
- Edge selection toolbar
- Marquee selection
- Persistent group membership metadata
- Auto-layout constraints after actions complete

## Existing Context

Current code already provides:

- additive node multi-selection
- grouped dragging for manually selected nodes
- batch deletion for selected nodes
- inline editing for text cards on double click
- full-board viewport reset/centering
- `color` support in the canvas node model

Current gaps:

- no floating selection toolbar
- no selection-relative viewport centering
- no batch color action
- no group creation around an existing selection
- no align/distribute/arrange actions
- group nodes do not currently carry enclosed nodes when dragged

## Recommended Approach

Use one shared floating-toolbar system anchored to the selected nodes' screen-space bounding box.

Why this approach:

- It matches the reference images closely.
- Single-select and multi-select variants can share the same placement logic.
- It keeps complex behavior in pure document/editor helpers instead of burying logic in the Vue template.
- It is straightforward to test with document-level pure functions and editor-level action methods.

Alternatives considered and rejected:

1. Anchor the toolbar to the top-right corner of the selection.
   - Rejected because it is more likely to collide with content and viewport edges on tall stacks.
2. Use different anchor positions for single and multi selection.
   - Rejected because it adds unnecessary interaction variance and more conditional rendering logic.

## Interaction Model

### Toolbar visibility

- Show the floating toolbar only when one or more nodes are selected.
- Do not show it for edge selection or blank canvas state.
- Group nodes count as nodes and can show the same toolbar patterns.

### Toolbar placement

- Compute a combined selection bounding box in board coordinates.
- Convert that box into screen coordinates using the current viewport transform.
- Anchor the toolbar above the top-center of that selection box.
- If there is not enough space above, flip the toolbar below the selection box.
- Clamp the toolbar horizontally so it stays inside the visible stage.
- Keep toolbar size in screen pixels so zoom level does not affect hit targets.

### Single selection actions

- `Delete`: remove the selected node.
- `Color`: open a color palette popover and apply one color to the selected node.
- `Center`: adjust viewport only, so the selected node center lands in the window center.
- `Edit`:
  - for text nodes, enter the existing inline markdown editor flow
  - for non-text nodes, reuse the current double-click activation behavior

### Multi selection actions

- `Delete`: remove all selected nodes.
- `Color`: apply one color to all selected nodes.
- `Center`: adjust viewport only, so the selected nodes' combined center lands in the window center.
- `Create group`: create a new group node around the selected nodes.
- `Align`: open a submenu containing batch layout actions.

### Popover behavior

- Only one selection popover can be open at a time.
- Color palette and align submenu are mutually exclusive.
- Close the open popover when:
  - the user clicks outside the toolbar/popover
  - the selection changes
  - the user presses `Escape`
  - the user executes a menu action

## Color Model

Use a fixed palette mapped to the existing canvas `color` field.

Behavior:

- Apply the chosen color to all selected nodes.
- If a node does not currently include a `color` field, write it.
- Do not introduce a new color storage format.

Reasoning:

- Keeps compatibility with the existing `.canvas` document format.
- Keeps the first version compact and easy to test.
- Matches the user's stated requirement of changing border and translucent background through node color.

## Selection Centering

Add a dedicated selection-centering action separate from the current full-board reset.

Behavior:

- For one selected node, center that node.
- For multiple selected nodes, center the combined selection bounds.
- Do not modify node coordinates.
- Only update viewport `x`, `y`, and preserve the current `scale`.

## Group Creation and Membership

### Group creation

- Compute the selected nodes' combined bounds.
- Expand those bounds by a fixed padding of `24px` on all sides.
- Create a new `group` node using those bounds.
- Default group label: `Group`.
- After creation, select only the newly created group node.
- Render groups behind other node types, preserving the current drawing convention.

### Membership model

Do not store explicit membership lists.

Instead:

- Treat a node as belonging to a group when the node is fully enclosed by the group rectangle.
- Membership is evaluated geometrically from current coordinates.

This matches the user's approved rule:

- dragging the group carries currently enclosed cards
- cards moved outside the group bounds stop following

### Group drag behavior

When dragging a group node:

- find all nodes currently fully enclosed by that group, excluding the group itself
- translate those nodes by the same drag delta
- translate the group itself by the same drag delta

When resizing a group:

- do not scale enclosed nodes
- do not snap nodes to the new bounds
- only the geometry changes, which may alter future membership

## Align Menu

The align menu will expose the following actions in this order:

1. left align
2. horizontal center
3. right align
4. top align
5. vertical center
6. bottom align
7. arrange in row
8. arrange in column
9. arrange in grid
10. distribute horizontally
11. distribute vertically
12. stretch horizontally
13. stretch vertically

All operations apply only to selected nodes and use the selected nodes' combined bounds as the reference box.

### Edge alignments

- `Left align`: set all selected nodes' `x` to the selection left edge.
- `Horizontal center`: align each node's horizontal midpoint to the selection horizontal midpoint.
- `Right align`: align each node's right edge to the selection right edge.
- `Top align`: set all selected nodes' `y` to the selection top edge.
- `Vertical center`: align each node's vertical midpoint to the selection vertical midpoint.
- `Bottom align`: align each node's bottom edge to the selection bottom edge.

### Distribution

- `Distribute horizontally`:
  - preserve each node width
  - sort selected nodes left-to-right
  - keep the first and last nodes as anchors
  - spread intermediate nodes evenly by center point
- `Distribute vertically`:
  - preserve each node height
  - sort selected nodes top-to-bottom
  - keep the first and last nodes as anchors
  - spread intermediate nodes evenly by center point

### Arrangement

- `Arrange in row`:
  - sort by current visual order left-to-right then top-to-bottom
  - place into one row
  - use a fixed gap of `32px`
- `Arrange in column`:
  - sort by current visual order top-to-bottom then left-to-right
  - place into one column
  - use a fixed gap of `24px`
- `Arrange in grid`:
  - preserve approximate current layout shape
  - derive column count from the current selection aspect ratio
  - use fixed gaps consistent with row/column arrangement

### Stretch

- `Stretch horizontally`:
  - set all selected nodes to share the selection left and right edges
  - update both `x` and `width`
- `Stretch vertically`:
  - set all selected nodes to share the selection top and bottom edges
  - update both `y` and `height`

## Architecture

### Document helpers

Add pure helpers in `src/canvas/document.ts` for:

- computing node bounds and selection bounds
- applying a color to a node set
- centering calculations for selection bounds
- creating a group node from selected nodes
- align/distribute/arrange/stretch operations
- finding nodes enclosed by a group

These helpers should remain UI-agnostic and return updated `CanvasDocument` values.

### Editor actions

Extend `src/canvas/use-canvas-editor.ts` with:

- selection-toolbar visibility and placement state
- current open popover state
- selection centering action
- batch color action
- create-group action
- align action dispatcher
- group-drag expansion so enclosed nodes move with the dragged group

Keep `resetViewport()` as the existing full-board action. Add a separate selection-centering method instead of overloading it.

### Workspace component

Extend `src/components/canvas/CanvasWorkspace.vue` with:

- floating selection toolbar markup
- color palette popover
- align submenu
- click-outside and keyboard-close wiring
- button handlers for single-select and multi-select action variants

The toolbar should be rendered relative to the stage container, not inside scaled world content.

## Error Handling and Constraints

- Ignore align and distribution actions when fewer than 2 nodes are selected.
- Ignore arrange/grid actions when the selection is empty.
- Avoid crashes if a selected node disappears while a popover is open; close the popover and continue.
- Preserve non-selected nodes and all unrelated edges.
- Do not mutate viewport when stage dimensions are unavailable.

## Testing Strategy

Follow strict TDD.

### Document tests

Add failing tests first for:

- computing combined bounds
- applying color to selected nodes
- creating a group node around a selection
- finding nodes enclosed by a group
- each align/distribute/arrange/stretch helper

### Editor tests

Add failing tests first for:

- centering viewport on a selected node
- centering viewport on multi-selection bounds
- dragging a group moves enclosed nodes
- color and align actions close popovers after execution

### Workspace tests

Add failing tests first for:

- single-selection toolbar rendering
- multi-selection toolbar rendering
- align menu visibility
- color palette visibility
- edit button reusing existing inline text edit flow
- toolbar hidden when selection is empty or edge-only

## Implementation Sequence

1. Add document-level failing tests.
2. Implement minimal document helpers until green.
3. Add editor-level failing tests.
4. Implement minimal editor actions until green.
5. Add component-level failing tests.
6. Implement toolbar UI and popovers until green.
7. Run the relevant targeted test files.
8. Run the broader test suite for regression confidence.

## Open Decisions Resolved

The following design choices were explicitly resolved with the user:

- multi-select color applies directly to all selected cards
- toolbar anchor approach is top-centered relative to the selection bounds
- group membership is based on geometric containment, not explicit metadata

## Success Criteria

The feature is complete when:

- selecting one node shows the single-selection floating toolbar
- selecting multiple nodes shows the multi-selection floating toolbar
- color updates selected node appearance through existing node color data
- selection centering moves the chosen card or card set to the viewport center
- group creation wraps the selected nodes with the agreed padding
- dragging a group carries currently enclosed nodes
- align actions reposition only the selected nodes as specified
- tests cover document helpers, editor actions, and toolbar rendering
