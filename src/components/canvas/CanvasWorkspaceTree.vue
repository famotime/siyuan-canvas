<template>
  <div
    class="workspace-tree"
    @dragover.prevent
    @drop.prevent="$emit('root-drop', $event)"
  >
    <template
      v-for="node in workspaceDocuments"
      :key="node.path"
    >
      <div
        v-if="node.type === 'folder'"
        class="workspace-tree__folder"
      >
        <button
          :class="['workspace-tree__folder-header', { 'workspace-tree__folder-header--drop-target': dragOverFolderPath === node.path }]"
          type="button"
          :title="node.path"
          :aria-expanded="expandedFolders.has(node.path)"
          draggable="true"
          @click="$emit('toggle-folder', node.path)"
          @contextmenu.prevent="$emit('context-menu', $event, node.path, 'folder')"
          @dragstart="$emit('folder-drag-start', $event, node.path)"
          @dragend="$emit('drag-end')"
          @dragover.prevent="$emit('folder-drag-over', $event)"
          @dragenter.prevent="$emit('folder-drag-enter', $event, node.path)"
          @dragleave="$emit('folder-drag-leave', $event, node.path)"
          @drop.prevent="$emit('folder-drop', $event, node.path)"
        >
          <CanvasIcon
            class="workspace-tree__chevron"
            :class="{ 'workspace-tree__chevron--expanded': expandedFolders.has(node.path) }"
            name="chevron-right"
            :size="12"
          />
          <CanvasIcon
            class="workspace-tree__folder-icon"
            :name="expandedFolders.has(node.path) ? 'folder-open' : 'folder'"
            :size="14"
          />
          <span class="workspace-tree__name">{{ node.name }}</span>
        </button>
        <div
          v-if="expandedFolders.has(node.path)"
          class="workspace-tree__folder-children"
        >
          <template
            v-for="child in node.children"
            :key="child.path"
          >
            <div
              v-if="child.type === 'file'"
              :class="['workspace-tree__file', { 'workspace-tree__file--active': child.path === currentFilePath }]"
              draggable="true"
              :title="child.path"
              @contextmenu.prevent="$emit('context-menu', $event, child.path, 'file')"
              @dragstart="$emit('file-drag-start', $event, child.path)"
              @dragend="$emit('drag-end')"
            >
              <button
                class="workspace-tree__file-open"
                type="button"
                @click="$emit('open-file', child.path)"
              >
                <CanvasIcon
                  class="workspace-tree__file-icon"
                  name="canvas-file"
                  :size="14"
                />
                <span class="workspace-tree__name">{{ child.name }}</span>
              </button>
              <button
                class="workspace-tree__file-delete"
                :title="deleteTitle"
                type="button"
                @click.stop="$emit('delete-document', child.path)"
              >
                <CanvasIcon name="close" :size="12" />
              </button>
            </div>
            <div
              v-else-if="child.type === 'folder'"
              class="workspace-tree__folder workspace-tree__folder--nested"
            >
              <button
                :class="['workspace-tree__folder-header', { 'workspace-tree__folder-header--drop-target': dragOverFolderPath === child.path }]"
                type="button"
                :title="child.path"
                :aria-expanded="expandedFolders.has(child.path)"
                draggable="true"
                @click="$emit('toggle-folder', child.path)"
                @contextmenu.prevent="$emit('context-menu', $event, child.path, 'folder')"
                @dragstart="$emit('folder-drag-start', $event, child.path)"
                @dragend="$emit('drag-end')"
                @dragover.prevent="$emit('folder-drag-over', $event)"
                @dragenter.prevent="$emit('folder-drag-enter', $event, child.path)"
                @dragleave="$emit('folder-drag-leave', $event, child.path)"
                @drop.prevent="$emit('folder-drop', $event, child.path)"
              >
                <CanvasIcon
                  class="workspace-tree__chevron"
                  :class="{ 'workspace-tree__chevron--expanded': expandedFolders.has(child.path) }"
                  name="chevron-right"
                  :size="12"
                />
                <CanvasIcon
                  class="workspace-tree__folder-icon"
                  :name="expandedFolders.has(child.path) ? 'folder-open' : 'folder'"
                  :size="14"
                />
                <span class="workspace-tree__name">{{ child.name }}</span>
              </button>
              <div
                v-if="expandedFolders.has(child.path)"
                class="workspace-tree__folder-children"
              >
                <template
                  v-for="grandchild in child.children"
                  :key="grandchild.path"
                >
                  <div
                    v-if="grandchild.type === 'file'"
                    :class="['workspace-tree__file', { 'workspace-tree__file--active': grandchild.path === currentFilePath }]"
                    draggable="true"
                    :title="grandchild.path"
                    @contextmenu.prevent="$emit('context-menu', $event, grandchild.path, 'file')"
                    @dragstart="$emit('file-drag-start', $event, grandchild.path)"
                    @dragend="$emit('drag-end')"
                  >
                    <button
                      class="workspace-tree__file-open"
                      type="button"
                      @click="$emit('open-file', grandchild.path)"
                    >
                      <CanvasIcon
                        class="workspace-tree__file-icon"
                        name="canvas-file"
                        :size="14"
                      />
                      <span class="workspace-tree__name">{{ grandchild.name }}</span>
                    </button>
                    <button
                      class="workspace-tree__file-delete"
                      :title="deleteTitle"
                      type="button"
                      @click.stop="$emit('delete-document', grandchild.path)"
                    >
                      <CanvasIcon name="close" :size="12" />
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </template>
        </div>
      </div>
      <div
        v-else-if="node.type === 'file'"
        :class="['workspace-tree__file', { 'workspace-tree__file--active': node.path === currentFilePath }]"
        draggable="true"
        :title="node.path"
        @contextmenu.prevent="$emit('context-menu', $event, node.path, 'file')"
        @dragstart="$emit('file-drag-start', $event, node.path)"
        @dragend="$emit('drag-end')"
      >
        <button
          class="workspace-tree__file-open"
          type="button"
          @click="$emit('open-file', node.path)"
        >
          <CanvasIcon
            class="workspace-tree__file-icon"
            name="canvas-file"
            :size="14"
          />
          <span class="workspace-tree__name">{{ node.name }}</span>
        </button>
        <button
          class="workspace-tree__file-delete"
          :title="deleteTitle"
          type="button"
          @click.stop="$emit('delete-document', node.path)"
        >
          <CanvasIcon name="close" :size="12" />
        </button>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
export default { name: "CanvasWorkspaceTree" }
</script>

<script setup lang="ts">
import type { WorkspaceTreeNode } from "@/canvas/use-canvas-editor-workspace-tree"
import { CanvasIcon } from "@/components/canvas/canvas-icon"

defineProps<{
  workspaceDocuments: WorkspaceTreeNode[]
  expandedFolders: Set<string>
  currentFilePath: string
  dragOverFolderPath: string | null
  deleteTitle: string
}>()

defineEmits<{
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
  (e: 'folder-drag-start', event: DragEvent, path: string): void
  (e: 'drag-end'): void
}>()
</script>

<style scoped>
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

.workspace-tree__file[draggable="true"],
.workspace-tree__folder-header[draggable="true"] {
  cursor: grab;
}

.workspace-tree__file[draggable="true"]:active,
.workspace-tree__folder-header[draggable="true"]:active {
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
