<template>
  <div
    v-if="open"
    class="command-palette-backdrop"
    role="dialog"
    aria-modal="true"
    :aria-label="t('commandPaletteTitle')"
    data-testid="command-palette"
    @click.self="close"
  >
    <div class="command-palette">
      <input
        ref="inputRef"
        v-model="query"
        class="command-palette__input"
        :placeholder="t('commandPalettePlaceholder')"
        autocomplete="off"
        spellcheck="false"
        @keydown="onInputKeyDown"
      >
      <ul
        ref="listRef"
        class="command-palette__list"
        role="listbox"
      >
        <li
          v-for="(item, idx) in filtered"
          :key="item.id"
          :class="['command-palette__item', { 'command-palette__item--active': idx === activeIndex }]"
          role="option"
          :aria-selected="idx === activeIndex"
          :data-testid="`command-palette-item-${idx}`"
          @click="execute(item)"
          @mouseenter="activeIndex = idx"
        >
          <span class="command-palette__item-kind">{{ kindLabel(item.kind) }}</span>
          <span class="command-palette__item-title">{{ item.title }}</span>
          <span
            v-if="item.subtitle"
            class="command-palette__item-subtitle"
          >{{ item.subtitle }}</span>
          <span
            v-if="item.shortcut"
            class="command-palette__item-shortcut"
          >{{ item.shortcut }}</span>
        </li>
        <li
          v-if="filtered.length === 0"
          class="command-palette__empty"
        >
          {{ t('commandPaletteNoResults') }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import type { CanvasNode } from "@/canvas/types"

type CommandKind = "command" | "recent" | "node"

interface PaletteItem {
  id: string
  kind: CommandKind
  title: string
  subtitle?: string
  shortcut?: string
  /** 用于过滤的额外关键词（如英文别名） */
  keywords?: string[]
  run: () => void | Promise<void>
}

interface PaletteEditor {
  state: { document: { nodes: CanvasNode[] }, filePath: string }
  recentFiles: Array<{ path: string, title: string, sourceType: "workspace" | "local" }>
  newCanvas: () => void | Promise<void>
  triggerImport: () => void
  save: () => void | Promise<void>
  exportCanvas: () => void
  undo?: () => void
  redo?: () => void
  zoomIn: () => void
  zoomOut: () => void
  zoomToActualSize?: () => void
  zoomToFit?: () => void
  resetViewport: () => void
  openRecentFile: (recent: { path: string, title: string, sourceType: "workspace" | "local" }) => void | Promise<void>
  selectNode: (nodeId: string) => void
  centerSelectionInViewport?: () => void
  state2?: never
}

const props = defineProps<{
  open: boolean
  editor: PaletteEditor
  t: (key: string, replacements?: Record<string, number | string>) => string
}>()

const emit = defineEmits<{ (event: "close"): void }>()

const query = ref("")
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement>()
const listRef = ref<HTMLElement>()

function close() {
  query.value = ""
  activeIndex.value = 0
  emit("close")
}

watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  query.value = ""
  activeIndex.value = 0
  await nextTick()
  inputRef.value?.focus()
})

const accel = typeof navigator !== "undefined" && navigator.platform.includes("Mac") ? "⌘" : "Ctrl"

const commandItems = computed<PaletteItem[]>(() => {
  const e = props.editor
  return [
    { id: "cmd:new", kind: "command", title: props.t("toolbarNew"), keywords: ["new", "create", "新建"], shortcut: "", run: () => e.newCanvas() },
    { id: "cmd:open", kind: "command", title: props.t("toolbarOpen"), keywords: ["open", "import", "打开"], run: () => e.triggerImport() },
    { id: "cmd:save", kind: "command", title: props.t("toolbarSaveAs"), keywords: ["save", "save as", "保存", "另存为"], shortcut: `${accel}+S`, run: () => e.save() },
    { id: "cmd:export", kind: "command", title: props.t("toolbarExport"), keywords: ["export", "导出"], run: () => e.exportCanvas() },
    ...(e.undo ? [{ id: "cmd:undo", kind: "command" as const, title: props.t("toolbarUndo"), keywords: ["undo", "撤销"], shortcut: `${accel}+Z`, run: () => e.undo!() }] : []),
    ...(e.redo ? [{ id: "cmd:redo", kind: "command" as const, title: props.t("toolbarRedo"), keywords: ["redo", "重做"], shortcut: `${accel}+Y`, run: () => e.redo!() }] : []),
    { id: "cmd:zoom-in", kind: "command", title: props.t("toolbarZoomIn"), keywords: ["zoom in", "放大"], shortcut: `${accel}++`, run: () => e.zoomIn() },
    { id: "cmd:zoom-out", kind: "command", title: props.t("toolbarZoomOut"), keywords: ["zoom out", "缩小"], shortcut: `${accel}+-`, run: () => e.zoomOut() },
    ...(e.zoomToActualSize ? [{ id: "cmd:zoom-actual", kind: "command" as const, title: props.t("toolbarZoomActual"), keywords: ["actual", "实际"], shortcut: `${accel}+0`, run: () => e.zoomToActualSize!() }] : []),
    ...(e.zoomToFit ? [{ id: "cmd:zoom-fit", kind: "command" as const, title: props.t("toolbarZoomFit"), keywords: ["fit", "适应"], shortcut: "F", run: () => e.zoomToFit!() }] : []),
    { id: "cmd:reset-viewport", kind: "command", title: props.t("toolbarResetViewport"), keywords: ["reset", "重置"], run: () => e.resetViewport() },
  ]
})

const recentItems = computed<PaletteItem[]>(() => {
  return props.editor.recentFiles.map((recent) => ({
    id: `recent:${recent.path}`,
    kind: "recent",
    title: recent.title,
    subtitle: recent.path,
    keywords: [recent.path],
    run: () => props.editor.openRecentFile(recent),
  }))
})

function nodeTitle(node: CanvasNode): string {
  if (node.type === "text") return (node.text || "").split("\n")[0]?.trim() || `[${props.t("nodeKindText")}]`
  if (node.type === "file") return node.file ? (node.file.split("/").pop() || node.file) : `[${props.t("toolbarFile")}]`
  if (node.type === "link") return node.url || `[${props.t("nodeKindExternalLink")}]`
  if (node.type === "group") return node.label || `[${props.t("nodeDefaultGroupLabel")}]`
  return ""
}

const nodeItems = computed<PaletteItem[]>(() => {
  return props.editor.state.document.nodes.map((node) => ({
    id: `node:${node.id}`,
    kind: "node",
    title: nodeTitle(node),
    subtitle: node.type,
    keywords: [node.type, node.id],
    run: () => {
      props.editor.selectNode(node.id)
      // 用 nextTick 确保 selectNode 之后的 reactive 更新完成，再请求居中
      nextTick(() => {
        props.editor.centerSelectionInViewport?.()
      })
    },
  }))
})

const allItems = computed<PaletteItem[]>(() => {
  return [...commandItems.value, ...recentItems.value, ...nodeItems.value]
})

const filtered = computed<PaletteItem[]>(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return allItems.value.slice(0, 50)

  return allItems.value
    .map((item) => {
      const haystack = [item.title, item.subtitle ?? "", ...(item.keywords ?? [])].join(" ").toLowerCase()
      const score = haystack.includes(q) ? 1 : 0
      return { item, score }
    })
    .filter((entry) => entry.score > 0)
    .map((entry) => entry.item)
    .slice(0, 50)
})

watch(filtered, () => {
  if (activeIndex.value >= filtered.value.length) {
    activeIndex.value = Math.max(0, filtered.value.length - 1)
  }
})

function kindLabel(kind: CommandKind): string {
  if (kind === "command") return props.t("commandPaletteKindCommand")
  if (kind === "recent") return props.t("commandPaletteKindRecent")
  return props.t("commandPaletteKindNode")
}

async function execute(item: PaletteItem) {
  close()
  await item.run()
}

function onInputKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault()
    close()
    return
  }

  if (event.key === "ArrowDown") {
    event.preventDefault()
    activeIndex.value = Math.min(filtered.value.length - 1, activeIndex.value + 1)
    scrollActiveIntoView()
    return
  }

  if (event.key === "ArrowUp") {
    event.preventDefault()
    activeIndex.value = Math.max(0, activeIndex.value - 1)
    scrollActiveIntoView()
    return
  }

  if (event.key === "Enter") {
    event.preventDefault()
    const target = filtered.value[activeIndex.value]
    if (target) {
      void execute(target)
    }
  }
}

function scrollActiveIntoView() {
  void nextTick(() => {
    const list = listRef.value
    if (!list) return
    const item = list.querySelector<HTMLElement>(".command-palette__item--active")
    // jsdom 没有实现 scrollIntoView，运行时也可能在某些环境缺失，做一次能力探测
    if (item && typeof item.scrollIntoView === "function") {
      item.scrollIntoView({ block: "nearest" })
    }
  })
}
</script>

<style scoped lang="scss">
.command-palette-backdrop {
  position: absolute;
  inset: 0;
  z-index: 7;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  background: color-mix(in srgb, var(--b3-theme-on-surface) 28%, transparent);
  backdrop-filter: blur(4px);
}

.command-palette {
  width: min(560px, calc(100% - 48px));
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  background: var(--canvas-floating-bg);
  border: 1px solid var(--canvas-floating-border);
  border-radius: 12px;
  box-shadow: var(--canvas-shadow-strong);
  overflow: hidden;
  backdrop-filter: blur(14px);
}

.command-palette__input {
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--canvas-border);
  background: transparent;
  padding: 14px 16px;
  font: inherit;
  font-size: 14px;
  color: var(--canvas-text);
  box-sizing: border-box;
  outline: 0;
}

.command-palette__list {
  list-style: none;
  margin: 0;
  padding: 6px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.command-palette__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--canvas-text);
  transition: background 0.12s ease;
}

.command-palette__item--active,
.command-palette__item:hover {
  background: var(--canvas-accent-soft);
}

.command-palette__item-kind {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--canvas-floating-button-bg);
  color: var(--canvas-text-muted);
  font-size: 11px;
  font-weight: 500;
  flex-shrink: 0;
}

.command-palette__item--active .command-palette__item-kind {
  background: color-mix(in srgb, var(--canvas-accent) 16%, transparent);
  color: var(--canvas-accent);
}

.command-palette__item-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-palette__item-subtitle {
  font-size: 11px;
  color: var(--canvas-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 40%;
}

.command-palette__item-shortcut {
  font-size: 11px;
  color: var(--canvas-text-muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.command-palette__empty {
  padding: 24px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--canvas-text-muted);
}
</style>
