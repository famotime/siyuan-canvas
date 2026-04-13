# Edge Toolbar And Reconnect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add direct on-canvas edge editing with side-aware arrows, endpoint reconnection, deletion-on-blank-drop, an edge floating toolbar, and inline edge label editing.

**Architecture:** Extend the existing edge document model with explicit arrow endpoints, move path/tangent math into testable helpers, and mirror the node floating-toolbar pattern for selected edges. Keep gesture state in the existing editor gesture module and render edge UI as an SVG-plus-HTML overlay inside the workspace stage.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vue Test Utils

---

### Task 1: Edge Helper Tests

**Files:**
- Modify: `tests/canvas-selection-toolbar.test.ts`
- Modify: `tests/canvas-document.test.ts`
- Modify: `src/canvas/selection-toolbar.ts`
- Modify: `src/canvas/document.ts`

- [ ] Step 1: Add failing tests for side-aware edge tangent output and edge toolbar positioning.
- [ ] Step 2: Run `pnpm test -- tests/canvas-selection-toolbar.test.ts` and verify the new cases fail for the expected missing helpers or wrong output.
- [ ] Step 3: Implement the minimal path and positioning helpers in `src/canvas/selection-toolbar.ts`.
- [ ] Step 4: Run `pnpm test -- tests/canvas-selection-toolbar.test.ts` and verify it passes.
- [ ] Step 5: Add failing document-helper tests for edge label/color/direction/endpoint updates.
- [ ] Step 6: Run `pnpm test -- tests/canvas-document.test.ts` and verify the new cases fail.
- [ ] Step 7: Implement the minimal edge mutation helpers in `src/canvas/document.ts`.
- [ ] Step 8: Run `pnpm test -- tests/canvas-document.test.ts` and verify it passes.

### Task 2: Editor Gesture And State Tests

**Files:**
- Modify: `tests/canvas-selection-toolbar.test.ts`
- Modify: `src/canvas/use-canvas-editor.ts`
- Modify: `src/canvas/use-canvas-editor-gestures.ts`

- [ ] Step 1: Add failing editor tests for edge centering, edge direction changes, inline label edit state, reconnecting an endpoint, and deleting an edge when dropping on blank space.
- [ ] Step 2: Run `pnpm test -- tests/canvas-selection-toolbar.test.ts` and verify the new cases fail for missing editor behavior.
- [ ] Step 3: Implement minimal editor state/actions and gesture handling in `src/canvas/use-canvas-editor.ts` and `src/canvas/use-canvas-editor-gestures.ts`.
- [ ] Step 4: Re-run `pnpm test -- tests/canvas-selection-toolbar.test.ts` and verify it passes.

### Task 3: Workspace UI Tests

**Files:**
- Modify: `tests/canvas-workspace.test.ts`
- Modify: `src/components/canvas/CanvasWorkspace.vue`

- [ ] Step 1: Add failing workspace tests for edge toolbar rendering, direction menu actions, endpoint handles, dual marker wiring, and inline label input.
- [ ] Step 2: Run `pnpm test -- tests/canvas-workspace.test.ts` and verify the new cases fail.
- [ ] Step 3: Implement the minimal workspace SVG/HTML overlay UI in `src/components/canvas/CanvasWorkspace.vue`.
- [ ] Step 4: Re-run `pnpm test -- tests/canvas-workspace.test.ts` and verify it passes.

### Task 4: Regression Verification

**Files:**
- Modify: `src/canvas/types.ts`
- Modify: `src/canvas/editor-bindings.ts`
- Modify: `src/i18n/canvas.ts`
- Modify: `tests/canvas-use-editor-actions.test.ts`

- [ ] Step 1: Add any missing type, binding, and i18n coverage for the new edge actions.
- [ ] Step 2: Run targeted regression suites covering editor bindings and actions.
- [ ] Step 3: Run `pnpm test`.
- [ ] Step 4: Fix any regressions and re-run `pnpm test` until green.
