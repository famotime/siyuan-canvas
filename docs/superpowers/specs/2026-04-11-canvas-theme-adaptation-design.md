# Canvas Theme Adaptation Design

Date: 2026-04-11

## Goal

Make the canvas editor tab follow SiYuan's light and dark themes automatically, with live updates when the host theme changes.

## Scope

In scope:

- canvas editor tab content only
- automatic theme sync while the tab stays open
- replacing hard-coded light-theme colors in the canvas workspace with host-aware theme tokens
- tests for live theme syncing and canvas root theme state

Out of scope:

- plugin settings dialog styling
- changes to canvas document data
- persisted theme preferences

## Existing Context

Current canvas UI styling in `src/components/canvas/CanvasWorkspace.vue` is mostly hard-coded for a light appearance:

- warm gradients on the shell background
- light-only toolbar, inspector, node, and popover colors
- fixed text and border colors that do not track the host theme

The plugin already runs inside a SiYuan custom tab and has access to the SiYuan plugin `eventBus`.

The SiYuan plugin API exposes the `switch-protyle-mode` event, which is suitable for reacting to host theme changes.

## Approved Approach

Use a lightweight host-theme bridge plus canvas-specific semantic CSS tokens.

### Theme sync mechanism

- Add a small theme synchronizer in `src/main.ts`.
- On mount, detect the current host theme mode from the surrounding DOM.
- Subscribe to SiYuan's `switch-protyle-mode` event.
- When the event fires, re-read the host DOM state and apply `data-theme-mode="light"` or `data-theme-mode="dark"` to the mounted canvas root element immediately.
- Unsubscribe on unmount.

Theme mode is host UI state, not canvas editor business state, so it should not be stored in `use-canvas-editor.ts`.

### Styling model

- Define canvas semantic tokens on `.canvas-shell`, such as:
  - `--canvas-bg`
  - `--canvas-surface`
  - `--canvas-surface-elevated`
  - `--canvas-border`
  - `--canvas-text`
  - `--canvas-text-muted`
  - `--canvas-accent`
  - `--canvas-grid`
  - `--canvas-shadow`
- Default those tokens to SiYuan `--b3-*` variables wherever practical.
- Use `data-theme-mode` only for small dark-mode overrides where host variables alone are not enough, such as:
  - stage grid opacity
  - floating toolbar backdrop
  - selection box contrast
  - card shadows
  - color-chip fill transparency for selected node colors

## UI Areas To Update

- canvas shell background
- top toolbar and buttons
- stage background, grid, selection box, edges, and labels
- canvas nodes, group nodes, anchors, resize handles, and selected state
- markdown preview typography surfaces
- floating selection toolbar and its popovers/tooltips
- inspector panel, cards, recent items, inputs, and conflict panel

## Error Handling And Constraints

- If host theme detection fails, default to `light` and keep semantic tokens valid.
- Theme changes must not require reopening the tab.
- Theme sync must not mutate canvas document state or plugin settings.
- Multiple canvas tabs can exist at once; each mounted root must manage its own theme attribute.

## Testing Strategy

Follow TDD.

Add failing tests first for:

- mount-layer theme sync:
  - applies the detected mode on initial mount
  - updates the mounted root when `switch-protyle-mode` fires
  - stops reacting after unmount
- workspace rendering:
  - renders a stable canvas root theme hook that can be styled by the mount layer
  - keeps the existing selection-toolbar and node tests intact

## Success Criteria

The change is complete when:

- the canvas editor visually matches SiYuan light theme when the host is light
- the canvas editor visually matches SiYuan dark theme when the host is dark
- switching SiYuan theme updates an already-open canvas tab immediately
- no canvas document behavior changes
- tests cover theme sync and pass
