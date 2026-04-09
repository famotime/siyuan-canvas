# Floating Selection Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add single-select and multi-select floating toolbars for canvas cards, including color, selection centering, grouping, and align actions.

**Architecture:** Keep document mutations and selection geometry in pure helpers so the Vue layer stays thin. Extend the editor hook with toolbar state, popover state, and selection-scoped actions, then render the toolbar and popovers from `CanvasWorkspace.vue`.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vite, SiYuan plugin API

---

## File structure

- `src/canvas/types.ts`
  - Add shared types for selection bounds, layout actions, and toolbar popover state.
- `src/canvas/document.ts`
  - Keep all pure document mutations here: selection bounds, color application, grouping, membership lookup, and layout actions.
- `src/canvas/selection-toolbar.ts`
  - Add pure helpers for viewport centering math and toolbar/popup screen placement.
- `src/canvas/use-canvas-editor.ts`
  - Integrate the new pure helpers with editor state, drag behavior, popover toggling, and bound actions returned to the workspace.
- `src/components/canvas/CanvasWorkspace.vue`
  - Render the floating toolbar, color palette, and align submenu; wire them into the existing inline-edit entry points.
- `tests/canvas-document.test.ts`
  - Regression coverage for pure selection/document mutations.
- `tests/canvas-selection-toolbar.test.ts`
  - Regression coverage for pure toolbar placement and viewport centering helpers.
- `tests/canvas-workspace.test.ts`
  - Regression coverage for toolbar rendering, popovers, and button behavior.

## Task 1: Selection Bounds, Color, and Grouping Helpers

**Files:**
- Modify: `src/canvas/types.ts`
- Modify: `src/canvas/document.ts`
- Test: `tests/canvas-document.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it("computes combined bounds for selected nodes", () => {
  const document = {
    nodes: [
      { id: "n1", type: "text", text: "one", x: 20, y: 40, width: 120, height: 80 },
      { id: "n2", type: "text", text: "two", x: 210, y: 150, width: 90, height: 60 },
    ],
    edges: [],
  }

  expect(getCanvasSelectionBounds(document, ["n1", "n2"])).toEqual({
    x: 20,
    y: 40,
    width: 280,
    height: 170,
  })
})

it("applies one color to selected nodes only", () => {
  const document = {
    nodes: [
      { id: "n1", type: "text", text: "one", x: 0, y: 0, width: 100, height: 80 },
      { id: "n2", type: "text", text: "two", x: 120, y: 0, width: 100, height: 80 },
    ],
    edges: [],
  }

  const next = setCanvasNodesColor(document, ["n2"], "6")

  expect(next.nodes).toMatchObject([
    { id: "n1", color: undefined },
    { id: "n2", color: "6" },
  ])
})

it("creates a group node around selected nodes with padding", () => {
  const document = {
    nodes: [
      { id: "n1", type: "text", text: "one", x: 50, y: 70, width: 120, height: 80 },
      { id: "n2", type: "text", text: "two", x: 230, y: 160, width: 90, height: 60 },
    ],
    edges: [],
  }

  const { document: next, groupId } = createCanvasGroupForNodes(document, ["n1", "n2"], 24)
  const group = next.nodes.find(node => node.id === groupId)

  expect(group).toMatchObject({
    type: "group",
    label: "Group",
    x: 26,
    y: 46,
    width: 318,
    height: 198,
  })
})

it("finds nodes fully enclosed by a group", () => {
  const document = {
    nodes: [
      { id: "group-1", type: "group", label: "Group", x: 0, y: 0, width: 400, height: 300 },
      { id: "n1", type: "text", text: "one", x: 20, y: 30, width: 120, height: 80 },
      { id: "n2", type: "text", text: "two", x: 320, y: 250, width: 120, height: 80 },
    ],
    edges: [],
  }

  expect(findCanvasNodesInGroup(document, "group-1")).toEqual(["n1"])
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/canvas-document.test.ts -t "computes combined bounds|applies one color|creates a group node|finds nodes fully enclosed"`

Expected: `FAIL` because `getCanvasSelectionBounds`, `setCanvasNodesColor`, `createCanvasGroupForNodes`, and `findCanvasNodesInGroup` do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
export interface CanvasBounds {
  x: number
  y: number
  width: number
  height: number
}

export function getCanvasSelectionBounds(
  document: CanvasDocument,
  nodeIds: string[],
): CanvasBounds | null {
  const nodes = document.nodes.filter(node => nodeIds.includes(node.id))
  if (nodes.length === 0) {
    return null
  }

  const minX = Math.min(...nodes.map(node => node.x))
  const minY = Math.min(...nodes.map(node => node.y))
  const maxX = Math.max(...nodes.map(node => node.x + node.width))
  const maxY = Math.max(...nodes.map(node => node.y + node.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function setCanvasNodesColor(
  document: CanvasDocument,
  nodeIds: string[],
  color: string,
): CanvasDocument {
  const selected = new Set(nodeIds)
  return {
    ...document,
    nodes: document.nodes.map(node => (selected.has(node.id) ? { ...node, color } : node)),
  }
}

export function createCanvasGroupForNodes(
  document: CanvasDocument,
  nodeIds: string[],
  padding = 24,
): { document: CanvasDocument, groupId: string } {
  const bounds = getCanvasSelectionBounds(document, nodeIds)
  if (!bounds) {
    throw new Error("Cannot create a group without selected nodes.")
  }

  const group = createCanvasNode("group")
  group.x = bounds.x - padding
  group.y = bounds.y - padding
  group.width = bounds.width + padding * 2
  group.height = bounds.height + padding * 2

  return {
    groupId: group.id,
    document: upsertCanvasNode(document, group),
  }
}

export function findCanvasNodesInGroup(document: CanvasDocument, groupId: string): string[] {
  const group = document.nodes.find(
    (node): node is Extract<CanvasNode, { type: "group" }> => node.id === groupId && node.type === "group",
  )
  if (!group) {
    return []
  }

  return document.nodes
    .filter(node =>
      node.id !== group.id
      && node.x >= group.x
      && node.y >= group.y
      && node.x + node.width <= group.x + group.width
      && node.y + node.height <= group.y + group.height,
    )
    .map(node => node.id)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/canvas-document.test.ts -t "computes combined bounds|applies one color|creates a group node|finds nodes fully enclosed"`

Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add src/canvas/types.ts src/canvas/document.ts tests/canvas-document.test.ts
git commit -m "feat: add canvas selection bounds and grouping helpers"
```

## Task 2: Layout, Distribution, and Stretch Actions

**Files:**
- Modify: `src/canvas/types.ts`
- Modify: `src/canvas/document.ts`
- Test: `tests/canvas-document.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it("left aligns selected nodes to the selection bounds", () => {
  const document = {
    nodes: [
      { id: "n1", type: "text", text: "one", x: 20, y: 0, width: 100, height: 80 },
      { id: "n2", type: "text", text: "two", x: 180, y: 60, width: 90, height: 80 },
    ],
    edges: [],
  }

  const next = applyCanvasNodeLayout(document, ["n1", "n2"], "left-align")

  expect(next.nodes).toMatchObject([
    { id: "n1", x: 20 },
    { id: "n2", x: 20 },
  ])
})

it("distributes selected nodes horizontally by center point", () => {
  const document = {
    nodes: [
      { id: "n1", type: "text", text: "one", x: 0, y: 0, width: 100, height: 80 },
      { id: "n2", type: "text", text: "two", x: 80, y: 0, width: 100, height: 80 },
      { id: "n3", type: "text", text: "three", x: 320, y: 0, width: 100, height: 80 },
    ],
    edges: [],
  }

  const next = applyCanvasNodeLayout(document, ["n1", "n2", "n3"], "distribute-horizontal")

  expect(next.nodes).toMatchObject([
    { id: "n1", x: 0 },
    { id: "n2", x: 160 },
    { id: "n3", x: 320 },
  ])
})

it("arranges selected nodes into a row with a fixed gap", () => {
  const document = {
    nodes: [
      { id: "n1", type: "text", text: "one", x: 220, y: 120, width: 100, height: 80 },
      { id: "n2", type: "text", text: "two", x: 20, y: 10, width: 80, height: 60 },
      { id: "n3", type: "text", text: "three", x: 120, y: 80, width: 120, height: 70 },
    ],
    edges: [],
  }

  const next = applyCanvasNodeLayout(document, ["n1", "n2", "n3"], "arrange-row")

  expect(next.nodes).toMatchObject([
    { id: "n2", x: 20, y: 10 },
    { id: "n3", x: 132, y: 10 },
    { id: "n1", x: 284, y: 10 },
  ])
})

it("stretches selected nodes horizontally to the selection width", () => {
  const document = {
    nodes: [
      { id: "n1", type: "text", text: "one", x: 20, y: 0, width: 100, height: 80 },
      { id: "n2", type: "text", text: "two", x: 180, y: 60, width: 90, height: 80 },
    ],
    edges: [],
  }

  const next = applyCanvasNodeLayout(document, ["n1", "n2"], "stretch-horizontal")

  expect(next.nodes).toMatchObject([
    { id: "n1", x: 20, width: 250 },
    { id: "n2", x: 20, width: 250 },
  ])
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/canvas-document.test.ts -t "left aligns selected nodes|distributes selected nodes horizontally|arranges selected nodes into a row|stretches selected nodes horizontally"`

Expected: `FAIL` because `applyCanvasNodeLayout` and its action type do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
export type CanvasNodeLayoutAction =
  | "left-align"
  | "center-horizontal"
  | "right-align"
  | "top-align"
  | "center-vertical"
  | "bottom-align"
  | "arrange-row"
  | "arrange-column"
  | "arrange-grid"
  | "distribute-horizontal"
  | "distribute-vertical"
  | "stretch-horizontal"
  | "stretch-vertical"

export function applyCanvasNodeLayout(
  document: CanvasDocument,
  nodeIds: string[],
  action: CanvasNodeLayoutAction,
): CanvasDocument {
  const bounds = getCanvasSelectionBounds(document, nodeIds)
  if (!bounds || nodeIds.length === 0) {
    return document
  }

  switch (action) {
    case "left-align":
      return patchSelectedNodes(document, nodeIds, node => ({ x: bounds.x }))
    case "distribute-horizontal":
      return distributeHorizontally(document, nodeIds)
    case "arrange-row":
      return arrangeInRow(document, nodeIds, 32)
    case "stretch-horizontal":
      return patchSelectedNodes(document, nodeIds, () => ({
        x: bounds.x,
        width: bounds.width,
      }))
    default:
      return document
  }
}

function patchSelectedNodes(
  document: CanvasDocument,
  nodeIds: string[],
  patcher: (node: CanvasNode) => Partial<CanvasNode>,
): CanvasDocument {
  const selected = new Set(nodeIds)
  return {
    ...document,
    nodes: document.nodes.map(node => (selected.has(node.id) ? { ...node, ...patcher(node) } : node)),
  }
}
```

Implement the remaining action branches before closing the task so all 13 menu items from the spec resolve through the same dispatcher.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/canvas-document.test.ts`

Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add src/canvas/types.ts src/canvas/document.ts tests/canvas-document.test.ts
git commit -m "feat: add canvas layout actions"
```

## Task 3: Toolbar Geometry and Editor Integration

**Files:**
- Create: `src/canvas/selection-toolbar.ts`
- Modify: `src/canvas/use-canvas-editor.ts`
- Test: `tests/canvas-selection-toolbar.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it("centers the viewport on selection bounds without changing scale", () => {
  const next = centerViewportOnBounds(
    { x: -80, y: -40, scale: 1.5 },
    { width: 900, height: 700 },
    { x: 100, y: 200, width: 300, height: 120 },
    { left: 0, top: 0 },
  )

  expect(next).toEqual({
    scale: 1.5,
    x: 150,
    y: -80,
  })
})

it("places the toolbar above the selection and flips below when needed", () => {
  expect(resolveSelectionToolbarPosition(
    { x: 100, y: 120, width: 280, height: 160 },
    { width: 900, height: 700 },
    { width: 220, height: 48 },
  )).toMatchObject({ x: 130, y: 64, placement: "top" })

  expect(resolveSelectionToolbarPosition(
    { x: 100, y: 8, width: 280, height: 160 },
    { width: 900, height: 700 },
    { width: 220, height: 48 },
  )).toMatchObject({ placement: "bottom" })
})

it("uses enclosed nodes when dragging a group card", () => {
  const document = {
    nodes: [
      { id: "group-1", type: "group", label: "Group", x: 0, y: 0, width: 300, height: 220 },
      { id: "n1", type: "text", text: "one", x: 20, y: 20, width: 120, height: 80 },
      { id: "n2", type: "text", text: "two", x: 260, y: 170, width: 80, height: 80 },
    ],
    edges: [],
  }

  expect(resolveDragNodeIds(document, "group-1", ["group-1"])).toEqual(["group-1", "n1"])
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/canvas-selection-toolbar.test.ts`

Expected: `FAIL` because `centerViewportOnBounds`, `resolveSelectionToolbarPosition`, and `resolveDragNodeIds` do not exist yet.

- [ ] **Step 3: Write the minimal implementation and integrate the editor**

```ts
export function centerViewportOnBounds(
  viewport: { x: number, y: number, scale: number },
  stageSize: { width: number, height: number },
  bounds: CanvasBounds,
  boardOffset: { left: number, top: number },
) {
  const centerX = (bounds.x - boardOffset.left + bounds.width / 2) * viewport.scale
  const centerY = (bounds.y - boardOffset.top + bounds.height / 2) * viewport.scale
  return {
    scale: viewport.scale,
    x: stageSize.width / 2 - centerX,
    y: stageSize.height / 2 - centerY,
  }
}

export function resolveSelectionToolbarPosition(
  selectionRect: CanvasBounds,
  stageSize: { width: number, height: number },
  toolbarSize: { width: number, height: number },
) {
  const unclampedX = selectionRect.x + selectionRect.width / 2 - toolbarSize.width / 2
  const x = Math.min(
    stageSize.width - toolbarSize.width - 12,
    Math.max(12, unclampedX),
  )
  const topY = selectionRect.y - toolbarSize.height - 8
  if (topY >= 12) {
    return { x, y: topY, placement: "top" as const }
  }
  return { x, y: selectionRect.y + selectionRect.height + 8, placement: "bottom" as const }
}

export function resolveDragNodeIds(
  document: CanvasDocument,
  draggedNodeId: string,
  selectedNodeIds: string[],
): string[] {
  const draggedNode = document.nodes.find(node => node.id === draggedNodeId)
  if (draggedNode?.type === "group") {
    return [draggedNodeId, ...findCanvasNodesInGroup(document, draggedNodeId)]
  }
  return selectedNodeIds.includes(draggedNodeId) ? selectedNodeIds : [draggedNodeId]
}
```

Then extend `useCanvasEditor` to:

- track `selectionToolbarPopover`
- expose `selectionToolbar`, `selectionColors`, `selectionLayoutActions`
- add `centerSelectionInViewport()`
- add `applySelectionColor(color: string)`
- add `createGroupFromSelection()`
- add `applySelectionLayout(action: CanvasNodeLayoutAction)`
- close the open popover on `Escape`, selection change, and action execution
- switch drag resolution from raw `selectedNodeIds` to `resolveDragNodeIds(...)`

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/canvas-selection-toolbar.test.ts`

Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add src/canvas/selection-toolbar.ts src/canvas/use-canvas-editor.ts tests/canvas-selection-toolbar.test.ts
git commit -m "feat: add selection toolbar editor actions"
```

## Task 4: Workspace Toolbar UI, Popovers, and Final Verification

**Files:**
- Modify: `src/components/canvas/CanvasWorkspace.vue`
- Modify: `tests/canvas-workspace.test.ts`
- Modify: `src/canvas/use-canvas-editor.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it("renders the single-selection floating toolbar actions", () => {
  currentEditor = createEditorMock()
  currentEditor.selectedNode = createTextNode()
  currentEditor.selectedNodeCount = 1
  currentEditor.selectionToolbar = {
    visible: true,
    x: 120,
    y: 40,
    placement: "top",
  }

  const wrapper = mount(CanvasWorkspace, {
    props: {
      bootstrap: {},
      plugin: {},
      setTitle: vi.fn(),
    },
  })

  expect(wrapper.find("[data-test='selection-toolbar']").exists()).toBe(true)
  expect(wrapper.find("[data-test='selection-edit']").exists()).toBe(true)
  expect(wrapper.find("[data-test='selection-group']").exists()).toBe(false)
})

it("renders the multi-selection toolbar and opens the align menu", async () => {
  currentEditor = createEditorMock()
  currentEditor.selectedNodeCount = 2
  currentEditor.selectionToolbar = {
    visible: true,
    x: 120,
    y: 40,
    placement: "top",
  }
  currentEditor.selectionLayoutActions = [
    { action: "left-align", label: "左对齐" },
    { action: "center-horizontal", label: "水平居中" },
  ]
  currentEditor.selectionToolbarPopover = "layout"

  const wrapper = mount(CanvasWorkspace, {
    props: {
      bootstrap: {},
      plugin: {},
      setTitle: vi.fn(),
    },
  })

  expect(wrapper.find("[data-test='selection-group']").exists()).toBe(true)
  expect(wrapper.find("[data-test='selection-align-menu']").text()).toContain("左对齐")
})

it("uses the toolbar edit button to enter inline text editing", async () => {
  currentEditor = createEditorMock(createTextNode())
  currentEditor.selectedNode = createTextNode()
  currentEditor.selectedNodeCount = 1
  currentEditor.selectionToolbar = {
    visible: true,
    x: 120,
    y: 40,
    placement: "top",
  }

  const wrapper = mount(CanvasWorkspace, {
    props: {
      bootstrap: {},
      plugin: {},
      setTitle: vi.fn(),
    },
  })

  await wrapper.find("[data-test='selection-edit']").trigger("click")

  expect(wrapper.find(".canvas-node__editor").exists()).toBe(true)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/canvas-workspace.test.ts -t "floating toolbar|align menu|toolbar edit button"`

Expected: `FAIL` because the toolbar markup and bindings are not rendered yet.

- [ ] **Step 3: Write the minimal implementation**

```vue
<div
  v-if="editor.selectionToolbar?.visible"
  class="selection-toolbar"
  data-test="selection-toolbar"
  :style="{ left: `${editor.selectionToolbar.x}px`, top: `${editor.selectionToolbar.y}px` }"
>
  <button data-test="selection-delete" @click="editor.deleteSelection">删除</button>
  <button data-test="selection-color" @click="editor.toggleSelectionPopover('color')">颜色</button>
  <button data-test="selection-center" @click="editor.centerSelectionInViewport">居中显示</button>
  <button
    v-if="editor.selectedNodeCount === 1"
    data-test="selection-edit"
    @click="handleToolbarEdit"
  >
    编辑
  </button>
  <button
    v-else
    data-test="selection-group"
    @click="editor.createGroupFromSelection"
  >
    创建分组
  </button>
  <button
    v-if="editor.selectedNodeCount > 1"
    data-test="selection-align"
    @click="editor.toggleSelectionPopover('layout')"
  >
    对齐
  </button>
</div>
```

Also add:

- color popover rendering from `editor.selectionColors`
- align submenu rendering from `editor.selectionLayoutActions`
- `handleToolbarEdit()` that reuses the existing text-card inline editing flow
- `@pointerdown.stop` on toolbar and popovers so clicks do not leak into the stage
- styles for toolbar, palette, and menu that match the approved dark floating appearance

- [ ] **Step 4: Run the targeted and broader verification**

Run:

```bash
npm test -- tests/canvas-workspace.test.ts
npm test -- tests/canvas-document.test.ts tests/canvas-selection-toolbar.test.ts tests/canvas-workspace.test.ts
npm test
npm run build
```

Expected:

- all targeted toolbar tests `PASS`
- full test suite `PASS`
- build completes successfully

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/CanvasWorkspace.vue src/canvas/use-canvas-editor.ts tests/canvas-workspace.test.ts
git commit -m "feat: add floating selection toolbar UI"
```

## Self-review

### Spec coverage

- Single-selection floating toolbar: Task 4
- Multi-selection floating toolbar: Task 4
- Fixed color palette via node `color`: Tasks 1 and 4
- Selection centering without coordinate mutation: Task 3
- Group creation with `24px` padding: Task 1, editor selection handoff in Task 3
- Geometric group membership and group drag: Tasks 1 and 3
- Align/distribute/arrange/stretch menu actions: Task 2 and Task 4
- Popover mutual exclusion and close behavior: Task 3 and Task 4
- TDD-first workflow and verification: all tasks

No uncovered spec requirements remain.

### Placeholder scan

- No `TODO`, `TBD`, or deferred “implement later” steps remain.
- Every code-touching step includes concrete file targets and code examples.
- Every verification step includes exact commands and expected outcomes.

### Type consistency

The plan uses these names consistently across all tasks:

- `CanvasBounds`
- `CanvasNodeLayoutAction`
- `getCanvasSelectionBounds`
- `setCanvasNodesColor`
- `createCanvasGroupForNodes`
- `findCanvasNodesInGroup`
- `applyCanvasNodeLayout`
- `centerViewportOnBounds`
- `resolveSelectionToolbarPosition`
- `resolveDragNodeIds`
