# File Node Picker And Rich Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder `文件` node creation with a picker-backed flow that can create document, `.canvas`, and image file nodes with rich previews and workspace image paste support.

**Architecture:** Keep JSON Canvas compatibility by preserving the existing `file` node type and layering target-resolution, preview-loading, and picker state services around it. The editor remains the orchestration point, while Vue renders a new picker dialog, richer file cards, and paste-aware workspace behavior.

**Tech Stack:** Vue 3, TypeScript, Vitest, SiYuan kernel APIs, JSON Canvas file format

---

## File Structure

- `src/canvas/file-target-resolution.ts`
  New pure resolution layer for path or block-ID input, including target-kind normalization.
- `src/canvas/file-target-preview.ts`
  New preview-loading layer for document excerpts, canvas thumbnails, image sources, and unresolved fallback cards.
- `src/canvas/file-picker-dialog.ts`
  New picker-state and result-normalization helper for the bottom-toolbar file flow.
- `src/canvas/workspace-image-files.ts`
  New helper for sibling asset directory derivation and workspace image writes.
- `src/canvas/siyuan-file-node-lookups.ts`
  Extend pure lookup helpers for image block-ID and search result support.
- `src/canvas/siyuan-kernel-file-node-lookups.ts`
  Extend runtime query bridge to expose the new pure lookup helpers.
- `src/canvas/use-canvas-editor-file-nodes.ts`
  Swap the old file-node metadata model for the new resolution and preview pipeline.
- `src/canvas/use-canvas-editor.ts`
  Add picker dialog state, file-node creation flow, paste handling, richer preview refresh, and activation behavior.
- `src/components/canvas/CanvasWorkspace.vue`
  Render the picker dialog, richer file cards, and canvas-surface paste wiring.
- `src/i18n/zh_CN.json` and `src/i18n/en_US.json`
  Add localized labels and messages for picker UI, block-ID input, paste rejection, and preview states.
- `docs/project-structure.md`
  Record the new file-target and workspace-image modules after implementation.

## Task Summary

1. Build the target-resolution layer.
2. Build the rich preview layer.
3. Add picker search and dialog state.
4. Wire picker selection, inspector re-resolution, and rich card rendering.
5. Add workspace canvas thumbnails and clipboard image paste.
6. Finish activation, documentation, and verification.

### Task 1: Build The Target-Resolution Layer

**Files:**
- Create: `src/canvas/file-target-resolution.ts`
- Modify: `src/canvas/siyuan-file-node-lookups.ts`
- Modify: `src/canvas/siyuan-kernel-file-node-lookups.ts`
- Test: `tests/canvas-file-target-resolution.test.ts`
- Test: `tests/canvas-siyuan-file-node-lookups.test.ts`

- [ ] **Step 1: Write the failing pure tests for path and block-ID resolution**

Add this to `tests/canvas-file-target-resolution.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"
import { resolveCanvasFileTarget } from "@/canvas/file-target-resolution"

describe("resolveCanvasFileTarget", () => {
  it("resolves a block id to an image target before falling back to document lookup", async () => {
    const result = await resolveCanvasFileTarget("20260412094047-ihhbskn", {
      resolveCanvasByPath: vi.fn(async () => null),
      resolveDocumentByBlockId: vi.fn(async () => null),
      resolveDocumentByPath: vi.fn(async () => null),
      resolveImageByBlockId: vi.fn(async () => ({
        blockId: "20260412094047-ihhbskn",
        kind: "image",
        openPath: "/data/assets/example.png",
        path: "assets/example.png",
        title: "example.png",
      })),
      resolveImageByPath: vi.fn(async () => null),
    })

    expect(result.kind).toBe("image")
    expect(result.path).toBe("assets/example.png")
  })

  it("resolves a .canvas path before document lookup", async () => {
    const result = await resolveCanvasFileTarget("/data/storage/maps/roadmap.canvas", {
      resolveCanvasByPath: vi.fn(async path => ({ kind: "canvas", path, title: "roadmap.canvas" })),
      resolveDocumentByBlockId: vi.fn(async () => null),
      resolveDocumentByPath: vi.fn(async () => null),
      resolveImageByBlockId: vi.fn(async () => null),
      resolveImageByPath: vi.fn(async () => null),
    })

    expect(result.kind).toBe("canvas")
    expect(result.title).toBe("roadmap.canvas")
  })
})
```

Add this to `tests/canvas-siyuan-file-node-lookups.test.ts`:

```ts
it("resolves image assets by the copied block id", async () => {
  const queryRows = vi.fn(async () => [{
    block_id: "20260412094047-ihhbskn",
    name: "diagram.png",
    path: "assets/diagram.png",
    title: "Architecture Diagram",
  }])

  const result = await resolveImageAssetByBlockId("20260412094047-ihhbskn", queryRows)

  expect(result).toEqual({
    blockId: "20260412094047-ihhbskn",
    name: "diagram.png",
    openPath: "/data/assets/diagram.png",
    path: "assets/diagram.png",
    title: "Architecture Diagram",
  })
})
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `pnpm test -- tests/canvas-file-target-resolution.test.ts tests/canvas-siyuan-file-node-lookups.test.ts`

Expected: FAIL with module-not-found or missing-export errors for `resolveCanvasFileTarget` and `resolveImageAssetByBlockId`.

- [ ] **Step 3: Write the minimal resolution and lookup implementation**

Add this public API to `src/canvas/file-target-resolution.ts`:

```ts
export interface ResolvedCanvasImageTarget {
  blockId?: string
  kind: "image"
  openPath: string
  path: string
  title: string
}

export interface ResolvedCanvasDocumentTarget {
  hpath: string
  id: string
  kind: "document"
  path: string
  title: string
}

export interface ResolvedCanvasNestedTarget {
  kind: "canvas"
  path: string
  title: string
}

export interface ResolvedCanvasFileFallbackTarget {
  kind: "file"
  path: string
  title: string
}

export type ResolvedCanvasFileTarget =
  | ResolvedCanvasDocumentTarget
  | ResolvedCanvasNestedTarget
  | ResolvedCanvasImageTarget
  | ResolvedCanvasFileFallbackTarget

export async function resolveCanvasFileTarget(input: string, lookups: CanvasFileTargetLookups): Promise<ResolvedCanvasFileTarget> {
  const trimmed = input.trim()
  if (!trimmed) {
    return { kind: "file", path: "", title: "" }
  }

  if (/^\d{14}-[a-z0-9]{7}$/i.test(trimmed)) {
    const image = await lookups.resolveImageByBlockId(trimmed)
    if (image) return image
    const document = await lookups.resolveDocumentByBlockId(trimmed)
    if (document) return document
  }

  const canvas = await lookups.resolveCanvasByPath(trimmed)
  if (canvas) return canvas
  const document = await lookups.resolveDocumentByPath(trimmed)
  if (document) return document
  const image = await lookups.resolveImageByPath(trimmed)
  if (image) return image

  const segments = trimmed.replace(/\\/g, "/").split("/")
  return { kind: "file", path: trimmed, title: segments.at(-1) || trimmed }
}
```

Extend `src/canvas/siyuan-file-node-lookups.ts`:

```ts
export async function resolveImageAssetByBlockId(blockId: string, queryRows: QueryRows): Promise<SiyuanResolvedAsset | null> {
  const rows = await queryRows(
    `SELECT block_id, path, name, title
     FROM assets
     WHERE block_id = '${escapeSqlString(blockId)}'
     LIMIT 1`,
  )
  const row = rows[0]
  if (!row) return null
  const assetPath = row.path as string
  return {
    blockId: row.block_id as string,
    name: row.name || getFileName(assetPath),
    openPath: assetPath.startsWith("/data/") ? assetPath : `/data/${assetPath.replace(/^\//, "")}`,
    path: assetPath,
    title: row.title || undefined,
  }
}
```

Extend `src/canvas/siyuan-kernel-file-node-lookups.ts`:

```ts
export async function findSiyuanImageAssetByBlockId(blockId: string): Promise<SiyuanResolvedAsset | null> {
  return resolveImageAssetByBlockId(blockId, querySiyuanSql)
}
```

- [ ] **Step 4: Run the tests to verify the new layer passes**

Run: `pnpm test -- tests/canvas-file-target-resolution.test.ts tests/canvas-siyuan-file-node-lookups.test.ts`

Expected: PASS with the new target-resolution tests green and no regression in the lookup suite.

- [ ] **Step 5: Commit**

```bash
git add tests/canvas-file-target-resolution.test.ts tests/canvas-siyuan-file-node-lookups.test.ts src/canvas/file-target-resolution.ts src/canvas/siyuan-file-node-lookups.ts src/canvas/siyuan-kernel-file-node-lookups.ts
git commit -m "feat: add file target resolution helpers"
```

### Task 2: Build The Rich Preview Layer

**Files:**
- Create: `src/canvas/file-target-preview.ts`
- Modify: `src/canvas/use-canvas-editor-file-nodes.ts`
- Test: `tests/canvas-file-target-preview.test.ts`

- [ ] **Step 1: Write the failing preview-model tests**

Create `tests/canvas-file-target-preview.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { createCanvasFileTargetPreview } from "@/canvas/file-target-preview"

describe("createCanvasFileTargetPreview", () => {
  it("creates a document preview with rendered html and clipping metadata", () => {
    const preview = createCanvasFileTargetPreview({
      excerptHtml: "<h1>Heading</h1><p>Body</p>",
      hpath: "/Projects/Canvas",
      id: "20260412094047-ihhbskn",
      kind: "document",
      path: "/data/20260412094047-ihhbskn.sy",
      title: "Canvas Spec",
    })

    expect(preview.kind).toBe("document")
    expect(preview.headline).toBe("Canvas Spec")
    expect(preview.previewHtml).toContain("<h1>Heading</h1>")
    expect(preview.clampMode).toBe("viewport")
  })

  it("creates a canvas preview with miniature graph data", () => {
    const preview = createCanvasFileTargetPreview({
      kind: "canvas",
      path: "/data/storage/maps/roadmap.canvas",
      thumbnail: {
        edges: [{ fromX: 10, fromY: 20, toX: 70, toY: 80 }],
        nodes: [{ height: 40, width: 80, x: 20, y: 30 }],
      },
      title: "roadmap.canvas",
    })

    expect(preview.kind).toBe("canvas")
    expect(preview.thumbnail?.nodes).toHaveLength(1)
  })

  it("creates an image card preview", () => {
    const preview = createCanvasFileTargetPreview({
      kind: "image",
      openPath: "/data/assets/photo.png",
      path: "assets/photo.png",
      title: "photo.png",
    })

    expect(preview.kind).toBe("image")
    expect(preview.imageSrc).toBe("/data/assets/photo.png")
  })
})
```

- [ ] **Step 2: Run the preview tests to verify they fail**

Run: `pnpm test -- tests/canvas-file-target-preview.test.ts`

Expected: FAIL with module-not-found or missing-export errors for `createCanvasFileTargetPreview`.

- [ ] **Step 3: Write the minimal preview model implementation**

Create `src/canvas/file-target-preview.ts`:

```ts
import type { ResolvedCanvasFileTarget } from "@/canvas/file-target-resolution"

export interface CanvasThumbnailNode {
  height: number
  width: number
  x: number
  y: number
}

export interface CanvasThumbnailEdge {
  fromX: number
  fromY: number
  toX: number
  toY: number
}

export interface CanvasFileTargetPreview {
  clampMode?: "viewport"
  detail: string
  headline: string
  helper: string
  imageSrc?: string
  kind: "canvas" | "document" | "file" | "image"
  previewHtml?: string
  thumbnail?: {
    edges: CanvasThumbnailEdge[]
    nodes: CanvasThumbnailNode[]
  }
}

type PreviewInput = ResolvedCanvasFileTarget & {
  excerptHtml?: string
  thumbnail?: {
    edges: CanvasThumbnailEdge[]
    nodes: CanvasThumbnailNode[]
  }
}

export function createCanvasFileTargetPreview(target: PreviewInput): CanvasFileTargetPreview {
  switch (target.kind) {
    case "document":
      return {
        clampMode: "viewport",
        detail: target.hpath || target.path,
        headline: target.title,
        helper: "Opens in SiYuan",
        kind: "document",
        previewHtml: target.excerptHtml || "",
      }
    case "canvas":
      return {
        detail: target.path,
        headline: target.title,
        helper: "Opens nested canvas",
        kind: "canvas",
        thumbnail: target.thumbnail,
      }
    case "image":
      return {
        detail: target.path,
        headline: target.title,
        helper: "Image file",
        imageSrc: target.openPath,
        kind: "image",
      }
    default:
      return {
        detail: target.path,
        headline: target.title,
        helper: "Unresolved path",
        kind: "file",
      }
  }
}
```

Update `src/canvas/use-canvas-editor-file-nodes.ts` so `getFileNodePreview(node)` returns `CanvasFileTargetPreview` from the new helper instead of the old badge-only model.

- [ ] **Step 4: Run the preview tests to verify they pass**

Run: `pnpm test -- tests/canvas-file-target-preview.test.ts`

Expected: PASS with document, canvas, image, and fallback preview cases green.

- [ ] **Step 5: Commit**

```bash
git add tests/canvas-file-target-preview.test.ts src/canvas/file-target-preview.ts src/canvas/use-canvas-editor-file-nodes.ts
git commit -m "feat: add file target preview models"
```

### Task 3: Add Picker Search And Dialog State

**Files:**
- Create: `src/canvas/file-picker-dialog.ts`
- Modify: `src/canvas/siyuan-file-node-lookups.ts`
- Modify: `src/canvas/siyuan-kernel-file-node-lookups.ts`
- Modify: `src/canvas/use-canvas-editor.ts`
- Test: `tests/canvas-siyuan-file-node-lookups.test.ts`
- Test: `tests/canvas-use-editor-actions.test.ts`

- [ ] **Step 1: Write the failing picker-search tests**

Add a pure helper test:

```ts
it("searches documents, images, and workspace canvases into grouped picker results", async () => {
  const result = await searchCanvasFilePickerTargets("road", {
    searchDocuments: vi.fn(async () => [{ kind: "document", path: "/data/roadmap.sy", subtitle: "/Projects/Roadmap", title: "Roadmap" }]),
    searchImages: vi.fn(async () => [{ kind: "image", path: "assets/road.png", subtitle: "assets/road.png", title: "road.png" }]),
    searchWorkspaceCanvasFiles: vi.fn(async () => [{ kind: "canvas", path: "/data/storage/maps/road.canvas", subtitle: "/data/storage/maps/road.canvas", title: "road.canvas" }]),
  })

  expect(result.documents).toHaveLength(1)
  expect(result.images).toHaveLength(1)
  expect(result.canvases).toHaveLength(1)
})
```

Add an editor state test:

```ts
it("opens the file picker from the bottom toolbar instead of inserting a placeholder node", () => {
  editor.openFilePickerDialog()

  expect(editor.filePickerDialog.visible).toBe(true)
  expect(editor.state.document.nodes).toHaveLength(0)
})
```

- [ ] **Step 2: Run the picker tests to verify they fail**

Run: `pnpm test -- tests/canvas-siyuan-file-node-lookups.test.ts tests/canvas-use-editor-actions.test.ts`

Expected: FAIL with missing search helpers or missing `filePickerDialog` editor state.

- [ ] **Step 3: Implement grouped picker search and editor dialog state**

Create `src/canvas/file-picker-dialog.ts`:

```ts
export interface CanvasFilePickerOption {
  kind: "canvas" | "document" | "image"
  path: string
  subtitle: string
  title: string
}

export interface CanvasFilePickerGroups {
  canvases: CanvasFilePickerOption[]
  documents: CanvasFilePickerOption[]
  images: CanvasFilePickerOption[]
}

export async function searchCanvasFilePickerTargets(
  query: string,
  sources: {
    searchDocuments: (query: string) => Promise<CanvasFilePickerOption[]>
    searchImages: (query: string) => Promise<CanvasFilePickerOption[]>
    searchWorkspaceCanvasFiles: (query: string) => Promise<CanvasFilePickerOption[]>
  },
): Promise<CanvasFilePickerGroups> {
  const trimmed = query.trim()
  const [documents, images, canvases] = await Promise.all([
    sources.searchDocuments(trimmed),
    sources.searchImages(trimmed),
    sources.searchWorkspaceCanvasFiles(trimmed),
  ])
  return { canvases, documents, images }
}
```

Add this state to `src/canvas/use-canvas-editor.ts`:

```ts
const filePickerDialog = reactive({
  groups: {
    canvases: [] as CanvasFilePickerOption[],
    documents: [] as CanvasFilePickerOption[],
    images: [] as CanvasFilePickerOption[],
  },
  query: "",
  visible: false,
})

function openFilePickerDialog() {
  filePickerDialog.visible = true
}

function closeFilePickerDialog() {
  filePickerDialog.visible = false
  filePickerDialog.query = ""
  filePickerDialog.groups = { canvases: [], documents: [], images: [] }
}
```

- [ ] **Step 4: Run the picker tests to verify they pass**

Run: `pnpm test -- tests/canvas-siyuan-file-node-lookups.test.ts tests/canvas-use-editor-actions.test.ts`

Expected: PASS with picker search grouping and dialog-open behavior green.

- [ ] **Step 5: Commit**

```bash
git add tests/canvas-siyuan-file-node-lookups.test.ts tests/canvas-use-editor-actions.test.ts src/canvas/file-picker-dialog.ts src/canvas/siyuan-file-node-lookups.ts src/canvas/siyuan-kernel-file-node-lookups.ts src/canvas/use-canvas-editor.ts
git commit -m "feat: add file picker search state"
```

### Task 4: Wire Picker Selection, Inspector Re-Resolution, And Rich Card Rendering

**Files:**
- Modify: `src/canvas/use-canvas-editor.ts`
- Modify: `src/canvas/use-canvas-editor-file-nodes.ts`
- Modify: `src/components/canvas/CanvasWorkspace.vue`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
- Test: `tests/canvas-use-editor-actions.test.ts`
- Test: `tests/canvas-workspace.test.ts`

- [ ] **Step 1: Write the failing integration tests for picker selection and workspace rendering**

Add an editor selection test:

```ts
it("creates a document file node from picker selection and selects it", async () => {
  editor.openFilePickerDialog()

  await editor.selectFilePickerResult({
    kind: "document",
    path: "/data/roadmap.sy",
    subtitle: "/Projects/Roadmap",
    title: "Roadmap",
  })

  expect(editor.state.document.nodes).toHaveLength(1)
  expect(editor.state.document.nodes[0]).toMatchObject({
    file: "/data/roadmap.sy",
    type: "file",
  })
  expect(editor.selectedNode?.id).toBe(editor.state.document.nodes[0]?.id)
  expect(editor.filePickerDialog.visible).toBe(false)
})
```

Add a Vue rendering test:

```ts
it("renders the file picker dialog and rich document preview card", () => {
  currentEditor.filePickerDialog.visible = true
  currentEditor.filePickerDialog.groups.documents = [{
    kind: "document",
    path: "/data/roadmap.sy",
    subtitle: "/Projects/Roadmap",
    title: "Roadmap",
  }]
  currentEditor.getFileNodePreview.mockReturnValue({
    clampMode: "viewport",
    detail: "/Projects/Roadmap",
    headline: "Roadmap",
    helper: "Opens in SiYuan",
    kind: "document",
    previewHtml: "<p>Preview</p>",
  })

  const wrapper = mount(CanvasWorkspace, { props: { editor: currentEditor } })

  expect(wrapper.find("[data-testid='file-picker-dialog']").exists()).toBe(true)
  expect(wrapper.find(".file-card__document-preview").html()).toContain("Preview")
})
```

- [ ] **Step 2: Run the integration tests to verify they fail**

Run: `pnpm test -- tests/canvas-use-editor-actions.test.ts tests/canvas-workspace.test.ts`

Expected: FAIL with missing `selectFilePickerResult`, missing dialog markup, or missing rich preview rendering.

- [ ] **Step 3: Implement picker selection, inspector updates, and card rendering**

Add picker selection to `src/canvas/use-canvas-editor.ts`:

```ts
async function selectFilePickerResult(option: CanvasFilePickerOption) {
  const node = createCanvasNode("file")
  node.x = Math.round((200 - viewport.x) / viewport.scale + board.value.left)
  node.y = Math.round((160 - viewport.y) / viewport.scale + board.value.top)
  node.file = option.path

  commitDocument(upsertCanvasNode(state.document, node))
  state.selectNode(node.id)
  closeFilePickerDialog()
  await refreshFileNodeMetadata()
}
```

Make `updateNodeField()` refresh file-node metadata after file edits:

```ts
function updateNodeField(field: string, value: string) {
  if (!state.selectedNode) {
    return
  }

  commitDocument(upsertCanvasNode(state.document, {
    ...state.selectedNode,
    [field]: value,
  }))

  if (field === "file") {
    void refreshFileNodeMetadata()
  }
}
```

Render the picker in `src/components/canvas/CanvasWorkspace.vue`:

```vue
<div
  v-if="editor.filePickerDialog.visible"
  class="canvas-dialog-backdrop"
  data-testid="file-picker-dialog"
  @click.self="editor.closeFilePickerDialog"
>
  <div class="canvas-dialog">
    <div class="canvas-dialog__header">
      <h2>{{ t("filePickerDialogTitle") }}</h2>
    </div>
    <label class="canvas-dialog__field">
      <span>{{ t("filePickerSearchLabel") }}</span>
      <input
        :value="editor.filePickerDialog.query"
        class="canvas-dialog__control"
        @input="editor.updateFilePickerQuery(valueFromEvent($event))"
      >
    </label>
  </div>
</div>
```

Render document previews:

```vue
<div
  v-if="editor.getFileNodePreview(node).kind === 'document'"
  class="file-card"
>
  <div class="canvas-node__title">{{ editor.getFileNodePreview(node).headline }}</div>
  <div class="canvas-node__meta">{{ editor.getFileNodePreview(node).detail }}</div>
  <div
    class="file-card__document-preview markdown-preview"
    v-html="editor.getFileNodePreview(node).previewHtml"
  />
</div>
```

Add i18n keys:

```json
{
  "filePickerDialogTitle": "选择文件",
  "filePickerSearchLabel": "搜索笔记、图片或画布",
  "messageUnablePasteImageWithoutWorkspaceCanvas": "请先将当前画布保存到工作空间后再粘贴图片。"
}
```

- [ ] **Step 4: Run the integration tests to verify they pass**

Run: `pnpm test -- tests/canvas-use-editor-actions.test.ts tests/canvas-workspace.test.ts`

Expected: PASS with picker selection, inspector file updates, and document preview rendering green.

- [ ] **Step 5: Commit**

```bash
git add tests/canvas-use-editor-actions.test.ts tests/canvas-workspace.test.ts src/canvas/use-canvas-editor.ts src/canvas/use-canvas-editor-file-nodes.ts src/components/canvas/CanvasWorkspace.vue src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat: connect file picker to canvas file nodes"
```

### Task 5: Add Workspace Canvas Thumbnails And Clipboard Image Paste

**Files:**
- Create: `src/canvas/workspace-image-files.ts`
- Modify: `src/canvas/file-target-preview.ts`
- Modify: `src/canvas/use-canvas-editor.ts`
- Modify: `src/components/canvas/CanvasWorkspace.vue`
- Test: `tests/canvas-file-target-preview.test.ts`
- Test: `tests/canvas-use-editor-actions.test.ts`

- [ ] **Step 1: Write the failing tests for canvas thumbnails and image paste**

Add a thumbnail test:

```ts
it("creates a static canvas thumbnail from parsed nodes and edges", async () => {
  const preview = await loadCanvasTargetPreview({
    kind: "canvas",
    path: "/data/storage/maps/roadmap.canvas",
    title: "roadmap.canvas",
  }, {
    readCanvasText: vi.fn(async () => JSON.stringify({
      edges: [{ fromNode: "a", fromSide: "right", id: "edge-1", toNode: "b", toSide: "left" }],
      nodes: [
        { height: 100, id: "a", text: "A", type: "text", width: 120, x: 0, y: 0 },
        { height: 100, id: "b", text: "B", type: "text", width: 120, x: 240, y: 0 },
      ],
    })),
  })

  expect(preview.thumbnail?.nodes).toHaveLength(2)
  expect(preview.thumbnail?.edges).toHaveLength(1)
})
```

Add a paste test:

```ts
it("writes a pasted image beside the saved workspace canvas and creates a file node", async () => {
  editor.state.filePath = "/data/storage/maps/roadmap.canvas"
  editor.fileSource = "workspace"

  await editor.handleClipboardImagePaste(new File(["png"], "pasted.png", { type: "image/png" }))

  expect(writeWorkspaceImageFile).toHaveBeenCalledWith(
    "/data/storage/maps/roadmap.canvas",
    expect.any(File),
    expect.any(Function),
  )
  expect(editor.state.document.nodes.at(-1)).toMatchObject({
    file: expect.stringContaining("roadmap.assets/"),
    type: "file",
  })
})
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `pnpm test -- tests/canvas-file-target-preview.test.ts tests/canvas-use-editor-actions.test.ts`

Expected: FAIL with missing thumbnail loader or missing `handleClipboardImagePaste`.

- [ ] **Step 3: Implement sibling image-file writes and paste-aware editor flow**

Create `src/canvas/workspace-image-files.ts`:

```ts
function getCanvasAssetDirectory(canvasPath: string): string {
  return canvasPath.replace(/\.canvas$/i, ".assets")
}

export function buildWorkspaceImagePath(canvasPath: string, fileName: string, now = Date.now()): string {
  const assetDirectory = getCanvasAssetDirectory(canvasPath)
  const extension = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : ".png"
  return `${assetDirectory}/${now}${extension}`
}

export async function writeWorkspaceImageFile(
  canvasPath: string,
  file: File,
  putFile: (path: string, isDir: boolean, file: Blob) => Promise<unknown>,
): Promise<string> {
  const targetPath = buildWorkspaceImagePath(canvasPath, file.name || "pasted.png")
  await putFile(targetPath, false, file)
  return targetPath
}
```

Add paste handling to `src/canvas/use-canvas-editor.ts`:

```ts
async function handleClipboardImagePaste(file: File) {
  if (fileSource.value !== "workspace" || !state.filePath.endsWith(".canvas")) {
    showMessage(t("messageUnablePasteImageWithoutWorkspaceCanvas"), 4000, "warning")
    return
  }

  const path = await writeWorkspaceImageFile(state.filePath, file, putFile)
  const node = createCanvasNode("file")
  node.file = path
  node.x = Math.round((200 - viewport.x) / viewport.scale + board.value.left)
  node.y = Math.round((160 - viewport.y) / viewport.scale + board.value.top)
  commitDocument(upsertCanvasNode(state.document, node))
  state.selectNode(node.id)
  await refreshFileNodeMetadata()
}
```

Wire paste from the stage in `src/components/canvas/CanvasWorkspace.vue`:

```vue
<main
  class="stage"
  @paste="handleStagePaste"
>
```

Add `handleStagePaste` in the script:

```ts
function handleStagePaste(event: ClipboardEvent) {
  const file = [...(event.clipboardData?.files || [])].find(candidate => candidate.type.startsWith("image/"))
  if (!file) {
    return
  }

  event.preventDefault()
  void editor.handleClipboardImagePaste(file)
}
```

- [ ] **Step 4: Run the tests to verify the new behavior passes**

Run: `pnpm test -- tests/canvas-file-target-preview.test.ts tests/canvas-use-editor-actions.test.ts`

Expected: PASS with canvas thumbnail generation, workspace image writes, and rejection cases green.

- [ ] **Step 5: Commit**

```bash
git add tests/canvas-file-target-preview.test.ts tests/canvas-use-editor-actions.test.ts src/canvas/workspace-image-files.ts src/canvas/file-target-preview.ts src/canvas/use-canvas-editor.ts src/components/canvas/CanvasWorkspace.vue
git commit -m "feat: support canvas thumbnails and workspace image paste"
```

### Task 6: Finish Activation, Documentation, And Verification

**Files:**
- Modify: `src/canvas/use-canvas-editor.ts`
- Modify: `docs/project-structure.md`
- Test: `tests/canvas-use-editor-actions.test.ts`
- Test: `tests/canvas-workspace.test.ts`

- [ ] **Step 1: Write the failing activation and regression tests**

Add activation coverage:

```ts
it("opens a document target on file-node activation", async () => {
  fileNodeLookupMock.findSiyuanDocumentByPath.mockResolvedValueOnce({
    hpath: "/Projects/Roadmap",
    id: "20260412094047-ihhbskn",
    path: "/data/roadmap.sy",
    title: "Roadmap",
  })

  editor.activateNode({
    file: "/data/roadmap.sy",
    height: 180,
    id: "node-document",
    type: "file",
    width: 320,
    x: 0,
    y: 0,
  })

  expect(openTab).toHaveBeenCalledWith(expect.objectContaining({
    doc: { id: "20260412094047-ihhbskn" },
  }))
})
```

Add workspace image activation coverage:

```ts
it("keeps workspace image targets in-place when double-clicked", async () => {
  currentEditor.getFileNodePreview.mockReturnValue({
    detail: "/data/storage/maps/roadmap.assets/1712890000000.png",
    headline: "1712890000000.png",
    helper: "Image file",
    imageSrc: "/data/storage/maps/roadmap.assets/1712890000000.png",
    kind: "image",
  })

  await wrapper.find("[data-testid='canvas-node-node-image']").trigger("dblclick")

  expect(openTab).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the regression tests to verify they fail**

Run: `pnpm test -- tests/canvas-use-editor-actions.test.ts tests/canvas-workspace.test.ts`

Expected: FAIL until activation logic distinguishes workspace image files from SiYuan assets.

- [ ] **Step 3: Implement final activation rules and update project documentation**

Update activation in `src/canvas/use-canvas-editor.ts`:

```ts
function isSiyuanImageAssetTarget(target: ResolvedCanvasFileTarget): boolean {
  return target.kind === "image" && target.path.startsWith("assets/")
}

function activateNode(node: CanvasNode) {
  if (node.type === "file") {
    const resolved = getResolvedFileNode(node)
    if (resolved.kind === "canvas") {
      void plugin.openCanvasTab?.({ path: resolved.path })
      return
    }
    if (resolved.kind === "document") {
      void openTab({
        app: plugin.app,
        doc: { id: resolved.id },
        keepCursor: true,
        openNewTab: true,
      })
      return
    }
    if (isSiyuanImageAssetTarget(resolved)) {
      void openTab({
        app: plugin.app,
        asset: { path: resolved.openPath },
        keepCursor: true,
        openNewTab: true,
      })
      return
    }
    showMessage(resolved.path || node.file, 2500, "info")
    return
  }

  // Preserve existing link/text/group behavior below this point.
}
```

Update `docs/project-structure.md`:

```md
- `src/canvas/file-target-resolution.ts`
  Normalizes file-node input from paths and block IDs into document, canvas, image, or fallback targets.
- `src/canvas/file-target-preview.ts`
  Builds rich preview payloads for document excerpts, canvas thumbnails, and image cards.
- `src/canvas/file-picker-dialog.ts`
  Groups picker-search results for the bottom-toolbar file action.
- `src/canvas/workspace-image-files.ts`
  Derives sibling asset directories and writes pasted workspace image files.
```

- [ ] **Step 4: Run targeted and full verification**

Run: `pnpm test -- tests/canvas-file-target-resolution.test.ts tests/canvas-file-target-preview.test.ts tests/canvas-siyuan-file-node-lookups.test.ts tests/canvas-use-editor-actions.test.ts tests/canvas-workspace.test.ts`

Expected: PASS with all file-node-specific suites green.

Run: `pnpm test`

Expected: PASS with the full Vitest suite green and no new regressions.

- [ ] **Step 5: Commit**

```bash
git add tests/canvas-use-editor-actions.test.ts tests/canvas-workspace.test.ts src/canvas/use-canvas-editor.ts docs/project-structure.md
git commit -m "feat: finish file node rich previews"
```

## Self-Review

### Spec Coverage

- Global picker for documents, `.canvas`, and images: covered by Task 3 and Task 4.
- Keep JSON Canvas `file` nodes: covered by Task 1 and Task 4.
- Real document preview with clipped viewport height: covered by Task 2 and Task 4.
- Real `.canvas` thumbnail: covered by Task 5.
- Image cards: covered by Task 2 and Task 4.
- Inspector path or block-ID editing: covered by Task 1 and Task 4.
- Workspace image paste beside the saved canvas: covered by Task 5.
- Double-click behavior: covered by Task 6.

No spec gaps remain.

### Placeholder Scan

- No placeholder markers or “similar to Task N” shortcuts remain.
- Each task lists exact files, test commands, expected failure mode, implementation code, verification command, and commit command.

### Type Consistency

- `ResolvedCanvasFileTarget` is introduced in Task 1 and reused in Tasks 2, 5, and 6.
- `CanvasFilePickerOption` is introduced in Task 3 and reused in Task 4.
- `handleClipboardImagePaste` is introduced in Task 5 and not referenced by earlier tasks.
