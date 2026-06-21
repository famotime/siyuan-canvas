<template>
  <div class="canvas-sidebar" data-theme-mode="light">
    <!-- 标签栏 -->
    <nav class="inspector__tabs" role="tablist">
      <button class="inspector__tab inspector__tab--active" role="tab" aria-selected="true" type="button">
        {{ t('sidebarTabLabel') }}
      </button>
    </nav>

    <!-- 工具栏 -->
    <div class="inspector__toolbar">
      <button
        class="inspector__toolbar-button"
        :title="t('toolbarNew')"
        data-testid="sidebar-new-canvas"
        type="button"
        @click="newCanvas"
      >
        <CanvasIcon name="new-canvas" :size="16" />
      </button>
      <button
        class="inspector__toolbar-button"
        :title="t('inspectorNewFolder')"
        data-testid="sidebar-new-folder"
        type="button"
        @click="tree.createWorkspaceFolder"
      >
        <CanvasIcon name="new-folder" :size="16" />
      </button>
      <button
        class="inspector__toolbar-button"
        :title="t('sidebarRefresh')"
        data-testid="sidebar-refresh"
        type="button"
        @click="refresh"
      >
        <CanvasIcon name="refresh" :size="16" />
      </button>
      <button
        class="inspector__toolbar-button"
        :title="t('inspectorSort')"
        data-testid="sidebar-sort"
        type="button"
        aria-haspopup="menu"
        :aria-expanded="sortMenuOpen"
        @click="sortMenuOpen = !sortMenuOpen"
      >
        <CanvasIcon name="sort" :size="16" />
      </button>
      <button
        class="inspector__toolbar-button"
        :title="tree.allFoldersExpanded ? t('inspectorCollapseAll') : t('inspectorExpandAll')"
        data-testid="sidebar-expand-all"
        type="button"
        @click="tree.allFoldersExpanded ? tree.collapseAllFolders() : tree.expandAllFolders()"
      >
        <CanvasIcon name="expand-all" :size="16" />
      </button>
    </div>

    <!-- 排序弹出菜单 -->
    <div v-if="sortMenuOpen" class="inspector__sort-menu">
      <button
        class="inspector__sort-option"
        :class="{ 'inspector__sort-option--active': tree.workspaceSortField === 'name' }"
        type="button"
        @click="tree.setWorkspaceSortField('name'); sortMenuOpen = false"
      >
        {{ t('inspectorSortByName') }}
      </button>
      <button
        class="inspector__sort-option"
        :class="{ 'inspector__sort-option--active': tree.workspaceSortField === 'updated' }"
        type="button"
        @click="tree.setWorkspaceSortField('updated'); sortMenuOpen = false"
      >
        {{ t('inspectorSortByUpdated') }}
      </button>
      <div class="inspector__sort-divider" />
      <button
        class="inspector__sort-option"
        type="button"
        @click="tree.setWorkspaceSortDirection(tree.workspaceSortDirection === 'asc' ? 'desc' : 'asc'); sortMenuOpen = false"
      >
        {{ tree.workspaceSortDirection === 'asc' ? t('inspectorSortAsc') : t('inspectorSortDesc') }}
      </button>
    </div>

    <!-- 文档 section -->
    <section class="inspector__section">
      <button
        class="inspector__section-toggle"
        :title="docSectionCollapsed ? t('inspectorExpand') : t('inspectorCollapse')"
        type="button"
        @click="docSectionCollapsed = !docSectionCollapsed"
      >
        <h2>{{ t('inspectorTabDocuments') }}</h2>
        <span>{{ docSectionCollapsed ? '+' : '−' }}</span>
      </button>
      <div v-if="!docSectionCollapsed">
        <CanvasWorkspaceTree
          v-if="tree.workspaceDocuments.length > 0"
          :workspace-documents="tree.workspaceDocuments"
          :expanded-folders="tree.expandedFolders"
          :current-file-path="''"
          :drag-over-folder-path="dragOverFolderPath"
          :delete-title="t('selectionToolbarDelete')"
          data-testid="sidebar-workspace-tree"
          @toggle-folder="tree.toggleFolderExpand"
          @open-file="openFile"
          @delete-document="tree.deleteWorkspaceDocument"
          @context-menu="onContextMenu"
          @file-drag-start="onFileDragStart"
          @folder-drag-start="onFolderDragStart"
          @drag-end="onDragEnd"
          @folder-drag-over="onFolderDragOver"
          @folder-drag-enter="onFolderDragEnter"
          @folder-drag-leave="onFolderDragLeave"
          @folder-drop="onFolderDrop"
          @root-drop="onRootDrop"
        />
        <p v-else class="inspector__empty">
          {{ t('sidebarNoFiles') }}
        </p>
      </div>
    </section>

    <!-- 最近打开 section -->
    <section class="inspector__section">
      <button
        class="inspector__section-toggle"
        :title="recentSectionCollapsed ? t('inspectorExpand') : t('inspectorCollapse')"
        type="button"
        @click="recentSectionCollapsed = !recentSectionCollapsed"
      >
        <h2>{{ t('inspectorRecent') }}</h2>
        <span>{{ recentSectionCollapsed ? '+' : '−' }}</span>
      </button>
      <div v-if="!recentSectionCollapsed">
        <div v-if="recentFiles.length > 0" class="canvas-sidebar__recent">
          <button
            v-for="recent in recentFiles"
            :key="recent.path"
            class="canvas-sidebar__recent-item"
            type="button"
            @click="openRecentFile(recent)"
          >
            <CanvasIcon name="canvas-file" :size="14" />
            <span class="canvas-sidebar__recent-name">{{ recent.title || getFileName(recent.path) }}</span>
            <button
              class="canvas-sidebar__recent-remove"
              type="button"
              @click.stop="removeRecentFile(recent.path)"
            >
              ×
            </button>
          </button>
        </div>
        <p v-else class="inspector__empty">
          {{ t('sidebarNoRecentFiles') }}
        </p>
      </div>
    </section>

    <!-- 拖拽移动目标预览 -->
    <Teleport to="body">
      <div
        v-if="draggedPath && dragOverFolderPath"
        class="canvas-sidebar__drag-indicator"
        :style="{ left: `${dragPointerX + 12}px`, top: `${dragPointerY - 36}px` }"
      >
        {{ t('sidebarDragToFolder', { folder: getFolderDisplayName(dragOverFolderPath) }) }}
      </div>
    </Teleport>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenuVisible"
        class="canvas-sidebar__context-menu"
        :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
        @click.stop
        @mouseleave="closeContextMenu"
      >
        <template v-if="contextMenuType === 'file'">
          <button class="canvas-sidebar__context-item" type="button" @click="contextMenuRename">
            {{ t('contextMenuRename') }}
          </button>
          <button class="canvas-sidebar__context-item" type="button" @click="contextMenuCopy">
            {{ t('contextMenuCopy') }}
          </button>
          <button class="canvas-sidebar__context-item" type="button" @click="contextMenuCopyPath">
            {{ t('contextMenuCopyPath') }}
          </button>
          <button class="canvas-sidebar__context-item" type="button" @click="contextMenuOpenInExplorer">
            {{ t('contextMenuOpenInExplorer') }}
          </button>
          <button class="canvas-sidebar__context-item canvas-sidebar__context-item--danger" type="button" @click="contextMenuDelete">
            {{ t('contextMenuDelete') }}
          </button>
        </template>
        <template v-else>
          <button class="canvas-sidebar__context-item" type="button" @click="contextMenuRename">
            {{ t('contextMenuRename') }}
          </button>
          <button class="canvas-sidebar__context-item" type="button" @click="contextMenuOpenInExplorer">
            {{ t('contextMenuOpenInExplorer') }}
          </button>
          <button class="canvas-sidebar__context-item canvas-sidebar__context-item--danger" type="button" @click="contextMenuDelete">
            {{ t('contextMenuDelete') }}
          </button>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import { fetchSyncPost, showMessage } from "siyuan"
import {
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from "vue"
import {
  putFile,
  removeFile,
} from "@/api"
import { CanvasIcon } from "@/components/canvas/canvas-icon"
import CanvasWorkspaceTree from "@/components/canvas/CanvasWorkspaceTree.vue"
import {
  buildWorkspaceFilePath,
  sanitizeCanvasFileBaseName,
} from "@/canvas/workspace-tree-core"
import { createCanvasEditorWorkspaceTree } from "@/canvas/use-canvas-editor-workspace-tree"
import { createCanvasI18n } from "@/i18n/canvas"

const props = defineProps<{
  plugin: Plugin & {
    app?: unknown
    getCanvasSettings?: () => { defaultCanvasDirectory: string, [key: string]: any }
    getRecentCanvasFiles?: () => Array<{ path: string, title?: string, openedAt?: number }>
    i18n?: Record<string, string>
    openCanvasTab?: (bootstrap?: { path?: string, title?: string }) => Promise<void>
    removeRecentCanvasFile?: (path: string) => Promise<void>
  }
}>()

const t = createCanvasI18n(props.plugin.i18n)

// 工作区文件树
const recentFiles = ref<Array<{ path: string, title?: string, openedAt?: number }>>([])

// API 返回的 updated 字段不随保存而变化，自行跟踪文件的最后保存时间
const lastSavedTimes = reactive<Record<string, number>>({})

// 拖拽状态
const draggedPath = ref("")
const draggedType = ref<"file" | "folder">("file")
const dragOverFolderPath = ref<string | null>(null)
const dragPointerX = ref(0)
const dragPointerY = ref(0)

function refreshRecentFiles() {
  recentFiles.value = (props.plugin.getRecentCanvasFiles?.() ?? []).slice(0, 20)
}

const tree = reactive(createCanvasEditorWorkspaceTree({
  readDir: async (path) => {
      const response = await fetchSyncPost("/api/file/readDir", { path })
      const data = (response.code === 0 ? response.data : null) as Array<{ name: string, isDir: boolean, updated?: number }> | null
      // 注入 lastSavedTimes，使按编辑时间排序在保存/重命名/复制后立即生效
      if (Array.isArray(data)) {
        for (const entry of data) {
          const saved = lastSavedTimes[`${path}/${entry.name}`]
          if (saved) {
            entry.updated = Math.max(entry.updated ?? 0, saved)
          }
        }
      }
      return data
    },
  putFile,
  removeFile,
  renameFile: async (path: string, newPath: string) => {
    await fetchSyncPost("/api/file/renameFile", { path, newPath })
  },
  showMessage: (msg: string, timeout?: number, type?: string) => showMessage(msg, timeout, type as any),
  getSettings: () => props.plugin.getCanvasSettings?.() ?? { defaultCanvasDirectory: "/data/storage/petal/siyuan-canvas" },
  plugin: {
    removeRecentCanvasFile: (path) => props.plugin.removeRecentCanvasFile?.(path) ?? Promise.resolve(),
    updateCanvasUiState: async () => {},
  },
  refreshRecentFiles,
  labels: {
    copyTitle: t("contextMenuCopy"),
    deleteCanvasDescription: (path: string) => t("workspaceDeleteCanvasDescription", { path }),
    deleteCanvasTitle: t("workspaceDeleteCanvasTitle"),
    deleteFolderDescription: (name: string) => t("workspaceDeleteFolderDescription", { name }),
    deleteFolderTitle: t("contextMenuDeleteFolderConfirm"),
    dialogCancel: t("dialogCancel"),
    dialogConfirm: t("dialogConfirm"),
    fileAlreadyExistsMessage: t("messageFileAlreadyExists"),
    folderNameTitle: t("workspaceFolderNameTitle"),
    messageFileCopied: (name: string) => t("workspaceFileCopied", { name }),
    messageFolderRenamed: (name: string) => t("workspaceFolderRenamed", { name }),
    newFolderMessage: (name: string) => t("workspaceNewFolder", { name }),
    notAvailableInBrowserMessage: t("workspaceNotAvailableInBrowser"),
    renameFolderTitle: t("workspaceRenameFolderTitle"),
    renameTitle: t("contextMenuRename"),
    unableToCopyFileMessage: t("workspaceUnableCopyFile"),
    unableToGetWorkspacePathMessage: t("workspaceUnableGetWorkspacePath"),
    unableToOpenFolderMessage: t("workspaceUnableOpenFolder"),
    unableToRenameFileMessage: t("messageUnableRenameFile"),
    unableToRenameFolderMessage: t("workspaceUnableRenameFolder"),
    unableToSaveMessage: t("messageUnableSaveCanvas"),
    messageEntryMoved: (name: string, folder: string) => t("messageEntryMoved", { folder, name }),
    messageEntryMovedToRoot: (name: string) => t("messageEntryMovedToRoot", { name }),
    messageFileRenamed: (name: string) => t("messageFileRenamed", { name }),
    messageFileMoved: (name: string, folder: string) => t("messageFileMoved", { folder, name }),
    unableToMoveFileMessage: t("messageUnableMoveFile"),
  },
}))

// 打开文件
function getFileName(path: string): string {
  const parts = path.split("/")
  return parts[parts.length - 1] || path
}

function openFile(path: string) {
  void props.plugin.openCanvasTab?.({ path })
}

function openRecentFile(recent: { path: string, title?: string }) {
  void props.plugin.openCanvasTab?.({ path: recent.path, title: recent.title })
}

async function removeRecentFile(recentPath: string) {
  await props.plugin.removeRecentCanvasFile?.(recentPath)
  refreshRecentFiles()
}

// 新建画布
async function newCanvas() {
  const settings = props.plugin.getCanvasSettings?.() ?? { defaultCanvasDirectory: "/data/storage/petal/siyuan-canvas" }
  const { defaultCanvasDirectory } = settings
  const baseName = t("untitledCanvas").replace(/\.canvas$/, "")
  const path = buildWorkspaceFilePath(defaultCanvasDirectory, sanitizeCanvasFileBaseName(baseName))
  try {
    const blob = new Blob(["{}"], { type: "application/json" })
    await putFile(path, false, blob)
    await tree.refreshWorkspaceDocuments()
    await props.plugin.openCanvasTab?.({ path })
  } catch {
    showMessage(t("messageUnableSaveCanvas"), 4000, "error")
  }
}

async function refresh() {
  await tree.refreshWorkspaceDocuments()
  refreshRecentFiles()
}

// 拖拽移动
function onFileDragStart(event: DragEvent, path: string) {
  draggedPath.value = path
  draggedType.value = "file"
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", path)
  }
}

function onFolderDragStart(event: DragEvent, path: string) {
  draggedPath.value = path
  draggedType.value = "folder"
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", path)
  }
}

function getFolderDisplayName(path: string): string {
  const parts = path.split("/")
  return parts[parts.length - 1] || path
}

function onDragEnd() {
  draggedPath.value = ""
  draggedType.value = "file"
  dragOverFolderPath.value = null
  dragPointerX.value = 0
  dragPointerY.value = 0
  dragEnterCounter.value = 0
}

function onFolderDragOver(event: DragEvent) {
  dragPointerX.value = event.clientX
  dragPointerY.value = event.clientY
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move"
  }
}

const sortMenuOpen = ref(false)
const docSectionCollapsed = ref(false)
const recentSectionCollapsed = ref(false)
const dragEnterCounter = ref(0)

function onFolderDragEnter(_event: DragEvent, path: string) {
  if (path === draggedPath.value) return
  dragEnterCounter.value++
  dragOverFolderPath.value = path
}

function onFolderDragLeave(_event: DragEvent, path: string) {
  dragEnterCounter.value--
  if (dragEnterCounter.value <= 0) {
    dragEnterCounter.value = 0
    if (dragOverFolderPath.value === path) {
      dragOverFolderPath.value = null
    }
  }
}

async function onFolderDrop(_event: DragEvent, targetFolderPath: string) {
  const sourcePath = draggedPath.value
  dragOverFolderPath.value = null
  dragEnterCounter.value = 0
  if (!sourcePath || sourcePath === targetFolderPath) return

  // 不能拖入自身的子目录中
  if (draggedType.value === "folder" && targetFolderPath.startsWith(sourcePath + "/")) return

  await tree.moveWorkspaceEntry(sourcePath, targetFolderPath)
  refreshRecentFiles()
}

async function onRootDrop(_event: DragEvent) {
  const sourcePath = draggedPath.value
  dragOverFolderPath.value = null
  dragEnterCounter.value = 0
  if (!sourcePath) return

  const settings = props.plugin.getCanvasSettings?.() ?? { defaultCanvasDirectory: "/data/storage/petal/siyuan-canvas" }
  const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'))
  if (sourceDir === settings.defaultCanvasDirectory) return // 已在根目录

  await tree.moveWorkspaceEntryToRoot(sourcePath)
  refreshRecentFiles()
}

// 右键菜单
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuPath = ref("")
const contextMenuType = ref<"file" | "folder">("file")

function onContextMenu(event: MouseEvent, path: string, type: "file" | "folder") {
  contextMenuPath.value = path
  contextMenuType.value = type
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuVisible.value = true
}

function closeContextMenu() {
  contextMenuVisible.value = false
}

function contextMenuRename() {
  closeContextMenu()
  if (contextMenuType.value === "file") {
    void tree.renameWorkspaceDocument(contextMenuPath.value)
  } else {
    void tree.renameWorkspaceFolder(contextMenuPath.value)
  }
}

function contextMenuCopy() {
  closeContextMenu()
  void tree.copyWorkspaceDocument(contextMenuPath.value)
}

async function contextMenuCopyPath() {
  closeContextMenu()
  try {
    await navigator.clipboard.writeText(contextMenuPath.value)
    showMessage(t("contextMenuCopyPathSuccess"), 2000)
  } catch {
    // clipboard may not be available
  }
}

function contextMenuOpenInExplorer() {
  closeContextMenu()
  void tree.openInExplorer(contextMenuPath.value)
}

function contextMenuDelete() {
  closeContextMenu()
  if (contextMenuType.value === "file") {
    void tree.deleteWorkspaceDocument(contextMenuPath.value)
  } else {
    void tree.deleteWorkspaceFolder(contextMenuPath.value)
  }
}

// 自动刷新：监听工作区、文件保存和最近文件变更事件
let workspaceRefreshTimer: ReturnType<typeof setTimeout> | null = null

function onWorkspaceChanged() {
  if (workspaceRefreshTimer) return
  workspaceRefreshTimer = setTimeout(() => {
    workspaceRefreshTimer = null
    void tree.refreshWorkspaceDocuments({ silent: true })
  }, 300)
}

function onFileSaved(event: Event) {
  const path = (event as CustomEvent<{ path: string }>).detail?.path
  if (path) {
    lastSavedTimes[path] = Date.now()
  }
  onWorkspaceChanged()
}

function onRecentChanged() {
  refreshRecentFiles()
}

// 生命周期
onMounted(() => {
  void tree.refreshWorkspaceDocuments()
  refreshRecentFiles()
  window.addEventListener("siyuan-canvas:workspace-changed", onWorkspaceChanged)
  window.addEventListener("siyuan-canvas:file-saved", onFileSaved)
  window.addEventListener("siyuan-canvas:recent-changed", onRecentChanged)
})

onBeforeUnmount(() => {
  if (workspaceRefreshTimer) clearTimeout(workspaceRefreshTimer)
  window.removeEventListener("siyuan-canvas:workspace-changed", onWorkspaceChanged)
  window.removeEventListener("siyuan-canvas:file-saved", onFileSaved)
  window.removeEventListener("siyuan-canvas:recent-changed", onRecentChanged)
})
</script>

<style scoped>
.canvas-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  padding: 8px;
  gap: 8px;
  background: var(--canvas-inspector-bg, var(--b3-theme-background));
  color: var(--b3-theme-on-background);
  font-size: 12px;
  box-sizing: border-box;
}

/* Tabs */
.inspector__tabs {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
}

.inspector__tab {
  flex: 1;
  padding: 4px 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  font-weight: 500;
  cursor: default;
}

.inspector__tab--active {
  color: var(--b3-theme-on-background);
}

/* Toolbar */
.inspector__toolbar {
  display: flex;
  gap: 2px;
}

.inspector__toolbar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: default;
  transition: background 0.15s ease;
}

.inspector__toolbar-button:hover {
  background: color-mix(in srgb, var(--b3-theme-on-surface) 8%, transparent);
}

/* Sort menu */
.inspector__sort-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.inspector__sort-option {
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  text-align: left;
  cursor: default;
}

.inspector__sort-option:hover {
  background: color-mix(in srgb, var(--b3-theme-on-surface) 8%, transparent);
}

.inspector__sort-option--active {
  background: color-mix(in srgb, var(--b3-theme-primary) 14%, transparent);
  color: var(--b3-theme-primary);
}

.inspector__sort-divider {
  height: 1px;
  margin: 2px 0;
  background: var(--b3-border-color);
}

/* Section */
.inspector__section {
  display: flex;
  flex-direction: column;
}

.inspector__section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: default;
  transition: background 0.15s ease;
}

.inspector__section-toggle:hover {
  background: color-mix(in srgb, var(--b3-theme-on-surface) 6%, transparent);
}

.inspector__section-toggle h2 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.inspector__section-toggle span {
  font-size: 14px;
  font-weight: 500;
  opacity: 0.5;
}

.inspector__empty {
  margin: 0;
  padding: 8px 0;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
  font-size: 11px;
}

/* Recent files */
.canvas-sidebar__recent {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.canvas-sidebar__recent-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  text-align: left;
  cursor: default;
  box-sizing: border-box;
}

.canvas-sidebar__recent-item:hover {
  background: color-mix(in srgb, var(--b3-theme-on-surface) 8%, transparent);
}

.canvas-sidebar__recent-item:hover .canvas-sidebar__recent-remove {
  opacity: 1;
}

.canvas-sidebar__recent-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.canvas-sidebar__recent-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 14px;
  line-height: 1;
  cursor: default;
  opacity: 0;
  transition: opacity 0.1s;
}

.canvas-sidebar__recent-remove:hover {
  background: color-mix(in srgb, var(--b3-theme-error) 20%, transparent);
  color: var(--b3-theme-error);
}

/* Drag indicator */
.canvas-sidebar__drag-indicator {
  position: fixed;
  z-index: 10001;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--canvas-accent);
  color: var(--canvas-accent-contrast);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* Context menu */
.canvas-sidebar__context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 140px;
  padding: 4px 0;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
}

.canvas-sidebar__context-item {
  display: block;
  width: calc(100% - 8px);
  margin: 0 4px;
  padding: 6px 12px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  text-align: left;
  cursor: default;
}

.canvas-sidebar__context-item:hover {
  background: color-mix(in srgb, var(--b3-theme-on-surface) 8%, transparent);
}

.canvas-sidebar__context-item--danger {
  color: var(--b3-theme-error);
}
</style>
