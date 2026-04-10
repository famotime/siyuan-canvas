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
            :style="getCanvasNodeStyle(node)"
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
          :ref="setSelectionToolbarRef"
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
            :aria-label="SELECTION_TOOLBAR_TOOLTIPS.delete"
            :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.delete"
            :title="SELECTION_TOOLBAR_TOOLTIPS.delete"
            type="button"
            @click.stop="editor.deleteSelection"
          >
            <SelectionToolbarIcon
              class="selection-toolbar__icon"
              name="delete"
            />
          </button>
          <div class="selection-toolbar__menu">
            <button
              class="selection-toolbar__button"
              :class="{ 'selection-toolbar__button--active': editor.selectionToolbarPopover === 'color' }"
              :aria-label="SELECTION_TOOLBAR_TOOLTIPS.color"
              :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.color"
              data-testid="selection-toolbar-color"
              :title="SELECTION_TOOLBAR_TOOLTIPS.color"
              type="button"
              @click.stop="editor.toggleSelectionPopover('color')"
            >
              <SelectionToolbarIcon
                class="selection-toolbar__icon"
                name="color"
              />
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
            :aria-label="SELECTION_TOOLBAR_TOOLTIPS.center"
            :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.center"
            :title="SELECTION_TOOLBAR_TOOLTIPS.center"
            type="button"
            @click.stop="editor.centerSelectionInViewport"
          >
            <SelectionToolbarIcon
              class="selection-toolbar__icon"
              name="center"
            />
          </button>
          <button
            v-if="editor.selectedNodeCount === 1 && editor.selectedNode"
            class="selection-toolbar__button"
            data-testid="selection-toolbar-edit"
            :aria-label="SELECTION_TOOLBAR_TOOLTIPS.edit"
            :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.edit"
            :title="SELECTION_TOOLBAR_TOOLTIPS.edit"
            type="button"
            @click.stop="handleToolbarEdit"
          >
            <SelectionToolbarIcon
              class="selection-toolbar__icon"
              name="edit"
            />
          </button>
          <template v-else-if="editor.selectedNodeCount > 1">
            <button
              class="selection-toolbar__button"
              data-testid="selection-toolbar-create-group"
              :aria-label="SELECTION_TOOLBAR_TOOLTIPS.createGroup"
              :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.createGroup"
              :title="SELECTION_TOOLBAR_TOOLTIPS.createGroup"
              type="button"
              @click.stop="editor.createGroupFromSelection"
            >
              <SelectionToolbarIcon
                class="selection-toolbar__icon"
                name="group"
              />
            </button>
            <div class="selection-toolbar__menu">
              <button
                class="selection-toolbar__button"
                :class="{ 'selection-toolbar__button--active': editor.selectionToolbarPopover === 'layout' }"
                :aria-label="SELECTION_TOOLBAR_TOOLTIPS.align"
                :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.align"
                data-testid="selection-toolbar-align"
                :title="SELECTION_TOOLBAR_TOOLTIPS.align"
                type="button"
                @click.stop="editor.toggleSelectionPopover('layout')"
              >
                <SelectionToolbarIcon
                  class="selection-toolbar__icon"
                  name="align"
                />
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
                  :data-tooltip="layoutAction.label"
                  :title="layoutAction.label"
                  type="button"
                  @click.stop="editor.applySelectionLayout(layoutAction.action)"
                >
                  <SelectionToolbarIcon
                    class="selection-toolbar__menu-icon"
                    :name="SELECTION_LAYOUT_ICON_NAMES[layoutAction.action]"
                  />
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
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  nextTick,
  ref,
  watch,
} from "vue"
import type {
  CanvasNode,
  CanvasNodeLayoutAction,
} from "@/canvas/types"
import type { PropType } from "vue"

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
const selectionToolbarRef = ref<HTMLElement>()
let selectionToolbarResizeObserver: ResizeObserver | null = null
type SelectionToolbarIconName =
  | "delete"
  | "color"
  | "center"
  | "edit"
  | "group"
  | "align"
  | "left-align"
  | "center-horizontal"
  | "right-align"
  | "top-align"
  | "center-vertical"
  | "bottom-align"
  | "arrange-row"
  | "arrange-column"
  | "arrange-grid"
  | "distribute-horizontal"
  | "distribute-vertical"
  | "stretch-horizontal"
  | "stretch-vertical"

const SELECTION_TOOLBAR_TOOLTIPS = {
  align: "对齐",
  center: "聚焦",
  color: "颜色",
  createGroup: "创建分组",
  delete: "删除",
  edit: "编辑",
} as const

const SELECTION_LAYOUT_ICON_NAMES: Record<CanvasNodeLayoutAction, SelectionToolbarIconName> = {
  "arrange-column": "arrange-column",
  "arrange-grid": "arrange-grid",
  "arrange-row": "arrange-row",
  "bottom-align": "bottom-align",
  "center-horizontal": "center-horizontal",
  "center-vertical": "center-vertical",
  "distribute-horizontal": "distribute-horizontal",
  "distribute-vertical": "distribute-vertical",
  "left-align": "left-align",
  "right-align": "right-align",
  "stretch-horizontal": "stretch-horizontal",
  "stretch-vertical": "stretch-vertical",
  "top-align": "top-align",
}

const SELECTION_TOOLBAR_ICONS: Record<SelectionToolbarIconName, { paths: string[], viewBox: string }> = {
  align: {
    paths: [
      "M6 6h12",
      "M6 12h8",
      "M6 18h14",
      "M4 4v16",
    ],
    viewBox: "0 0 24 24",
  },
  "arrange-column": {
    paths: [
      "M6 4h12v4H6z",
      "M6 10h12v4H6z",
      "M6 16h12v4H6z",
    ],
    viewBox: "0 0 24 24",
  },
  "arrange-grid": {
    paths: [
      "M5 5h5v5H5z",
      "M14 5h5v5h-5z",
      "M5 14h5v5H5z",
      "M14 14h5v5h-5z",
    ],
    viewBox: "0 0 24 24",
  },
  "arrange-row": {
    paths: [
      "M4 7h4v10H4z",
      "M10 7h4v10h-4z",
      "M16 7h4v10h-4z",
    ],
    viewBox: "0 0 24 24",
  },
  "bottom-align": {
    paths: [
      "M4 19h16",
      "M7 8v11",
      "M12 5v14",
      "M17 11v8",
    ],
    viewBox: "0 0 24 24",
  },
  center: {
    paths: [
      "M9 4H7a3 3 0 0 0-3 3v2",
      "M15 4h2a3 3 0 0 1 3 3v2",
      "M20 15v2a3 3 0 0 1-3 3h-2",
      "M9 20H7a3 3 0 0 1-3-3v-2",
      "M12 9v6",
      "M9 12h6",
    ],
    viewBox: "0 0 24 24",
  },
  "center-horizontal": {
    paths: [
      "M12 4v16",
      "M7 7h10",
      "M9 12h6",
      "M6 17h12",
    ],
    viewBox: "0 0 24 24",
  },
  "center-vertical": {
    paths: [
      "M4 12h16",
      "M7 7v10",
      "M12 9v6",
      "M17 6v12",
    ],
    viewBox: "0 0 24 24",
  },
  color: {
    paths: [
      "M12 4c4.97 0 9 3.13 9 7 0 2.76-2.04 5.14-5 6.27-.9.34-1.5 1.2-1.5 2.17 0 .85-.69 1.56-1.54 1.56H12C7.03 21 3 17.87 3 14s4.03-10 9-10Z",
      "M8 11h.01",
      "M10.5 8.5h.01",
      "M14 8h.01",
      "M16 11h.01",
    ],
    viewBox: "0 0 24 24",
  },
  delete: {
    paths: [
      "M4 7h16",
      "M9 4h6",
      "M7 7l1 12h8l1-12",
      "M10 11v5",
      "M14 11v5",
      "M9 7V5h6v2",
    ],
    viewBox: "0 0 24 24",
  },
  "distribute-horizontal": {
    paths: [
      "M5 6v12",
      "M19 6v12",
      "M8 9h2v6H8z",
      "M14 9h2v6h-2z",
      "M10 12h4",
    ],
    viewBox: "0 0 24 24",
  },
  "distribute-vertical": {
    paths: [
      "M6 5h12",
      "M6 19h12",
      "M9 8v2h6V8",
      "M9 14v2h6v-2",
      "M12 10v4",
    ],
    viewBox: "0 0 24 24",
  },
  edit: {
    paths: [
      "M4 20h4l10-10-4-4L4 16v4",
      "M12 6l4 4",
      "M14 4l4 4",
    ],
    viewBox: "0 0 24 24",
  },
  group: {
    paths: [
      "M4 7h7v7H4z",
      "M13 7h7v7h-7z",
      "M8 14h8v3H8z",
    ],
    viewBox: "0 0 24 24",
  },
  "left-align": {
    paths: [
      "M4 4v16",
      "M7 7h11",
      "M7 12h8",
      "M7 17h13",
    ],
    viewBox: "0 0 24 24",
  },
  "right-align": {
    paths: [
      "M20 4v16",
      "M6 7h11",
      "M9 12h8",
      "M4 17h13",
    ],
    viewBox: "0 0 24 24",
  },
  "stretch-horizontal": {
    paths: [
      "M5 6v12",
      "M19 6v12",
      "M8 9h8v6H8z",
      "M7 12h-2",
      "M19 12h-2",
    ],
    viewBox: "0 0 24 24",
  },
  "stretch-vertical": {
    paths: [
      "M6 5h12",
      "M6 19h12",
      "M9 8h6v8H9z",
      "M12 7V5",
      "M12 19v-2",
    ],
    viewBox: "0 0 24 24",
  },
  "top-align": {
    paths: [
      "M4 5h16",
      "M7 5v11",
      "M12 5v14",
      "M17 5v8",
    ],
    viewBox: "0 0 24 24",
  },
}

const SelectionToolbarIcon = defineComponent({
  name: "SelectionToolbarIcon",
  props: {
    name: {
      required: true,
      type: String as PropType<SelectionToolbarIconName>,
    },
    size: {
      default: 18,
      type: Number,
    },
  },
  setup(props) {
    return () => {
      const icon = SELECTION_TOOLBAR_ICONS[props.name]

      return h(
        "svg",
        {
          "aria-hidden": "true",
          fill: "none",
          height: props.size,
          viewBox: icon.viewBox,
          width: props.size,
          xmlns: "http://www.w3.org/2000/svg",
        },
        icon.paths.map((path) => h("path", {
          d: path,
          stroke: "currentColor",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "stroke-width": "1.7",
        })),
      )
    }
  },
})
const selectionColorStyles: Record<string, { background: string, border: string, swatch: string }> = {
  "1": {
    background: "rgba(79, 124, 255, 0.18)",
    border: "#4f7cff",
    swatch: "#4f7cff",
  },
  "2": {
    background: "rgba(38, 166, 154, 0.18)",
    border: "#26a69a",
    swatch: "#26a69a",
  },
  "3": {
    background: "rgba(244, 180, 0, 0.18)",
    border: "#f4b400",
    swatch: "#f4b400",
  },
  "4": {
    background: "rgba(249, 115, 22, 0.18)",
    border: "#f97316",
    swatch: "#f97316",
  },
  "5": {
    background: "rgba(239, 68, 68, 0.18)",
    border: "#ef4444",
    swatch: "#ef4444",
  },
  "6": {
    background: "rgba(139, 92, 246, 0.18)",
    border: "#8b5cf6",
    swatch: "#8b5cf6",
  },
}

function valueFromEvent(event: Event): string {
  return (event.target as HTMLInputElement).value
}

function setEditingTextareaRef(value: Element | null) {
  editingTextareaRef.value = value instanceof HTMLTextAreaElement ? value : undefined
}

function setSelectionToolbarRef(value: Element | null) {
  selectionToolbarRef.value = value instanceof HTMLElement ? value : undefined
  observeSelectionToolbar()
  syncSelectionToolbarSize()
}

function getSelectionColorStyle(color: string) {
  const colorStyle = selectionColorStyles[color]

  return {
    backgroundColor: colorStyle?.swatch || "#64748b",
  }
}

function getCanvasNodeStyle(node: CanvasNode) {
  const colorStyle = "color" in node && node.color ? selectionColorStyles[node.color] : undefined

  return {
    ...editor.getNodeStyle(node),
    ...(colorStyle ? {
      backgroundColor: colorStyle.background,
      borderColor: colorStyle.border,
    } : {}),
  }
}

function handleToolbarEdit() {
  if (!editor.selectedNode || editor.selectedNodeCount !== 1) {
    return
  }

  handleNodeDoubleClick(editor.selectedNode)
}

function syncSelectionToolbarSize() {
  if (!selectionToolbarRef.value) {
    return
  }

  const { height, width } = selectionToolbarRef.value.getBoundingClientRect()
  editor.setSelectionToolbarSize({
    height: Math.round(height),
    width: Math.round(width),
  })
}

function observeSelectionToolbar() {
  selectionToolbarResizeObserver?.disconnect()
  selectionToolbarResizeObserver = null

  if (!selectionToolbarRef.value || typeof ResizeObserver === "undefined") {
    return
  }

  selectionToolbarResizeObserver = new ResizeObserver(() => {
    syncSelectionToolbarSize()
  })
  selectionToolbarResizeObserver.observe(selectionToolbarRef.value)
}

function handleWindowPointerDown(event: PointerEvent) {
  if (editor.selectionToolbarPopover === "closed") {
    return
  }

  if (event.target instanceof HTMLElement && event.target.closest(".selection-toolbar")) {
    return
  }

  editor.closeSelectionPopover()
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

onMounted(() => {
  window.addEventListener("pointerdown", handleWindowPointerDown)
})

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", handleWindowPointerDown)
  selectionToolbarResizeObserver?.disconnect()
})

watch(
  () => `${editor.selectionToolbar.visible}|${editor.selectedNodeCount}`,
  async () => {
    await nextTick()
    syncSelectionToolbarSize()
  },
)
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
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  min-width: 0;
  border: 0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: #f4f7f5;
  padding: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    color 120ms ease,
    transform 120ms ease;
}

.selection-toolbar__button--active,
.selection-toolbar__button:hover,
.selection-toolbar__menu-button:hover {
  background: rgba(255, 255, 255, 0.16);
}

.selection-toolbar__button:hover,
.selection-toolbar__menu-button:hover {
  transform: translateY(-1px);
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
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #f4f7f5;
  padding: 8px 10px;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.selection-toolbar__button::after,
.selection-toolbar__menu-button::after {
  content: attr(data-tooltip);
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  z-index: 2;
  padding: 5px 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(7, 10, 10, 0.98);
  color: #f4f7f5;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, 4px);
  transition:
    opacity 120ms ease,
    transform 120ms ease;
}

.selection-toolbar__button:hover::after,
.selection-toolbar__button:focus-visible::after,
.selection-toolbar__menu-button:hover::after,
.selection-toolbar__menu-button:focus-visible::after {
  opacity: 1;
  transform: translate(-50%, 0);
}

.selection-toolbar__icon,
.selection-toolbar__menu-icon {
  display: inline-flex;
  color: inherit;
}

.selection-toolbar__icon :deep(svg),
.selection-toolbar__menu-icon :deep(svg) {
  display: block;
}

.selection-toolbar__menu-icon {
  opacity: 0.88;
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
