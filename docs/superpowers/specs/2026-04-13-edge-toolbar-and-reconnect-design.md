# Edge Toolbar And Reconnect Design

Date: 2026-04-13

## Goal

Improve canvas edge editing so selected edges can be edited directly on the board:

- edge arrows follow the actual connected side direction
- selected edges show a floating toolbar
- selected edges expose draggable endpoints for reconnecting
- dragging an endpoint to blank space deletes the whole edge
- edge labels can be edited inline near the edge midpoint

## Confirmed Interaction Rules

- `fromNode/fromSide -> toNode/toSide` is the single-direction semantic
- single direction shows an arrow only at the `to` end
- bidirectional shows arrows at both ends
- no direction shows no arrows
- dropping a dragged endpoint on a non-anchor deletes the entire edge
- editing edge text happens inline near the edge midpoint, not in a dialog

## Existing Context

- `CanvasEdge` currently stores node ids, sides, optional `label`, and optional `color`
- edge rendering in `CanvasWorkspace.vue` uses one shared SVG marker at `marker-end`
- edge paths in `use-canvas-editor.ts` use a horizontal-only cubic Bezier control scheme
- connection drag creation already exists in `use-canvas-editor-gestures.ts`
- node selection already has a floating toolbar pattern that should be mirrored for edges

## Recommended Approach

Keep the current edge data model and extend it with explicit endpoint arrow booleans:

- `startArrow?: boolean`
- `endArrow?: boolean`

This keeps rendering direct and avoids forcing a separate enum that the UI would still need to translate into start/end markers.

## Rendering Design

### Edge path tangents

Edge curves should use side-aware control vectors instead of a fixed horizontal midpoint:

- `top`: control point offset upward
- `right`: control point offset rightward
- `bottom`: control point offset downward
- `left`: control point offset leftward

This ensures SVG `orient="auto"` markers align with the true tangent at each endpoint, so top connections point up and bottom connections point down.

### Arrow display

- no direction: no markers
- single direction: `marker-end` only
- bidirectional: both `marker-start` and `marker-end`

### Edge label display

- labels render near the edge midpoint
- entering edit mode overlays an HTML input near that midpoint
- empty submit removes the `label` field

## Interaction Design

### Floating toolbar

Show the edge toolbar only when exactly one edge is selected.

Buttons:

- delete
- color
- center in viewport
- direction submenu: no direction, single direction, bidirectional
- edit label

Placement:

- anchor to the selected edge midpoint in screen space
- prefer above the edge midpoint
- clamp within the visible stage

### Endpoint drag editing

When an edge is selected:

- show one handle at the `from` anchor
- show one handle at the `to` anchor

Behavior:

- dragging a handle starts an edge-end draft
- moving over a valid anchor previews the reconnection target
- releasing on a valid anchor updates that edge endpoint
- releasing on blank space removes the edge

### Selection behavior

- selecting an edge clears node selection, unchanged from current editor state behavior
- opening an edge popover closes node popovers and vice versa
- `Escape` closes edge popovers first, then clears selection

## Architecture

### `src/canvas/document.ts`

Add pure helpers for:

- updating edge label
- updating edge color
- updating edge direction booleans
- updating one edge endpoint target

### `src/canvas/selection-toolbar.ts`

Extend toolbar helpers with midpoint-based floating positioning for edges.

### `src/canvas/use-canvas-editor.ts`

Add:

- edge toolbar state and popover state
- edge midpoint positioning helpers
- edge color/direction actions
- inline edge label editing state and submit/cancel actions
- viewport centering for a selected edge

### `src/canvas/use-canvas-editor-gestures.ts`

Add:

- selected-edge endpoint drag handling
- edge reconnection preview
- deletion on blank drop

### `src/components/canvas/CanvasWorkspace.vue`

Add:

- per-edge markers for start/end arrows
- selected-edge endpoint handles
- floating edge toolbar
- inline edge label input

## Testing Strategy

Follow TDD:

1. add pure helper tests for edge path tangents and edge mutation helpers
2. add editor tests for edge centering, direction updates, label editing state, and endpoint drag outcomes
3. add workspace tests for edge toolbar rendering, direction menu actions, endpoint handles, and inline label input
4. run targeted suites, then broader regression tests

## Success Criteria

The work is complete when:

- top-connected arrows point up and bottom-connected arrows point down
- selected edges show a floating toolbar with the requested actions
- selected edges allow endpoint drag reconnection
- dropping an endpoint on blank space deletes the edge
- edge labels can be edited inline near the edge midpoint
