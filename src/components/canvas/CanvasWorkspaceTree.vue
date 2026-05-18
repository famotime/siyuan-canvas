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
          @click="$emit('toggle-folder', node.path)"
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
              @contextmenu.prevent="$emit('rename-document', child.path)"
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
                @click="$emit('toggle-folder', child.path)"
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
                    @contextmenu.prevent="$emit('rename-document', grandchild.path)"
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
        @contextmenu.prevent="$emit('rename-document', node.path)"
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
  (e: 'rename-document', path: string): void
  (e: 'root-drop', event: DragEvent): void
  (e: 'folder-drag-over', event: DragEvent): void
  (e: 'folder-drag-enter', event: DragEvent, path: string): void
  (e: 'folder-drag-leave', event: DragEvent, path: string): void
  (e: 'folder-drop', event: DragEvent, path: string): void
  (e: 'file-drag-start', event: DragEvent, path: string): void
  (e: 'drag-end'): void
}>()
</script>
