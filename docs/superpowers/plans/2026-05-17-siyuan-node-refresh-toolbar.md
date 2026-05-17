# Siyuan Node Refresh Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a refresh button to the floating selection toolbar for single-selected SiYuan document/block file nodes so users can sync the latest note content into the canvas card preview.

**Architecture:** Extend file-node metadata refresh to support targeted node refreshes, expose a selection-aware editor action and capability flag, then render a conditional toolbar button that calls that action. Keep preview generation in the existing file-node helper path so full refreshes and targeted refreshes share the same code.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vue Test Utils, SiYuan plugin APIs

---

### Task 1: Document The Feature Contract

**Files:**
- Create: `docs/superpowers/specs/2026-05-17-siyuan-node-refresh-toolbar-design.md`
- Create: `docs/superpowers/plans/2026-05-17-siyuan-node-refresh-toolbar.md`

- [ ] **Step 1: Re-state the behavior and file ownership**

Write down these rules in the spec:

```md
- Show the refresh button only for single-selected file nodes resolved as `document` or `block`.
- Clicking refresh updates preview content only; it does not mutate the node's `file` field.
- Refresh failures keep existing preview data and surface a message.
```

- [ ] **Step 2: Self-check the written scope**

Confirm the spec covers:

```md
- UI visibility conditions
- data-refresh entry point
- preview regeneration path
- error handling
- tests for editor logic and workspace rendering
```

- [ ] **Step 3: Commit the docs**

Run:

```bash
git add docs/superpowers/specs/2026-05-17-siyuan-node-refresh-toolbar-design.md docs/superpowers/plans/2026-05-17-siyuan-node-refresh-toolbar.md
git commit -m "docs: 补充思源节点刷新按钮设计与实现计划"
```

Expected: commit succeeds with only the two docs files staged.

### Task 2: Write The Failing Refresh Behavior Test

**Files:**
- Modify: `tests/canvas-use-editor-actions.test.ts`

- [ ] **Step 1: Add a failing editor-level test for targeted preview refresh**

Add a test near the existing document-preview coverage:

```ts
it("refreshes the selected Siyuan document node preview with the latest content", async () => {
  fileNodeLookupMock.findSiyuanDocumentByPath.mockResolvedValue({
    hpath: "/Projects/Roadmap",
    id: "20260412094047-ihhbskn",
    path: "/data/roadmap.sy",
    title: "Roadmap",
  })
  fileNodeLookupMock.getSiyuanDocumentMarkdown
    .mockResolvedValueOnce("# Roadmap\n\nOld body")
    .mockResolvedValueOnce("# Roadmap\n\nNew body")

  const { editor, wrapper } = await mountEditor()

  await editor.selectFilePickerResult({
    kind: "document",
    path: "/data/roadmap.sy",
    subtitle: "/Projects/Roadmap",
    title: "Roadmap",
  })
  await flushEditor()

  expect(editor.getFileNodePreview(editor.selectedNode).previewHtml).toContain("<p>Old body</p>")

  await editor.refreshSelectedSiyuanNode()
  await flushEditor()

  expect(editor.getFileNodePreview(editor.selectedNode).previewHtml).toContain("<p>New body</p>")
  expect(editor.canRefreshSelectedSiyuanNode).toBe(true)

  wrapper.unmount()
})
```

- [ ] **Step 2: Run the focused test and verify it fails for the right reason**

Run:

```bash
pnpm test -- tests/canvas-use-editor-actions.test.ts
```

Expected: FAIL because `refreshSelectedSiyuanNode` and/or `canRefreshSelectedSiyuanNode` do not exist yet.

- [ ] **Step 3: Commit the failing test**

Run:

```bash
git add tests/canvas-use-editor-actions.test.ts
git commit -m "test: 补充思源节点定向刷新失败用例"
```

Expected: commit succeeds with the single failing test file.

### Task 3: Write The Failing Toolbar Rendering Test

**Files:**
- Modify: `tests/canvas-workspace.test.ts`

- [ ] **Step 1: Add a failing toolbar visibility and click test**

Add a component test near the single-selection floating toolbar block:

```ts
it("shows a refresh button for a single selected Siyuan document node and triggers refresh", async () => {
  const node = {
    id: "file-1",
    type: "file",
    file: "/data/roadmap.sy",
    x: 0,
    y: 0,
    width: 320,
    height: 180,
  }
  currentEditor = createEditorMock(node)
  currentEditor.selectionToolbar = { placement: "top", visible: true, x: 144, y: 88 }
  currentEditor.state.selectedNodeIds = [node.id]
  currentEditor.getFileNodePreview = vi.fn(() => ({
    badge: "Document",
    detail: "/Projects/Roadmap",
    headline: "Roadmap",
    helper: "Opens in SiYuan",
    kind: "document",
  }))
  currentEditor.canRefreshSelectedSiyuanNode = true
  currentEditor.refreshSelectedSiyuanNode = vi.fn()

  const wrapper = mount(CanvasWorkspace, {
    props: { bootstrap: {}, plugin: {}, setTitle: vi.fn() },
  })

  expect(wrapper.find("[data-testid='selection-toolbar-refresh']").exists()).toBe(true)

  await wrapper.find("[data-testid='selection-toolbar-refresh']").trigger("click")

  expect(currentEditor.refreshSelectedSiyuanNode).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the focused workspace test and verify it fails correctly**

Run:

```bash
pnpm test -- tests/canvas-workspace.test.ts
```

Expected: FAIL because the refresh button is not rendered yet.

- [ ] **Step 3: Commit the failing UI test**

Run:

```bash
git add tests/canvas-workspace.test.ts
git commit -m "test: 补充浮动工具栏刷新按钮失败用例"
```

Expected: commit succeeds with the new failing UI test.

### Task 4: Implement Targeted File-Node Refresh

**Files:**
- Modify: `src/canvas/use-canvas-editor-file-nodes.ts`
- Modify: `src/canvas/use-canvas-editor.ts`

- [ ] **Step 1: Extract single-node metadata resolution in `use-canvas-editor-file-nodes.ts`**

Refactor the helper so both full refresh and targeted refresh use one path:

```ts
async function resolveFileNodeMetadata(node: Extract<CanvasNode, { type: "file" }>) {
  const resolved = await resolveCanvasFileTarget(node.file, { ...lookups })

  let enriched: ResolvedCanvasFileTarget & {
    detail: string
    excerptHtml?: string
    imageSrc?: string
    thumbnail?: CanvasFileTargetPreview["thumbnail"]
  } = {
    ...resolved,
    detail: resolved.path,
  }

  if (resolved.kind === "block") {
    enriched = await withBlockPreview(resolved)
  }

  if (resolved.kind === "document") {
    enriched = await withDocumentPreview(resolved)
  }

  if (resolved.kind === "canvas") {
    const canvasPreview = await loadCanvasTargetPreview(resolved, {
      readCanvasText: readWorkspaceCanvasText,
    })
    enriched = {
      ...resolved,
      detail: resolved.path,
      thumbnail: canvasPreview.thumbnail,
    }
  }

  return enriched
}
```

- [ ] **Step 2: Add optional node-id filtering to metadata refresh**

Update the refresh function to merge targeted updates instead of replacing everything:

```ts
async function refreshFileNodeMetadata(nodeIds?: string[]) {
  const version = ++fileNodeResolveVersion
  const fileNodes = state.document.nodes.filter((node): node is Extract<CanvasNode, { type: "file" }> => (
    node.type === "file" && (!nodeIds || nodeIds.includes(node.id))
  ))
  const nextEntries = await Promise.all(fileNodes.map(async (node) => [node.id, await resolveFileNodeMetadata(node)] as const))

  if (version !== fileNodeResolveVersion) {
    return
  }

  if (!nodeIds) {
    fileNodeMeta.value = Object.fromEntries(nextEntries)
    return
  }

  fileNodeMeta.value = {
    ...fileNodeMeta.value,
    ...Object.fromEntries(nextEntries),
  }
}
```

- [ ] **Step 3: Expose selection-aware refresh state and action from `use-canvas-editor.ts`**

Add computed capability and action:

```ts
const canRefreshSelectedSiyuanNode = computed(() => {
  if (selectedNodeCount.value !== 1 || selectedNode.value?.type !== "file") {
    return false
  }

  const kind = getResolvedFileNode(selectedNode.value).kind
  return kind === "block" || kind === "document"
})

async function refreshSelectedSiyuanNode() {
  if (!canRefreshSelectedSiyuanNode.value || selectedNode.value?.type !== "file") {
    return
  }

  try {
    await refreshFileNodeMetadata([selectedNode.value.id])
  } catch {
    showMessage(t("messageUnableRefreshSiyuanNode"), 4000, "error")
  }
}
```

- [ ] **Step 4: Bind the new editor API**

Add both fields into `createCanvasEditorBindings(...)` inputs:

```ts
canRefreshSelectedSiyuanNode,
refreshSelectedSiyuanNode,
```

- [ ] **Step 5: Run the editor-action test and verify it passes**

Run:

```bash
pnpm test -- tests/canvas-use-editor-actions.test.ts
```

Expected: PASS for the new refresh test and no regressions in that file.

- [ ] **Step 6: Commit the editor refresh implementation**

Run:

```bash
git add src/canvas/use-canvas-editor-file-nodes.ts src/canvas/use-canvas-editor.ts tests/canvas-use-editor-actions.test.ts
git commit -m "feat: 支持定向刷新思源文件节点预览"
```

Expected: commit succeeds with the helper, editor API, and green test.

### Task 5: Implement The Floating Toolbar Refresh Button

**Files:**
- Modify: `src/components/canvas/canvas-icon.ts`
- Modify: `src/components/canvas/canvas-selection-toolbar-icon.ts`
- Modify: `src/components/canvas/CanvasWorkspace.vue`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
- Modify: `tests/canvas-workspace.test.ts`

- [ ] **Step 1: Add the icon and tooltip string**

Extend the icon union and tooltip map:

```ts
export type CanvasIconName =
  | "refresh"
  | ...

refresh: `<svg ...>...</svg>`,
```

```ts
return {
  align: t("selectionToolbarAlign"),
  center: t("selectionToolbarCenter"),
  color: t("selectionToolbarColor"),
  createGroup: t("selectionToolbarCreateGroup"),
  delete: t("selectionToolbarDelete"),
  edit: t("selectionToolbarEdit"),
  refresh: t("selectionToolbarRefresh"),
} as const
```

Also add:

```json
"selectionToolbarRefresh": "刷新"
"messageUnableRefreshSiyuanNode": "无法刷新思源内容"
```

and English equivalents.

- [ ] **Step 2: Render the refresh button in the single-selection toolbar branch**

Insert the button next to other single-node actions:

```vue
<button
  v-if="editor.canRefreshSelectedSiyuanNode"
  class="selection-toolbar__button"
  data-testid="selection-toolbar-refresh"
  :aria-label="SELECTION_TOOLBAR_TOOLTIPS.refresh"
  :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.refresh"
  type="button"
  @click.stop="editor.refreshSelectedSiyuanNode"
>
  <CanvasIcon
    class="selection-toolbar__icon"
    name="refresh"
  />
</button>
```

- [ ] **Step 3: Update the workspace test mock shape if needed**

Make sure `createEditorMock()` includes:

```ts
canRefreshSelectedSiyuanNode: false,
refreshSelectedSiyuanNode: vi.fn(),
```

- [ ] **Step 4: Run the workspace test and verify it passes**

Run:

```bash
pnpm test -- tests/canvas-workspace.test.ts
```

Expected: PASS including the new refresh-button test.

- [ ] **Step 5: Commit the toolbar UI implementation**

Run:

```bash
git add src/components/canvas/canvas-icon.ts src/components/canvas/canvas-selection-toolbar-icon.ts src/components/canvas/CanvasWorkspace.vue src/i18n/zh_CN.json src/i18n/en_US.json tests/canvas-workspace.test.ts
git commit -m "feat: 为思源节点浮动工具栏增加刷新按钮"
```

Expected: commit succeeds with icon, i18n, toolbar, and test updates.

### Task 6: Final Verification

**Files:**
- Verify: `tests/canvas-use-editor-actions.test.ts`
- Verify: `tests/canvas-workspace.test.ts`

- [ ] **Step 1: Run the focused verification suite**

Run:

```bash
pnpm test -- tests/canvas-use-editor-actions.test.ts tests/canvas-workspace.test.ts
```

Expected: PASS with no failures.

- [ ] **Step 2: Check git status for unintended changes**

Run:

```bash
git status --short
```

Expected: only intended tracked changes remain; do not touch unrelated `package.zip` changes.

- [ ] **Step 3: Commit the final verification state if needed**

Run:

```bash
git add src/canvas/use-canvas-editor-file-nodes.ts src/canvas/use-canvas-editor.ts src/components/canvas/canvas-icon.ts src/components/canvas/canvas-selection-toolbar-icon.ts src/components/canvas/CanvasWorkspace.vue src/i18n/zh_CN.json src/i18n/en_US.json tests/canvas-use-editor-actions.test.ts tests/canvas-workspace.test.ts docs/superpowers/specs/2026-05-17-siyuan-node-refresh-toolbar-design.md docs/superpowers/plans/2026-05-17-siyuan-node-refresh-toolbar.md
git commit -m "feat: 支持思源节点浮动刷新同步"
```

Expected: commit succeeds if previous task commits were skipped during local execution.
