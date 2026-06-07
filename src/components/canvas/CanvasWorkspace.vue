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
      <div class="toolbar__group" :aria-label="t('toolbarGroupFile')">
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
          class="toolbar__button toolbar__button--icon toolbar__button--save"
          :class="{
            'toolbar__button--has-badge': editor.state.isDirty || editor.state.conflict,
            'toolbar__button--saving': editor.isSaving,
          }"
          data-testid="top-toolbar-save"
          :aria-label="editor.isSaving ? t('toolbarSaving') : t('toolbarSave')"
          :data-tooltip="editor.isSaving ? t('toolbarSaving') : t('toolbarSave')"
          :title="editor.isSaving ? t('toolbarSaving') : t('toolbarSave')"
          :disabled="editor.isSaving"
          type="button"
          @click="editor.save"
        >
          <CanvasIcon
            class="toolbar__icon"
            name="save"
          />
          <span
            v-if="editor.state.conflict"
            class="toolbar__button-badge toolbar__button-badge--danger"
            data-testid="top-toolbar-save-badge-conflict"
            aria-hidden="true"
          />
          <span
            v-else-if="editor.isSaving"
            class="toolbar__button-badge toolbar__button-badge--saving"
            data-testid="top-toolbar-save-badge-saving"
            aria-hidden="true"
          />
          <span
            v-else-if="editor.state.isDirty"
            class="toolbar__button-badge toolbar__button-badge--dirty"
            data-testid="top-toolbar-save-badge-dirty"
            aria-hidden="true"
          />
        </button>
        <button
          class="toolbar__button toolbar__button--icon"
          data-testid="top-toolbar-export"
          :aria-label="t('toolbarExport')"
          :data-tooltip="t('toolbarExport')"
          :title="t('toolbarExport')"
          type="button"
          @click="pngExportDialogVisible = true"
        >
          <CanvasIcon
            class="toolbar__icon"
            name="export"
          />
        </button>
      </div>
      <span class="toolbar__divider" aria-hidden="true" />
      <div class="toolbar__group" :aria-label="t('toolbarGroupHistory')">
        <button
          class="toolbar__button toolbar__button--icon"
          data-testid="top-toolbar-undo"
          :aria-label="t('toolbarUndo')"
          :data-tooltip="t('toolbarUndo')"
          :title="t('toolbarUndo')"
          :disabled="!editor.canUndo"
          type="button"
          @click="editor.undo"
        >
          <CanvasIcon
            class="toolbar__icon"
            name="undo"
            :size="18"
          />
        </button>
        <button
          class="toolbar__button toolbar__button--icon"
          data-testid="top-toolbar-redo"
          :aria-label="t('toolbarRedo')"
          :data-tooltip="t('toolbarRedo')"
          :title="t('toolbarRedo')"
          :disabled="!editor.canRedo"
          type="button"
          @click="editor.redo"
        >
          <CanvasIcon
            class="toolbar__icon"
            name="redo"
            :size="18"
          />
        </button>
      </div>
      <span class="toolbar__divider" aria-hidden="true" />
      <div class="toolbar__group" :aria-label="t('toolbarGroupView')">
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
        <button
          class="toolbar__stat toolbar__stat--button"
          data-testid="top-toolbar-scale-value"
          :aria-label="t('toolbarZoomActual')"
          :data-tooltip="t('toolbarZoomActual')"
          :title="t('toolbarZoomActual')"
          type="button"
          @click="editor.zoomToActualSize"
        >
          {{ Math.round(editor.viewport.scale * 100) }}%
        </button>
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
          :aria-label="t('toolbarZoomFit')"
          :data-tooltip="t('toolbarZoomFit')"
          :title="t('toolbarZoomFit')"
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
        <span class="toolbar__meta-stats">{{ t("toolbarGraphStats", { nodes: editor.state.document.nodes.length, edges: editor.state.document.edges.length }) }}</span>
        <span
          class="toolbar__status"
          :class="{
            'toolbar__status--dirty': editor.state.isDirty && !editor.state.conflict,
            'toolbar__status--saved': !editor.state.isDirty && !editor.state.conflict && !editor.isSaving,
            'toolbar__status--saving': editor.isSaving,
            'toolbar__status--conflict': !!editor.state.conflict,
          }"
        >
          <span class="toolbar__status-dot" aria-hidden="true" />
          {{
            editor.state.conflict
              ? t("toolbarConflictState")
              : editor.isSaving
                ? t("toolbarSavingState")
                : editor.state.isDirty
                  ? t("toolbarUnsavedChanges")
                  : t("toolbarSaved")
          }}
        </span>
      </div>
      <span class="toolbar__divider" aria-hidden="true" />
      <div class="toolbar__group">
        <button
          class="toolbar__button toolbar__button--icon"
          data-testid="top-toolbar-command-palette"
          :aria-label="t('commandPaletteOpen')"
          :data-tooltip="t('commandPaletteOpen')"
          :title="t('commandPaletteOpen')"
          type="button"
          @click="commandPaletteOpen = true"
        >
          <CanvasIcon
            class="toolbar__icon"
            name="search"
          />
        </button>
        <button
          class="toolbar__button toolbar__button--icon"
          data-testid="top-toolbar-help"
          :aria-label="t('helpDialogTitle')"
          :data-tooltip="t('helpDialogTitle')"
          :title="t('helpDialogTitle')"
          type="button"
          @click="showHelpDialog"
        >
          <CanvasIcon
            class="toolbar__icon"
            name="help"
          />
        </button>
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
        @dblclick="handleStageDoubleClick"
        @paste="handleStagePaste"
        @wheel.passive="editor.handleWheelZoom"
        @contextmenu.prevent
        @dragover="editor.handleStageDragOver"
        @dragenter.prevent
        @drop.prevent="editor.handleStageDrop"
      >
        <div
          v-if="editor.state.conflict"
          class="conflict-banner"
          role="alert"
          data-testid="conflict-banner"
        >
          <div class="conflict-banner__body">
            <strong class="conflict-banner__title">{{ t('conflictBannerTitle') }}</strong>
            <span class="conflict-banner__description">{{ t('conflictBannerDescription') }}</span>
          </div>
          <div class="conflict-banner__actions">
            <button
              class="conflict-banner__button"
              type="button"
              @click="editor.loadConflictVersion"
            >
              {{ t('conflictBannerLoadDisk') }}
            </button>
            <button
              class="conflict-banner__button conflict-banner__button--primary"
              type="button"
              @click="editor.overwriteConflictVersion"
            >
              {{ t('conflictBannerOverwrite') }}
            </button>
          </div>
        </div>
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
                  fill="currentColor"
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
                  fill="currentColor"
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
                  fill="currentColor"
                />
              </marker>
            </defs>
            <g
              v-for="edge in editor.state.document.edges"
              :key="`path-${edge.id}`"
            >
              <path
                class="stage__edge"
                :class="{ 'stage__edge--selected': editor.state.selectedEdgeId === edge.id }"
                :d="editor.getEdgePath(edge)"
                fill="none"
                :marker-start="resolveEdgeStartMarker(edge.startArrow ?? false)"
                :marker-end="resolveEdgeEndMarker(edge.endArrow ?? true)"
                stroke="#6b7280"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                :style="getEdgeStrokeStyle(edge)"
                @click.stop="editor.selectEdge(edge.id)"
              />
            </g>
            <path
              v-if="editor.connectionDraft.visible"
              class="stage__edge stage__edge--draft"
              :d="editor.getConnectionDraftPath()"
              fill="none"
              marker-end="url(#canvas-edge-arrow)"
              stroke="#3b82f6"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
            />
            <path
              v-if="editor.edgeReconnectDraft.visible"
              class="stage__edge stage__edge--draft"
              data-testid="edge-reconnect-draft"
              :d="editor.getEdgeReconnectDraftPath()"
              fill="none"
              :marker-start="editor.edgeReconnectDraft.endpoint === 'from' ? 'url(#canvas-edge-arrow-start)' : undefined"
              :marker-end="editor.edgeReconnectDraft.endpoint === 'to' ? 'url(#canvas-edge-arrow-end)' : undefined"
              stroke="#3b82f6"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
            />
            <g
              v-for="edge in editor.state.document.edges"
              :key="`label-${edge.id}`"
            >
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
          </svg>

          <article
            v-for="node in editor.displayNodes"
            :key="node.id"
            class="canvas-node"
            :data-canvas-node-id="node.id"
            :data-canvas-node-type="node.type"
            :class="[
              `canvas-node--${node.type}`,
              {
                'canvas-node--search-current': hasCanvasCurrentSearchMatch(node.id),
                'canvas-node--search-match': hasCanvasSearchMatch(node.id),
                'canvas-node--selected': editor.state.selectedNodeIds.includes(node.id),
              },
            ]"
            :style="getCanvasNodeStyle(node)"
            @pointerdown.stop="handleNodePointerDown(node, $event)"
            @click.stop="handleNodeClick(node, $event)"
            @dblclick.stop="handleNodeDoubleClick(node)"
            @wheel.passive="handleNodeWheel(node, $event)"
          >
            <header
              v-if="node.type !== 'group'"
              class="canvas-node__header"
              data-drag-handle="true"
            >
              <CanvasIcon
                class="canvas-node__header-icon"
                :name="getNodeHeaderIconName(node)"
                :size="14"
              />
              <span class="canvas-node__header-title">{{ getNodeHeaderTitle(node) }}</span>
              <a
                v-if="node.type === 'link' && node.url"
                class="canvas-node__header-action"
                :href="node.url"
                target="_blank"
                rel="noopener noreferrer"
                :title="t('linkCardOpenInBrowser')"
                @click.stop
                @pointerdown.stop
              >↗</a>
            </header>
            <div
              class="canvas-node__body"
              :class="{ 'canvas-node__body--selectable': node.type === 'text' || node.type === 'link' }"
            >
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
                  data-canvas-field="text"
                  v-html="renderCanvasTextNodeContent(node)"
                />
              </template>
              <template v-else-if="node.type === 'file'">
                <div data-canvas-field="note">
                  <CanvasFileCard
                    :canvas-thumbnail-view-box="getCanvasThumbnailViewBox(editor.getFileNodePreview(node).thumbnail)"
                    :document-preview-html="getFileCardDocumentPreviewHtml(node)"
                    :image-src="getFileCardImageSource(node)"
                    :node="node"
                    :preview="editor.getFileNodePreview(node)"
                    :show-detail="shouldShowFileCardDetail(node)"
                    :show-helper="shouldShowFileCardHelper(node)"
                    :show-headline="shouldShowFileCardHeadline(node)"
                    :tooltip="getFileCardTooltip(node)"
                    @image-error="handleFileCardImageError"
                    @preview-image-error="handleFileCardPreviewImageError"
                  />
                </div>
              </template>
              <template v-else-if="node.type === 'link'">
                <textarea
                  v-if="editingNodeId === node.id"
                  :ref="setEditingTextareaRef"
                  v-model="editingMarkdown"
                  class="canvas-node__editor"
                  @blur="commitTextNodeEditing"
                />
                <div
                  v-else
                  class="link-card"
                >
                  <div class="link-card__iframe-wrapper">
                    <iframe
                      :src="node.url"
                      class="link-card__iframe"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                      loading="lazy"
                      @error="onLinkIframeError(node.id)"
                    />
                    <!-- 未选中时遮罩拦截 iframe 抢焦点；选中后才允许直接交互 -->
                    <div
                      v-if="!editor.state.selectedNodeIds.includes(node.id)"
                      class="link-card__shield"
                      aria-hidden="true"
                    />
                  </div>
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
                data-canvas-field="label"
                :style="getCanvasNodeContentStyle(node)"
                v-html="renderCanvasGroupLabel(node)"
              />
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
            data-canvas-png-export-ignore="true"
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
                fill="none"
                :marker-start="resolveEdgeStartMarker(edge.startArrow ?? false)"
                :marker-end="resolveEdgeEndMarker(edge.endArrow ?? true)"
                :style="getEdgeStrokeStyle(edge)"
                :data-testid="`edge-overlay-${edge.id}`"
              />
              <path
                class="stage__edge stage__edge--hit-area"
                :d="editor.getEdgePath(edge)"
                fill="none"
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
              type="button"
              @click.stop="editor.toggleEdgePopover('color')"
            >
              <CanvasIcon class="selection-toolbar__icon" name="color" />
            </button>
            <div
              v-if="editor.edgeToolbarPopover === 'color'"
              class="selection-toolbar__popover selection-toolbar__popover--colors"
              role="menu"
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
              @click.stop="editor.toggleEdgePopover('direction')"
            >
              <CanvasIcon class="selection-toolbar__icon" name="edge-direction" />
            </button>
            <div
              v-if="editor.edgeToolbarPopover === 'direction'"
              class="selection-toolbar__popover selection-toolbar__popover--layout"
              role="menu"
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
              :aria-haspopup="'menu'"
              :aria-expanded="editor.selectionToolbarPopover === 'color'"
              data-testid="selection-toolbar-color"
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
              role="menu"
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
            type="button"
            @click.stop="editor.centerSelectionInViewport"
          >
            <CanvasIcon
              class="selection-toolbar__icon"
              name="center"
            />
          </button>
          <button
            v-if="editor.canRefreshSelectedSiyuanNode"
            class="selection-toolbar__button"
            data-testid="selection-toolbar-refresh"
            :aria-label="SELECTION_TOOLBAR_TOOLTIPS.refresh"
            :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.refresh"
            type="button"
            @click.stop="editor.refreshSelectedSiyuanNode"
          >
            <CanvasIcon
              class="selection-toolbar__icon"
              name="refresh"
            />
          </button>
          <button
            v-if="editor.canDecomposeSelectedDocument"
            class="selection-toolbar__button"
            data-testid="selection-toolbar-decompose"
            :aria-label="SELECTION_TOOLBAR_TOOLTIPS.decompose"
            :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.decompose"
            type="button"
            @click.stop="editor.decomposeSelectedDocument"
          >
            <CanvasIcon
              class="selection-toolbar__icon"
              name="decompose"
            />
          </button>
          <button
            v-if="editor.canConvertSelectionToDocument && editor.selectedNodeCount === 1"
            class="selection-toolbar__button"
            data-testid="selection-toolbar-convert"
            :aria-label="SELECTION_TOOLBAR_TOOLTIPS.convert"
            :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.convert"
            type="button"
            @click.stop="editor.convertSelectionToDocument"
          >
            <CanvasIcon
              class="selection-toolbar__icon"
              name="convert"
            />
          </button>
          <button
            v-if="editor.canConvertSelectionToText && editor.selectedNodeCount === 1"
            class="selection-toolbar__button"
            data-testid="selection-toolbar-convert-to-text"
            :aria-label="SELECTION_TOOLBAR_TOOLTIPS.convertToText"
            :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.convertToText"
            type="button"
            @click.stop="editor.convertSelectionToText"
          >
            <CanvasIcon
              class="selection-toolbar__icon"
              name="convert-to-text"
            />
          </button>
          <button
            v-if="editor.selectedNodeCount === 1 && editor.selectedNode"
            class="selection-toolbar__button"
            data-testid="selection-toolbar-edit"
            :aria-label="SELECTION_TOOLBAR_TOOLTIPS.edit"
            :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.edit"
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
              v-if="editor.canConvertSelectionToDocument"
              class="selection-toolbar__button"
              data-testid="selection-toolbar-convert"
              :aria-label="SELECTION_TOOLBAR_TOOLTIPS.convert"
              :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.convert"
              type="button"
              @click.stop="editor.convertSelectionToDocument"
            >
              <CanvasIcon
                class="selection-toolbar__icon"
                name="convert"
              />
            </button>
            <button
              v-if="editor.canConvertSelectionToText"
              class="selection-toolbar__button"
              data-testid="selection-toolbar-convert-to-text"
              :aria-label="SELECTION_TOOLBAR_TOOLTIPS.convertToText"
              :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.convertToText"
              type="button"
              @click.stop="editor.convertSelectionToText"
            >
              <CanvasIcon
                class="selection-toolbar__icon"
                name="convert-to-text"
              />
            </button>
            <button
              class="selection-toolbar__button"
              data-testid="selection-toolbar-create-group"
              :aria-label="SELECTION_TOOLBAR_TOOLTIPS.createGroup"
              :data-tooltip="SELECTION_TOOLBAR_TOOLTIPS.createGroup"
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
                :aria-haspopup="'menu'"
                :aria-expanded="editor.selectionToolbarPopover === 'layout'"
                data-testid="selection-toolbar-align"
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
                role="menu"
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

        <CanvasMinimap
          v-if="showCanvasThumbnails"
          :editor="editor"
        />

        <CanvasPngExportDialog
          :visible="pngExportDialogVisible"
          :loading="pngExportLoading"
          v-model:png-export-range="pngExportRange"
          v-model:png-export-background-mode="pngExportBackgroundMode"
          v-model:png-export-custom-color="pngExportCustomColor"
          :t="t"
          @close="closePngExportDialog"
          @confirm="confirmPngExport"
        />

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
                ref="filePickerInputRef"
                :value="editor.filePickerDialog.query"
                class="canvas-dialog__control"
                @input="editor.updateFilePickerQuery(valueFromEvent($event))"
                @keydown="onFilePickerKeyDown"
              >
            </label>
            <div ref="filePickerOptionsRef" class="canvas-node-picker__options">
              <template v-for="group in getFilePickerGroups()" :key="group.kind">
                <div class="canvas-node-picker__group-header">{{ getFilePickerGroupLabel(group.kind) }}</div>
                <button
                  v-for="result in group.items"
                  :key="`file-picker-${result.kind}-${result.path}`"
                  :class="['canvas-node-picker__option', { 'canvas-node-picker__option--active': getFilePickerFlatIndex(result) === filePickerActiveIndex }]"
                  :data-testid="`file-picker-option-${result.kind}`"
                  type="button"
                  @click="editor.selectFilePickerResult(result)"
                  @mouseenter="filePickerActiveIndex = getFilePickerFlatIndex(result)"
                >
                  <span class="canvas-node-picker__option-kind">{{ getFilePickerKindLabel(result.kind) }}</span>
                  <strong v-html="highlightText(result.title, editor.filePickerDialog.query)" />
                  <span v-html="highlightText(result.subtitle, editor.filePickerDialog.query)" />
                </button>
              </template>
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
          @click="sortDropdownOpen = false; closeContextMenu()"
        >
          <nav
            class="inspector__tabs"
            role="tablist"
            data-testid="inspector-tabs"
          >
            <button
              class="inspector__tab"
              :class="{ 'inspector__tab--active': activeInspectorTab === 'documents' }"
              data-testid="inspector-tab-documents"
              role="tab"
              :aria-selected="activeInspectorTab === 'documents'"
              type="button"
              @click="activeInspectorTab = 'documents'"
            >
              {{ t('inspectorTabDocuments') }}
              <span
                v-if="totalInspectorIssueCount > 0"
                class="inspector__tab-badge inspector__tab-badge--danger"
              >{{ totalInspectorIssueCount }}</span>
            </button>
            <button
              class="inspector__tab"
              :class="{ 'inspector__tab--active': activeInspectorTab === 'selection' }"
              data-testid="inspector-tab-selection"
              role="tab"
              :aria-selected="activeInspectorTab === 'selection'"
              type="button"
              @click="activeInspectorTab = 'selection'"
            >
              {{ t('inspectorTabSelection') }}
              <span
                v-if="editor.selectedNodeCount > 0 || editor.selectedEdge"
                class="inspector__tab-badge"
              >{{ editor.selectedNodeCount > 0 ? editor.selectedNodeCount : '·' }}</span>
            </button>
          </nav>
          <template v-if="activeInspectorTab === 'documents'">
          <div class="inspector__toolbar">
            <button
              class="inspector__toolbar-button"
              data-testid="inspector-toolbar-new-canvas"
              :title="t('inspectorNewCanvas')"
              type="button"
              @click="editor.newCanvas"
            >
              <CanvasIcon
                name="new-canvas"
                :size="16"
              />
            </button>
            <button
              class="inspector__toolbar-button"
              data-testid="inspector-toolbar-new-folder"
              :title="t('inspectorNewFolder')"
              type="button"
              @click="editor.createWorkspaceFolder"
            >
              <CanvasIcon
                name="new-folder"
                :size="16"
              />
            </button>
            <button
              class="inspector__toolbar-button"
              :class="{ 'inspector__toolbar-button--active': sortDropdownOpen }"
              data-testid="inspector-toolbar-sort"
              :title="t('inspectorSort')"
              type="button"
              :aria-haspopup="'menu'"
              :aria-expanded="sortDropdownOpen"
              @click.stop="sortDropdownOpen = !sortDropdownOpen"
            >
              <CanvasIcon
                name="sort"
                :size="16"
              />
            </button>
            <button
              class="inspector__toolbar-button"
              data-testid="inspector-toolbar-expand-all"
              :title="editor.allFoldersExpanded ? t('inspectorCollapseAll') : t('inspectorExpandAll')"
              type="button"
              @click="editor.expandAllInspectorSections"
            >
              <CanvasIcon
                name="expand-all"
                :size="16"
              />
            </button>
            <div
              v-if="sortDropdownOpen"
              class="inspector__sort-dropdown"
              role="menu"
              @click.stop
            >
              <div class="inspector__sort-dropdown-group">
                <button
                  :class="['inspector__sort-dropdown-item', { 'inspector__sort-dropdown-item--active': editor.workspaceSortField === 'name' }]"
                  type="button"
                  @click="editor.setWorkspaceSortField('name'); sortDropdownOpen = false"
                >{{ t('inspectorSortByName') }}</button>
                <button
                  :class="['inspector__sort-dropdown-item', { 'inspector__sort-dropdown-item--active': editor.workspaceSortField === 'updated' }]"
                  type="button"
                  @click="editor.setWorkspaceSortField('updated'); sortDropdownOpen = false"
                >{{ t('inspectorSortByUpdated') }}</button>
                <button
                  :class="['inspector__sort-dropdown-item', { 'inspector__sort-dropdown-item--active': editor.workspaceSortField === 'created' }]"
                  type="button"
                  @click="editor.setWorkspaceSortField('created'); sortDropdownOpen = false"
                >{{ t('inspectorSortByCreated') }}</button>
              </div>
              <div class="inspector__sort-dropdown-divider" />
              <div class="inspector__sort-dropdown-group">
                <button
                  :class="['inspector__sort-dropdown-item', { 'inspector__sort-dropdown-item--active': editor.workspaceSortDirection === 'asc' }]"
                  type="button"
                  @click="editor.setWorkspaceSortDirection('asc'); sortDropdownOpen = false"
                >{{ t('inspectorSortAsc') }}</button>
                <button
                  :class="['inspector__sort-dropdown-item', { 'inspector__sort-dropdown-item--active': editor.workspaceSortDirection === 'desc' }]"
                  type="button"
                  @click="editor.setWorkspaceSortDirection('desc'); sortDropdownOpen = false"
                >{{ t('inspectorSortDesc') }}</button>
              </div>
            </div>
          </div>
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
              <CanvasWorkspaceTree
                v-if="editor.workspaceDocuments.length"
                :workspace-documents="editor.workspaceDocuments"
                :expanded-folders="editor.expandedFolders"
                :current-file-path="editor.state.filePath"
                :drag-over-folder-path="dragOverFolderPath"
                :delete-title="t('selectionToolbarDelete')"
                @toggle-folder="editor.toggleFolderExpand"
                @open-file="editor.openWorkspacePath"
                @delete-document="editor.deleteWorkspaceDocument"
                @context-menu="onContextMenu"
                @root-drop="onRootDrop"
                @folder-drag-over="onFolderDragOver"
                @folder-drag-enter="onFolderDragEnter"
                @folder-drag-leave="onFolderDragLeave"
                @folder-drop="onFolderDrop"
                @file-drag-start="onFileDragStart"
                @drag-end="onDragEnd"
              />
              <p v-else class="workspace-tree__empty">
                {{ t("inspectorNoWorkspaceCanvasFiles") }}<br>
                <code>{{ editor.defaultCanvasDirectory }}/</code>
              </p>
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
                <div
                  v-for="recent in editor.recentFiles"
                  :key="recent.path"
                  class="recent-list__item"
                  :title="recent.path"
                >
                  <button
                    class="recent-list__item-open"
                    type="button"
                    @click="editor.openRecentFile(recent)"
                  >
                    <CanvasIcon
                      class="recent-list__item-icon"
                      name="canvas-file"
                      :size="14"
                    />
                    <span class="workspace-tree__name">{{ recent.title }}</span>
                  </button>
                  <button
                    class="recent-list__item-delete"
                    :title="t('selectionToolbarDelete')"
                    type="button"
                    @click.stop="editor.removeRecentFileRecord(recent.path)"
                  >
                    <CanvasIcon name="close" :size="12" />
                  </button>
                </div>
              </div>
              <p v-else>
                {{ t("inspectorNoRecentWorkspaceFiles") }}
              </p>
            </div>
          </section>

          <section
            v-if="editor.state.conflict"
            class="inspector__section"
            data-testid="inspector-conflict-section"
          >
            <h2>{{ t("inspectorExternalChangeDetected") }}</h2>
            <p>{{ t("inspectorExternalChangeDescription") }}</p>
            <div class="conflict-panel__actions">
              <button
                class="toolbar__button"
                type="button"
                @click="editor.loadConflictVersion"
              >
                {{ t("inspectorLoadDiskVersion") }}
              </button>
              <button
                class="toolbar__button toolbar__button--primary"
                type="button"
                @click="editor.overwriteConflictVersion"
              >
                {{ t("inspectorOverwriteDiskVersion") }}
              </button>
            </div>
          </section>
          <section
            v-if="editor.state.issues.errors.length || editor.state.issues.warnings.length"
            class="inspector__section"
            data-testid="inspector-issues-section"
          >
            <h2>{{ t("inspectorTabIssues") }}</h2>
            <div class="issues">
              <div
                v-for="issue in [...editor.state.issues.errors, ...editor.state.issues.warnings]"
                :key="issue.code + issue.path"
                :class="['issues__item', `issues__item--${issue.level}`]"
              >
                <strong>{{ getIssueLevelLabel(issue.level) }}</strong>
                <span>{{ issue.message }}</span>
              </div>
            </div>
          </section>
          </template>

          <CanvasInspector
            v-if="activeInspectorTab === 'selection'"
            :editor="(editor as Record<string, unknown>)"
            :get-side-label="getSideLabel"
            :t="t"
          />

        </div>
      </aside>
    </div>

    <Teleport to="body">
      <div
        v-if="contextMenuVisible"
        class="workspace-context-menu"
        :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
        @click.stop
      >
        <button
          class="workspace-context-menu__item"
          type="button"
          @click="contextMenuRename"
        >
          {{ t('contextMenuRename') }}
        </button>
        <button
          class="workspace-context-menu__item"
          type="button"
          @click="contextMenuOpenInExplorer"
        >
          {{ t('contextMenuOpenInExplorer') }}
        </button>
        <button
          v-if="contextMenuType === 'file'"
          class="workspace-context-menu__item"
          type="button"
          @click="contextMenuCopy"
        >
          {{ t('contextMenuCopy') }}
        </button>
        <template v-if="contextMenuType === 'folder'">
          <button
            class="workspace-context-menu__item"
            type="button"
            @click="contextMenuNewSubfolder"
          >
            {{ t('contextMenuNewSubfolder') }}
          </button>
          <button
            class="workspace-context-menu__item"
            type="button"
            @click="contextMenuNewDocument"
          >
            {{ t('contextMenuNewDocument') }}
          </button>
        </template>
        <div class="workspace-context-menu__divider" />
        <button
          class="workspace-context-menu__item workspace-context-menu__item--danger"
          type="button"
          @click="contextMenuDelete"
        >
          {{ t('contextMenuDelete') }}
        </button>
      </div>
    </Teleport>

    <CanvasCreateEdgeDialog
      v-if="editor.createEdgeDialog.visible"
      :editor="editor"
      :get-side-label="getSideLabel"
      :t="t"
    />

    <CanvasCommandPalette
      :open="commandPaletteOpen"
      :editor="editor"
      :t="t"
      @close="commandPaletteOpen = false"
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
import type {
  CanvasPngExportBackgroundMode,
  CanvasPngExportRange,
} from "@/canvas/png-export"

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue"
import type { CanvasTabBootstrap } from "@/main"
import { useCanvasEditor } from "@/canvas/use-canvas-editor"
import {
  CanvasIcon,
} from "@/components/canvas/canvas-icon"
import type { CanvasIconName } from "@/components/canvas/canvas-icon"
import {
  EDGE_DIRECTION_ICON_NAMES,
  SELECTION_LAYOUT_ICON_NAMES,
  createSelectionToolbarTooltips,
} from "@/components/canvas/canvas-selection-toolbar-icon"
import CanvasCreateEdgeDialog from "@/components/canvas/CanvasCreateEdgeDialog.vue"
import CanvasCommandPalette from "@/components/canvas/CanvasCommandPalette.vue"
import { openHelpDialog } from "@/canvas/help-dialog"
import CanvasFileCard from "@/components/canvas/CanvasFileCard.vue"
import CanvasMinimap from "@/components/canvas/CanvasMinimap.vue"
import CanvasWorkspaceTree from "@/components/canvas/CanvasWorkspaceTree.vue"
import CanvasInspector from "@/components/canvas/CanvasInspector.vue"
import CanvasPngExportDialog from "@/components/canvas/CanvasPngExportDialog.vue"
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
  markCanvasSearchTextRanges,
  renderCanvasSearchMarkedText,
  type CanvasSearchDecoration,
} from "@/canvas/search-bridge"
import {
  applyFilePreviewImageOverrides,
  getFilePreviewImageCandidates,
  getNextFilePreviewImageSource,
} from "@/canvas/file-preview-fallbacks"
import type { CanvasFilePickerOption } from "@/canvas/file-picker-dialog"

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
const textMarkdownImageBlobUrls = ref<Record<string, string>>({})
const hoveredEdgeId = ref("")
const pngExportBackgroundMode = ref<CanvasPngExportBackgroundMode>("white")
const pngExportCustomColor = ref("#ffffff")
const pngExportDialogVisible = ref(false)
const pngExportLoading = ref(false)
const pngExportRange = ref<CanvasPngExportRange>("full")
const sortDropdownOpen = ref(false)
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuPath = ref("")
const contextMenuType = ref<'file' | 'folder'>('file')
const dragSourcePath = ref<string | null>(null)
const dragOverFolderPath = ref<string | null>(null)
const settingsRevision = ref(0)
let dragExpandTimer: ReturnType<typeof setTimeout> | null = null
const textMarkdownImageBlobUrlLoads = new Set<string>()

type InspectorTab = 'documents' | 'selection'
const activeInspectorTab = ref<InspectorTab>('documents')

const totalInspectorIssueCount = computed(() => {
  const errors = editor.state.issues.errors.length
  const warnings = editor.state.issues.warnings.length
  const conflict = editor.state.conflict ? 1 : 0
  return errors + warnings + conflict
})

function isWorkspaceStorageImageSource(source: string): boolean {
  return /^\/data\/storage\/.+\.(?:avif|bmp|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(source.trim())
}

async function loadTextMarkdownImageBlobUrl(source: string) {
  if (textMarkdownImageBlobUrls.value[source] || textMarkdownImageBlobUrlLoads.has(source)) {
    return
  }

  textMarkdownImageBlobUrlLoads.add(source)
  try {
    const response = await fetch("/api/file/getFile", {
      body: JSON.stringify({ path: source }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    })
    if (!response.ok) {
      return
    }

    const blobUrl = URL.createObjectURL(await response.blob())
    textMarkdownImageBlobUrls.value = {
      ...textMarkdownImageBlobUrls.value,
      [source]: blobUrl,
    }
  } catch (error) {
    console.warn("[siyuan-canvas] unable to load text markdown image:", source, error)
  } finally {
    textMarkdownImageBlobUrlLoads.delete(source)
  }
}

function collectWorkspaceStorageImages(html: string): string[] {
  const sources = new Set<string>()
  html.replace(/<img\b[^>]*\bsrc=(["'])([^"']+)\1/gi, (_match, _quote: string, source: string) => {
    if (isWorkspaceStorageImageSource(source)) {
      sources.add(source)
    }
    return _match
  })
  return [...sources]
}

function applyTextMarkdownImageBlobUrls(html: string): string {
  return html.replace(
    /(<img\b[^>]*\bsrc=(["']))([^"']+)(\2)/gi,
    (match, prefix: string, _quote: string, source: string, suffix: string) => {
      const blobUrl = textMarkdownImageBlobUrls.value[source]
      return blobUrl ? `${prefix}${blobUrl}${suffix}` : match
    },
  )
}

const showCanvasThumbnails = computed(() => {
  settingsRevision.value
  return editor.getPluginSettings().showCanvasThumbnails
})

function handleCanvasSettingsChanged() {
  settingsRevision.value += 1
}

function onContextMenuKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeContextMenu()
}

onMounted(() => {
  window.addEventListener("siyuan-canvas-settings-changed", handleCanvasSettingsChanged)
  document.addEventListener("click", closeContextMenu)
  document.addEventListener("keydown", onContextMenuKeydown)
})

onBeforeUnmount(() => {
  for (const blobUrl of Object.values(textMarkdownImageBlobUrls.value)) {
    URL.revokeObjectURL(blobUrl)
  }
  window.removeEventListener("siyuan-canvas-settings-changed", handleCanvasSettingsChanged)
  document.removeEventListener("click", closeContextMenu)
  document.removeEventListener("keydown", onContextMenuKeydown)
})

// 选区/边变更时若用户尚停留在文档 tab，自动切到选区 tab，避免反复手动切换
watch(
  () => `${editor.state.selectedEdgeId}|${editor.state.selectedNodeIds.length}`,
  (next, prev) => {
    if (next === prev) return
    const hasSelection = editor.state.selectedEdgeId !== '' || editor.state.selectedNodeIds.length > 0
    if (hasSelection && activeInspectorTab.value === 'documents') {
      activeInspectorTab.value = 'selection'
    }
  },
)

function onFileDragStart(event: DragEvent, filePath: string) {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', filePath)
  dragSourcePath.value = filePath
}

function onFolderDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function onFolderDragEnter(event: DragEvent, folderPath: string) {
  event.preventDefault()
  dragOverFolderPath.value = folderPath
  if (!editor.expandedFolders.has(folderPath)) {
    if (dragExpandTimer) clearTimeout(dragExpandTimer)
    dragExpandTimer = setTimeout(() => {
      editor.toggleFolderExpand(folderPath)
      dragExpandTimer = null
    }, 600)
  }
}

function onFolderDragLeave(event: DragEvent, folderPath: string) {
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

async function onFolderDrop(event: DragEvent, folderPath: string) {
  event.preventDefault()
  if (dragExpandTimer) {
    clearTimeout(dragExpandTimer)
    dragExpandTimer = null
  }
  dragOverFolderPath.value = null
  const sourcePath = event.dataTransfer?.getData('text/plain') || dragSourcePath.value
  if (!sourcePath) return
  dragSourcePath.value = null
  await editor.moveWorkspaceFile(sourcePath, folderPath)
}

async function onRootDrop(event: DragEvent) {
  event.preventDefault()
  const sourcePath = event.dataTransfer?.getData('text/plain') || dragSourcePath.value
  if (!sourcePath) return
  dragSourcePath.value = null
  await editor.moveWorkspaceFile(sourcePath, editor.defaultCanvasDirectory)
}

function onDragEnd() {
  dragSourcePath.value = null
  dragOverFolderPath.value = null
  if (dragExpandTimer) {
    clearTimeout(dragExpandTimer)
    dragExpandTimer = null
  }
}

function onContextMenu(event: MouseEvent, path: string, type: 'file' | 'folder') {
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
  if (contextMenuType.value === 'file') {
    editor.renameWorkspaceDocument(contextMenuPath.value)
  } else {
    editor.renameWorkspaceFolder(contextMenuPath.value)
  }
}

function contextMenuCopy() {
  closeContextMenu()
  editor.copyWorkspaceDocument(contextMenuPath.value)
}

function contextMenuOpenInExplorer() {
  closeContextMenu()
  editor.openInExplorer(contextMenuPath.value)
}

function contextMenuNewSubfolder() {
  closeContextMenu()
  editor.createWorkspaceFolder()
}

function contextMenuNewDocument() {
  closeContextMenu()
  editor.newCanvas()
}

function contextMenuDelete() {
  closeContextMenu()
  if (contextMenuType.value === 'file') {
    editor.deleteWorkspaceDocument(contextMenuPath.value)
  } else {
    editor.deleteWorkspaceFolder(contextMenuPath.value)
  }
}

function closePngExportDialog() {
  pngExportDialogVisible.value = false
}

async function confirmPngExport() {
  pngExportLoading.value = true
  try {
    await editor.exportCanvasPng({
      background: {
        color: pngExportCustomColor.value,
        mode: pngExportBackgroundMode.value,
      },
      range: pngExportRange.value,
    })
  } finally {
    pngExportLoading.value = false
    closePngExportDialog()
  }
}

onBeforeUnmount(() => {
  if (dragExpandTimer) {
    clearTimeout(dragExpandTimer)
    dragExpandTimer = null
  }
  window.removeEventListener("keydown", handleGlobalKeydown, true)
})

// Ctrl/Cmd + K 打开命令面板。capture 阶段拦截，避免被画布的全局 keydown 当成普通快捷键
const commandPaletteOpen = ref(false)
function handleGlobalKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "k") {
    event.preventDefault()
    event.stopPropagation()
    commandPaletteOpen.value = true
  }
}

// 文件选择器键盘导航
const filePickerInputRef = ref<HTMLInputElement>()
const filePickerOptionsRef = ref<HTMLElement>()
const filePickerActiveIndex = ref(0)

function getFilePickerFlatResults() {
  const groups = getFilePickerGroups()
  return groups.flatMap((g) => g.items)
}

function getFilePickerFlatIndex(result: CanvasFilePickerOption): number {
  return getFilePickerFlatResults().indexOf(result)
}

function filePickerScrollActiveIntoView() {
  void nextTick(() => {
    const container = filePickerOptionsRef.value
    if (!container) return
    const active = container.querySelector<HTMLElement>(".canvas-node-picker__option--active")
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest" })
    }
  })
}

function onFilePickerKeyDown(event: KeyboardEvent) {
  const total = getFilePickerFlatResults().length
  if (event.key === "Escape") {
    event.preventDefault()
    editor.closeFilePickerDialog()
    return
  }
  if (event.key === "ArrowDown") {
    event.preventDefault()
    filePickerActiveIndex.value = total > 0 ? (filePickerActiveIndex.value + 1) % total : 0
    filePickerScrollActiveIntoView()
    return
  }
  if (event.key === "ArrowUp") {
    event.preventDefault()
    filePickerActiveIndex.value = total > 0 ? (filePickerActiveIndex.value - 1 + total) % total : 0
    filePickerScrollActiveIntoView()
    return
  }
  if (event.key === "Enter") {
    event.preventDefault()
    const target = getFilePickerFlatResults()[filePickerActiveIndex.value]
    if (target) {
      editor.selectFilePickerResult(target)
    }
  }
}

watch(() => editor.filePickerDialog.visible, (visible) => {
  if (visible) {
    filePickerActiveIndex.value = 0
    void nextTick(() => filePickerInputRef.value?.focus())
  }
})

watch(() => editor.filePickerDialog.query, () => {
  filePickerActiveIndex.value = 0
})

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown, true)
})
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
  commitTextNodeEditing()
  editor.activateCanvasSurface()
  editor.startPan(event)
}

function handleStageDoubleClick(event: MouseEvent) {
  const rect = stageRef.value?.getBoundingClientRect()
  if (!rect) return
  const stageX = event.clientX - rect.left
  const stageY = event.clientY - rect.top
  const canvasX = (stageX - editor.viewport.x) / editor.viewport.scale + editor.board.left
  const canvasY = (stageY - editor.viewport.y) / editor.viewport.scale + editor.board.top
  editor.addNodeAtPosition('text', canvasX, canvasY)
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

function onLinkIframeError(nodeId: string) {
  const iframe = document.querySelector(`[data-node-id="${nodeId}"] .link-card__iframe`) as HTMLIFrameElement | null
  if (iframe) {
    iframe.style.display = "none"
    const fallback = document.createElement("div")
    fallback.className = "link-card__fallback"
    fallback.textContent = t("linkCardFallback")
    iframe.parentElement?.appendChild(fallback)
  }
}

function handleNodeWheel(node: CanvasNode, event: WheelEvent) {
  const target = event.target as HTMLElement | null
  if (!target) return
  const isSelected = editor.state.selectedNodeIds.includes(node.id)
  if (isSelected) {
    event.stopPropagation()
    return
  }
  const scrollable = target.closest('.canvas-node__body, .markdown-preview pre, .file-card__document-preview') as HTMLElement | null
  if (!scrollable) return
  const { scrollHeight, clientHeight, scrollTop } = scrollable
  if (scrollHeight <= clientHeight) return
  const atTop = scrollTop <= 0 && event.deltaY < 0
  const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && event.deltaY > 0
  if (!atTop && !atBottom) {
    event.stopPropagation()
  }
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

function showHelpDialog() {
  const shortcuts = [
    { key: t("helpShortcutDoubleClick"), action: t("helpActionDoubleClick") },
    { key: t("helpShortcutDoubleClickStage"), action: t("helpActionDoubleClickStage") },
    { key: t("helpShortcutEscape"), action: t("helpActionEscape") },
    { key: t("helpShortcutDelete"), action: t("helpActionDelete") },
    { key: t("helpShortcutCtrlA"), action: t("helpActionCtrlA") },
    { key: t("helpShortcutCtrlS"), action: t("helpActionCtrlS") },
    { key: t("helpShortcutUndo"), action: t("helpActionUndo") },
    { key: t("helpShortcutRedo"), action: t("helpActionRedo") },
    { key: t("helpShortcutDuplicate"), action: t("helpActionDuplicate") },
    { key: t("helpShortcutZoomIn"), action: t("helpActionZoomIn") },
    { key: t("helpShortcutZoomOut"), action: t("helpActionZoomOut") },
    { key: t("helpShortcutZoomActual"), action: t("helpActionZoomActual") },
    { key: t("helpShortcutZoomFit"), action: t("helpActionZoomFit") },
    { key: t("helpShortcutCommandPalette"), action: t("helpActionCommandPalette") },
    { key: t("helpShortcutDoubleBracket"), action: t("helpActionDoubleBracket") },
    { key: t("helpShortcutTab"), action: t("helpActionTab") },
    { key: t("helpShortcutEnter"), action: t("helpActionEnter") },
    { key: t("helpShortcutWheel"), action: t("helpActionWheel") },
    { key: t("helpShortcutDrag"), action: t("helpActionDrag") },
    { key: t("helpShortcutDragSecondary"), action: t("helpActionDragSecondary") },
    { key: t("helpShortcutDragNode"), action: t("helpActionDragNode") },
    { key: t("helpShortcutDragAnchor"), action: t("helpActionDragAnchor") },
    { key: t("helpShortcutRenameDocument"), action: t("helpActionRenameDocument") },
  ]
  openHelpDialog(t("helpDialogTitle"), shortcuts)
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
  return colorStyle ? { color: colorStyle.border, stroke: colorStyle.border } : undefined
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

function hasCanvasSearchMatch(nodeId: string) {
  return (editor.searchDecorations ?? []).some(decoration => decoration.targetId.startsWith(`node:${nodeId}:`))
}

function hasCanvasCurrentSearchMatch(nodeId: string) {
  return (editor.searchDecorations ?? []).some(decoration =>
    decoration.current && decoration.targetId.startsWith(`node:${nodeId}:`),
  )
}

function getCanvasTargetDecorations(targetId: string): CanvasSearchDecoration[] {
  return (editor.searchDecorations ?? []).filter(decoration => decoration.targetId === targetId)
}

function renderCanvasGroupLabel(node: CanvasNode) {
  const label = node.type === "group"
    ? node.label || t("nodeDefaultGroupLabel")
    : ""
  return renderCanvasSearchMarkedText(label, getCanvasTargetDecorations(`node:${node.id}:label`))
}

function renderCanvasTextNodeContent(node: CanvasNode) {
  if (node.type !== "text") {
    return ""
  }

  const decorations = getCanvasTargetDecorations(`node:${node.id}:text`)
  const markdown = decorations.length
    ? markCanvasSearchTextRanges(node.text, decorations)
    : node.text
  const html = editor.getRenderedMarkdown(markdown)
  for (const source of collectWorkspaceStorageImages(html)) {
    void loadTextMarkdownImageBlobUrl(source)
  }
  return applyTextMarkdownImageBlobUrls(html)
}

/**
 * 节点 header 上显示的类型图标。文本/文件/链接三类节点 header 的图标视觉锚点
 * 来自 canvas-icon 字典，与底部 toolbar 添加按钮保持一致。
 */
function getNodeHeaderIconName(node: CanvasNode): CanvasIconName {
  if (node.type === "text") return "text"
  if (node.type === "file") return "canvas-file"
  if (node.type === "link") return "open"
  return "text"
}

/**
 * 节点 header 上显示的标题。优先使用节点已有元数据，最后退化到节点类型默认文案。
 */
function getNodeHeaderTitle(node: CanvasNode): string {
  if (node.type === "text") {
    const firstLine = (node.text || "").split("\n").find((line) => line.trim().length > 0) ?? ""
    const title = firstLine.trim().replace(/^#{1,6}\s+/, "").trim()
    return title.slice(0, 60) || t("nodeKindText")
  }
  if (node.type === "file") {
    return editor.getNodeTitle?.(node)
      || (node.file ? node.file.split("/").pop() || node.file : t("toolbarFile"))
  }
  if (node.type === "link") {
    if (!node.url) return t("nodeKindExternalLink")
    try {
      return new URL(node.url).hostname || node.url
    } catch {
      return node.url
    }
  }
  return ""
}

function getFileCardImageSource(node: CanvasNode): string | undefined {
  if (node.type !== "file") {
    return undefined
  }

  const preview = editor.getFileNodePreview(node)
  if (preview.kind !== "image" || !preview.imageSrc) {
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

  return !["block", "image"].includes(editor.getFileNodePreview(node).kind)
}

function shouldShowFileCardDetail(node: CanvasNode) {
  if (node.type !== "file") {
    return false
  }

  const kind = editor.getFileNodePreview(node).kind
  return !["block", "document", "image"].includes(kind)
}

function shouldShowFileCardHelper(node: CanvasNode) {
  if (node.type !== "file") {
    return false
  }

  return !["block", "document", "image"].includes(editor.getFileNodePreview(node).kind)
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

type FilePickerKind = "block" | "canvas" | "document" | "image"

function getFilePickerGroups() {
  const g = editor.filePickerDialog.groups
  const candidates = [
    { kind: "document" as FilePickerKind, items: g.documents },
    { kind: "canvas" as FilePickerKind, items: g.canvases },
    { kind: "block" as FilePickerKind, items: g.blocks },
    { kind: "image" as FilePickerKind, items: g.images },
  ]
  return candidates.filter((group) => group.items.length > 0)
}

function getFilePickerGroupLabel(kind: FilePickerKind): string {
  return t(`filePickerGroup${kind.charAt(0).toUpperCase()}${kind.slice(1)}s` as any)
}

function getFilePickerKindLabel(kind: FilePickerKind): string {
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function highlightText(text: string, query: string): string {
  if (!query) return escapeHtml(text)
  const escaped = escapeHtml(text)
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`(${escapedQuery})`, "gi")
  return escaped.replace(regex, "<mark>$1</mark>")
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

.workspace-context-menu__divider {
  height: 1px;
  margin: 4px;
  background: var(--b3-border-color);
}
</style>
