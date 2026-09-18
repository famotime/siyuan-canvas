<template>
  <div
    class="canvas-shell inspector"
    style="height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden;"
    @pointerdown.capture.stop
    @click="sortDropdownOpen = false; closeContextMenu()"
  >
    <div class="inspector__content" style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
      <!-- 头部页签导航 -->
      <div class="inspector__header" style="flex-shrink: 0;">
        <nav
          class="inspector__tabs"
          role="tablist"
          data-testid="inspector-tabs"
        >
          <button
            class="inspector__tab"
            :class="{ 'inspector__tab--active': activeTab === 'documents' }"
            role="tab"
            :aria-selected="activeTab === 'documents'"
            type="button"
            @click="activeTab = 'documents'"
          >
            {{ t("inspectorTabDocuments") }}
          </button>
          <button
            class="inspector__tab"
            :class="{
              'inspector__tab--active': activeTab === 'selection',
              'inspector__tab--disabled': !hasActiveEditor
            }"
            role="tab"
            :aria-selected="activeTab === 'selection'"
            :disabled="!hasActiveEditor"
            type="button"
            @click="activeTab = 'selection'"
          >
            {{ t("inspectorTabSelection") }}
          </button>
        </nav>
      </div>

      <!-- 内容展示区 -->
      <div class="inspector__tabs-content" style="flex: 1; overflow-y: auto; min-height: 0; padding: 8px;">
        <!-- 1. Canvas 目录树 Tab -->
        <div v-show="activeTab === 'documents'">
          <div class="inspector__toolbar" style="display: flex; gap: 4px; margin-bottom: 8px; justify-content: flex-end; position: relative;">
            <button
              class="inspector__toolbar-button canvas-icon-button"
              :aria-label="t('inspectorNewCanvas')"
              :data-tooltip="t('inspectorNewCanvas')"
              type="button"
              @click="() => handleCreateCanvas()"
            >
              <CanvasIcon
                name="new-canvas"
                :size="16"
              />
            </button>
            <button
              class="inspector__toolbar-button canvas-icon-button"
              :aria-label="t('inspectorNewFolder')"
              :data-tooltip="t('inspectorNewFolder')"
              type="button"
              @click="handleCreateFolder"
            >
              <CanvasIcon
                name="new-folder"
                :size="16"
              />
            </button>
            <button
              class="inspector__toolbar-button canvas-icon-button"
              :class="{ 'inspector__toolbar-button--active': sortDropdownOpen }"
              :aria-label="t('inspectorSort')"
              :data-tooltip="t('inspectorSort')"
              type="button"
              @click.stop="sortDropdownOpen = !sortDropdownOpen"
            >
              <CanvasIcon
                name="sort"
                :size="16"
              />
            </button>
            <button
              class="inspector__toolbar-button canvas-icon-button"
              :aria-label="allFoldersExpanded ? t('inspectorCollapseAll') : t('inspectorExpandAll')"
              :data-tooltip="allFoldersExpanded ? t('inspectorCollapseAll') : t('inspectorExpandAll')"
              type="button"
              @click="handleToggleAllFolders"
            >
              <CanvasIcon
                name="expand-all"
                :size="16"
              />
            </button>

            <!-- 排序下拉菜单 -->
            <div
              v-if="sortDropdownOpen"
              class="inspector__sort-dropdown"
              role="menu"
              style="position: absolute; right: 0; top: 100%; z-index: 100;"
              @click.stop
            >
              <div class="inspector__sort-dropdown-group">
                <button
                  :class="['inspector__sort-dropdown-item', { 'inspector__sort-dropdown-item--active': workspaceSortField === 'name' }]"
                  type="button"
                  @click="handleSetWorkspaceSortField('name')"
                >{{ t('inspectorSortByName') }}</button>
                <button
                  :class="['inspector__sort-dropdown-item', { 'inspector__sort-dropdown-item--active': workspaceSortField === 'updated' }]"
                  type="button"
                  @click="handleSetWorkspaceSortField('updated')"
                >{{ t('inspectorSortByUpdated') }}</button>
                <button
                  :class="['inspector__sort-dropdown-item', { 'inspector__sort-dropdown-item--active': workspaceSortField === 'created' }]"
                  type="button"
                  @click="handleSetWorkspaceSortField('created')"
                >{{ t('inspectorSortByCreated') }}</button>
              </div>
              <div class="inspector__sort-dropdown-divider" />
              <div class="inspector__sort-dropdown-group">
                <button
                  :class="['inspector__sort-dropdown-item', { 'inspector__sort-dropdown-item--active': workspaceSortDirection === 'asc' }]"
                  type="button"
                  @click="handleSetWorkspaceSortDirection('asc')"
                >{{ t('inspectorSortAsc') }}</button>
                  <button
                  :class="['inspector__sort-dropdown-item', { 'inspector__sort-dropdown-item--active': workspaceSortDirection === 'desc' }]"
                  type="button"
                  @click="handleSetWorkspaceSortDirection('desc')"
                >{{ t('inspectorSortDesc') }}</button>
              </div>
            </div>
          </div>

          <!-- 大纲文件树部分 -->
          <section class="inspector__section">
            <button
              class="inspector__section-toggle"
              type="button"
              @click="toggleInspectorSection('document')"
            >
              <h2>{{ t("inspectorDocument") }}</h2>
              <CanvasIcon
                name="chevron-right"
                class="inspector__section-chevron"
                :class="{'inspector__section-chevron--expanded': inspectorSectionState.document}"
              />
            </button>
            <div
              v-show="inspectorSectionState.document"
              data-testid="inspector-section-document-body"
            >
              <CanvasWorkspaceTree
                v-if="workspaceDocuments.length"
                :workspace-documents="workspaceDocuments"
                :expanded-folders="workspaceExpandedFolders"
                :current-file-path="activeEditorFilePath"
                :drag-over-folder-path="dragOverFolderPath"
                :delete-title="t('selectionToolbarDelete')"
                @toggle-folder="handleToggleFolder"
                @open-file="handleOpenFile"
                @delete-document="handleDeleteDocument"
                @context-menu="onContextMenu"
                @root-drop="onRootDrop"
                @folder-drag-over="onFolderDragOver"
                @folder-drag-enter="onFolderDragEnter"
                @folder-drag-leave="onFolderDragLeave"
                @folder-drop="onFolderDrop"
                @file-drag-start="onFileDragStart"
                @drag-end="onDragEnd"
              />
              <p v-else class="workspace-tree__empty" style="text-align: center; color: var(--b3-theme-label); padding: 16px;">
                {{ t("inspectorNoWorkspaceCanvasFiles") }}<br>
                <code>{{ defaultCanvasDirectory }}/</code>
              </p>
            </div>
          </section>

          <!-- 最近文档历史模块 -->
          <section class="inspector__section">
            <button
              class="inspector__section-toggle"
              type="button"
              @click="toggleInspectorSection('recent')"
            >
              <h2>{{ t("inspectorRecent") }}</h2>
              <CanvasIcon
                name="chevron-right"
                class="inspector__section-chevron"
                :class="{'inspector__section-chevron--expanded': inspectorSectionState.recent}"
              />
            </button>
            <div v-show="inspectorSectionState.recent">
              <div
                v-if="recentFiles.length"
                class="recent-list"
              >
                <div
                  v-for="recent in recentFiles"
                  :key="recent.path"
                  class="recent-list__item"
                  :title="recent.path"
                >
                  <button
                    class="recent-list__item-open"
                    type="button"
                    @click="handleOpenRecentFile(recent)"
                  >
                    <CanvasIcon
                      class="recent-list__item-icon"
                      name="canvas-file"
                      :size="14"
                    />
                    <span class="workspace-tree__name">{{ recent.title }}</span>
                  </button>
                  <button
                    class="recent-list__item-delete canvas-icon-button"
                    :aria-label="t('selectionToolbarDelete')"
                    :data-tooltip="t('selectionToolbarDelete')"
                    type="button"
                    @click.stop="handleRemoveRecentFileRecord(recent.path)"
                  >
                    <CanvasIcon name="close" :size="12" />
                  </button>
                </div>
              </div>
              <p v-else class="workspace-tree__empty" style="text-align: center; color: var(--b3-theme-label); padding: 16px;">
                {{ t("inspectorNoRecentWorkspaceFiles") }}
              </p>
            </div>
          </section>
        </div>

        <!-- 2. 元素属性 Tab -->
        <div v-show="activeTab === 'selection'">
          <CanvasInspector
            v-if="hasActiveEditor"
            :editor="(activeEditor as Record<string, unknown>)"
            :get-side-label="getSideLabel"
            :t="t"
          />
          <div v-else class="dock-empty-tip" style="text-align: center; color: var(--b3-theme-label); padding: 32px 16px;">
            {{ t("dockEmptySelectionTip") }}
          </div>
        </div>
      </div>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenuVisible"
        class="workspace-context-menu"
        role="menu"
        :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px', zIndex: 99999 }"
        @click.stop
      >
        <button
          class="workspace-context-menu__item"
          role="menuitem"
          type="button"
          @click="contextMenuRename"
        >
          <CanvasIcon class="workspace-context-menu__icon" name="edit" :size="14" />
          {{ t('contextMenuRename') }}
        </button>
        <button
          class="workspace-context-menu__item"
          role="menuitem"
          type="button"
          @click="contextMenuOpenInExplorer"
        >
          <CanvasIcon class="workspace-context-menu__icon" name="folder-open" :size="14" />
          {{ t('contextMenuOpenInExplorer') }}
        </button>
        <button
          v-if="contextMenuType === 'file'"
          class="workspace-context-menu__item"
          role="menuitem"
          type="button"
          @click="contextMenuCopy"
        >
          <CanvasIcon class="workspace-context-menu__icon" name="copy" :size="14" />
          {{ t('contextMenuCopy') }}
        </button>
        <button
          v-if="contextMenuType === 'file'"
          class="workspace-context-menu__item"
          role="menuitem"
          type="button"
          @click="contextMenuCopyPath"
        >
          <CanvasIcon class="workspace-context-menu__icon" name="copy-path" :size="14" />
          {{ t('contextMenuCopyPath') }}
        </button>
        <template v-if="contextMenuType === 'folder'">
          <button
            class="workspace-context-menu__item"
            role="menuitem"
            type="button"
            @click="contextMenuNewSubfolder"
          >
            <CanvasIcon class="workspace-context-menu__icon" name="new-folder" :size="14" />
            {{ t('contextMenuNewSubfolder') }}
          </button>
          <button
            class="workspace-context-menu__item"
            role="menuitem"
            type="button"
            @click="contextMenuNewDocument"
          >
            <CanvasIcon class="workspace-context-menu__icon" name="new-canvas" :size="14" />
            {{ t('contextMenuNewDocument') }}
          </button>
        </template>
        <div class="workspace-context-menu__divider" />
        <button
          class="workspace-context-menu__item workspace-context-menu__item--danger"
          role="menuitem"
          type="button"
          @click="contextMenuDelete"
        >
          <CanvasIcon class="workspace-context-menu__icon" name="delete" :size="14" />
          {{ t('contextMenuDelete') }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import { showMessage as siyuanShowMessage } from "siyuan"
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue"
import {
  putFile as siyuanPutFile,
  readDir as siyuanReadDir,
  removeFile as siyuanRemoveFile,
} from "@/api"
import { openConfirmDialog } from "@/canvas/confirm-dialog"
import { openTextInputDialog } from "@/canvas/text-input-dialog"
import { createCanvasEditorWorkspaceTree } from "@/canvas/use-canvas-editor-workspace-tree"
import { useCanvasWorkspaceContextMenu } from "@/components/canvas/use-canvas-workspace-context-menu"
import { CanvasIcon } from "@/components/canvas/canvas-icon"
import CanvasWorkspaceTree from "@/components/canvas/CanvasWorkspaceTree.vue"
import CanvasInspector from "@/components/canvas/CanvasInspector.vue"
import { createCanvasI18n } from "@/i18n/canvas"

const props = defineProps<{
  plugin: Plugin
}>()

const t = createCanvasI18n((props.plugin as any).i18n)

// 标签页控制
const activeTab = ref<'documents' | 'selection'>('documents')
const sortDropdownOpen = ref(false)

// 活跃画布状态绑定（仅用于高亮当前编辑文件与属性审查器展示）
const activeEditor = computed(() => (props.plugin as any)?.activeEditor?.value ?? null)
const hasActiveEditor = computed(() => !!activeEditor.value)
const activeEditorFilePath = computed(() => activeEditor.value?.state?.filePath ?? "")

// 最近文档响应式触发与本地备份数据
const localRecentFiles = ref<any[]>([])

const refreshLocalRecentFiles = () => {
  localRecentFiles.value = (props.plugin as any).getRecentCanvasFiles?.() ?? []
}

// 展开折叠状态独立管理
const inspectorSectionState = ref({
  document: true,
  recent: true,
})

const toggleInspectorSection = (section: 'document' | 'recent') => {
  inspectorSectionState.value[section] = !inspectorSectionState.value[section]
}

// 监听活跃编辑器状态，当画布关闭时如果当前在属性页则强制切回文件树 Tab
watch(hasActiveEditor, (newVal) => {
  if (!newVal && activeTab.value === 'selection') {
    activeTab.value = 'documents'
  }
})

// === 1. 工作区文档树统一宿主管理 ===
const workspaceTree = (props.plugin as any)?.getOrCreateWorkspaceTree
  ? (props.plugin as any).getOrCreateWorkspaceTree()
  : ((props.plugin as any)?.workspaceTree ?? createCanvasEditorWorkspaceTree({
      readDir: siyuanReadDir,
      putFile: siyuanPutFile,
      removeFile: siyuanRemoveFile,
      showMessage: siyuanShowMessage,
      getSettings: () => (props.plugin as any)?.getCanvasSettings?.() ?? {},
      plugin: props.plugin as any,
      onFilePathUpdate: (path: string) => {
        if (activeEditor.value?.state) {
          activeEditor.value.state.filePath = path
        }
      },
      refreshRecentFiles: () => {
        refreshLocalRecentFiles()
      },
      promptText: openTextInputDialog,
      confirm: openConfirmDialog,
      labels: {
        copyTitle: t("selectionToolbarCopy") || "复制",
        deleteCanvasTitle: t("selectionToolbarDelete") || "删除画布",
        deleteFolderTitle: t("contextMenuDelete") || "删除文件夹",
        dialogCancel: t("dialogCancel") || "取消",
        dialogConfirm: t("dialogConfirm") || "确认",
        folderNameTitle: t("inspectorNewFolder") || "新建文件夹",
        renameFolderTitle: t("contextMenuRename") || "重命名文件夹",
        renameTitle: t("contextMenuRename") || "重命名",
        unableToSaveMessage: t("unableToSave") || "无法保存",
        untitledCanvas: t("untitledCanvas") || "未命名画布.canvas",
      },
    }))

// 确保存储至插件实例，使后续打开的编辑器能共享同一文档树实例
if (props.plugin && !(props.plugin as any).workspaceTree) {
  (props.plugin as any).workspaceTree = workspaceTree
}

// === 2. 状态映射 ===
const workspaceDocuments = computed(() => workspaceTree.workspaceDocuments.value)
const workspaceExpandedFolders = computed(() => workspaceTree.expandedFolders.value)
const workspaceSortField = computed(() => workspaceTree.workspaceSortField.value)
const workspaceSortDirection = computed(() => workspaceTree.workspaceSortDirection.value)
const allFoldersExpanded = computed(() => workspaceTree.allFoldersExpanded.value)
const recentFiles = computed(() => localRecentFiles.value)
const defaultCanvasDirectory = computed(() => {
  return (props.plugin as any)?.getCanvasSettings?.()?.defaultCanvasDirectory ?? ""
})

const dragSourcePath = ref<string | null>(null)
const dragOverFolderPath = ref<string | null>(null)
let dragExpandTimer: any = null

// === 3. 操作事件 ===
const handleToggleFolder = (path: string) => {
  workspaceTree.toggleFolderExpand(path)
}

const handleOpenFile = (path: string) => {
  props.plugin.openCanvasTab({ path })
}

const handleDeleteDocument = (path: string) => {
  workspaceTree.deleteWorkspaceDocument(path)
}

const handleCreateCanvas = async (path?: unknown) => {
  const targetPath = typeof path === 'string' ? path : undefined
  await workspaceTree.createWorkspaceCanvas(targetPath)
}

const handleCreateFolder = async () => {
  await workspaceTree.createWorkspaceFolder()
}

const handleToggleAllFolders = () => {
  if (workspaceTree.allFoldersExpanded.value) {
    workspaceTree.collapseAllFolders()
  } else {
    workspaceTree.expandAllFolders()
  }
}

const handleSetWorkspaceSortField = (field: 'name' | 'updated' | 'created') => {
  workspaceTree.setWorkspaceSortField(field)
  sortDropdownOpen.value = false
}

const handleSetWorkspaceSortDirection = (direction: 'asc' | 'desc') => {
  workspaceTree.setWorkspaceSortDirection(direction)
  sortDropdownOpen.value = false
}

const handleOpenRecentFile = (recent: any) => {
  props.plugin.openCanvasTab({ path: recent.path })
}

const handleRemoveRecentFileRecord = async (path: string) => {
  await (props.plugin as any).removeRecentCanvasFile?.(path)
  refreshLocalRecentFiles()
}

// === 4. 右键菜单 ===
const contextMenuTreeActions = {
  copyWorkspaceDocument: (path: string) => workspaceTree.copyWorkspaceDocument(path),
  createWorkspaceFolder: (path?: string) => workspaceTree.createWorkspaceFolder(path),
  createWorkspaceCanvas: (path?: string) => workspaceTree.createWorkspaceCanvas(path),
  deleteWorkspaceDocument: (path: string) => workspaceTree.deleteWorkspaceDocument(path),
  deleteWorkspaceFolder: (path: string) => workspaceTree.deleteWorkspaceFolder(path),
  openInExplorer: (path: string) => workspaceTree.openInExplorer(path),
  renameWorkspaceDocument: (path: string) => workspaceTree.renameWorkspaceDocument(path),
  renameWorkspaceFolder: (path: string) => workspaceTree.renameWorkspaceFolder(path),
  newCanvas: (path?: string) => workspaceTree.createWorkspaceCanvas(path),
}

const {
  closeContextMenu,
  contextMenuCopy,
  contextMenuCopyPath,
  contextMenuDelete,
  contextMenuNewDocument,
  contextMenuNewSubfolder,
  contextMenuOpenInExplorer,
  contextMenuRename,
  contextMenuType,
  contextMenuVisible,
  contextMenuX,
  contextMenuY,
  onContextMenu,
} = useCanvasWorkspaceContextMenu({
  copyPath: async (filePath) => {
    try {
      await navigator.clipboard.writeText(filePath)
    } catch (e) {
      console.error("Failed to copy path", e)
    }
  },
  editor: contextMenuTreeActions,
  showCopyPathSuccess: () => {
    siyuanShowMessage(t("selectionToolbarCopySuccess") || "已复制到剪贴板")
  },
})

function onContextMenuKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeContextMenu()
}

onMounted(() => {
  workspaceTree.refreshWorkspaceDocuments()
  refreshLocalRecentFiles()
  document.addEventListener("click", closeContextMenu)
  document.addEventListener("keydown", onContextMenuKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener("click", closeContextMenu)
  document.removeEventListener("keydown", onContextMenuKeydown)
  if (dragExpandTimer) {
    clearTimeout(dragExpandTimer)
    dragExpandTimer = null
  }
})

// === 5. 拖拽与放置事件 ===
const onFileDragStart = (event: DragEvent, filePath: string) => {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copyMove'
  event.dataTransfer.setData('text/plain', filePath)
  event.dataTransfer.setData('application/siyuan-workspace-file', filePath)
  dragSourcePath.value = filePath
}

const onFolderDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

const onFolderDragEnter = (event: DragEvent, folderPath: string) => {
  event.preventDefault()
  dragOverFolderPath.value = folderPath

  const expandedFoldersSet = workspaceTree.expandedFolders.value
  if (expandedFoldersSet && !expandedFoldersSet.has(folderPath)) {
    if (dragExpandTimer) clearTimeout(dragExpandTimer)
    dragExpandTimer = setTimeout(() => {
      workspaceTree.toggleFolderExpand(folderPath)
      dragExpandTimer = null
    }, 600)
  }
}

const onFolderDragLeave = (event: DragEvent, folderPath: string) => {
  const related = event.relatedTarget as HTMLElement | null
  if (related && (event.currentTarget as HTMLElement).contains(related)) return
  if (dragOverFolderPath.value === folderPath) {
    dragOverFolderPath.value = null
  }
  if (dragExpandTimer) {
    clearTimeout(dragExpandTimer)
    dragExpandTimer = null
  }
}

const onFolderDrop = async (event: DragEvent, folderPath: string) => {
  event.preventDefault()
  if (dragExpandTimer) {
    clearTimeout(dragExpandTimer)
    dragExpandTimer = null
  }
  dragOverFolderPath.value = null
  const sourcePath = event.dataTransfer?.getData('text/plain') || dragSourcePath.value
  if (!sourcePath) return
  dragSourcePath.value = null

  await workspaceTree.moveWorkspaceFile(sourcePath, folderPath)
}

const onRootDrop = async (event: DragEvent) => {
  event.preventDefault()
  const sourcePath = event.dataTransfer?.getData('text/plain') || dragSourcePath.value
  if (!sourcePath) return
  dragSourcePath.value = null

  const defaultDir = (props.plugin as any)?.getCanvasSettings?.()?.defaultCanvasDirectory ?? ""
  await workspaceTree.moveWorkspaceFile(sourcePath, defaultDir)
}

const onDragEnd = () => {
  dragSourcePath.value = null
  dragOverFolderPath.value = null
  if (dragExpandTimer) {
    clearTimeout(dragExpandTimer)
    dragExpandTimer = null
  }
}

// 标签页辅助方法
const getSideLabel = (side: any) => {
  switch (side) {
    case "top": return t("edgeDirectionTop") || "上"
    case "bottom": return t("edgeDirectionBottom") || "下"
    case "left": return t("edgeDirectionLeft") || "左"
    case "right": return t("edgeDirectionRight") || "右"
    default: return ""
  }
}
</script>

<style scoped lang="scss" src="./canvas-workspace.scss"></style>

<style lang="scss">
.workspace-context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 160px;
  padding: 4px 0;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
}

.workspace-context-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: calc(100% - 8px);
  margin: 0 4px;
  padding: 7px 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;

  &:hover {
    background: color-mix(in srgb, var(--b3-theme-on-surface) 8%, transparent);
  }

  &--danger {
    color: var(--b3-card-error-color, #c04f2a);

    &:hover {
      background: color-mix(in srgb, var(--b3-card-error-color, #c04f2a) 12%, transparent);
    }
  }
}

.workspace-context-menu__icon {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 14px;
  color: currentColor;
}

.workspace-context-menu__divider {
  height: 1px;
  margin: 4px;
  background: var(--b3-border-color);
}
</style>
