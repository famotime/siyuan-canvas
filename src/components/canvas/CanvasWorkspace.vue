<template>
  <div
    ref="canvasShellRef"
    class="canvas-shell"
    data-testid="canvas-shell"
  >
    <header
      class="canvas-toolbar"
      data-testid="top-toolbar"
      @pointerdown.capture="editor.deactivateCanvasSurface"
    >
      <div class="toolbar__group">
        <button
          class="toolbar__button toolbar__button--icon toolbar__button--primary"
          data-testid="top-toolbar-new"
          :aria-label="t('toolbarNew')"
          :data-tooltip="t('toolbarNew')"
          :title="t('toolbarNew')"
          type="button"
          @click="editor.newCanvas"
        >
          <CanvasIcon
            class="toolbar__icon"
            name="new"
          />
        </button>
        <button
          class="toolbar__button toolbar__button--icon"
          data-testid="top-toolbar-open"
          :aria-label="t('toolbarOpen')"
          :data-tooltip="t('toolbarOpen')"
          :title="t('toolbarOpen')"
          type="button"
          @click="editor.triggerImport"
        >
          <CanvasIcon
            class="toolbar__icon"
            name="open"
          />
        </button>
        <button
          class="toolbar__button toolbar__button--icon"
          data-testid="top-toolbar-save"
          :aria-label="t('toolbarSave')"
          :data-tooltip="t('toolbarSave')"
          :title="t('toolbarSave')"
          type="button"
          @click="editor.save"
        >
          <CanvasIcon
            class="toolbar__icon"
            name="save"
          />
        </button>
      </div>
      <div class="toolbar__group">
        <button
          class="toolbar__button toolbar__button--icon"
          data-testid="top-toolbar-zoom-out"
          :aria-label="t('toolbarZoomOut')"
          :data-tooltip="t('toolbarZoomOut')"
          :title="t('toolbarZoomOut')"
          type="button"
          @click="editor.zoomOut"
        >
          <CanvasIcon
            class="toolbar__icon"
            name="zoom-out"
          />
        </button>
        <span
          class="toolbar__stat"
          data-testid="top-toolbar-scale-value"
        >
          {{ Math.round(editor.viewport.scale * 100) }}%
        </span>
        <button
          class="toolbar__button toolbar__button--icon"
          data-testid="top-toolbar-zoom-in"
          :aria-label="t('toolbarZoomIn')"
          :data-tooltip="t('toolbarZoomIn')"
          :title="t('toolbarZoomIn')"
          type="button"
          @click="editor.zoomIn"
        >
          <CanvasIcon
            class="toolbar__icon"
            name="zoom-in"
          />
        </button>
        <button
          class="toolbar__button toolbar__button--icon"
          data-testid="top-toolbar-reset-viewport"
          :aria-label="t('toolbarResetViewport')"
          :data-tooltip="t('toolbarResetViewport')"
          :title="t('toolbarResetViewport')"
          type="button"
          @click="editor.resetViewport"
        >
          <CanvasIcon
            class="toolbar__icon"
            name="reset-viewport"
          />
        </button>
      </div>
      <div class="toolbar__meta">
        <span>{{ editor.state.filePath || editor.suggestedFilename || t("untitledCanvas") }}</span>
        <span>{{ t("toolbarGraphStats", { nodes: editor.state.document.nodes.length, edges: editor.state.document.edges.length }) }}</span>
        <span :class="editor.state.isDirty ? 'toolbar__dirty' : 'toolbar__saved'">
          {{ editor.state.isDirty ? t("toolbarUnsavedChanges") : t("toolbarSaved") }}
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
        :title="editor.inspectorExpanded ? t('inspectorCollapseSidebar') : t('inspectorExpandSidebar')"
        @click="editor.toggleInspector"
      >
        {{ editor.inspectorExpanded ? "›" : "‹" }}
      </button>

      <section
        ref="stageRef"
        class="stage"
        @pointerdown="handleStagePointerDown"
        @paste="handleStagePaste"
        @wheel.passive="editor.handleWheelZoom"
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
              <marker
                id="canvas-edge-arrow-end"
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
              <marker
                id="canvas-edge-arrow-start"
                markerHeight="14"
                markerUnits="userSpaceOnUse"
                markerWidth="14"
                orient="auto-start-reverse"
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
                :marker-start="resolveEdgeStartMarker(edge.startArrow ?? false)"
                :marker-end="resolveEdgeEndMarker(edge.endArrow ?? true)"
                :style="getEdgeStrokeStyle(edge)"
                @click.stop="editor.selectEdge(edge.id)"
              />
              <text
                v-if="edge.label"
                class="stage__edge-label"
                :x="editor.getEdgeLabelPosition(edge).x"
                :y="editor.getEdgeLabelPosition(edge).y"
                :style="getEdgeLabelStyle(edge)"
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
            <path
              v-if="editor.edgeReconnectDraft.visible"
              class="stage__edge stage__edge--draft"
              data-testid="edge-reconnect-draft"
              :d="editor.getEdgeReconnectDraftPath()"
              :marker-start="editor.edgeReconnectDraft.endpoint === 'from' ? 'url(#canvas-edge-arrow-start)' : undefined"
              :marker-end="editor.edgeReconnectDraft.endpoint === 'to' ? 'url(#canvas-edge-arrow-end)' : undefined"
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
            @pointerdown.stop="handleNodePointerDown(node, $event)"
            @click.stop="handleNodeClick(node, $event)"
            @dblclick.stop="handleNodeDoubleClick(node)"
            @wheel.passive="handleNodeWheel(node, $event)"
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
                <CanvasFileCard
                  :canvas-thumbnail-view-box="getCanvasThumbnailViewBox(editor.getFileNodePreview(node).thumbnail)"
                  :document-preview-html="getFileCardDocumentPreviewHtml(node)"
                  :image-src="getFileCardImageSource(node)"
                  :node="node"
                  :preview="editor.getFileNodePreview(node)"
                  :show-detail="shouldShowFileCardDetail(node)"
                  :show-headline="shouldShowFileCardHeadline(node)"
                  :tooltip="getFileCardTooltip(node)"
                  @image-error="handleFileCardImageError"
                  @preview-image-error="handleFileCardPreviewImageError"
                />
              </template>
              <template v-else-if="node.type === 'link'">
                <div class="canvas-node__title">
                  {{ node.url }}
                </div>
                <div class="canvas-node__meta">
                  {{ t("nodeLinkHelper") }}
                </div>
              </template>
              <template v-else />
            </div>
            <template v-if="node.type === 'group'">
              <textarea
                v-if="editingNodeId === node.id"
                :ref="setEditingTextareaRef"
                v-model="editingMarkdown"
                class="canvas-node__group-label canvas-node__group-label-editor"
                @blur="commitTextNodeEditing"
              />
              <div
                v-else
                class="canvas-node__group-label"
                :style="getCanvasNodeContentStyle(node)"
              >
                {{ node.label || t("nodeDefaultGroupLabel") }}
              </div>
            </template>
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
              v-for="segment in NODE_RESIZE_SEGMENTS"
              :key="`resize-${node.id}-${segment.id}`"
              class="canvas-node__resize-handle"
              :class="`canvas-node__resize-handle--${segment.id}`"
              :data-testid="`node-resize-${segment.id}`"
              type="button"
              @pointerdown.stop.prevent="editor.startResize(node, segment.side, $event)"
            />
            <button
              class="canvas-node__resize-corner"
              data-testid="node-resize-corner"
              type="button"
              @pointerdown.stop.prevent="editor.startCornerResize(node, $event)"
            />
          </article>

          <svg
            class="stage__edges stage__edges--interactive"
            :height="editor.board.height"
            :viewBox="`0 0 ${editor.board.width} ${editor.board.height}`"
            :width="editor.board.width"
          >
            <g
              v-for="edge in editor.state.document.edges"
              :key="`interactive-${edge.id}`"
            >
              <path
                class="stage__edge stage__edge--overlay"
                :class="{
                  'stage__edge--hovered': hoveredEdgeId === edge.id,
                  'stage__edge--selected': editor.state.selectedEdgeId === edge.id,
                  'stage__edge--visible': hoveredEdgeId === edge.id || editor.state.selectedEdgeId === edge.id,
                }"
                :d="editor.getEdgePath(edge)"
                :marker-start="resolveEdgeStartMarker(edge.startArrow ?? false)"
                :marker-end="resolveEdgeEndMarker(edge.endArrow ?? true)"
                :style="getEdgeStrokeStyle(edge)"
                :data-testid="`edge-overlay-${edge.id}`"
              />
              <path
                class="stage__edge stage__edge--hit-area"
                :d="editor.getEdgePath(edge)"
                :data-testid="`edge-hit-area-${edge.id}`"
                @mouseenter="setHoveredEdge(edge.id)"
                @mouseleave="clearHoveredEdge(edge.id)"
                @pointerdown.stop
                @click.stop="handleEdgeClick(edge.id)"
              />
            </g>
          </svg>
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

        <button
          v-if="editor.selectedEdgeHandlePositions"
          class="edge-endpoint-handle"
          data-testid="edge-endpoint-from"
          type="button"
          :style="{
            left: `${editor.selectedEdgeHandlePositions.from.x}px`,
            top: `${editor.selectedEdgeHandlePositions.from.y}px`,
          }"
          @pointerdown.stop.prevent="editor.startEdgeEndpointDrag('from', $event)"
        />

        <button
          v-if="editor.selectedEdgeHandlePositions"
          class="edge-endpoint-handle"
          data-testid="edge-endpoint-to"
          type="button"
          :style="{
            left: `${editor.selectedEdgeHandlePositions.to.x}px`,
            top: `${editor.selectedEdgeHandlePositions.to.y}px`,
          }"
          @pointerdown.stop.prevent="editor.startEdgeEndpointDrag('to', $event)"
        />

        <div
          v-if="editor.edgeToolbar.visible"
          :ref="setEdgeToolbarRef"
          class="edge-toolbar selection-toolbar"
          :class="[
            `selection-toolbar--${editor.edgeToolbar.placement}`,
            `selection-toolbar--${selectionToolbarThemeMode}`,
          ]"
          :style="{
            left: `${editor.edgeToolbar.x}px`,
            top: `${editor.edgeToolbar.y}px`,
          }"
          data-testid="edge-toolbar"
          @click.stop
          @pointerdown.stop
        >
          <button
            class="selection-toolbar__button"
            data-testid="edge-toolbar-delete"
            :aria-label="SELECTION_TOOLBAR_TOOLTIPS.delete"
            :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.delete"
            :title="SELECTION_TOOLBAR_TOOLTIPS.delete"
            type="button"
            @click.stop="editor.deleteSelection"
          >
              <CanvasIcon class="selection-toolbar__icon" name="delete" />
          </button>
          <div class="selection-toolbar__menu">
            <button
              class="selection-toolbar__button"
              :class="{ 'selection-toolbar__button--active': editor.edgeToolbarPopover === 'color' }"
              data-testid="edge-toolbar-color"
              :aria-label="SELECTION_TOOLBAR_TOOLTIPS.color"
              :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.color"
              :title="SELECTION_TOOLBAR_TOOLTIPS.color"
              type="button"
              @click.stop="editor.toggleEdgePopover('color')"
            >
              <CanvasIcon class="selection-toolbar__icon" name="color" />
            </button>
            <div
              v-if="editor.edgeToolbarPopover === 'color'"
              class="selection-toolbar__popover selection-toolbar__popover--colors"
              data-testid="edge-color-palette"
              @click.stop
              @pointerdown.stop
            >
              <button
                class="selection-toolbar__swatch selection-toolbar__swatch--clear"
                data-testid="edge-color-clear"
                :style="getSelectionColorStyle(CLEAR_SELECTION_COLOR)"
                :title="t('selectionToolbarClearColor')"
                type="button"
                @click.stop="editor.applyEdgeColor(CLEAR_SELECTION_COLOR)"
              />
              <button
                v-for="color in editor.edgeColorOptions"
                :key="`edge-color-${color}`"
                class="selection-toolbar__swatch"
                :data-testid="`edge-color-${color}`"
                :style="getSelectionColorStyle(color)"
                type="button"
                @click.stop="editor.applyEdgeColor(color)"
              />
            </div>
          </div>
          <button
            class="selection-toolbar__button"
            data-testid="edge-toolbar-center"
            :aria-label="SELECTION_TOOLBAR_TOOLTIPS.center"
            :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.center"
            :title="SELECTION_TOOLBAR_TOOLTIPS.center"
            type="button"
            @click.stop="editor.centerEdgeInViewport"
          >
            <CanvasIcon class="selection-toolbar__icon" name="center" />
          </button>
          <div
            class="selection-toolbar__menu"
            data-testid="edge-toolbar-direction"
          >
            <button
              class="selection-toolbar__button"
              :class="{ 'selection-toolbar__button--active': editor.edgeToolbarPopover === 'direction' }"
              data-testid="edge-toolbar-direction-trigger"
              type="button"
              :aria-label="t('edgeToolbarDirection')"
              :data-tooltip="t('edgeToolbarDirection')"
              :title="t('edgeToolbarDirection')"
              @click.stop="editor.toggleEdgePopover('direction')"
            >
              <CanvasIcon class="selection-toolbar__icon" name="connect" />
            </button>
            <div
              v-if="editor.edgeToolbarPopover === 'direction'"
              class="selection-toolbar__popover selection-toolbar__popover--layout"
              data-testid="edge-direction-menu"
              @click.stop
              @pointerdown.stop
            >
              <button
                class="selection-toolbar__menu-button"
                :class="{ 'selection-toolbar__menu-button--active': editor.selectedEdgeDirectionMode === 'none' }"
                data-testid="edge-toolbar-direction-none"
                type="button"
                @click.stop="editor.updateSelectedEdgeDirection('none')"
              >
                <CanvasIcon
                  class="selection-toolbar__menu-icon"
                  :name="EDGE_DIRECTION_ICON_NAMES.none"
                />
                {{ t("edgeDirectionNone") }}
              </button>
              <button
                class="selection-toolbar__menu-button"
                :class="{ 'selection-toolbar__menu-button--active': editor.selectedEdgeDirectionMode === 'single' }"
                data-testid="edge-toolbar-direction-single"
                type="button"
                @click.stop="editor.updateSelectedEdgeDirection('single')"
              >
                <CanvasIcon
                  class="selection-toolbar__menu-icon"
                  :name="EDGE_DIRECTION_ICON_NAMES.single"
                />
                {{ t("edgeDirectionSingle") }}
              </button>
              <button
                class="selection-toolbar__menu-button"
                :class="{ 'selection-toolbar__menu-button--active': editor.selectedEdgeDirectionMode === 'both' }"
                data-testid="edge-toolbar-direction-both"
                type="button"
                @click.stop="editor.updateSelectedEdgeDirection('both')"
              >
                <CanvasIcon
                  class="selection-toolbar__menu-icon"
                  :name="EDGE_DIRECTION_ICON_NAMES.both"
                />
                {{ t("edgeDirectionBoth") }}
              </button>
            </div>
          </div>
          <button
            class="selection-toolbar__button"
            data-testid="edge-toolbar-edit-label"
            :aria-label="t('edgeToolbarEditLabel')"
            :data-tooltip="t('edgeToolbarEditLabel')"
            :title="t('edgeToolbarEditLabel')"
            type="button"
            @click.stop="editor.startEdgeLabelEditing"
          >
            <CanvasIcon class="selection-toolbar__icon" name="edit" />
          </button>
        </div>

        <input
          v-if="editor.editingEdgeLabelId && editor.edgeLabelEditorPosition"
          ref="edgeLabelInputRef"
          :value="editor.edgeLabelDraft"
          class="edge-label-editor"
          data-testid="edge-label-editor"
          :style="{
            left: `${editor.edgeLabelEditorPosition.x}px`,
            top: `${editor.edgeLabelEditorPosition.y}px`,
          }"
          @blur="editor.submitEdgeLabelEditing"
          @input="editor.updateEditingEdgeLabel(valueFromEvent($event))"
          @keydown="handleEdgeLabelEditorKeydown"
        >

        <div
          v-if="editor.bottomToolbarVisible"
          class="bottom-toolbar"
          data-testid="bottom-toolbar"
          :style="{
            '--selection-toolbar-tooltip-bg': 'var(--canvas-floating-tooltip-bg)',
            '--selection-toolbar-tooltip-border': 'var(--canvas-floating-border)',
            '--selection-toolbar-tooltip-text': 'var(--canvas-floating-tooltip-text)',
          }"
          @click.stop
          @pointerdown.stop
        >
          <button
            class="bottom-toolbar__button"
            data-testid="bottom-toolbar-text"
            :aria-label="t('bottomToolbarText')"
            :data-tooltip="t('bottomToolbarText')"
            :title="t('bottomToolbarText')"
            type="button"
            @click.stop="editor.addNode('text')"
          >
            <CanvasIcon
              class="bottom-toolbar__icon"
              name="text"
            />
          </button>
          <button
            class="bottom-toolbar__button"
            data-testid="bottom-toolbar-file"
            :aria-label="t('bottomToolbarFile')"
            :data-tooltip="t('bottomToolbarFile')"
            :title="t('bottomToolbarFile')"
            type="button"
            @click.stop="editor.openFilePickerDialog"
          >
            <CanvasIcon
              class="bottom-toolbar__icon"
              name="file"
            />
          </button>
          <button
            class="bottom-toolbar__button"
            data-testid="bottom-toolbar-connect"
            :aria-label="t('bottomToolbarConnect')"
            :data-tooltip="t('bottomToolbarConnect')"
            :title="t('bottomToolbarConnect')"
            type="button"
            @click.stop="editor.openCreateEdgeDialog"
          >
            <CanvasIcon
              class="bottom-toolbar__icon"
              name="connect"
            />
          </button>
          <button
            class="bottom-toolbar__button"
            data-testid="bottom-toolbar-group"
            :aria-label="t('bottomToolbarGroup')"
            :data-tooltip="t('bottomToolbarGroup')"
            :title="t('bottomToolbarGroup')"
            type="button"
            @click.stop="editor.addNode('group')"
          >
            <CanvasIcon
              class="bottom-toolbar__icon"
              name="group"
            />
          </button>
        </div>

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
            <CanvasIcon
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
              <CanvasIcon
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
                class="selection-toolbar__swatch selection-toolbar__swatch--clear"
                :class="{ 'selection-toolbar__swatch--active': activeSelectionColor === CLEAR_SELECTION_COLOR }"
                data-testid="selection-color-clear"
                :style="getSelectionColorStyle(CLEAR_SELECTION_COLOR)"
                :title="t('selectionToolbarClearColor')"
                type="button"
                @click.stop="editor.applySelectionColor(CLEAR_SELECTION_COLOR)"
              />
              <button
                v-for="color in editor.selectionColors"
                :key="color"
                class="selection-toolbar__swatch"
                :class="{ 'selection-toolbar__swatch--active': activeSelectionColor === color }"
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
            <CanvasIcon
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
            <CanvasIcon
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
              <CanvasIcon
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
                <CanvasIcon
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
                  <CanvasIcon
                    class="selection-toolbar__menu-icon"
                    :name="SELECTION_LAYOUT_ICON_NAMES[layoutAction.action]"
                  />
                  {{ layoutAction.label }}
                </button>
              </div>
            </div>
          </template>
        </div>

        <div
          v-if="editor.filePickerDialog.visible"
          class="canvas-dialog-backdrop"
          data-testid="file-picker-dialog"
          @click.self="editor.closeFilePickerDialog"
        >
          <div
            class="canvas-dialog"
            @wheel.passive.stop
          >
            <div class="canvas-dialog__header">
              <h2>{{ t("filePickerDialogTitle") }}</h2>
            </div>
            <label class="canvas-dialog__field">
              <span>{{ t("filePickerSearchLabel") }}</span>
              <input
                :value="editor.filePickerDialog.query"
                class="canvas-dialog__control"
                @input="editor.updateFilePickerQuery(valueFromEvent($event))"
              >
            </label>
            <div class="canvas-node-picker__options">
              <button
                v-for="result in getFilePickerResults()"
                :key="`file-picker-${result.kind}-${result.path}`"
                class="canvas-node-picker__option"
                :data-testid="`file-picker-option-${result.kind}`"
                type="button"
                @click="editor.selectFilePickerResult(result)"
              >
                <span class="canvas-node-picker__option-kind">{{ getFilePickerKindLabel(result.kind) }}</span>
                <strong>{{ result.title }}</strong>
                <span>{{ result.subtitle }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <aside
        class="inspector"
        :class="{ 'inspector--collapsed': !editor.inspectorExpanded }"
        @pointerdown.capture="editor.deactivateCanvasSurface"
      >
        <div
          v-if="editor.inspectorExpanded"
          class="inspector__content"
        >
          <section class="inspector__section">
            <button
              class="inspector__section-toggle"
              data-testid="inspector-section-document-toggle"
              :title="getInspectorSectionToggleTitle('document')"
              type="button"
              @click="editor.toggleInspectorSection('document')"
            >
              <h2>{{ t("inspectorDocument") }}</h2>
              <span>{{ getInspectorSectionChevron('document') }}</span>
            </button>
            <div
              v-if="editor.inspectorSectionState.document"
              data-testid="inspector-section-document-body"
            >
              <p>{{ editor.state.filePath || t("inspectorUnsavedWorkspacePath") }}</p>
              <p>{{ editor.state.isDirty ? t("inspectorPendingSave") : t("inspectorInSync") }}</p>
              <div
                v-if="editor.workspaceDocuments.length"
                class="recent-list"
              >
                <button
                  v-for="documentEntry in editor.workspaceDocuments"
                  :key="documentEntry.path"
                  class="recent-list__item"
                  @click="editor.openWorkspacePath(documentEntry.path)"
                >
                  <strong>{{ documentEntry.title }}</strong>
                  <span>{{ documentEntry.path }}</span>
                </button>
              </div>
              <p v-else>
                {{ t("inspectorNoWorkspaceCanvasFiles") }}
              </p>
              <div
                v-if="editor.state.conflict"
                class="conflict-panel"
              >
                <strong>{{ t("inspectorExternalChangeDetected") }}</strong>
                <span>{{ t("inspectorExternalChangeDescription") }}</span>
                <div class="conflict-panel__actions">
                  <button
                    class="toolbar__button"
                    @click="editor.loadConflictVersion"
                  >
                    {{ t("inspectorLoadDiskVersion") }}
                  </button>
                  <button
                    class="toolbar__button toolbar__button--primary"
                    @click="editor.overwriteConflictVersion"
                  >
                    {{ t("inspectorOverwriteDiskVersion") }}
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
                  <strong>{{ getIssueLevelLabel(issue.level) }}</strong>
                  <span>{{ issue.message }}</span>
                </div>
              </div>
            </div>
          </section>

          <section class="inspector__section">
            <button
              class="inspector__section-toggle"
              :title="getInspectorSectionToggleTitle('recent')"
              type="button"
              @click="editor.toggleInspectorSection('recent')"
            >
              <h2>{{ t("inspectorRecent") }}</h2>
              <span>{{ getInspectorSectionChevron('recent') }}</span>
            </button>
            <div v-if="editor.inspectorSectionState.recent">
              <div
                v-if="editor.recentFiles.length"
                class="recent-list"
              >
                <button
                  v-for="recent in editor.recentFiles"
                  :key="recent.path"
                  class="recent-list__item"
                  @click="editor.openRecentFile(recent)"
                >
                  <strong>{{ recent.title }}</strong>
                  <span>{{ recent.path }}</span>
                </button>
              </div>
              <p v-else>
                {{ t("inspectorNoRecentWorkspaceFiles") }}
              </p>
            </div>
          </section>

          <section
            v-if="editor.selectedNodeCount > 1"
            class="inspector__section"
          >
            <button
              class="inspector__section-toggle"
              :title="getInspectorSectionToggleTitle('selection')"
              type="button"
              @click="editor.toggleInspectorSection('selection')"
            >
              <h2>{{ t("inspectorSelection") }}</h2>
              <span>{{ getInspectorSectionChevron('selection') }}</span>
            </button>
            <div v-if="editor.inspectorSectionState.selection">
              <p>{{ t("selectionCount", { count: editor.selectedNodeCount }) }}</p>
              <button
                class="toolbar__button"
                @click="editor.deleteSelection"
              >
                {{ t("inspectorDeleteSelectedNodes") }}
              </button>
            </div>
          </section>

          <section
            v-if="editor.selectedNode && editor.selectedNodeCount === 1"
            class="inspector__section"
          >
            <button
              class="inspector__section-toggle"
              :title="getInspectorSectionToggleTitle('node')"
              type="button"
              @click="editor.toggleInspectorSection('node')"
            >
              <h2>{{ t("inspectorNode") }}</h2>
              <span>{{ getInspectorSectionChevron('node') }}</span>
            </button>
            <div v-if="editor.inspectorSectionState.node">
              <label>
                {{ t("fieldX") }}
                <input
                  :value="editor.selectedNode.x"
                  type="number"
                  @input="editor.updateNumericNodeField('x', valueFromEvent($event))"
                />
              </label>
              <label>
                {{ t("fieldY") }}
                <input
                  :value="editor.selectedNode.y"
                  type="number"
                  @input="editor.updateNumericNodeField('y', valueFromEvent($event))"
                />
              </label>
              <label>
                {{ t("fieldWidth") }}
                <input
                  :value="editor.selectedNode.width"
                  type="number"
                  @input="editor.updateNumericNodeField('width', valueFromEvent($event))"
                />
              </label>
              <label>
                {{ t("fieldHeight") }}
                <input
                  :value="editor.selectedNode.height"
                  type="number"
                  @input="editor.updateNumericNodeField('height', valueFromEvent($event))"
                />
              </label>
              <label v-if="'color' in editor.selectedNode">
                {{ t("fieldColor") }}
                <input
                  :value="editor.selectedNode.color || ''"
                  @input="editor.updateNodeField('color', valueFromEvent($event))"
                />
              </label>
              <label v-if="editor.selectedNode.type === 'text'">
                {{ t("fieldText") }}
                <textarea
                  :value="editor.selectedNode.text"
                  @input="editor.updateNodeField('text', valueFromEvent($event))"
                />
              </label>
              <label v-if="editor.selectedNode.type === 'file'">
                {{ t("fieldFilePath") }}
                <input
                  :value="editor.selectedNode.file"
                  @input="editor.updateNodeField('file', valueFromEvent($event))"
                />
              </label>
              <label v-if="editor.selectedNode.type === 'link'">
                {{ t("fieldUrl") }}
                <input
                  :value="editor.selectedNode.url"
                  @input="editor.updateNodeField('url', valueFromEvent($event))"
                />
              </label>
              <label v-if="editor.selectedNode.type === 'group'">
                {{ t("fieldLabel") }}
                <input
                  :value="editor.selectedNode.label || ''"
                  @input="editor.updateNodeField('label', valueFromEvent($event))"
                />
              </label>
            </div>
          </section>

          <section
            v-if="editor.selectedNode && editor.selectedNodeCount === 1"
            class="inspector__section"
          >
            <button
              class="inspector__section-toggle"
              :title="getInspectorSectionToggleTitle('createEdge')"
              type="button"
              @click="editor.toggleInspectorSection('createEdge')"
            >
              <h2>{{ t("inspectorCreateEdge") }}</h2>
              <span>{{ getInspectorSectionChevron('createEdge') }}</span>
            </button>
            <div v-if="editor.inspectorSectionState.createEdge">
              <label>
                {{ t("fieldSourceNode") }}
                <input
                  v-model="editor.newEdgeSourceQuery"
                  class="inspector__control"
                >
                <select
                  :value="editor.newEdgeSourceId"
                  class="inspector__control"
                  @change="editor.setNewEdgeSourceId(valueFromEvent($event))"
                >
                  <option value="">{{ t("fieldSelectSourceNode") }}</option>
                  <option
                    v-for="node in editor.edgeSources"
                    :key="node.id"
                    :value="node.id"
                  >
                    {{ editor.getNodeTitle(node) }}
                  </option>
                </select>
              </label>
              <label>
                {{ t("fieldTarget") }}
                <input
                  v-model="editor.newEdgeTargetQuery"
                  class="inspector__control"
                >
                <select
                  :value="editor.newEdgeTargetId"
                  class="inspector__control"
                  @change="editor.setNewEdgeTargetId(valueFromEvent($event))"
                >
                  <option value="">{{ t("fieldSelectTargetNode") }}</option>
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
                {{ t("fieldEdgeLabel") }}
                <input v-model="editor.newEdgeLabel" />
              </label>
              <label>
                {{ t("fieldFromSide") }}
                <select v-model="editor.newEdgeFromSide">
                  <option
                    v-for="side in editor.sides"
                    :key="side"
                    :value="side"
                  >{{ getSideLabel(side) }}</option>
                </select>
              </label>
              <label>
                {{ t("fieldToSide") }}
                <select v-model="editor.newEdgeToSide">
                  <option
                    v-for="side in editor.sides"
                    :key="side"
                    :value="side"
                  >{{ getSideLabel(side) }}</option>
                </select>
              </label>
              <button
                class="toolbar__button toolbar__button--primary"
                @click="editor.createEdgeFromSelection"
              >
                {{ t("inspectorCreateEdgeAction") }}
              </button>
            </div>
          </section>

          <section
            v-if="editor.selectedEdge"
            class="inspector__section"
          >
            <button
              class="inspector__section-toggle"
              :title="getInspectorSectionToggleTitle('edge')"
              type="button"
              @click="editor.toggleInspectorSection('edge')"
            >
              <h2>{{ t("inspectorEdge") }}</h2>
              <span>{{ getInspectorSectionChevron('edge') }}</span>
            </button>
            <div v-if="editor.inspectorSectionState.edge">
              <label>
                {{ t("fieldEdgeLabel") }}
                <input
                  :value="editor.selectedEdge.label || ''"
                  @input="editor.updateEdgeField('label', valueFromEvent($event))"
                />
              </label>
              <label>
                {{ t("fieldFromSide") }}
                <select
                  :value="editor.selectedEdge.fromSide"
                  @change="editor.updateEdgeSide('fromSide', valueFromEvent($event))"
                >
                  <option
                    v-for="side in editor.sides"
                    :key="side"
                    :value="side"
                  >{{ getSideLabel(side) }}</option>
                </select>
              </label>
              <label>
                {{ t("fieldToSide") }}
                <select
                  :value="editor.selectedEdge.toSide"
                  @change="editor.updateEdgeSide('toSide', valueFromEvent($event))"
                >
                  <option
                    v-for="side in editor.sides"
                    :key="side"
                    :value="side"
                  >{{ getSideLabel(side) }}</option>
                </select>
              </label>
              <button
                class="toolbar__button"
                @click="editor.deleteSelection"
              >
                {{ t("inspectorDeleteEdge") }}
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>

    <CanvasCreateEdgeDialog
      v-if="editor.createEdgeDialog.visible"
      :editor="editor"
      :get-side-label="getSideLabel"
      :t="t"
    />

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

import {
  nextTick,
  ref,
  watch,
} from "vue"
import type { CanvasTabBootstrap } from "@/main"
import { useCanvasEditor } from "@/canvas/use-canvas-editor"
import {
  CanvasIcon,
} from "@/components/canvas/canvas-icon"
import {
  EDGE_DIRECTION_ICON_NAMES,
  SELECTION_LAYOUT_ICON_NAMES,
  createSelectionToolbarTooltips,
} from "@/components/canvas/canvas-selection-toolbar-icon"
import CanvasCreateEdgeDialog from "@/components/canvas/CanvasCreateEdgeDialog.vue"
import CanvasFileCard from "@/components/canvas/CanvasFileCard.vue"
import {
  CLEAR_SELECTION_COLOR,
  getCanvasNodeContentStyle as resolveCanvasNodeContentStyle,
  getCanvasNodeStyle as buildCanvasNodeStyle,
  getSelectionColorStyle as resolveSelectionColorStyle,
  selectionColorStyles,
} from "@/components/canvas/canvas-workspace-display"
import { useCanvasWorkspaceBehavior } from "@/components/canvas/use-canvas-workspace-behavior"
import { createCanvasI18n } from "@/i18n/canvas"
import type {
  CanvasEdge,
  CanvasNode,
  CanvasSide,
} from "@/canvas/types"
import {
  applyFilePreviewImageOverrides,
  getFilePreviewImageCandidates,
  getNextFilePreviewImageSource,
} from "@/canvas/file-preview-fallbacks"

const props = defineProps<{
  bootstrap: CanvasTabBootstrap
  plugin: Plugin
  setTitle: (title: string) => void
}>()

const t = createCanvasI18n((props.plugin as Plugin & { i18n?: Record<string, string> }).i18n)
const editor = useCanvasEditor(props.plugin, props.bootstrap, props.setTitle)
const fileInputRef = editor.fileInputRef
const stageRef = editor.stageRef
const SELECTION_TOOLBAR_TOOLTIPS = createSelectionToolbarTooltips(t)
const {
  activeSelectionColor,
  canvasShellRef,
  commitTextNodeEditing,
  editingMarkdown,
  editingNodeId,
  handleImport,
  handleNodeDoubleClick,
  handleToolbarEdit,
  selectionToolbarThemeMode,
  setEdgeToolbarRef,
  setEditingTextareaRef,
  setSelectionToolbarRef,
} = useCanvasWorkspaceBehavior(editor)
const edgeLabelInputRef = ref<HTMLInputElement>()
const fileCardImageOverrides = ref<Record<string, string>>({})
const fileCardPreviewImageOverrides = ref<Record<string, Record<string, string>>>({})
const hoveredEdgeId = ref("")
const NODE_RESIZE_SEGMENTS: Array<{ id: string, side: CanvasSide }> = [
  { id: "top-left", side: "top" },
  { id: "top-right", side: "top" },
  { id: "right-top", side: "right" },
  { id: "right-bottom", side: "right" },
  { id: "bottom-left", side: "bottom" },
  { id: "bottom-right", side: "bottom" },
  { id: "left-top", side: "left" },
  { id: "left-bottom", side: "left" },
]

function valueFromEvent(event: Event): string {
  return (event.target as HTMLInputElement).value
}

function getIssueLevelLabel(level: "error" | "warning"): string {
  return level === "error" ? t("issueError") : t("issueWarning")
}

function handleStagePointerDown(event: PointerEvent) {
  editor.activateCanvasSurface()
  editor.startPan(event)
}

function handleStagePaste(event: ClipboardEvent) {
  const file = [...(event.clipboardData?.files || [])].find((candidate) => candidate.type.startsWith("image/"))
  if (!file) {
    return
  }

  event.preventDefault()
  void editor.handleClipboardImagePaste(file)
}

function handleNodePointerDown(node: CanvasNode, event: PointerEvent) {
  editor.activateCanvasSurface()
  editor.handleNodePointerDown(node, event)
}

function handleNodeClick(node: CanvasNode, event: MouseEvent) {
  editor.activateCanvasSurface()
  editor.selectNode(node.id, event)
}

function handleNodeWheel(_node: CanvasNode, _event: WheelEvent) {
  // Let wheel events bubble to stage for zoom
}

function handleEdgeClick(edgeId: string) {
  editor.activateCanvasSurface()
  editor.selectEdge(edgeId)
}

function setHoveredEdge(edgeId: string) {
  hoveredEdgeId.value = edgeId
}

function clearHoveredEdge(edgeId: string) {
  if (hoveredEdgeId.value === edgeId) {
    hoveredEdgeId.value = ""
  }
}

function getInspectorSectionChevron(section: keyof typeof editor.inspectorSectionState): string {
  return editor.inspectorSectionState[section] ? "−" : "+"
}

function getInspectorSectionToggleTitle(section: keyof typeof editor.inspectorSectionState): string {
  return editor.inspectorSectionState[section]
    ? t("inspectorCollapseSection")
    : t("inspectorExpandSection")
}

function getSideLabel(side: string): string {
  switch (side) {
    case "top":
      return t("sideTop")
    case "right":
      return t("sideRight")
    case "bottom":
      return t("sideBottom")
    case "left":
      return t("sideLeft")
    default:
      return side
  }
}

function getSelectionColorStyle(color: string) {
  return resolveSelectionColorStyle(color)
}

function resolveEdgeStartMarker(enabled?: boolean) {
  return enabled ? "url(#canvas-edge-arrow-start)" : undefined
}

function resolveEdgeEndMarker(enabled?: boolean) {
  return enabled ? "url(#canvas-edge-arrow-end)" : undefined
}

function getEdgeStrokeStyle(edge: CanvasEdge) {
  const colorStyle = edge.color ? selectionColorStyles[edge.color] : undefined
  return colorStyle ? { stroke: colorStyle.border } : undefined
}

function getEdgeLabelStyle(edge: CanvasEdge) {
  const colorStyle = edge.color ? selectionColorStyles[edge.color] : undefined
  return colorStyle ? { fill: colorStyle.border } : undefined
}

function getCanvasNodeStyle(node: CanvasNode) {
  return buildCanvasNodeStyle(node, editor.getNodeStyle(node), {
    selected: editor.state.selectedNodeIds.includes(node.id),
  })
}

function getCanvasNodeContentStyle(node: CanvasNode) {
  return resolveCanvasNodeContentStyle(node)
}

function getFileCardImageSource(node: CanvasNode): string | undefined {
  if (node.type !== "file") {
    return undefined
  }

  const preview = editor.getFileNodePreview(node)
  if (!preview.imageSrc) {
    return undefined
  }

  const candidates = getFilePreviewImageCandidates(preview.imageSrc)
  const override = fileCardImageOverrides.value[node.id]
  return override && candidates.includes(override) ? override : candidates[0]
}

function shouldShowFileCardHeadline(node: CanvasNode) {
  if (node.type !== "file") {
    return false
  }

  return editor.getFileNodePreview(node).kind !== "block"
}

function shouldShowFileCardDetail(node: CanvasNode) {
  if (node.type !== "file") {
    return false
  }

  const kind = editor.getFileNodePreview(node).kind
  return kind !== "block" && kind !== "document"
}

function getFileCardTooltip(node: CanvasNode): string | undefined {
  if (node.type !== "file") {
    return undefined
  }

  return editor.getFileNodePreview(node).detail || undefined
}

function getFileCardDocumentPreviewHtml(node: CanvasNode): string {
  if (node.type !== "file") {
    return ""
  }

  const preview = editor.getFileNodePreview(node)
  const previewHtml = preview.previewHtml || ""
  const overrides = fileCardPreviewImageOverrides.value[node.id]
  return applyFilePreviewImageOverrides(previewHtml, overrides)
}

function handleFileCardImageError(node: CanvasNode) {
  if (node.type !== "file") {
    return
  }

  const preview = editor.getFileNodePreview(node)
  if (!preview.imageSrc) {
    return
  }

  const currentSource = getFileCardImageSource(node)
  const nextSource = getNextFilePreviewImageSource(preview.imageSrc, currentSource)

  if (!nextSource) {
    return
  }

  fileCardImageOverrides.value = {
    ...fileCardImageOverrides.value,
    [node.id]: nextSource,
  }
}

function handleFileCardPreviewImageError(node: CanvasNode, event: Event) {
  if (node.type !== "file") {
    return
  }

  const target = event.target
  if (!(target instanceof HTMLImageElement)) {
    return
  }

  const currentSource = target.getAttribute("src")?.trim()
  if (!currentSource) {
    return
  }

  const storedCandidates = target.dataset.canvasImageCandidates
  const candidates = storedCandidates
    ? JSON.parse(storedCandidates) as string[]
    : getFilePreviewImageCandidates(currentSource)
  const currentIndex = Number.parseInt(target.dataset.canvasImageCandidateIndex || "", 10)
  const resolvedIndex = Number.isNaN(currentIndex)
    ? candidates.indexOf(currentSource)
    : currentIndex
  const nextSource = candidates[resolvedIndex + 1]

  if (!nextSource || nextSource === currentSource) {
    return
  }

  target.dataset.canvasImageCandidates = JSON.stringify(candidates)
  target.dataset.canvasImageCandidateIndex = String(resolvedIndex + 1)
  target.setAttribute("src", nextSource)

  fileCardPreviewImageOverrides.value = {
    ...fileCardPreviewImageOverrides.value,
    [node.id]: {
      ...(fileCardPreviewImageOverrides.value[node.id] || {}),
      [candidates[0] || currentSource]: nextSource,
    },
  }
}

function getFilePickerResults() {
  return [
    ...editor.filePickerDialog.groups.blocks,
    ...editor.filePickerDialog.groups.documents,
    ...editor.filePickerDialog.groups.canvases,
    ...editor.filePickerDialog.groups.images,
  ]
}

function getFilePickerKindLabel(kind: "block" | "canvas" | "document" | "image"): string {
  switch (kind) {
    case "block":
      return "Block"
    case "canvas":
      return "Canvas"
    case "document":
      return "Document"
    case "image":
      return "Image"
    default:
      return kind
  }
}

function getCanvasThumbnailViewBox(thumbnail?: {
  edges: Array<{ fromX: number, fromY: number, toX: number, toY: number }>
  nodes: Array<{ height: number, width: number, x: number, y: number }>
}) {
  if (!thumbnail || thumbnail.nodes.length === 0) {
    return "0 0 100 64"
  }

  const nodeMinX = Math.min(...thumbnail.nodes.map((node) => node.x))
  const nodeMinY = Math.min(...thumbnail.nodes.map((node) => node.y))
  const nodeMaxX = Math.max(...thumbnail.nodes.map((node) => node.x + node.width))
  const nodeMaxY = Math.max(...thumbnail.nodes.map((node) => node.y + node.height))
  const edgePoints = thumbnail.edges.flatMap((edge) => [
    { x: edge.fromX, y: edge.fromY },
    { x: edge.toX, y: edge.toY },
  ])
  const edgeMinX = edgePoints.length > 0 ? Math.min(...edgePoints.map((point) => point.x)) : nodeMinX
  const edgeMinY = edgePoints.length > 0 ? Math.min(...edgePoints.map((point) => point.y)) : nodeMinY
  const edgeMaxX = edgePoints.length > 0 ? Math.max(...edgePoints.map((point) => point.x)) : nodeMaxX
  const edgeMaxY = edgePoints.length > 0 ? Math.max(...edgePoints.map((point) => point.y)) : nodeMaxY
  const minX = Math.min(nodeMinX, edgeMinX)
  const minY = Math.min(nodeMinY, edgeMinY)
  const maxX = Math.max(nodeMaxX, edgeMaxX)
  const maxY = Math.max(nodeMaxY, edgeMaxY)
  const padding = 24

  return `${minX - padding} ${minY - padding} ${Math.max(maxX - minX + padding * 2, 1)} ${Math.max(maxY - minY + padding * 2, 1)}`
}

function handleEdgeLabelEditorKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault()
    editor.submitEdgeLabelEditing()
    return
  }

  if (event.key === "Escape") {
    event.preventDefault()
    editor.cancelEdgeLabelEditing()
  }
}

watch(
  () => editor.editingEdgeLabelId,
  async () => {
    if (!editor.editingEdgeLabelId) {
      return
    }

    await nextTick()
    edgeLabelInputRef.value?.focus()
    edgeLabelInputRef.value?.select()
  },
)
</script>

<style scoped lang="scss">
.canvas-shell {
  --canvas-bg: var(--b3-theme-background);
  --canvas-surface: var(--b3-theme-surface);
  --canvas-surface-elevated: var(--b3-theme-surface);
  --canvas-surface-overlay: rgba(255, 255, 255, 0.82);
  --canvas-toolbar-bg: rgba(255, 255, 255, 0.92);
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
  position: relative;
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
  --canvas-toolbar-bg: rgba(15, 23, 42, 0.92);
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

.canvas-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--canvas-border);
  background: var(--canvas-toolbar-bg);
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
  position: relative;
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

.toolbar__button--icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
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

.toolbar__icon {
  display: inline-flex;
  color: inherit;
}

.toolbar__icon :deep(svg) {
  display: block;
}

.toolbar__stat {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  padding: 0 8px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--canvas-text-muted);
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

.edge-toolbar {
  z-index: 5;
}

.edge-toolbar__direction-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px;
}

.bottom-toolbar {
  --selection-toolbar-tooltip-bg: var(--canvas-floating-tooltip-bg);
  --selection-toolbar-tooltip-border: var(--canvas-floating-border);
  --selection-toolbar-tooltip-text: var(--canvas-floating-tooltip-text);
  position: absolute;
  left: 50%;
  bottom: 20px;
  z-index: 4;
  display: inline-flex;
  gap: 10px;
  transform: translateX(-50%);
  padding: 10px;
  border: 1px solid var(--canvas-floating-border);
  border-radius: 999px;
  background: var(--canvas-floating-bg);
  box-shadow: var(--canvas-shadow-strong);
  backdrop-filter: blur(14px);
}

.bottom-toolbar__button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 999px;
  background: var(--canvas-floating-button-bg);
  color: var(--canvas-floating-text);
  cursor: pointer;
  transition: background-color 120ms ease, transform 120ms ease;
}

.bottom-toolbar__button:hover {
  background: var(--canvas-floating-button-bg-hover);
  transform: translateY(-1px);
}

.bottom-toolbar__icon {
  display: inline-flex;
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

.selection-toolbar__swatch--active {
  box-shadow:
    0 0 0 2px var(--selection-toolbar-bg),
    0 0 0 4px var(--selection-toolbar-text);
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

.selection-toolbar__menu-button--active {
  background: var(--selection-toolbar-button-bg-hover);
}

.toolbar__button[data-tooltip]::after,
.bottom-toolbar__button[data-tooltip]::after,
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

.toolbar__button[data-tooltip]:hover::after,
.toolbar__button[data-tooltip]:focus-visible::after,
.bottom-toolbar__button[data-tooltip]:hover::after,
.bottom-toolbar__button[data-tooltip]:focus-visible::after,
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

.edge-endpoint-handle {
  position: absolute;
  z-index: 4;
  width: 16px;
  height: 16px;
  border: 2px solid var(--canvas-accent);
  border-radius: 999px;
  background: var(--canvas-surface);
  box-shadow: 0 0 0 4px rgba(53, 103, 214, 0.14);
  transform: translate(-50%, -50%);
  cursor: crosshair;
}

.edge-label-editor {
  position: absolute;
  z-index: 5;
  min-width: 120px;
  max-width: 220px;
  border: 1px solid var(--canvas-floating-border);
  border-radius: 10px;
  background: var(--canvas-floating-bg);
  color: var(--canvas-text);
  padding: 6px 10px;
  box-shadow: var(--canvas-shadow);
  transform: translate(-50%, -50%);
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

.stage__edges--interactive {
  z-index: 2;
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

.stage__edge--overlay {
  opacity: 0;
  stroke-width: 4;
  filter: drop-shadow(0 0 6px rgba(53, 103, 214, 0.2));
  pointer-events: none;
  transition:
    opacity 0.16s ease,
    stroke-width 0.16s ease,
    filter 0.16s ease;
}

.stage__edge--visible {
  opacity: 1;
}

.stage__edge--hovered,
.stage__edge--selected.stage__edge--overlay {
  stroke-width: 4;
  filter: drop-shadow(0 0 10px rgba(53, 103, 214, 0.28));
}

.stage__edge--hit-area {
  stroke: transparent;
  stroke-width: 18;
  pointer-events: stroke;
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
  --canvas-node-midpoint-shield: 60px;
  position: absolute;
  z-index: 1;
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
  overflow: visible;
}

.canvas-node--selected {
  z-index: 3;
  box-shadow: 0 0 0 2px var(--canvas-selection-border), var(--canvas-shadow-strong);
}

.canvas-node:hover {
  z-index: 3;
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

.canvas-node__group-label {
  position: absolute;
  left: 14px;
  bottom: 100%;
  margin-bottom: 10px;
  max-width: calc(100% - 28px);
  border-radius: 12px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  white-space: pre-wrap;
  box-shadow: var(--canvas-shadow);
}

.canvas-node__group-label-editor {
  min-height: 40px;
  border: 0;
  outline: 0;
  resize: none;
  background: var(--canvas-surface);
  color: var(--canvas-text);
  font: inherit;
  box-sizing: border-box;
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

.markdown-preview :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 12px;
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
  display: block;
  width: 100%;
  max-height: 132px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid var(--canvas-border);
  background: var(--canvas-surface);
}

.file-card__canvas-preview {
  height: 132px;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--canvas-border);
  background:
    linear-gradient(180deg, rgba(53, 103, 214, 0.08), rgba(15, 23, 42, 0.02)),
    var(--canvas-surface);
}

.file-card__thumbnail {
  display: block;
  width: 100%;
  height: 100%;
}

.file-card__thumbnail-edge {
  fill: none;
  stroke: rgba(53, 103, 214, 0.58);
  stroke-linecap: round;
  stroke-width: 10px;
}

.file-card__thumbnail-node {
  fill: rgba(255, 255, 255, 0.88);
  stroke: rgba(15, 23, 42, 0.12);
  stroke-width: 4px;
}

.file-card__document-preview {
  max-height: min(46vh, 320px);
  overflow: hidden;
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
  pointer-events: auto;
}

.canvas-node__anchor {
  z-index: 3;
  width: 36px;
  height: 36px;
  border-radius: 999px;
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

.canvas-node__anchor::before {
  content: "";
  position: absolute;
  inset: 7px;
  border-radius: 999px;
  background: var(--canvas-anchor-bg);
  box-shadow: var(--canvas-anchor-shadow);
}

.canvas-node__anchor::after {
  content: "";
  position: absolute;
  inset: 13px;
  border-radius: 999px;
  background: var(--canvas-accent);
}

.canvas-node__anchor--active::before {
  background: var(--canvas-accent-soft);
  box-shadow: 0 0 0 2px var(--canvas-selection-fill);
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
  z-index: 2;
  opacity: 0;
  transition: opacity 0.16s ease;
}

.canvas-node:hover .canvas-node__resize-handle,
.canvas-node--selected .canvas-node__resize-handle,
.canvas-node:hover .canvas-node__resize-corner,
.canvas-node--selected .canvas-node__resize-corner {
  opacity: 1;
}

.canvas-node__resize-handle--top-left,
.canvas-node__resize-handle--top-right,
.canvas-node__resize-handle--bottom-left,
.canvas-node__resize-handle--bottom-right {
  width: max(0px, calc(50% - var(--canvas-node-midpoint-shield) / 2));
  height: 12px;
}

.canvas-node__resize-handle--left-top,
.canvas-node__resize-handle--left-bottom,
.canvas-node__resize-handle--right-top,
.canvas-node__resize-handle--right-bottom {
  width: 12px;
  height: max(0px, calc(50% - var(--canvas-node-midpoint-shield) / 2));
}

.canvas-node__resize-handle--top-left,
.canvas-node__resize-handle--top-right {
  top: -6px;
  cursor: ns-resize;
}

.canvas-node__resize-handle--top-left,
.canvas-node__resize-handle--bottom-left {
  left: 14px;
}

.canvas-node__resize-handle--top-right,
.canvas-node__resize-handle--bottom-right {
  right: 14px;
}

.canvas-node__resize-handle--right-top,
.canvas-node__resize-handle--right-bottom {
  right: -6px;
  cursor: ew-resize;
}

.canvas-node__resize-handle--left-top,
.canvas-node__resize-handle--left-bottom {
  left: -6px;
  cursor: ew-resize;
}

.canvas-node__resize-handle--bottom-left,
.canvas-node__resize-handle--bottom-right {
  bottom: -6px;
  cursor: ns-resize;
}

.canvas-node__resize-handle--left-top,
.canvas-node__resize-handle--right-top {
  top: 14px;
}

.canvas-node__resize-handle--left-bottom,
.canvas-node__resize-handle--right-bottom {
  bottom: 14px;
}

.canvas-node__resize-corner {
  position: absolute;
  z-index: 2;
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

.inspector__section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0;
  color: inherit;
  text-align: left;
  cursor: pointer;
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

.inspector__control {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
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

.canvas-dialog-backdrop {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.24);
  backdrop-filter: blur(4px);
}

.canvas-dialog {
  display: grid;
  gap: 12px;
  width: min(520px, calc(100% - 32px));
  padding: 18px;
  border: 1px solid var(--canvas-border);
  border-radius: 20px;
  background: var(--canvas-surface);
  box-shadow: var(--canvas-shadow-strong);
  box-sizing: border-box;
}

.canvas-dialog__header h2 {
  margin: 0;
  font-size: 16px;
  color: var(--canvas-text);
}

.canvas-dialog__field {
  display: grid;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: var(--canvas-text-muted);
}

.canvas-dialog__control {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid var(--canvas-border);
  border-radius: 12px;
  background: var(--canvas-surface);
  padding: 9px 10px;
  font: inherit;
  color: var(--canvas-text);
}

.canvas-node-picker {
  position: relative;
}

.canvas-node-picker__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  cursor: pointer;
}

.canvas-node-picker__trigger-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.canvas-node-picker__trigger-chevron {
  flex: 0 0 auto;
  color: var(--canvas-text-muted);
}

.canvas-node-picker__panel {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 8px);
  z-index: 2;
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--canvas-border);
  border-radius: 14px;
  background: var(--canvas-surface);
  box-shadow: var(--canvas-shadow);
}

.canvas-node-picker__search {
  margin: 0;
}

.canvas-node-picker__options {
  display: grid;
  gap: 6px;
  max-height: 220px;
  overflow: auto;
}

.canvas-node-picker__option {
  display: grid;
  gap: 4px;
  width: 100%;
  border: 0;
  border-radius: 10px;
  background: var(--canvas-floating-button-bg);
  padding: 8px 10px;
  color: var(--canvas-text);
  text-align: left;
  cursor: pointer;
}

.canvas-node-picker__option-kind {
  justify-self: start;
  border-radius: 999px;
  background: var(--canvas-accent-soft);
  color: var(--canvas-text);
  padding: 2px 8px;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.canvas-node-picker__option:hover {
  background: var(--canvas-floating-button-bg-hover);
}

.canvas-node-picker__empty {
  margin: 0;
  padding: 8px 10px;
  color: var(--canvas-text-muted);
  font-size: 12px;
}

.canvas-dialog__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.canvas-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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
