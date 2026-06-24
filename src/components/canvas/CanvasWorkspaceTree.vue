<template>
  <div
    ref="treeRef"
    class="workspace-tree"
    role="tree"
    @dragover.prevent
    @drop.prevent="$emit('root-drop', $event)"
    @keydown="handleKeyDown"
  >
    <WorkspaceTreeNodeView
      v-for="node in workspaceDocuments"
      :key="node.path"
      :node="node"
      :expanded-folders="expandedFolders"
      :current-file-path="currentFilePath"
      :drag-over-folder-path="dragOverFolderPath"
      :delete-title="deleteTitle"
      :focused-path="focusedPath"
      :default-tab-path="defaultTabPath"
      @toggle-folder="$emit('toggle-folder', $event)"
      @open-file="$emit('open-file', $event)"
      @delete-document="$emit('delete-document', $event)"
      @context-menu="forwardContextMenu"
      @folder-drag-over="$emit('folder-drag-over', $event)"
      @folder-drag-enter="forwardFolderDragEnter"
      @folder-drag-leave="forwardFolderDragLeave"
      @folder-drop="forwardFolderDrop"
      @file-drag-start="forwardFileDragStart"
      @drag-end="$emit('drag-end')"
      @update-focused-path="focusedPath = $event"
    />
  </div>
</template>

<script lang="ts">
export default { name: 'CanvasWorkspaceTree' }
</script>

<script setup lang="ts">
import {
  defineComponent,
  h,
  type PropType,
  ref,
  computed,
} from 'vue'
import type { WorkspaceTreeNode } from '@/canvas/use-canvas-editor-workspace-tree'
import { CanvasIcon } from '@/components/canvas/canvas-icon'

const props = defineProps<{
  workspaceDocuments: WorkspaceTreeNode[]
  expandedFolders: Set<string>
  currentFilePath: string
  dragOverFolderPath: string | null
  deleteTitle: string
}>()

const emit = defineEmits<{
  (e: 'toggle-folder', path: string): void
  (e: 'open-file', path: string): void
  (e: 'delete-document', path: string): void
  (e: 'context-menu', event: MouseEvent, path: string, type: 'file' | 'folder'): void
  (e: 'root-drop', event: DragEvent): void
  (e: 'folder-drag-over', event: DragEvent): void
  (e: 'folder-drag-enter', event: DragEvent, path: string): void
  (e: 'folder-drag-leave', event: DragEvent, path: string): void
  (e: 'folder-drop', event: DragEvent, path: string): void
  (e: 'file-drag-start', event: DragEvent, path: string): void
  (e: 'drag-end'): void
}>()

function forwardContextMenu(event: MouseEvent, path: string, type: 'file' | 'folder') {
  emit('context-menu', event, path, type)
}

function forwardFolderDragEnter(event: DragEvent, path: string) {
  emit('folder-drag-enter', event, path)
}

function forwardFolderDragLeave(event: DragEvent, path: string) {
  emit('folder-drag-leave', event, path)
}

function forwardFolderDrop(event: DragEvent, path: string) {
  emit('folder-drop', event, path)
}

function forwardFileDragStart(event: DragEvent, path: string) {
  emit('file-drag-start', event, path)
}

const treeRef = ref<HTMLElement | null>(null)
const focusedPath = ref<string | null>(null)

const defaultTabPath = computed(() => {
  if (props.currentFilePath) {
    return props.currentFilePath
  }
  return props.workspaceDocuments[0]?.path || null
})

function getVisibleItems() {
  if (!treeRef.value) return []
  return Array.from(
    treeRef.value.querySelectorAll('.workspace-tree__folder-header, .workspace-tree__file-open')
  ) as HTMLElement[]
}

function getParentFolderHeader(el: HTMLElement) {
  const childrenContainer = el.closest('.workspace-tree__folder-children')
  if (!childrenContainer) return null
  const parentFolder = childrenContainer.closest('.workspace-tree__folder')
  if (!parentFolder) return null
  return parentFolder.querySelector('.workspace-tree__folder-header') as HTMLElement | null
}

function handleKeyDown(event: KeyboardEvent) {
  const activeEl = document.activeElement as HTMLElement
  if (!activeEl) return

  const items = getVisibleItems()
  const idx = items.indexOf(activeEl)
  if (idx === -1) return

  let handled = false

  switch (event.key) {
    case 'ArrowDown':
      if (idx + 1 < items.length) {
        items[idx + 1].focus()
        handled = true
      }
      break
    case 'ArrowUp':
      if (idx - 1 >= 0) {
        items[idx - 1].focus()
        handled = true
      }
      break
    case 'ArrowRight':
      if (activeEl.classList.contains('workspace-tree__folder-header')) {
        const isExpanded = activeEl.getAttribute('aria-expanded') === 'true'
        if (!isExpanded) {
          activeEl.click()
        } else if (idx + 1 < items.length) {
          items[idx + 1].focus()
        }
        handled = true
      }
      break
    case 'ArrowLeft':
      if (activeEl.classList.contains('workspace-tree__folder-header')) {
        const isExpanded = activeEl.getAttribute('aria-expanded') === 'true'
        if (isExpanded) {
          activeEl.click()
        } else {
          const parentHeader = getParentFolderHeader(activeEl)
          if (parentHeader) {
            parentHeader.focus()
          }
        }
        handled = true
      } else if (activeEl.classList.contains('workspace-tree__file-open')) {
        const parentHeader = getParentFolderHeader(activeEl)
        if (parentHeader) {
          parentHeader.focus()
        }
        handled = true
      }
      break
    case 'Home':
      if (items.length > 0) {
        items[0].focus()
        handled = true
      }
      break
    case 'End':
      if (items.length > 0) {
        items[items.length - 1].focus()
        handled = true
      }
      break
  }

  if (handled) {
    event.preventDefault()
  }
}

const WorkspaceTreeNodeView = defineComponent({
  name: 'WorkspaceTreeNodeView',
  props: {
    node: {
      required: true,
      type: Object as PropType<WorkspaceTreeNode>,
    },
    expandedFolders: {
      required: true,
      type: Object as PropType<Set<string>>,
    },
    currentFilePath: {
      required: true,
      type: String,
    },
    dragOverFolderPath: {
      default: null,
      type: String as PropType<string | null>,
    },
    deleteTitle: {
      required: true,
      type: String,
    },
    focusedPath: {
      required: true,
      type: String as PropType<string | null>,
    },
    defaultTabPath: {
      required: true,
      type: String as PropType<string | null>,
    },
  },
  emits: [
    'toggle-folder',
    'open-file',
    'delete-document',
    'context-menu',
    'folder-drag-over',
    'folder-drag-enter',
    'folder-drag-leave',
    'folder-drop',
    'file-drag-start',
    'drag-end',
    'update-focused-path',
  ],
  setup(nodeProps, { emit }) {
    const isFocusable = computed(() => {
      if (nodeProps.focusedPath) {
        return nodeProps.focusedPath === nodeProps.node.path
      }
      return nodeProps.defaultTabPath === nodeProps.node.path
    })
    const tabIndex = computed(() => isFocusable.value ? 0 : -1)

    function renderFolder(node: Extract<WorkspaceTreeNode, { type: 'folder' }>) {
      const expanded = nodeProps.expandedFolders.has(node.path)

      return h('div', {
        class: 'workspace-tree__folder',
        role: 'treeitem',
        'aria-expanded': expanded,
      }, [
        h('button', {
          class: [
            'workspace-tree__folder-header',
            { 'workspace-tree__folder-header--drop-target': nodeProps.dragOverFolderPath === node.path },
          ],
          type: 'button',
          title: node.path,
          'aria-expanded': expanded,
          tabindex: tabIndex.value,
          onClick: () => emit('toggle-folder', node.path),
          onFocus: () => emit('update-focused-path', node.path),
          onContextmenu: (event: MouseEvent) => {
            event.preventDefault()
            emit('context-menu', event, node.path, 'folder')
          },
          onDragover: (event: DragEvent) => {
            event.preventDefault()
            emit('folder-drag-over', event)
          },
          onDragenter: (event: DragEvent) => {
            event.preventDefault()
            emit('folder-drag-enter', event, node.path)
          },
          onDragleave: (event: DragEvent) => emit('folder-drag-leave', event, node.path),
          onDrop: (event: DragEvent) => {
            event.preventDefault()
            emit('folder-drop', event, node.path)
          },
        }, [
          h(CanvasIcon, {
            class: [
              'workspace-tree__chevron',
              { 'workspace-tree__chevron--expanded': expanded },
            ],
            name: 'chevron-right',
            size: 12,
          }),
          h(CanvasIcon, {
            class: 'workspace-tree__folder-icon',
            name: expanded ? 'folder-open' : 'folder',
            size: 14,
          }),
          h('span', { class: 'workspace-tree__name' }, node.name),
        ]),
        expanded
          ? h('div', {
              class: 'workspace-tree__folder-children',
              role: 'group',
            }, node.children.map(child => h(WorkspaceTreeNodeView, {
              key: child.path,
              node: child,
              expandedFolders: nodeProps.expandedFolders,
              currentFilePath: nodeProps.currentFilePath,
              dragOverFolderPath: nodeProps.dragOverFolderPath,
              deleteTitle: nodeProps.deleteTitle,
              focusedPath: nodeProps.focusedPath,
              defaultTabPath: nodeProps.defaultTabPath,
              onToggleFolder: (path: string) => emit('toggle-folder', path),
              onOpenFile: (path: string) => emit('open-file', path),
              onDeleteDocument: (path: string) => emit('delete-document', path),
              onContextMenu: (event: MouseEvent, path: string, type: 'file' | 'folder') => emit('context-menu', event, path, type),
              onFolderDragOver: (event: DragEvent) => emit('folder-drag-over', event),
              onFolderDragEnter: (event: DragEvent, path: string) => emit('folder-drag-enter', event, path),
              onFolderDragLeave: (event: DragEvent, path: string) => emit('folder-drag-leave', event, path),
              onFolderDrop: (event: DragEvent, path: string) => emit('folder-drop', event, path),
              onFileDragStart: (event: DragEvent, path: string) => emit('file-drag-start', event, path),
              onDragEnd: () => emit('drag-end'),
              onUpdateFocusedPath: (path: string) => emit('update-focused-path', path),
            })))
          : null,
      ])
    }

    function renderFile(node: Extract<WorkspaceTreeNode, { type: 'file' }>) {
      const active = node.path === nodeProps.currentFilePath

      return h('div', {
        class: [
          'workspace-tree__file',
          { 'workspace-tree__file--active': active },
        ],
        draggable: 'true',
        title: node.path,
        role: 'treeitem',
        'aria-current': active ? 'page' : undefined,
        onContextmenu: (event: MouseEvent) => {
          event.preventDefault()
          emit('context-menu', event, node.path, 'file')
        },
        onDragstart: (event: DragEvent) => emit('file-drag-start', event, node.path),
        onDragend: () => emit('drag-end'),
      }, [
        h('button', {
          class: 'workspace-tree__file-open',
          type: 'button',
          tabindex: tabIndex.value,
          onClick: () => emit('open-file', node.path),
          onFocus: () => emit('update-focused-path', node.path),
        }, [
          h(CanvasIcon, {
            class: 'workspace-tree__file-icon',
            name: 'canvas-file',
            size: 14,
          }),
          h('span', { class: 'workspace-tree__name' }, node.name),
        ]),
        h('button', {
          class: 'workspace-tree__file-delete canvas-icon-button',
          type: 'button',
          'aria-label': nodeProps.deleteTitle,
          'data-tooltip': nodeProps.deleteTitle,
          tabindex: -1,
          onClick: (event: MouseEvent) => {
            event.stopPropagation()
            emit('delete-document', node.path)
          },
        }, [
          h(CanvasIcon, { name: 'close', size: 12 }),
        ]),
      ])
    }

    return () => {
      return nodeProps.node.type === 'folder'
        ? renderFolder(nodeProps.node)
        : renderFile(nodeProps.node)
    }
  },
})

void props
</script>

<style>
.workspace-tree {
  display: grid;
  gap: 1px;
}

.workspace-tree__folder-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--canvas-text);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  text-align: left;
}

.workspace-tree__folder-header:hover {
  background: var(--canvas-floating-button-bg);
}

.workspace-tree__folder-header--drop-target {
  background: var(--canvas-accent-soft);
  box-shadow: inset 2px 0 0 var(--canvas-accent);
}

.workspace-tree__file[draggable="true"] {
  cursor: grab;
}

.workspace-tree__file[draggable="true"]:active {
  opacity: 0.5;
  cursor: grabbing;
}

.workspace-tree__chevron {
  flex-shrink: 0;
  color: var(--canvas-text-muted);
  transition: transform 0.15s ease;
}

.workspace-tree__chevron--expanded {
  transform: rotate(90deg);
}

.workspace-tree__folder-icon,
.workspace-tree__file-icon {
  flex-shrink: 0;
  color: var(--canvas-text-muted);
}

.workspace-tree__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.workspace-tree__folder-children {
  display: grid;
  gap: 1px;
  padding-left: 16px;
  position: relative;
}

.workspace-tree__folder-children::before {
  content: '';
  position: absolute;
  left: 9px;
  top: 4px;
  bottom: 4px;
  width: 1px;
  background: var(--canvas-border);
}

.workspace-tree__file {
  display: flex;
  align-items: stretch;
  border: 0;
  border-radius: 6px;
  overflow: hidden;
  transition: background 0.15s ease;
}

.workspace-tree__file:hover {
  background: var(--canvas-floating-button-bg);
}

.workspace-tree__file--active {
  background: var(--canvas-accent-soft);
  box-shadow: inset 2px 0 0 var(--canvas-accent);
}

.workspace-tree__file--active .workspace-tree__file-icon,
.workspace-tree__file--active .workspace-tree__name {
  color: var(--canvas-accent);
}

.workspace-tree__file--active .workspace-tree__name {
  font-weight: 600;
}

.workspace-tree__file-open {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: 0;
  background: transparent;
  color: var(--canvas-text);
  cursor: pointer;
  text-align: left;
  min-width: 0;
  font: inherit;
}

.workspace-tree__file-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: auto 4px;
  flex-shrink: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--canvas-text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.workspace-tree__file:hover .workspace-tree__file-delete,
.workspace-tree__file--active .workspace-tree__file-delete,
.workspace-tree__file-delete:focus-visible {
  opacity: 1;
}

.workspace-tree__file-delete:hover {
  background: var(--canvas-danger-soft);
  color: var(--canvas-danger);
}

@media (hover: none) {
  .workspace-tree__file-delete {
    opacity: 1;
  }
}

.workspace-tree__empty {
  margin: 0;
  padding: 16px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--canvas-text-muted);
  line-height: 1.6;
}

.workspace-tree__empty code {
  display: inline-block;
  margin-top: 6px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--canvas-code-bg);
  font-size: 11px;
}
</style>
