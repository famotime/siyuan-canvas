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
      </div>
      <span class="toolbar__divider" aria-hidden="true" />
      <div class="toolbar__group" :aria-label="t('toolbarGroupHistory')">
        <button
          class="toolbar__button toolbar__button--icon"
          data-testid="top-toolbar-undo"
          :aria-label="t('toolbarUndo')"
          :data-tooltip="t('toolbarUndo')"
          :disabled="!editor.canUndo"
          type="button"
          @click="editor.undo"
        >
          <CanvasIcon
            class="toolbar__icon"
            name="undo"
          />
        </button>
        <button
          class="toolbar__button toolbar__button--icon"
          data-testid="top-toolbar-redo"
          :aria-label="t('toolbarRedo')"
          :data-tooltip="t('toolbarRedo')"
          :disabled="!editor.canRedo"
          type="button"
          @click="editor.redo"
        >
          <CanvasIcon
            class="toolbar__icon"
            name="redo"
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
              :key="`path-${edge.id}`"
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
              <CanvasIcon class="selection-toolbar__icon" name="connect" />
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

        <CanvasMinimap :editor="editor" />

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
              <template v-for="group in getFilePickerGroups()" :key="group.kind">
                <div class="canvas-node-picker__group-header">{{ getFilePickerGroupLabel(group.kind) }}</div>
                <button
                  v-for="result in group.items"
                  :key="`file-picker-${result.kind}-${result.path}`"
                  class="canvas-node-picker__option"
                  :data-testid="`file-picker-option-${result.kind}`"
                  type="button"
                  @click="editor.selectFilePickerResult(result)"
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
          @click="sortDropdownOpen = false"
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
              <div
                v-if="editor.workspaceDocuments.length"
                class="workspace-tree"
                @dragover.prevent
                @drop.prevent="onRootDrop"
              >
                <template
                  v-for="node in editor.workspaceDocuments"
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
                      :aria-expanded="editor.expandedFolders.has(node.path)"
                      @click="editor.toggleFolderExpand(node.path)"
                      @dragover.prevent="onFolderDragOver"
                      @dragenter.prevent="onFolderDragEnter($event, node.path)"
                      @dragleave="onFolderDragLeave($event, node.path)"
                      @drop.prevent="onFolderDrop($event, node.path)"
                    >
                      <CanvasIcon
                        class="workspace-tree__chevron"
                        :class="{ 'workspace-tree__chevron--expanded': editor.expandedFolders.has(node.path) }"
                        name="chevron-right"
                        :size="12"
                      />
                      <CanvasIcon
                        class="workspace-tree__folder-icon"
                        :name="editor.expandedFolders.has(node.path) ? 'folder-open' : 'folder'"
                        :size="14"
                      />
                      <span class="workspace-tree__name">{{ node.name }}</span>
                    </button>
                    <div
                      v-if="editor.expandedFolders.has(node.path)"
                      class="workspace-tree__folder-children"
                    >
                      <template
                        v-for="child in node.children"
                        :key="child.path"
                      >
                        <div
                          v-if="child.type === 'file'"
                          :class="['workspace-tree__file', { 'workspace-tree__file--active': child.path === editor.state.filePath }]"
                          draggable="true"
                          :title="child.path"
                          @contextmenu.prevent="editor.renameWorkspaceDocument(child.path)"
                          @dragstart="onFileDragStart($event, child.path)"
                          @dragend="onDragEnd"
                        >
                          <button
                            class="workspace-tree__file-open"
                            type="button"
                            @click="editor.openWorkspacePath(child.path)"
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
                            :title="t('selectionToolbarDelete')"
                            type="button"
                            @click.stop="editor.deleteWorkspaceDocument(child.path)"
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
                            :aria-expanded="editor.expandedFolders.has(child.path)"
                            @click="editor.toggleFolderExpand(child.path)"
                            @dragover.prevent="onFolderDragOver"
                            @dragenter.prevent="onFolderDragEnter($event, child.path)"
                            @dragleave="onFolderDragLeave($event, child.path)"
                            @drop.prevent="onFolderDrop($event, child.path)"
                          >
                            <CanvasIcon
                              class="workspace-tree__chevron"
                              :class="{ 'workspace-tree__chevron--expanded': editor.expandedFolders.has(child.path) }"
                              name="chevron-right"
                              :size="12"
                            />
                            <CanvasIcon
                              class="workspace-tree__folder-icon"
                              :name="editor.expandedFolders.has(child.path) ? 'folder-open' : 'folder'"
                              :size="14"
                            />
                            <span class="workspace-tree__name">{{ child.name }}</span>
                          </button>
                          <div
                            v-if="editor.expandedFolders.has(child.path)"
                            class="workspace-tree__folder-children"
                          >
                            <template
                              v-for="grandchild in child.children"
                              :key="grandchild.path"
                            >
                              <div
                                v-if="grandchild.type === 'file'"
                                :class="['workspace-tree__file', { 'workspace-tree__file--active': grandchild.path === editor.state.filePath }]"
                                draggable="true"
                                :title="grandchild.path"
                                @contextmenu.prevent="editor.renameWorkspaceDocument(grandchild.path)"
                                @dragstart="onFileDragStart($event, grandchild.path)"
                                @dragend="onDragEnd"
                              >
                                <button
                                  class="workspace-tree__file-open"
                                  type="button"
                                  @click="editor.openWorkspacePath(grandchild.path)"
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
                                  :title="t('selectionToolbarDelete')"
                                  type="button"
                                  @click.stop="editor.deleteWorkspaceDocument(grandchild.path)"
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
                    :class="['workspace-tree__file', { 'workspace-tree__file--active': node.path === editor.state.filePath }]"
                    draggable="true"
                    :title="node.path"
                    @contextmenu.prevent="editor.renameWorkspaceDocument(node.path)"
                    @dragstart="onFileDragStart($event, node.path)"
                    @dragend="onDragEnd"
                  >
                    <button
                      class="workspace-tree__file-open"
                      type="button"
                      @click="editor.openWorkspacePath(node.path)"
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
                      :title="t('selectionToolbarDelete')"
                      type="button"
                      @click.stop="editor.deleteWorkspaceDocument(node.path)"
                    >
                      <CanvasIcon name="close" :size="12" />
                    </button>
                  </div>
                </template>
              </div>
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

          <template v-if="activeInspectorTab === 'selection'">
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
          </template>

        </div>
      </aside>
    </div>

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
const sortDropdownOpen = ref(false)
const dragSourcePath = ref<string | null>(null)
const dragOverFolderPath = ref<string | null>(null)
let dragExpandTimer: ReturnType<typeof setTimeout> | null = null

type InspectorTab = 'documents' | 'selection'
const activeInspectorTab = ref<InspectorTab>('documents')

const totalInspectorIssueCount = computed(() => {
  const errors = editor.state.issues.errors.length
  const warnings = editor.state.issues.warnings.length
  const conflict = editor.state.conflict ? 1 : 0
  return errors + warnings + conflict
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
    return firstLine.trim().slice(0, 60) || t("nodeKindText")
  }
  if (node.type === "file") {
    return editor.getFileNodeDescription?.(node)
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

<style scoped lang="scss">
/* 设计 token 全部从思源 --b3-* 派生；color-mix 统一处理透明/混色，主题切换零失配 */
.canvas-shell {
  /* 表面层 */
  --canvas-bg: var(--b3-theme-background);
  --canvas-surface: var(--b3-theme-surface);
  --canvas-surface-elevated: var(--b3-theme-surface);
  --canvas-surface-overlay: color-mix(in srgb, var(--b3-theme-surface) 82%, transparent);
  --canvas-toolbar-bg: color-mix(in srgb, var(--b3-theme-surface) 92%, transparent);

  /* 边框 */
  --canvas-border: var(--b3-border-color);
  --canvas-border-strong: color-mix(in srgb, var(--b3-theme-on-surface) 16%, transparent);

  /* 文字 */
  --canvas-text: var(--b3-theme-on-surface);
  --canvas-text-muted: var(--b3-theme-on-surface-light);

  /* 强调色 */
  --canvas-accent: var(--b3-theme-primary);
  --canvas-accent-contrast: var(--b3-theme-on-primary);
  --canvas-accent-soft: color-mix(in srgb, var(--b3-theme-primary) 14%, transparent);
  --canvas-accent-strong: color-mix(in srgb, var(--b3-theme-primary) 72%, transparent);

  /* 语义色 */
  --canvas-success: var(--b3-card-success-color, #2f7d4e);
  --canvas-success-soft: color-mix(in srgb, var(--canvas-success) 16%, transparent);
  --canvas-danger: var(--b3-card-error-color, #c04f2a);
  --canvas-danger-soft: color-mix(in srgb, var(--canvas-danger) 16%, transparent);
  --canvas-warning: var(--b3-card-warning-color, #d68f2c);

  /* 栅格与阴影 */
  --canvas-grid: color-mix(in srgb, var(--b3-theme-on-surface) 8%, transparent);
  --canvas-shadow: 0 8px 20px color-mix(in srgb, var(--b3-theme-on-surface) 12%, transparent);
  --canvas-shadow-strong: 0 12px 28px color-mix(in srgb, var(--b3-theme-on-surface) 18%, transparent);

  /* 浮层 */
  --canvas-floating-bg: color-mix(in srgb, var(--b3-theme-surface) 94%, transparent);
  --canvas-floating-border: color-mix(in srgb, var(--b3-theme-on-surface) 10%, transparent);
  --canvas-floating-button-bg: color-mix(in srgb, var(--b3-theme-on-surface) 6%, transparent);
  --canvas-floating-button-bg-hover: color-mix(in srgb, var(--b3-theme-on-surface) 12%, transparent);
  --canvas-floating-text: var(--canvas-text);
  --canvas-floating-tooltip-bg: color-mix(in srgb, var(--b3-theme-on-surface) 92%, var(--b3-theme-surface));
  --canvas-floating-tooltip-text: var(--b3-theme-surface);

  /* 选区 / 节点 */
  --canvas-selection-border: var(--canvas-accent-strong);
  --canvas-selection-fill: var(--canvas-accent-soft);
  --canvas-card-bg: var(--canvas-surface);
  --canvas-group-bg: color-mix(in srgb, var(--b3-theme-primary) 8%, transparent);
  --canvas-code-bg: color-mix(in srgb, var(--b3-theme-on-surface) 6%, transparent);

  /* 检查器 */
  --canvas-inspector-bg: var(--canvas-surface-elevated);
  --canvas-inspector-section-bg: var(--canvas-surface-overlay);

  /* 锚点 / 调整尺寸 */
  --canvas-anchor-bg: var(--canvas-surface);
  --canvas-anchor-shadow: 0 0 0 1px color-mix(in srgb, var(--b3-theme-on-surface) 12%, transparent);
  --canvas-resize-handle: color-mix(in srgb, var(--b3-theme-on-surface) 18%, transparent);
  --canvas-resize-handle-hover: color-mix(in srgb, var(--b3-theme-on-surface) 26%, transparent);

  /* 整体氛围 */
  --canvas-shell-highlight: color-mix(in srgb, var(--b3-theme-primary) 8%, transparent);

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

/* 暗色模式下 color-mix 自动适配，仅调整少量浮层透明度 */
.canvas-shell[data-theme-mode="dark"] {
  --canvas-surface-overlay: color-mix(in srgb, var(--b3-theme-surface) 68%, transparent);
  --canvas-toolbar-bg: color-mix(in srgb, var(--b3-theme-surface) 92%, transparent);
  --canvas-floating-bg: color-mix(in srgb, var(--b3-theme-surface) 92%, transparent);
}

.canvas-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--canvas-border);
  background: var(--canvas-toolbar-bg);
  backdrop-filter: blur(16px);
}

.toolbar__group {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.toolbar__divider {
  display: inline-block;
  width: 1px;
  height: 20px;
  background: var(--canvas-border);
}

.toolbar__meta {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  font-size: 12px;
  line-height: 1;
  color: var(--canvas-text-muted);
}

.toolbar__meta-stats {
  font-variant-numeric: tabular-nums;
}

.toolbar__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--canvas-floating-button-bg);
  font-size: 12px;
  font-weight: 500;
}

.toolbar__status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}

.toolbar__status--saved {
  color: var(--canvas-success);
  background: var(--canvas-success-soft);
}

.toolbar__status--dirty {
  color: var(--canvas-warning);
  background: color-mix(in srgb, var(--canvas-warning) 16%, transparent);
}

.toolbar__status--saving {
  color: var(--canvas-text-muted);
}

.toolbar__status--saving .toolbar__status-dot {
  animation: toolbar-status-pulse 1.4s ease-in-out infinite;
}

.toolbar__status--conflict {
  color: var(--canvas-danger);
  background: var(--canvas-danger-soft);
}

@keyframes toolbar-status-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.1); }
}

.toolbar__button {
  position: relative;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--canvas-text);
  padding: 6px 12px;
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
  width: 32px;
  height: 32px;
  padding: 0;
}

.toolbar__button:hover:not(:disabled) {
  background: var(--canvas-floating-button-bg-hover);
}

.toolbar__button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.toolbar__button:focus-visible {
  outline: 2px solid var(--canvas-accent);
  outline-offset: 1px;
}

.toolbar__button--primary {
  border-color: transparent;
  background: var(--canvas-accent);
  color: var(--canvas-accent-contrast);
}

.toolbar__button--primary:hover:not(:disabled) {
  border-color: transparent;
  background: var(--canvas-accent);
  color: var(--canvas-accent-contrast);
  filter: brightness(0.92);
}

.toolbar__button-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  border: 1px solid var(--canvas-toolbar-bg);
  pointer-events: none;
}

.toolbar__button-badge--dirty {
  background: var(--canvas-warning, #d68f2c);
}

.toolbar__button-badge--danger {
  background: var(--canvas-danger);
}

.toolbar__button-badge--saving {
  background: var(--canvas-accent);
  animation: toolbar-status-pulse 1.4s ease-in-out infinite;
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
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--canvas-text-muted);
}

.toolbar__stat--button {
  cursor: pointer;
  font: inherit;
}

.toolbar__stat--button:hover {
  background: var(--canvas-floating-button-bg-hover);
  color: var(--canvas-text);
}

.toolbar__dirty {
  color: var(--canvas-danger);
}

.toolbar__saved {
  color: var(--canvas-success);
}

.conflict-banner {
  position: absolute;
  top: 12px;
  left: 50%;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--canvas-floating-bg);
  border: 1px solid var(--canvas-danger);
  box-shadow: var(--canvas-shadow-strong);
  backdrop-filter: blur(14px);
  transform: translateX(-50%);
  max-width: calc(100% - 24px);
}

.conflict-banner__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.conflict-banner__title {
  font-size: 13px;
  color: var(--canvas-danger);
}

.conflict-banner__description {
  font-size: 12px;
  color: var(--canvas-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conflict-banner__actions {
  display: inline-flex;
  gap: 8px;
  flex-shrink: 0;
}

.conflict-banner__button {
  border: 1px solid var(--canvas-border);
  border-radius: 8px;
  background: var(--canvas-surface);
  padding: 6px 12px;
  font-size: 12px;
  color: var(--canvas-text);
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}

.conflict-banner__button:hover {
  background: var(--canvas-floating-button-bg-hover);
}

.conflict-banner__button--primary {
  background: var(--canvas-accent);
  color: var(--canvas-accent-contrast);
  border-color: transparent;
}

.conflict-banner__button--primary:hover {
  filter: brightness(0.92);
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
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--b3-theme-surface) 18%, transparent);
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
  --selection-toolbar-bg: var(--canvas-floating-bg);
  --selection-toolbar-border: var(--canvas-floating-border);
  --selection-toolbar-shadow: var(--canvas-shadow-strong);
  --selection-toolbar-text: var(--canvas-text);
  --selection-toolbar-button-bg: var(--canvas-floating-button-bg);
  --selection-toolbar-button-bg-hover: var(--canvas-floating-button-bg-hover);
  --selection-toolbar-tooltip-bg: var(--canvas-floating-tooltip-bg);
  --selection-toolbar-tooltip-border: var(--canvas-floating-border);
  --selection-toolbar-tooltip-text: var(--canvas-floating-tooltip-text);
}

.selection-toolbar--dark {
  --selection-toolbar-bg: var(--canvas-floating-bg);
  --selection-toolbar-border: var(--canvas-floating-border);
  --selection-toolbar-shadow: var(--canvas-shadow-strong);
  --selection-toolbar-text: var(--canvas-text);
  --selection-toolbar-button-bg: var(--canvas-floating-button-bg);
  --selection-toolbar-button-bg-hover: var(--canvas-floating-button-bg-hover);
  --selection-toolbar-tooltip-bg: var(--canvas-floating-tooltip-bg);
  --selection-toolbar-tooltip-border: var(--canvas-floating-border);
  --selection-toolbar-tooltip-text: var(--canvas-floating-tooltip-text);
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
  box-shadow: 0 0 0 4px var(--canvas-accent-soft);
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
  filter: drop-shadow(0 0 6px var(--canvas-accent-soft));
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
  filter: drop-shadow(0 0 10px var(--canvas-accent-soft));
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
  paint-order: stroke;
  stroke: var(--b3-theme-background, #fff);
  stroke-width: 3px;
  stroke-linejoin: round;
}

.canvas-node {
  --canvas-node-midpoint-shield: 60px;
  position: absolute;
  z-index: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--canvas-border);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: var(--canvas-shadow);
  background: var(--canvas-card-bg);
  color: var(--canvas-text);
  /* cursor: grab 移到 header；body 区域可选中文本 */
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

/* 节点顶部 header：唯一拖拽手柄；包含类型图标 + 标题 + 可选操作 */
.canvas-node__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--canvas-border);
  background: var(--canvas-floating-button-bg);
  color: var(--canvas-text-muted);
  font-size: 11px;
  font-weight: 500;
  flex-shrink: 0;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}

.canvas-node__header:active {
  cursor: grabbing;
}

.canvas-node--selected .canvas-node__header {
  background: var(--canvas-accent-soft);
  color: var(--canvas-accent);
}

.canvas-node__header-icon {
  flex-shrink: 0;
}

.canvas-node__header-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.canvas-node__header-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin: -2px -4px -2px 0;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1;
  color: inherit;
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}

.canvas-node__header-action:hover {
  background: var(--canvas-floating-button-bg-hover);
  color: var(--canvas-accent);
}

.canvas-node__body {
  flex: 1;
  padding: 12px 14px 16px;
  overflow: auto;
}

/* 文本/链接节点的 body 是用户内容区，可选择文本/不触发拖动 */
.canvas-node__body--selectable {
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}

.canvas-node--link .canvas-node__body {
  padding: 0;
  overflow: hidden;
  cursor: default;
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
    linear-gradient(180deg, var(--canvas-accent-soft), color-mix(in srgb, var(--b3-theme-on-surface) 2%, transparent)),
    var(--canvas-surface);
}

.file-card__thumbnail {
  display: block;
  width: 100%;
  height: 100%;
}

.file-card__thumbnail-edge {
  fill: none;
  stroke: var(--canvas-accent-strong);
  stroke-linecap: round;
  stroke-width: 10px;
}

.file-card__thumbnail-node {
  fill: color-mix(in srgb, var(--b3-theme-surface) 88%, transparent);
  stroke: color-mix(in srgb, var(--b3-theme-on-surface) 12%, transparent);
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

/* 触屏环境（无 hover、粗指针）：放大命中区域、selected 节点的锚点常驻 */
@media (hover: none) and (pointer: coarse) {
  .canvas-node__anchor {
    width: 44px;
    height: 44px;
  }

  .canvas-node--selected .canvas-node__anchor {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  .canvas-node__resize-corner {
    width: 22px;
    height: 22px;
  }

  .canvas-node--selected .canvas-node__resize-corner {
    opacity: 1;
  }

  /* 触屏没有 hover 显示 tooltip 的语义，干脆禁用 ::after 的 tooltip 浮层避免 tap 抖动 */
  .toolbar__button[data-tooltip]::after,
  .bottom-toolbar__button[data-tooltip]::after,
  .selection-toolbar__button::after,
  .selection-toolbar__menu-button::after {
    display: none;
  }

  /* 底栏按钮 hover 抬升对触屏无意义且会闪烁，关掉 */
  .bottom-toolbar__button:hover,
  .selection-toolbar__button:hover,
  .selection-toolbar__menu-button:hover {
    transform: none;
  }
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

.inspector__toolbar {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}

.inspector__toolbar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--canvas-border);
  border-radius: 8px;
  background: var(--canvas-inspector-section-bg);
  color: var(--canvas-text-muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.inspector__toolbar-button:hover {
  background: var(--canvas-surface);
  color: inherit;
}

.inspector__toolbar-button--active {
  background: var(--canvas-surface);
  color: inherit;
}

/* 三 tab 顶部导航：文档 / 选区 / 问题 */
.inspector__tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 12px;
  padding: 2px;
  border-radius: 8px;
  background: var(--canvas-floating-button-bg);
}

.inspector__tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--canvas-text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.inspector__tab:hover {
  color: var(--canvas-text);
}

.inspector__tab--active {
  background: var(--canvas-surface);
  color: var(--canvas-text);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--b3-theme-on-surface) 8%, transparent);
}

.inspector__tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--canvas-floating-button-bg-hover);
  color: var(--canvas-text);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.inspector__tab--active .inspector__tab-badge {
  background: var(--canvas-accent-soft);
  color: var(--canvas-accent);
}

.inspector__tab-badge--danger {
  background: var(--canvas-danger-soft);
  color: var(--canvas-danger);
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
  gap: 6px;
  font-size: 12px;
}

.issues__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 6px;
  border-left: 3px solid var(--canvas-warning);
  background: var(--canvas-floating-button-bg);
}

.issues__item--error {
  border-left-color: var(--canvas-danger);
  background: var(--canvas-danger-soft);
}

.issues__item--warning {
  border-left-color: var(--canvas-warning);
}

.issues__item strong {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--canvas-text-muted);
}

.issues__empty {
  margin: 0;
  padding: 16px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--canvas-text-muted);
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
  gap: 1px;
}

.recent-list__item {
  display: flex;
  align-items: stretch;
  border: 0;
  border-radius: 6px;
  background: transparent;
  overflow: hidden;
  transition: background 0.15s ease;
}

.recent-list__item:hover {
  background: var(--canvas-floating-button-bg);
}

.recent-list__item-open {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  text-align: left;
  cursor: pointer;
  color: var(--canvas-text);
  border: 0;
  background: transparent;
  min-width: 0;
  font: inherit;
}

.recent-list__item-icon {
  flex-shrink: 0;
  color: var(--canvas-text-muted);
}

.recent-list__item-delete {
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

.recent-list__item:hover .recent-list__item-delete,
.recent-list__item-delete:focus-visible {
  opacity: 1;
}

.recent-list__item-delete:hover {
  background: var(--canvas-danger-soft);
  color: var(--canvas-danger);
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
  background: color-mix(in srgb, var(--b3-theme-on-surface) 24%, transparent);
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

.canvas-node-picker__option mark {
  background: var(--b3-theme-primary-light);
  color: inherit;
  border-radius: 2px;
  padding: 0 2px;
}

.canvas-node-picker__group-header {
  padding: 4px 10px 2px;
  font-size: 11px;
  font-weight: 600;
  color: var(--canvas-text-muted);
  letter-spacing: 0.04em;
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

.link-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 8px;
}

.link-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--canvas-surface);
  border-bottom: 1px solid var(--canvas-border);
  min-height: 32px;
  box-sizing: border-box;
}

.link-card__url {
  flex: 1;
  font-size: 12px;
  color: var(--canvas-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.link-card__open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1;
  color: var(--canvas-text-muted);
  text-decoration: none;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.link-card__open:hover {
  background: var(--canvas-floating-button-bg-hover);
  color: var(--canvas-accent);
}

.link-card__iframe-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.link-card__iframe {
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--canvas-surface);
  position: absolute;
  top: 0;
  left: 0;
}

/* 未选中时盖一层透明遮罩，确保拖动事件能落在节点上而不是 iframe；选中后让出指针权 */
.link-card__shield {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: transparent;
  cursor: grab;
}

.link-card__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 16px;
  font-size: 13px;
  color: var(--canvas-text-muted);
  text-align: center;
}

.inspector__sort-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 10;
  min-width: 160px;
  margin-top: 4px;
  padding: 4px 0;
  border: 1px solid var(--canvas-border);
  border-radius: 8px;
  background: var(--canvas-surface);
  box-shadow: var(--canvas-shadow-strong);
}

.inspector__sort-dropdown-group {
  display: flex;
  flex-direction: column;
}

.inspector__sort-dropdown-divider {
  height: 1px;
  margin: 4px 0;
  background: var(--canvas-border);
}

.inspector__sort-dropdown-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 12px;
  border: 0;
  background: transparent;
  color: var(--canvas-text-muted);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.inspector__sort-dropdown-item:hover {
  background: var(--canvas-surface);
  color: var(--canvas-text);
}

.inspector__sort-dropdown-item--active {
  color: var(--canvas-text);
  font-weight: 600;
}

.inspector__toolbar {
  position: relative;
}

.workspace-tree {
  display: grid;
  gap: 1px;
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

/* 树形左侧引导线，让层级更清晰 */
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
</style>
