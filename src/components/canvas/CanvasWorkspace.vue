<template>
  <div class="canvas-shell">
    <header class="toolbar">
      <div class="toolbar__group">
        <button
          class="toolbar__button toolbar__button--primary"
          @click="editor.newCanvas"
        >
          New
        </button>
        <button
          class="toolbar__button"
          @click="editor.openPath"
        >
          Open Path
        </button>
        <button
          class="toolbar__button"
          @click="editor.triggerImport"
        >
          Import
        </button>
        <button
          class="toolbar__button"
          @click="editor.save"
        >
          Save
        </button>
        <button
          class="toolbar__button"
          @click="editor.exportCanvas"
        >
          Export
        </button>
        <button
          class="toolbar__button"
          @click="editor.openSettings"
        >
          Settings
        </button>
      </div>
      <div class="toolbar__group">
        <button
          class="toolbar__button"
          @click="editor.addNode('text')"
        >
          Text
        </button>
        <button
          class="toolbar__button"
          @click="editor.addNode('file')"
        >
          File
        </button>
        <button
          class="toolbar__button"
          @click="editor.addNode('link')"
        >
          Link
        </button>
        <button
          class="toolbar__button"
          @click="editor.addNode('group')"
        >
          Group
        </button>
        <button
          class="toolbar__button"
          :disabled="!editor.canDelete"
          @click="editor.deleteSelection"
        >
          Delete
        </button>
      </div>
      <div class="toolbar__group">
        <button
          class="toolbar__button"
          @click="editor.zoomOut"
        >
          -
        </button>
        <button
          class="toolbar__button toolbar__button--stat"
          @click="editor.resetViewport"
        >
          {{ Math.round(editor.viewport.scale * 100) }}%
        </button>
        <button
          class="toolbar__button"
          @click="editor.zoomIn"
        >
          +
        </button>
      </div>
      <div class="toolbar__meta">
        <span>{{ editor.state.filePath || editor.suggestedFilename || "Unsaved.canvas" }}</span>
        <span>{{ editor.state.document.nodes.length }} nodes / {{ editor.state.document.edges.length }} edges</span>
        <span :class="editor.state.isDirty ? 'toolbar__dirty' : 'toolbar__saved'">
          {{ editor.state.isDirty ? "Unsaved changes" : "Saved" }}
        </span>
      </div>
    </header>

    <div
      class="workspace"
      :class="{ 'workspace--inspector-collapsed': !editor.inspectorExpanded }"
    >
      <button
        class="workspace__inspector-handle"
        :class="{ 'workspace__inspector-handle--collapsed': !editor.inspectorExpanded }"
        type="button"
        :title="editor.inspectorExpanded ? '收起属性栏' : '展开属性栏'"
        @click="editor.toggleInspector"
      >
        {{ editor.inspectorExpanded ? "›" : "‹" }}
      </button>

      <section
        ref="stageRef"
        class="stage"
        @pointerdown="editor.startPan"
        @wheel="editor.handleWheelZoom"
        @contextmenu.prevent
      >
        <div
          class="stage__world"
          :style="{
            height: `${editor.board.height}px`,
            transform: `translate(${editor.viewport.x}px, ${editor.viewport.y}px) scale(${editor.viewport.scale})`,
            width: `${editor.board.width}px`,
          }"
        >
          <svg
            class="stage__edges"
            :height="editor.board.height"
            :viewBox="`0 0 ${editor.board.width} ${editor.board.height}`"
            :width="editor.board.width"
          >
            <defs>
              <marker
                id="canvas-edge-arrow"
                markerHeight="14"
                markerUnits="userSpaceOnUse"
                markerWidth="14"
                orient="auto"
                refX="11"
                refY="7"
                viewBox="0 0 14 14"
              >
                <path
                  d="M 1.5 1.5 L 12 7 L 1.5 12.5 L 4.75 7 z"
                  fill="context-stroke"
                />
              </marker>
            </defs>
            <g
              v-for="edge in editor.state.document.edges"
              :key="edge.id"
            >
              <path
                class="stage__edge"
                :class="{ 'stage__edge--selected': editor.state.selectedEdgeId === edge.id }"
                :d="editor.getEdgePath(edge)"
                marker-end="url(#canvas-edge-arrow)"
                @click.stop="editor.selectEdge(edge.id)"
              />
              <text
                v-if="edge.label"
                class="stage__edge-label"
                :x="editor.getEdgeLabelPosition(edge).x"
                :y="editor.getEdgeLabelPosition(edge).y"
                @click.stop="editor.selectEdge(edge.id)"
              >
                {{ edge.label }}
              </text>
            </g>
          </svg>

          <article
            v-for="node in editor.displayNodes"
            :key="node.id"
            class="canvas-node"
            :class="[
              `canvas-node--${node.type}`,
              { 'canvas-node--selected': editor.state.selectedNodeIds.includes(node.id) },
            ]"
            :style="editor.getNodeStyle(node)"
            @pointerdown.stop="editor.handleNodePointerDown(node, $event)"
            @click.stop="editor.selectNode(node.id, $event)"
            @dblclick.stop="handleNodeDoubleClick(node)"
          >
            <div class="canvas-node__body">
              <template v-if="node.type === 'text'">
                <textarea
                  v-if="editingNodeId === node.id"
                  :ref="setEditingTextareaRef"
                  v-model="editingMarkdown"
                  class="canvas-node__editor"
                  @blur="commitTextNodeEditing"
                />
                <div
                  v-else
                  class="canvas-node__content markdown-preview"
                  v-html="editor.getRenderedMarkdown(node.text)"
                />
              </template>
              <template v-else-if="node.type === 'file'">
                <div class="file-card">
                  <span class="file-card__badge">
                    {{ editor.getFileNodePreview(node).badge }}
                  </span>
                  <img
                    v-if="editor.getFileNodePreview(node).imageSrc"
                    :src="editor.getFileNodePreview(node).imageSrc"
                    alt=""
                    class="file-card__image"
                  >
                  <div class="canvas-node__title">
                    {{ editor.getFileNodePreview(node).headline }}
                  </div>
                  <div class="canvas-node__meta">
                    {{ editor.getFileNodePreview(node).detail }}
                  </div>
                  <div class="file-card__helper">
                    {{ editor.getFileNodePreview(node).helper }}
                  </div>
                </div>
              </template>
              <template v-else-if="node.type === 'link'">
                <div class="canvas-node__title">
                  {{ node.url }}
                </div>
                <div class="canvas-node__meta">
                  Double click to open
                </div>
              </template>
              <template v-else>
                <div class="canvas-node__content">
                  {{ node.label || "Group" }}
                </div>
              </template>
            </div>
            <button
              class="canvas-node__resize"
              @pointerdown.stop="editor.startResize(node, $event)"
            />
          </article>
        </div>

        <div
          v-if="editor.selectionToolbar.visible"
          class="selection-toolbar"
          :class="`selection-toolbar--${editor.selectionToolbar.placement}`"
          :style="{
            left: `${editor.selectionToolbar.x}px`,
            top: `${editor.selectionToolbar.y}px`,
          }"
          data-testid="selection-toolbar"
          @click.stop
          @pointerdown.stop
        >
          <button
            class="selection-toolbar__button"
            data-testid="selection-toolbar-delete"
            type="button"
            @click.stop="editor.deleteSelection"
          >
            Delete
          </button>
          <div class="selection-toolbar__menu">
            <button
              class="selection-toolbar__button"
              :class="{ 'selection-toolbar__button--active': editor.selectionToolbarPopover === 'color' }"
              data-testid="selection-toolbar-color"
              type="button"
              @click.stop="editor.toggleSelectionPopover('color')"
            >
              Color
            </button>
            <div
              v-if="editor.selectionToolbarPopover === 'color'"
              class="selection-toolbar__popover selection-toolbar__popover--colors"
              data-testid="selection-color-palette"
              @click.stop
              @pointerdown.stop
            >
              <button
                v-for="color in editor.selectionColors"
                :key="color"
                class="selection-toolbar__swatch"
                :data-testid="`selection-color-${color}`"
                :style="getSelectionColorStyle(color)"
                type="button"
                @click.stop="editor.applySelectionColor(color)"
              />
            </div>
          </div>
          <button
            class="selection-toolbar__button"
            data-testid="selection-toolbar-center"
            type="button"
            @click.stop="editor.centerSelectionInViewport"
          >
            Center
          </button>
          <button
            v-if="editor.selectedNodeCount === 1 && editor.selectedNode"
            class="selection-toolbar__button"
            data-testid="selection-toolbar-edit"
            type="button"
            @click.stop="handleToolbarEdit"
          >
            Edit
          </button>
          <template v-else-if="editor.selectedNodeCount > 1">
            <button
              class="selection-toolbar__button"
              data-testid="selection-toolbar-create-group"
              type="button"
              @click.stop="editor.createGroupFromSelection"
            >
              Group
            </button>
            <div class="selection-toolbar__menu">
              <button
                class="selection-toolbar__button"
                :class="{ 'selection-toolbar__button--active': editor.selectionToolbarPopover === 'layout' }"
                data-testid="selection-toolbar-align"
                type="button"
                @click.stop="editor.toggleSelectionPopover('layout')"
              >
                Align
              </button>
              <div
                v-if="editor.selectionToolbarPopover === 'layout'"
                class="selection-toolbar__popover selection-toolbar__popover--layout"
                data-testid="selection-layout-menu"
                @click.stop
                @pointerdown.stop
              >
                <button
                  v-for="layoutAction in editor.selectionLayoutActions"
                  :key="layoutAction.action"
                  class="selection-toolbar__menu-button"
                  :data-testid="`selection-layout-action-${layoutAction.action}`"
                  type="button"
                  @click.stop="editor.applySelectionLayout(layoutAction.action)"
                >
                  {{ layoutAction.label }}
                </button>
              </div>
            </div>
          </template>
        </div>
      </section>

      <aside
        class="inspector"
        :class="{ 'inspector--collapsed': !editor.inspectorExpanded }"
      >
        <div
          v-if="editor.inspectorExpanded"
          class="inspector__content"
        >
          <section class="inspector__section">
            <h2>Document</h2>
            <p>{{ editor.state.filePath || "Unsaved workspace path" }}</p>
            <p>{{ editor.state.isDirty ? "Pending save" : "In sync" }}</p>
            <div
              v-if="editor.state.conflict"
              class="conflict-panel"
            >
              <strong>External change detected</strong>
              <span>The file changed on disk after it was loaded.</span>
              <div class="conflict-panel__actions">
                <button
                  class="toolbar__button"
                  @click="editor.loadConflictVersion"
                >
                  Load disk version
                </button>
                <button
                  class="toolbar__button toolbar__button--primary"
                  @click="editor.overwriteConflictVersion"
                >
                  Overwrite disk version
                </button>
              </div>
            </div>
            <div
              v-if="editor.state.issues.errors.length || editor.state.issues.warnings.length"
              class="issues"
            >
              <div
                v-for="issue in [...editor.state.issues.errors, ...editor.state.issues.warnings]"
                :key="issue.code + issue.path"
              >
                <strong>{{ issue.level.toUpperCase() }}</strong>
                <span>{{ issue.message }}</span>
              </div>
            </div>
          </section>

          <section class="inspector__section">
            <h2>Recent</h2>
            <div
              v-if="editor.recentFiles.length"
              class="recent-list"
            >
              <button
                v-for="recent in editor.recentFiles"
                :key="recent.path"
                class="recent-list__item"
                @click="editor.openRecentPath(recent.path)"
              >
                <strong>{{ recent.title }}</strong>
                <span>{{ recent.path }}</span>
              </button>
            </div>
            <p v-else>
              No recent workspace files yet.
            </p>
          </section>

          <section
            v-if="editor.selectedNodeCount > 1"
            class="inspector__section"
          >
            <h2>Selection</h2>
            <p>{{ editor.selectedNodeCount }} nodes selected.</p>
            <button
              class="toolbar__button"
              @click="editor.deleteSelection"
            >
              Delete selected nodes
            </button>
          </section>

          <section
            v-if="editor.selectedNode && editor.selectedNodeCount === 1"
            class="inspector__section"
          >
          <h2>Node</h2>
          <label>
            X
            <input
              :value="editor.selectedNode.x"
              type="number"
              @input="editor.updateNumericNodeField('x', valueFromEvent($event))"
            />
          </label>
          <label>
            Y
            <input
              :value="editor.selectedNode.y"
              type="number"
              @input="editor.updateNumericNodeField('y', valueFromEvent($event))"
            />
          </label>
          <label>
            Width
            <input
              :value="editor.selectedNode.width"
              type="number"
              @input="editor.updateNumericNodeField('width', valueFromEvent($event))"
            />
          </label>
          <label>
            Height
            <input
              :value="editor.selectedNode.height"
              type="number"
              @input="editor.updateNumericNodeField('height', valueFromEvent($event))"
            />
          </label>
          <label v-if="'color' in editor.selectedNode">
            Color
            <input
              :value="editor.selectedNode.color || ''"
              @input="editor.updateNodeField('color', valueFromEvent($event))"
            />
          </label>
          <label v-if="editor.selectedNode.type === 'text'">
            Text
            <textarea
              :value="editor.selectedNode.text"
              @input="editor.updateNodeField('text', valueFromEvent($event))"
            />
          </label>
          <label v-if="editor.selectedNode.type === 'file'">
            File path
            <input
              :value="editor.selectedNode.file"
              @input="editor.updateNodeField('file', valueFromEvent($event))"
            />
          </label>
          <label v-if="editor.selectedNode.type === 'link'">
            URL
            <input
              :value="editor.selectedNode.url"
              @input="editor.updateNodeField('url', valueFromEvent($event))"
            />
          </label>
          <label v-if="editor.selectedNode.type === 'group'">
            Label
            <input
              :value="editor.selectedNode.label || ''"
              @input="editor.updateNodeField('label', valueFromEvent($event))"
            />
          </label>
          </section>

          <section
            v-if="editor.selectedNode && editor.selectedNodeCount === 1"
            class="inspector__section"
          >
          <h2>Create Edge</h2>
          <label>
            Target
            <select v-model="editor.newEdgeTargetId">
              <option value="">Select target node</option>
              <option
                v-for="node in editor.edgeTargets"
                :key="node.id"
                :value="node.id"
              >
                {{ editor.getNodeTitle(node) }}
              </option>
            </select>
          </label>
          <label>
            Label
            <input v-model="editor.newEdgeLabel" />
          </label>
          <label>
            From side
            <select v-model="editor.newEdgeFromSide">
              <option
                v-for="side in editor.sides"
                :key="side"
                :value="side"
              >{{ side }}</option>
            </select>
          </label>
          <label>
            To side
            <select v-model="editor.newEdgeToSide">
              <option
                v-for="side in editor.sides"
                :key="side"
                :value="side"
              >{{ side }}</option>
            </select>
          </label>
          <button
            class="toolbar__button toolbar__button--primary"
            @click="editor.createEdgeFromSelection"
          >
            Create edge
          </button>
          </section>

          <section
            v-if="editor.selectedEdge"
            class="inspector__section"
          >
          <h2>Edge</h2>
          <label>
            Label
            <input
              :value="editor.selectedEdge.label || ''"
              @input="editor.updateEdgeField('label', valueFromEvent($event))"
            />
          </label>
          <label>
            From side
            <select
              :value="editor.selectedEdge.fromSide"
              @change="editor.updateEdgeSide('fromSide', valueFromEvent($event))"
            >
              <option
                v-for="side in editor.sides"
                :key="side"
                :value="side"
              >{{ side }}</option>
            </select>
          </label>
          <label>
            To side
            <select
              :value="editor.selectedEdge.toSide"
              @change="editor.updateEdgeSide('toSide', valueFromEvent($event))"
            >
              <option
                v-for="side in editor.sides"
                :key="side"
                :value="side"
              >{{ side }}</option>
            </select>
          </label>
          <button
            class="toolbar__button"
            @click="editor.deleteSelection"
          >
            Delete edge
          </button>
          </section>
        </div>
      </aside>
    </div>

    <input
      ref="fileInputRef"
      accept=".canvas,application/json"
      class="visually-hidden"
      type="file"
      @change="handleImport"
    >
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"

import type { CanvasTabBootstrap } from "@/main"
import { useCanvasEditor } from "@/canvas/use-canvas-editor"
import {
  nextTick,
  ref,
} from "vue"
import type { CanvasNode } from "@/canvas/types"

const props = defineProps<{
  bootstrap: CanvasTabBootstrap
  plugin: Plugin
  setTitle: (title: string) => void
}>()

const editor = useCanvasEditor(props.plugin, props.bootstrap, props.setTitle)
const editingMarkdown = ref("")
const editingNodeId = ref("")
const editingTextareaRef = ref<HTMLTextAreaElement>()
const fileInputRef = editor.fileInputRef
const stageRef = editor.stageRef
const selectionColorStyles: Record<string, string> = {
  "1": "#4f7cff",
  "2": "#26a69a",
  "3": "#f4b400",
  "4": "#f97316",
  "5": "#ef4444",
  "6": "#8b5cf6",
}

function valueFromEvent(event: Event): string {
  return (event.target as HTMLInputElement).value
}

function setEditingTextareaRef(value: Element | null) {
  editingTextareaRef.value = value instanceof HTMLTextAreaElement ? value : undefined
}

function getSelectionColorStyle(color: string) {
  return {
    backgroundColor: selectionColorStyles[color] || "#64748b",
  }
}

function handleToolbarEdit() {
  if (!editor.selectedNode || editor.selectedNodeCount !== 1) {
    return
  }

  handleNodeDoubleClick(editor.selectedNode)
}

function handleNodeDoubleClick(node: CanvasNode) {
  if (node.type !== "text") {
    editor.activateNode(node)
    return
  }

  editor.selectNode(node.id)
  editingNodeId.value = node.id
  editingMarkdown.value = node.text
  void nextTick(() => {
    editingTextareaRef.value?.focus()
    editingTextareaRef.value?.setSelectionRange(editingMarkdown.value.length, editingMarkdown.value.length)
  })
}

function commitTextNodeEditing() {
  if (!editingNodeId.value) {
    return
  }

  editor.updateTextNodeContent(editingNodeId.value, editingMarkdown.value)
  editingNodeId.value = ""
  editingMarkdown.value = ""
}

async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }

  await editor.importCanvas(file)
  input.value = ""
}
</script>

<style scoped lang="scss">
.canvas-shell {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
  min-height: 100%;
  color: var(--b3-theme-on-surface);
  background:
    radial-gradient(circle at top left, rgba(196, 226, 214, 0.18), transparent 28%),
    linear-gradient(135deg, rgba(255, 245, 232, 0.95), rgba(242, 247, 243, 0.96));
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 251, 245, 0.88);
  backdrop-filter: blur(16px);
}

.toolbar__group {
  display: inline-flex;
  gap: 8px;
}

.toolbar__meta {
  display: inline-flex;
  gap: 16px;
  margin-left: auto;
  font-size: 13px;
  color: var(--b3-theme-on-surface-light);
}

.toolbar__button {
  border: 1px solid rgba(22, 28, 20, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: var(--b3-theme-on-surface);
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
}

.toolbar__button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.toolbar__button--primary {
  background: #16361f;
  color: #f7f3ea;
}

.toolbar__button--stat {
  min-width: 72px;
}

.toolbar__dirty {
  color: #b84f2a;
}

.toolbar__saved {
  color: #3f7a58;
}

.workspace {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 320px;
  min-height: 0;
}

.workspace__inspector-handle {
  position: absolute;
  top: 50%;
  right: 304px;
  z-index: 4;
  width: 28px;
  height: 56px;
  border: 1px solid rgba(22, 28, 20, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  color: #274332;
  box-shadow: 0 10px 24px rgba(22, 36, 25, 0.14);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  transform: translateY(-50%);
}

.workspace__inspector-handle--collapsed {
  right: 36px;
}

.workspace--inspector-collapsed {
  grid-template-columns: 1fr 52px;
}

.stage {
  position: relative;
  overflow: hidden;
  background-image:
    linear-gradient(rgba(17, 33, 22, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(17, 33, 22, 0.08) 1px, transparent 1px);
  background-size: 32px 32px;
  touch-action: none;
}

.selection-toolbar {
  --selection-toolbar-bg: rgba(15, 20, 20, 0.94);
  --selection-toolbar-border: rgba(255, 255, 255, 0.08);
  --selection-toolbar-shadow: 0 16px 40px rgba(5, 10, 10, 0.28);
  position: absolute;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--selection-toolbar-border);
  border-radius: 16px;
  background: var(--selection-toolbar-bg);
  box-shadow: var(--selection-toolbar-shadow);
  backdrop-filter: blur(14px);
}

.selection-toolbar--bottom {
  transform: translateY(8px);
}

.selection-toolbar__button {
  min-width: 0;
  border: 0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: #f4f7f5;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}

.selection-toolbar__button--active,
.selection-toolbar__button:hover,
.selection-toolbar__menu-button:hover {
  background: rgba(255, 255, 255, 0.16);
}

.selection-toolbar__menu {
  position: relative;
}

.selection-toolbar__popover {
  position: absolute;
  left: 0;
  top: calc(100% + 10px);
  display: grid;
  gap: 8px;
  min-width: 160px;
  padding: 10px;
  border: 1px solid var(--selection-toolbar-border);
  border-radius: 14px;
  background: rgba(12, 16, 16, 0.98);
  box-shadow: var(--selection-toolbar-shadow);
}

.selection-toolbar__popover--colors {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  min-width: 132px;
}

.selection-toolbar__popover--layout {
  min-width: 180px;
}

.selection-toolbar__swatch {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  cursor: pointer;
}

.selection-toolbar__menu-button {
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #f4f7f5;
  padding: 8px 10px;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.stage__world {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
}

.stage__edges {
  position: absolute;
  left: 0;
  top: 0;
  overflow: visible;
  pointer-events: none;
}

.stage__edge {
  fill: none;
  stroke: rgba(44, 62, 48, 0.6);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: stroke;
}

.stage__edge--selected {
  stroke: #b84f2a;
}

.stage__edge-label {
  font-size: 12px;
  text-anchor: middle;
  fill: #4f5d52;
  pointer-events: all;
}

.canvas-node {
  position: absolute;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(17, 33, 22, 0.1);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 24px 40px rgba(22, 36, 25, 0.1);
  background: rgba(255, 252, 246, 0.96);
  cursor: grab;
  touch-action: none;
}

.canvas-node--group {
  background: rgba(195, 221, 206, 0.4);
  border-style: dashed;
}

.canvas-node--selected {
  box-shadow: 0 0 0 2px rgba(184, 79, 42, 0.45), 0 24px 40px rgba(22, 36, 25, 0.14);
}

.canvas-node__body {
  flex: 1;
  padding: 16px 14px 20px;
  overflow: auto;
}

.canvas-node__title {
  font-weight: 600;
  line-height: 1.5;
}

.canvas-node__content {
  white-space: pre-wrap;
  line-height: 1.6;
}

.canvas-node__editor {
  width: 100%;
  min-height: 100%;
  border: 0;
  outline: 0;
  resize: none;
  background: transparent;
  color: #25362c;
  font: inherit;
  line-height: 1.6;
  white-space: pre-wrap;
  box-sizing: border-box;
}

.markdown-preview {
  white-space: normal;
  color: #25362c;
}

.markdown-preview :deep(*) {
  margin: 0;
}

.markdown-preview :deep(h1),
.markdown-preview :deep(h2),
.markdown-preview :deep(h3),
.markdown-preview :deep(h4),
.markdown-preview :deep(h5),
.markdown-preview :deep(h6) {
  margin-bottom: 10px;
  color: #16361f;
  line-height: 1.3;
}

.markdown-preview :deep(p),
.markdown-preview :deep(blockquote),
.markdown-preview :deep(pre),
.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  margin-bottom: 10px;
}

.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  padding-left: 20px;
}

.markdown-preview :deep(blockquote) {
  border-left: 3px solid rgba(22, 54, 31, 0.22);
  padding-left: 10px;
  color: #506355;
}

.markdown-preview :deep(code) {
  border-radius: 6px;
  background: rgba(22, 54, 31, 0.08);
  padding: 2px 6px;
  font-size: 12px;
}

.markdown-preview :deep(pre) {
  overflow: auto;
  border-radius: 10px;
  background: rgba(22, 54, 31, 0.08);
  padding: 10px;
}

.markdown-preview :deep(pre code) {
  background: transparent;
  padding: 0;
}

.markdown-preview :deep(a) {
  color: #2c6a4a;
  text-decoration: underline;
}

.canvas-node__meta {
  margin-top: 8px;
  font-size: 12px;
  color: #6d796f;
  word-break: break-all;
}

.file-card {
  display: grid;
  gap: 8px;
}

.file-card__badge {
  justify-self: start;
  border-radius: 999px;
  background: rgba(22, 54, 31, 0.12);
  color: #274332;
  padding: 4px 8px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.file-card__image {
  width: 100%;
  max-height: 132px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid rgba(17, 33, 22, 0.08);
  background: rgba(255, 255, 255, 0.7);
}

.file-card__helper {
  font-size: 12px;
  color: #506355;
}

.canvas-node__resize {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 16px;
  height: 16px;
  border: 0;
  border-radius: 4px;
  background: rgba(22, 54, 31, 0.18);
  cursor: nwse-resize;
}

.inspector {
  overflow: auto;
  padding: 18px;
  border-left: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(250, 248, 242, 0.9);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inspector--collapsed {
  overflow: hidden;
  padding: 0;
  border-left: 1px solid rgba(0, 0, 0, 0.08);
}

.inspector__content {
  display: grid;
  gap: 0;
}

.inspector__section {
  display: grid;
  gap: 10px;
  margin-bottom: 18px;
  padding: 14px;
  border: 1px solid rgba(17, 33, 22, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.7);
}

.inspector__section h2 {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #4c5f53;
}

.inspector__section label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: #4f5d52;
}

.inspector__section input,
.inspector__section select,
.inspector__section textarea {
  width: 100%;
  border: 1px solid rgba(22, 28, 20, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  padding: 9px 10px;
  font: inherit;
  color: inherit;
  box-sizing: border-box;
}

.inspector__section textarea {
  min-height: 96px;
  resize: vertical;
}

.issues {
  display: grid;
  gap: 8px;
  font-size: 12px;
}

.conflict-panel {
  display: grid;
  gap: 8px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(184, 79, 42, 0.1);
  color: #6f2f18;
}

.conflict-panel__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.recent-list {
  display: grid;
  gap: 8px;
}

.recent-list__item {
  display: grid;
  gap: 4px;
  justify-items: start;
  border: 1px solid rgba(17, 33, 22, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  padding: 10px;
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.recent-list__item span {
  font-size: 12px;
  color: #6d796f;
  word-break: break-all;
}

.issues strong {
  margin-right: 6px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
