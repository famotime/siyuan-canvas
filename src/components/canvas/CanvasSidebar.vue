<template>
  <div class="canvas-sidebar" data-theme-mode="light">
    <!-- 工具栏 -->
    <div class="canvas-sidebar__toolbar">
      <button
        class="canvas-sidebar__toolbar-btn"
        :title="t('toolbarNew')"
        data-testid="sidebar-new-canvas"
        type="button"
        @click="newCanvas"
      >
        <CanvasIcon name="canvas-file" :size="14" />
      </button>
      <button
        class="canvas-sidebar__toolbar-btn"
        :title="t('inspectorNewFolder')"
        data-testid="sidebar-new-folder"
        type="button"
        @click="tree.createWorkspaceFolder"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M2 4h4l2 2h6v7H2z" /><line x1="8" y1="8.5" x2="8" y2="12.5" /><line x1="6" y1="10.5" x2="10" y2="10.5" />
        </svg>
      </button>
      <button
        class="canvas-sidebar__toolbar-btn"
        :title="t('sidebarRefresh')"
        data-testid="sidebar-refresh"
        type="button"
        @click="refresh"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M2 8a6 6 0 0110.47-4M14 8a6 6 0 01-10.47 4" />
          <polyline points="10.5,2.5 13,2.5 13,5" /><polyline points="5.5,13.5 3,13.5 3,11" />
        </svg>
      </button>
    </div>

    <!-- 排序工具栏 -->
    <div class="canvas-sidebar__sortbar">
      <button
        class="canvas-sidebar__sort-btn"
        :class="{ 'canvas-sidebar__sort-btn--active': tree.workspaceSortField === 'name' }"
        type="button"
        @click="tree.setWorkspaceSortField('name')"
      >
        {{ t('inspectorSortByName') }}
      </button>
      <button
        class="canvas-sidebar__sort-btn"
        :class="{ 'canvas-sidebar__sort-btn--active': tree.workspaceSortField === 'updated' }"
        type="button"
        @click="tree.setWorkspaceSortField('updated')"
      >
        {{ t('inspectorSortByUpdated') }}
      </button>
      <button
        class="canvas-sidebar__sort-dir"
        type="button"
        @click="tree.setWorkspaceSortDirection(tree.workspaceSortDirection === 'asc' ? 'desc' : 'asc')"
      >
        {{ tree.workspaceSortDirection === 'asc' ? t('inspectorSortAsc') : t('inspectorSortDesc') }}
      </button>
    </div>

    <!-- 工作区文件树 -->
    <section class="canvas-sidebar__section">
      <h3 class="canvas-sidebar__section-title">{{ t('inspectorTabDocuments') }}</h3>
      <CanvasWorkspaceTree
        v-if="tree.workspaceDocuments.length > 0"
        :workspace-documents="tree.workspaceDocuments"
        :expanded-folders="tree.expandedFolders"
        :current-file-path="''"
        :drag-over-folder-path="null"
        :delete-title="t('selectionToolbarDelete')"
        data-testid="sidebar-workspace-tree"
        @toggle-folder="tree.toggleFolderExpand"
        @open-file="openFile"
        @delete-document="tree.deleteWorkspaceDocument"
        @context-menu="onContextMenu"
      />
      <p v-else class="canvas-sidebar__empty">
        {{ t('sidebarNoFiles') }}
      </p>
    </section>

    <!-- 最近文件 -->
    <section class="canvas-sidebar__section">
      <h3 class="canvas-sidebar__section-title">{{ t('inspectorRecent') }}</h3>
      <div v-if="recentFiles.length > 0" class="canvas-sidebar__recent">
        <button
          v-for="recent in recentFiles"
          :key="recent.path"
          class="canvas-sidebar__recent-item"
          type="button"
          @click="openRecentFile(recent)"
        >
          <CanvasIcon name="canvas-file" :size="12" />
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
      <p v-else class="canvas-sidebar__empty">
        {{ t('sidebarNoRecentFiles') }}
      </p>
    </section>

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
import { bindThemeSync } from "@/main"

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
    void tree.refreshWorkspaceDocuments()
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
  const host = getCurrentHost()
  if (host) {
    bindThemeSync(host, props.plugin as Plugin)
  }
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

// 获取当前宿主元素
function getCurrentHost(): HTMLElement | null {
  // 通过 DOM 向上查找 sidebar 容器
  const el = document.querySelector(".canvas-sidebar")
  return el as HTMLElement | null
}
</script>

<style scoped>
.canvas-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  padding: 8px;
  gap: 8px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 12px;
  box-sizing: border-box;
}

.canvas-sidebar__toolbar {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.canvas-sidebar__toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
}

.canvas-sidebar__toolbar-btn:hover {
  background: color-mix(in srgb, var(--b3-theme-on-surface) 8%, transparent);
}

.canvas-sidebar__sortbar {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

.canvas-sidebar__sort-btn,
.canvas-sidebar__sort-dir {
  padding: 2px 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 11px;
  cursor: pointer;
}

.canvas-sidebar__sort-btn:hover,
.canvas-sidebar__sort-dir:hover {
  background: color-mix(in srgb, var(--b3-theme-on-surface) 8%, transparent);
}

.canvas-sidebar__sort-btn--active {
  background: color-mix(in srgb, var(--b3-theme-on-surface) 12%, transparent);
}

.canvas-sidebar__section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.canvas-sidebar__section-title {
  margin: 0;
  padding: 4px 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.canvas-sidebar__empty {
  margin: 0;
  padding: 8px 0;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
  font-size: 11px;
}

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
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
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
  border-radius: 3px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.1s;
}

.canvas-sidebar__recent-remove:hover {
  background: color-mix(in srgb, var(--b3-theme-error) 20%, transparent);
  color: var(--b3-theme-error);
}

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
  cursor: pointer;
}

.canvas-sidebar__context-item:hover {
  background: color-mix(in srgb, var(--b3-theme-on-surface) 8%, transparent);
}

.canvas-sidebar__context-item--danger {
  color: var(--b3-theme-error);
}
</style>
