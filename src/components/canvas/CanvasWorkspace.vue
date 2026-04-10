<template>
  <div
    ref="canvasShellRef"
    class="canvas-shell"
    data-testid="canvas-shell"
  >
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
      :style="editor.inspectorExpanded ? undefined : { gridTemplateColumns: '1fr 0px' }"
    >
      <button
        class="workspace__inspector-handle"
        :class="{ 'workspace__inspector-handle--collapsed': !editor.inspectorExpanded }"
        :style="editor.inspectorExpanded ? undefined : { right: '8px' }"
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
            <path
              v-if="editor.connectionDraft.visible"
              class="stage__edge stage__edge--draft"
              :d="editor.getConnectionDraftPath()"
              marker-end="url(#canvas-edge-arrow)"
            />
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
              v-for="side in editor.sides"
              :key="`anchor-${node.id}-${side}`"
              class="canvas-node__anchor"
              :class="[
                `canvas-node__anchor--${side}`,
                { 'canvas-node__anchor--active': editor.isConnectionTarget(node.id, side) },
              ]"
              :data-testid="`node-anchor-${side}`"
              type="button"
              @pointerdown.stop.prevent="editor.startConnectionDrag(node, side, $event)"
            />
            <button
              v-for="side in editor.sides"
              :key="`resize-${node.id}-${side}`"
              class="canvas-node__resize-handle"
              :class="`canvas-node__resize-handle--${side}`"
              :data-testid="`node-resize-${side}`"
              type="button"
              @pointerdown.stop.prevent="editor.startResize(node, side, $event)"
            />
            <button
              class="canvas-node__resize-corner"
              data-testid="node-resize-corner"
              type="button"
              @pointerdown.stop.prevent="editor.startCornerResize(node, $event)"
            />
          </article>
        </div>

        <div
          v-if="editor.selectionBox.visible"
          class="stage__selection-box"
          :style="{
            height: `${editor.selectionBox.height}px`,
            left: `${editor.selectionBox.x}px`,
            top: `${editor.selectionBox.y}px`,
            width: `${editor.selectionBox.width}px`,
          }"
          data-testid="selection-box"
        />

        <div
          v-if="editor.selectionToolbar.visible"
          :ref="setSelectionToolbarRef"
          class="selection-toolbar"
          :class="[
            `selection-toolbar--${editor.selectionToolbar.placement}`,
            `selection-toolbar--${selectionToolbarThemeMode}`,
          ]"
          :data-theme-mode="selectionToolbarThemeMode"
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
const canvasShellRef = ref<HTMLElement>()
const fileInputRef = editor.fileInputRef
const stageRef = editor.stageRef
const selectionToolbarRef = ref<HTMLElement>()
const selectionToolbarThemeMode = ref<"dark" | "light">("light")
let canvasThemeObserver: MutationObserver | null = null
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

function syncSelectionToolbarThemeMode() {
  selectionToolbarThemeMode.value = canvasShellRef.value?.dataset.themeMode === "dark" ? "dark" : "light"
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
  syncSelectionToolbarThemeMode()
  window.addEventListener("pointerdown", handleWindowPointerDown)

  if (canvasShellRef.value && typeof MutationObserver !== "undefined") {
    canvasThemeObserver = new MutationObserver(() => {
      syncSelectionToolbarThemeMode()
    })
    canvasThemeObserver.observe(canvasShellRef.value, {
      attributeFilter: ["data-theme-mode"],
      attributes: true,
    })
  }
})

onBeforeUnmount(() => {
  canvasThemeObserver?.disconnect()
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
  --canvas-bg: var(--b3-theme-background);
  --canvas-surface: var(--b3-theme-surface);
  --canvas-surface-elevated: var(--b3-theme-surface);
  --canvas-surface-overlay: rgba(255, 255, 255, 0.82);
  --canvas-border: rgba(0, 0, 0, 0.1);
  --canvas-border-strong: rgba(0, 0, 0, 0.16);
  --canvas-text: var(--b3-theme-on-surface);
  --canvas-text-muted: var(--b3-theme-on-surface-light);
  --canvas-accent: var(--b3-theme-primary);
  --canvas-accent-contrast: var(--b3-theme-on-primary);
  --canvas-accent-soft: rgba(53, 103, 214, 0.14);
  --canvas-success: #2f7d4e;
  --canvas-danger: #c04f2a;
  --canvas-grid: rgba(15, 23, 42, 0.08);
  --canvas-shadow: 0 18px 34px rgba(15, 23, 42, 0.12);
  --canvas-shadow-strong: 0 18px 42px rgba(15, 23, 42, 0.18);
  --canvas-floating-bg: rgba(255, 255, 255, 0.94);
  --canvas-floating-border: rgba(0, 0, 0, 0.08);
  --canvas-floating-button-bg: rgba(15, 23, 42, 0.06);
  --canvas-floating-button-bg-hover: rgba(15, 23, 42, 0.12);
  --canvas-floating-text: var(--canvas-text);
  --canvas-floating-tooltip-bg: rgba(15, 23, 42, 0.96);
  --canvas-floating-tooltip-text: #f8fafc;
  --canvas-selection-border: rgba(53, 103, 214, 0.72);
  --canvas-selection-fill: rgba(53, 103, 214, 0.14);
  --canvas-card-bg: var(--canvas-surface);
  --canvas-group-bg: rgba(53, 103, 214, 0.08);
  --canvas-code-bg: rgba(15, 23, 42, 0.06);
  --canvas-inspector-bg: var(--canvas-surface-elevated);
  --canvas-inspector-section-bg: var(--canvas-surface-overlay);
  --canvas-anchor-bg: var(--canvas-surface);
  --canvas-anchor-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12);
  --canvas-resize-handle: rgba(15, 23, 42, 0.18);
  --canvas-resize-handle-hover: rgba(15, 23, 42, 0.26);
  --canvas-shell-highlight: rgba(53, 103, 214, 0.08);
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
  min-height: 100%;
  color: var(--canvas-text);
  background:
    radial-gradient(circle at top left, var(--canvas-shell-highlight), transparent 28%),
    linear-gradient(135deg, var(--canvas-bg), var(--canvas-surface));
}

.canvas-shell[data-theme-mode="dark"] {
  --canvas-surface-overlay: rgba(15, 23, 42, 0.68);
  --canvas-border: rgba(255, 255, 255, 0.1);
  --canvas-border-strong: rgba(255, 255, 255, 0.16);
  --canvas-accent-soft: rgba(92, 155, 255, 0.2);
  --canvas-grid: rgba(255, 255, 255, 0.08);
  --canvas-shadow: 0 18px 34px rgba(2, 6, 23, 0.32);
  --canvas-shadow-strong: 0 18px 42px rgba(2, 6, 23, 0.46);
  --canvas-floating-bg: rgba(15, 23, 42, 0.92);
  --canvas-floating-border: rgba(255, 255, 255, 0.1);
  --canvas-floating-button-bg: rgba(255, 255, 255, 0.08);
  --canvas-floating-button-bg-hover: rgba(255, 255, 255, 0.14);
  --canvas-floating-text: #f8fafc;
  --canvas-selection-border: rgba(92, 155, 255, 0.82);
  --canvas-selection-fill: rgba(92, 155, 255, 0.18);
  --canvas-group-bg: rgba(92, 155, 255, 0.12);
  --canvas-code-bg: rgba(255, 255, 255, 0.08);
  --canvas-anchor-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
  --canvas-resize-handle: rgba(255, 255, 255, 0.18);
  --canvas-resize-handle-hover: rgba(255, 255, 255, 0.26);
  --canvas-shell-highlight: rgba(92, 155, 255, 0.08);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--canvas-border);
  background: var(--canvas-surface-overlay);
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
  color: var(--canvas-text-muted);
}

.toolbar__button {
  border: 1px solid var(--canvas-border);
  border-radius: 999px;
  background: var(--canvas-surface);
  color: var(--canvas-text);
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  transition:
    border-color 120ms ease,
    background-color 120ms ease,
    color 120ms ease;
}

.toolbar__button:hover:not(:disabled) {
  border-color: var(--canvas-border-strong);
  background: var(--canvas-surface-overlay);
}

.toolbar__button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.toolbar__button--primary {
  border-color: transparent;
  background: var(--canvas-accent);
  color: var(--canvas-accent-contrast);
}

.toolbar__button--stat {
  min-width: 72px;
}

.toolbar__dirty {
  color: var(--canvas-danger);
}

.toolbar__saved {
  color: var(--canvas-success);
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
  border: 1px solid var(--canvas-border);
  border-radius: 999px;
  background: var(--canvas-surface-overlay);
  color: var(--canvas-text);
  box-shadow: var(--canvas-shadow);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  transform: translateY(-50%);
}

.workspace__inspector-handle--collapsed {
  right: 36px;
}

.workspace--inspector-collapsed {
  grid-template-columns: 1fr 0;
}

.stage {
  position: relative;
  overflow: hidden;
  background-color: var(--canvas-bg);
  background-image:
    linear-gradient(var(--canvas-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--canvas-grid) 1px, transparent 1px);
  background-size: 32px 32px;
  touch-action: none;
}

.stage__selection-box {
  position: absolute;
  z-index: 3;
  border: 1px solid var(--canvas-selection-border);
  border-radius: 12px;
  background: linear-gradient(135deg, var(--canvas-selection-fill), transparent);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  pointer-events: none;
}

.selection-toolbar {
  --selection-toolbar-bg: var(--canvas-floating-bg);
  --selection-toolbar-border: var(--canvas-floating-border);
  --selection-toolbar-shadow: var(--canvas-shadow-strong);
  --selection-toolbar-text: var(--canvas-floating-text);
  --selection-toolbar-button-bg: var(--canvas-floating-button-bg);
  --selection-toolbar-button-bg-hover: var(--canvas-floating-button-bg-hover);
  --selection-toolbar-tooltip-bg: var(--canvas-floating-tooltip-bg);
  --selection-toolbar-tooltip-border: var(--canvas-floating-border);
  --selection-toolbar-tooltip-text: var(--canvas-floating-tooltip-text);
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

.selection-toolbar--light {
  --selection-toolbar-bg: rgba(255, 255, 255, 0.96);
  --selection-toolbar-border: rgba(15, 23, 42, 0.1);
  --selection-toolbar-shadow: 0 18px 42px rgba(15, 23, 42, 0.14);
  --selection-toolbar-text: var(--canvas-text);
  --selection-toolbar-button-bg: rgba(15, 23, 42, 0.06);
  --selection-toolbar-button-bg-hover: rgba(15, 23, 42, 0.12);
  --selection-toolbar-tooltip-bg: rgba(255, 255, 255, 0.98);
  --selection-toolbar-tooltip-border: rgba(15, 23, 42, 0.12);
  --selection-toolbar-tooltip-text: var(--canvas-text);
}

.selection-toolbar--dark {
  --selection-toolbar-bg: rgba(15, 23, 42, 0.94);
  --selection-toolbar-border: rgba(255, 255, 255, 0.1);
  --selection-toolbar-shadow: 0 18px 44px rgba(2, 6, 23, 0.48);
  --selection-toolbar-text: #f8fafc;
  --selection-toolbar-button-bg: rgba(255, 255, 255, 0.08);
  --selection-toolbar-button-bg-hover: rgba(255, 255, 255, 0.14);
  --selection-toolbar-tooltip-bg: rgba(15, 23, 42, 0.98);
  --selection-toolbar-tooltip-border: rgba(255, 255, 255, 0.12);
  --selection-toolbar-tooltip-text: #f8fafc;
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
  background: var(--selection-toolbar-button-bg);
  color: var(--selection-toolbar-text);
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
  background: var(--selection-toolbar-button-bg-hover);
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
  background: var(--selection-toolbar-bg);
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
  border: 1px solid var(--selection-toolbar-border);
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
  color: var(--selection-toolbar-text);
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
  border: 1px solid var(--selection-toolbar-tooltip-border);
  border-radius: 8px;
  background: var(--selection-toolbar-tooltip-bg);
  color: var(--selection-toolbar-tooltip-text);
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
  stroke: var(--canvas-text-muted);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: stroke;
}

.stage__edge--selected {
  stroke: var(--canvas-accent);
}

.stage__edge--draft {
  stroke: var(--canvas-accent);
  stroke-dasharray: 8 6;
  pointer-events: none;
}

.stage__edge-label {
  font-size: 12px;
  text-anchor: middle;
  fill: var(--canvas-text-muted);
  pointer-events: all;
}

.canvas-node {
  position: absolute;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--canvas-border);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: var(--canvas-shadow);
  background: var(--canvas-card-bg);
  color: var(--canvas-text);
  cursor: grab;
  touch-action: none;
}

.canvas-node--group {
  background: var(--canvas-group-bg);
  border-style: dashed;
}

.canvas-node--selected {
  box-shadow: 0 0 0 2px var(--canvas-selection-border), var(--canvas-shadow-strong);
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
  color: var(--canvas-text);
  font: inherit;
  line-height: 1.6;
  white-space: pre-wrap;
  box-sizing: border-box;
}

.markdown-preview {
  white-space: normal;
  color: var(--canvas-text);
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
  color: var(--canvas-text);
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
  border-left: 3px solid var(--canvas-border-strong);
  padding-left: 10px;
  color: var(--canvas-text-muted);
}

.markdown-preview :deep(code) {
  border-radius: 6px;
  background: var(--canvas-code-bg);
  padding: 2px 6px;
  font-size: 12px;
}

.markdown-preview :deep(pre) {
  overflow: auto;
  border-radius: 10px;
  background: var(--canvas-code-bg);
  padding: 10px;
}

.markdown-preview :deep(pre code) {
  background: transparent;
  padding: 0;
}

.markdown-preview :deep(a) {
  color: var(--canvas-accent);
  text-decoration: underline;
}

.canvas-node__meta {
  margin-top: 8px;
  font-size: 12px;
  color: var(--canvas-text-muted);
  word-break: break-all;
}

.file-card {
  display: grid;
  gap: 8px;
}

.file-card__badge {
  justify-self: start;
  border-radius: 999px;
  background: var(--canvas-accent-soft);
  color: var(--canvas-text);
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
  border: 1px solid var(--canvas-border);
  background: var(--canvas-surface);
}

.file-card__helper {
  font-size: 12px;
  color: var(--canvas-text-muted);
}

.canvas-node__anchor,
.canvas-node__resize-handle {
  position: absolute;
  border: 0;
  padding: 0;
  background: transparent;
}

.canvas-node__anchor {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: var(--canvas-anchor-bg);
  box-shadow: var(--canvas-anchor-shadow);
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.78);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease,
    box-shadow 0.16s ease,
    background 0.16s ease;
  pointer-events: auto;
}

.canvas-node:hover .canvas-node__anchor,
.canvas-node--selected .canvas-node__anchor,
.canvas-node__anchor--active {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.canvas-node__anchor--active {
  background: var(--canvas-accent-soft);
  box-shadow: 0 0 0 2px var(--canvas-selection-fill);
}

.canvas-node__anchor::before {
  content: "";
  position: absolute;
  inset: 5px;
  border-radius: 999px;
  background: var(--canvas-accent);
}

.canvas-node__anchor--top {
  top: 0;
  left: 50%;
}

.canvas-node__anchor--right {
  top: 50%;
  left: 100%;
}

.canvas-node__anchor--bottom {
  top: 100%;
  left: 50%;
}

.canvas-node__anchor--left {
  top: 50%;
  left: 0;
}

.canvas-node__resize-handle {
  opacity: 0;
  transition: opacity 0.16s ease;
}

.canvas-node:hover .canvas-node__resize-handle,
.canvas-node--selected .canvas-node__resize-handle,
.canvas-node:hover .canvas-node__resize-corner,
.canvas-node--selected .canvas-node__resize-corner {
  opacity: 1;
}

.canvas-node__resize-handle--top,
.canvas-node__resize-handle--bottom {
  left: 14px;
  right: 14px;
  height: 12px;
}

.canvas-node__resize-handle--left,
.canvas-node__resize-handle--right {
  top: 14px;
  bottom: 14px;
  width: 12px;
}

.canvas-node__resize-handle--top {
  top: -6px;
  cursor: ns-resize;
}

.canvas-node__resize-handle--right {
  position: absolute;
  right: -6px;
  cursor: ew-resize;
}

.canvas-node__resize-handle--bottom {
  bottom: -6px;
  cursor: ns-resize;
}

.canvas-node__resize-handle--left {
  left: -6px;
  cursor: ew-resize;
}

.canvas-node__resize-corner {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 16px;
  height: 16px;
  border: 0;
  border-radius: 4px;
  background: var(--canvas-resize-handle);
  cursor: nwse-resize;
  opacity: 0;
  transition:
    opacity 0.16s ease,
    background 0.16s ease;
}

.canvas-node__resize-corner:hover {
  background: var(--canvas-resize-handle-hover);
}

.inspector {
  overflow: auto;
  padding: 18px;
  border-left: 1px solid var(--canvas-border);
  background: var(--canvas-inspector-bg);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inspector--collapsed {
  overflow: hidden;
  border-left: 0;
  padding: 0;
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
  border: 1px solid var(--canvas-border);
  border-radius: 16px;
  background: var(--canvas-inspector-section-bg);
}

.inspector__section h2 {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--canvas-text-muted);
}

.inspector__section label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--canvas-text-muted);
}

.inspector__section input,
.inspector__section select,
.inspector__section textarea {
  width: 100%;
  border: 1px solid var(--canvas-border);
  border-radius: 12px;
  background: var(--canvas-surface);
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
  background: var(--canvas-accent-soft);
  color: var(--canvas-text);
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
  border: 1px solid var(--canvas-border);
  border-radius: 12px;
  background: var(--canvas-surface);
  padding: 10px;
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.recent-list__item span {
  font-size: 12px;
  color: var(--canvas-text-muted);
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
