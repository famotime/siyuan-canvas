# Bottom Toolbar And Collapsible Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move node-creation controls into a bottom floating toolbar, add a connection dialog shortcut, and persist collapsible inspector sections without regressing existing canvas editing flows.

**Architecture:** Extend plugin persistence with a dedicated `ui` block, then thread that state through the plugin bridge and editor composable before updating `CanvasWorkspace.vue` to render the new bottom toolbar, dialog, and collapsible inspector sections. Reuse the existing edge-creation state and action methods so the inspector form and dialog stay behaviorally identical.

**Tech Stack:** TypeScript, Vue 3, Vitest, SiYuan plugin APIs

---

### Task 1: Persist Inspector UI State

**Files:**
- Modify: `src/canvas/plugin-data.ts`
- Modify: `src/index.ts`
- Modify: `src/canvas/use-canvas-editor-shared.ts`
- Test: `tests/canvas-plugin-data.test.ts`
- Test: `tests/canvas-plugin-lifecycle.test.ts`

- [ ] **Step 1: Write the failing plugin-data tests**

```ts
it("provides default inspector section UI state", () => {
  const data = createDefaultCanvasPluginData()

  expect(data.ui.inspectorSections).toEqual({
    createEdge: true,
    document: true,
    edge: true,
    node: true,
    recent: true,
    selection: true,
  })
})

it("normalizes missing or invalid persisted UI state", () => {
  const data = normalizeCanvasPluginData({
    recentFiles: [],
    settings: {},
    ui: {
      inspectorSections: {
        createEdge: false,
        document: "bad",
      },
    },
    version: 1,
  })

  expect(data.ui.inspectorSections).toEqual({
    createEdge: false,
    document: true,
    edge: true,
    node: true,
    recent: true,
    selection: true,
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/canvas-plugin-data.test.ts`
Expected: FAIL because `ui` is missing from plugin data defaults and normalization.

- [ ] **Step 3: Write minimal persistence implementation**

```ts
export interface CanvasPluginUiState {
  inspectorSections: CanvasInspectorSectionState
}

export function createDefaultCanvasPluginUiState(): CanvasPluginUiState {
  return {
    inspectorSections: {
      createEdge: true,
      document: true,
      edge: true,
      node: true,
      recent: true,
      selection: true,
    },
  }
}

export function updateCanvasPluginUiState(
  data: CanvasPluginData,
  ui: Partial<CanvasPluginUiState>,
): CanvasPluginData {
  return normalizeCanvasPluginData({
    ...data,
    ui: {
      ...data.ui,
      ...ui,
      inspectorSections: {
        ...data.ui.inspectorSections,
        ...ui.inspectorSections,
      },
    },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/canvas-plugin-data.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing plugin lifecycle test for persisted UI round-trip**

```ts
it("loads and updates persisted inspector section UI state", async () => {
  const plugin = new SiyuanCanvasPlugin()
  plugin.setStoredData({
    recentFiles: [],
    settings: {
      defaultCanvasDirectory: "/persisted/canvas",
      detectExternalChanges: false,
      recentFilesLimit: 3,
    },
    ui: {
      inspectorSections: {
        createEdge: false,
        document: false,
        edge: true,
        node: true,
        recent: true,
        selection: true,
      },
    },
    version: 1,
  })

  await plugin.onload()

  expect(plugin.getCanvasUiState()).toEqual({
    inspectorSections: {
      createEdge: false,
      document: false,
      edge: true,
      node: true,
      recent: true,
      selection: true,
    },
  })

  await plugin.updateCanvasUiState({
    inspectorSections: {
      document: true,
    },
  })

  expect(plugin.getCanvasUiState().inspectorSections.document).toBe(true)
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm test -- tests/canvas-plugin-lifecycle.test.ts`
Expected: FAIL because UI bridge methods do not exist yet.

- [ ] **Step 7: Extend the plugin bridge and plugin class minimally**

```ts
export interface CanvasPluginBridge extends Plugin {
  getCanvasUiState?: () => CanvasPluginUiState
  updateCanvasUiState?: (ui: Partial<CanvasPluginUiState>) => Promise<void>
}
```

```ts
public getCanvasUiState(): CanvasPluginUiState {
  return {
    inspectorSections: {
      ...this.canvasData.ui.inspectorSections,
    },
  }
}

public async updateCanvasUiState(ui: Partial<CanvasPluginUiState>): Promise<void> {
  this.canvasData = updateCanvasPluginUiState(this.canvasData, ui)
  await this.persistCanvasData()
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm test -- tests/canvas-plugin-lifecycle.test.ts`
Expected: PASS

### Task 2: Add Editor State For Bottom Toolbar, Dialog, And Inspector Toggles

**Files:**
- Modify: `src/canvas/use-canvas-editor.ts`
- Test: `tests/canvas-use-editor-actions.test.ts`

- [ ] **Step 1: Write the failing editor tests**

```ts
it("shows the bottom toolbar after the stage is activated", async () => {
  const { editor, wrapper } = await mountEditor()

  expect(editor.bottomToolbarVisible).toBe(false)

  editor.activateCanvasSurface()
  await flushEditor()

  expect(editor.bottomToolbarVisible).toBe(true)

  wrapper.unmount()
})

it("opens the create-edge dialog only when exactly one node is selected", async () => {
  const { editor, wrapper } = await mountEditor()

  editor.openCreateEdgeDialog()
  await flushEditor()

  expect(showMessage).toHaveBeenCalled()
  expect(editor.createEdgeDialog.visible).toBe(false)

  editor.state.selectNode("n1")
  editor.openCreateEdgeDialog()
  await flushEditor()

  expect(editor.createEdgeDialog.visible).toBe(true)

  wrapper.unmount()
})

it("persists inspector section toggles through the plugin bridge", async () => {
  const { editor, plugin, wrapper } = await mountEditor()

  await editor.toggleInspectorSection("document")

  expect(plugin.updateCanvasUiState).toHaveBeenCalledWith({
    inspectorSections: {
      document: false,
    },
  })
  expect(editor.inspectorSectionState.document).toBe(false)

  wrapper.unmount()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/canvas-use-editor-actions.test.ts`
Expected: FAIL because bottom toolbar state, dialog state, and UI persistence hooks are missing.

- [ ] **Step 3: Implement minimal editor support state**

```ts
const bottomToolbarVisible = ref(false)
const createEdgeDialog = reactive({
  visible: false,
})
const inspectorSectionState = ref(
  plugin.getCanvasUiState?.().inspectorSections ?? createDefaultCanvasPluginUiState().inspectorSections,
)

function activateCanvasSurface() {
  bottomToolbarVisible.value = true
}

function deactivateCanvasSurface() {
  bottomToolbarVisible.value = false
}

function openCreateEdgeDialog() {
  if (state.selectedNodeIds.length !== 1 || !selectedNode.value) {
    showMessage(t("createEdgeDialogRequiresSingleNode"), 2500, "warning")
    return
  }

  activateCanvasSurface()
  createEdgeDialog.visible = true
}

function closeCreateEdgeDialog() {
  createEdgeDialog.visible = false
}

async function toggleInspectorSection(section: keyof CanvasInspectorSectionState) {
  const nextValue = !inspectorSectionState.value[section]
  inspectorSectionState.value = {
    ...inspectorSectionState.value,
    [section]: nextValue,
  }
  await plugin.updateCanvasUiState?.({
    inspectorSections: {
      [section]: nextValue,
    },
  })
}
```

- [ ] **Step 4: Reuse the existing create-edge action from the dialog**

```ts
function submitCreateEdgeDialog() {
  createEdgeFromSelection()
  closeCreateEdgeDialog()
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- tests/canvas-use-editor-actions.test.ts`
Expected: PASS

### Task 3: Render The Bottom Toolbar, Dialog, And Collapsible Inspector

**Files:**
- Modify: `src/components/canvas/CanvasWorkspace.vue`
- Modify: `src/components/canvas/canvas-selection-toolbar-icon.ts`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
- Test: `tests/canvas-workspace.test.ts`

- [ ] **Step 1: Write the failing workspace tests**

```ts
it("hides the bottom toolbar until the canvas surface is activated", async () => {
  currentEditor = createEditorMock()
  currentEditor.bottomToolbarVisible = false

  const wrapper = mountWorkspace()
  expect(wrapper.find("[data-testid='bottom-toolbar']").exists()).toBe(false)

  currentEditor.bottomToolbarVisible = true
  await wrapper.vm.$nextTick()

  expect(wrapper.find("[data-testid='bottom-toolbar']").exists()).toBe(true)
})

it("removes retired top toolbar buttons and keeps file controls", () => {
  currentEditor = createEditorMock()
  const wrapper = mountWorkspace()
  const toolbarText = wrapper.find(".toolbar").text()

  expect(toolbarText).toContain("新建")
  expect(toolbarText).toContain("打开")
  expect(toolbarText).toContain("保存")
  expect(toolbarText).not.toContain("导出")
  expect(toolbarText).not.toContain("设置")
  expect(toolbarText).not.toContain("文本")
  expect(toolbarText).not.toContain("文件")
  expect(toolbarText).not.toContain("链接")
  expect(toolbarText).not.toContain("分组")
})

it("opens the create-edge dialog from the bottom toolbar", async () => {
  currentEditor = createEditorMock()
  currentEditor.bottomToolbarVisible = true

  const wrapper = mountWorkspace()
  await wrapper.find("[data-testid='bottom-toolbar-connect']").trigger("click")

  expect(currentEditor.openCreateEdgeDialog).toHaveBeenCalled()
})

it("collapses the document inspector section body", async () => {
  currentEditor = createEditorMock()
  currentEditor.inspectorSectionState = {
    createEdge: true,
    document: false,
    edge: true,
    node: true,
    recent: true,
    selection: true,
  }

  const wrapper = mountWorkspace()

  expect(wrapper.find("[data-testid='inspector-section-document-body']").exists()).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/canvas-workspace.test.ts`
Expected: FAIL because the workspace still renders the old toolbar and non-collapsible inspector sections.

- [ ] **Step 3: Implement the bottom toolbar and collapsible section markup**

```vue
<div
  v-if="editor.bottomToolbarVisible"
  class="bottom-toolbar"
  data-testid="bottom-toolbar"
>
  <button data-testid="bottom-toolbar-text" @click="editor.addNode('text')">...</button>
  <button data-testid="bottom-toolbar-file" @click="editor.addNode('file')">...</button>
  <button data-testid="bottom-toolbar-connect" @click="editor.openCreateEdgeDialog">...</button>
  <button data-testid="bottom-toolbar-group" @click="editor.addNode('group')">...</button>
</div>
```

```vue
<section class="inspector__section">
  <button
    class="inspector__section-toggle"
    data-testid="inspector-section-document-toggle"
    @click="editor.toggleInspectorSection('document')"
  >
    <h2>{{ t("inspectorDocument") }}</h2>
  </button>
  <div
    v-if="editor.inspectorSectionState.document"
    data-testid="inspector-section-document-body"
  >
    ...
  </div>
</section>
```

- [ ] **Step 4: Render the create-edge dialog using the shared editor state**

```vue
<div
  v-if="editor.createEdgeDialog.visible"
  class="canvas-dialog-backdrop"
  data-testid="create-edge-dialog"
>
  <div class="canvas-dialog">
    <label>
      {{ t("fieldTarget") }}
      <select v-model="editor.newEdgeTargetId">...</select>
    </label>
    <label>
      {{ t("fieldEdgeLabel") }}
      <input v-model="editor.newEdgeLabel" />
    </label>
    <label>
      {{ t("fieldFromSide") }}
      <select v-model="editor.newEdgeFromSide">...</select>
    </label>
    <label>
      {{ t("fieldToSide") }}
      <select v-model="editor.newEdgeToSide">...</select>
    </label>
    <button @click="editor.closeCreateEdgeDialog">{{ t("dialogCancel") }}</button>
    <button @click="editor.submitCreateEdgeDialog">{{ t("inspectorCreateEdgeAction") }}</button>
  </div>
</div>
```

- [ ] **Step 5: Add i18n labels and icon names**

```json
{
  "bottomToolbarText": "文本",
  "bottomToolbarFile": "文件",
  "bottomToolbarConnect": "连线",
  "bottomToolbarGroup": "分组",
  "createEdgeDialogRequiresSingleNode": "请先选中一个节点，再创建连线。",
  "inspectorToggleCollapse": "折叠",
  "inspectorToggleExpand": "展开"
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test -- tests/canvas-workspace.test.ts`
Expected: PASS

### Task 4: Run Regression Verification

**Files:**
- Test: `tests/canvas-plugin-data.test.ts`
- Test: `tests/canvas-plugin-lifecycle.test.ts`
- Test: `tests/canvas-use-editor-actions.test.ts`
- Test: `tests/canvas-workspace.test.ts`

- [ ] **Step 1: Run the targeted suite**

Run: `pnpm test -- tests/canvas-plugin-data.test.ts tests/canvas-plugin-lifecycle.test.ts tests/canvas-use-editor-actions.test.ts tests/canvas-workspace.test.ts`
Expected: PASS

- [ ] **Step 2: Run the broader regression suite**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/canvas/plugin-data.ts src/index.ts src/canvas/use-canvas-editor-shared.ts src/canvas/use-canvas-editor.ts src/components/canvas/CanvasWorkspace.vue src/components/canvas/canvas-selection-toolbar-icon.ts src/i18n/zh_CN.json src/i18n/en_US.json tests/canvas-plugin-data.test.ts tests/canvas-plugin-lifecycle.test.ts tests/canvas-use-editor-actions.test.ts tests/canvas-workspace.test.ts docs/superpowers/plans/2026-04-12-bottom-toolbar-inspector-collapsible.md
git commit -m "feat: add bottom toolbar and collapsible inspector"
```
