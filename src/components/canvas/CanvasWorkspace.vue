<template>
  <div
    ref="canvasShellRef"
    class="canvas-shell"
    data-testid="canvas-shell"
  >
    <header
      class="toolbar"
      @pointerdown.capture="editor.deactivateCanvasSurface"
    >
      <div class="toolbar__group">
        <button
          class="toolbar__button toolbar__button--primary"
          @click="editor.newCanvas"
        >
          {{ t("toolbarNew") }}
        </button>
        <button
          class="toolbar__button"
          @click="editor.triggerImport"
        >
          {{ t("toolbarOpen") }}
        </button>
        <button
          class="toolbar__button"
          @click="editor.save"
        >
          {{ t("toolbarSave") }}
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
            @pointerdown.stop="handleNodePointerDown(node, $event)"
            @click.stop="handleNodeClick(node, $event)"
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
                  <div
                    v-if="editor.getFileNodePreview(node).kind === 'canvas' && editor.getFileNodePreview(node).thumbnail"
                    class="file-card__canvas-preview"
                  >
                    <svg
                      class="file-card__thumbnail"
                      :viewBox="getCanvasThumbnailViewBox(editor.getFileNodePreview(node).thumbnail)"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <path
                        v-for="(edge, edgeIndex) in editor.getFileNodePreview(node).thumbnail?.edges || []"
                        :key="`thumbnail-edge-${node.id}-${edgeIndex}`"
                        class="file-card__thumbnail-edge"
                        :d="`M ${edge.fromX} ${edge.fromY} L ${edge.toX} ${edge.toY}`"
                      />
                      <rect
                        v-for="(thumbnailNode, thumbnailIndex) in editor.getFileNodePreview(node).thumbnail?.nodes || []"
                        :key="`thumbnail-node-${node.id}-${thumbnailIndex}`"
                        class="file-card__thumbnail-node"
                        rx="16"
                        :height="thumbnailNode.height"
                        :width="thumbnailNode.width"
                        :x="thumbnailNode.x"
                        :y="thumbnailNode.y"
                      />
                    </svg>
                  </div>
                  <img
                    v-if="getFileCardImageSource(node)"
                    :src="getFileCardImageSource(node)"
                    alt=""
                    class="file-card__image"
                    @error="handleFileCardImageError(node)"
                  >
                  <div class="canvas-node__title">
                    {{ editor.getFileNodePreview(node).headline }}
                  </div>
                  <div class="canvas-node__meta">
                    {{ editor.getFileNodePreview(node).detail }}
                  </div>
                  <div
                    v-if="['block', 'document'].includes(editor.getFileNodePreview(node).kind) && editor.getFileNodePreview(node).previewHtml"
                    class="file-card__document-preview markdown-preview"
                    v-html="editor.getFileNodePreview(node).previewHtml"
                  />
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
                  {{ t("nodeLinkHelper") }}
                </div>
              </template>
              <template v-else>
                <div
                  class="canvas-node__content"
                  :style="getCanvasNodeContentStyle(node)"
                >
                  {{ node.label || t("nodeDefaultGroupLabel") }}
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
          v-if="editor.bottomToolbarVisible"
          class="bottom-toolbar"
          data-testid="bottom-toolbar"
          @click.stop
          @pointerdown.stop
        >
          <button
            class="bottom-toolbar__button"
            data-testid="bottom-toolbar-text"
            :aria-label="t('bottomToolbarText')"
            :title="t('bottomToolbarText')"
            type="button"
            @click.stop="editor.addNode('text')"
          >
            <SelectionToolbarIcon
              class="bottom-toolbar__icon"
              name="text"
            />
          </button>
          <button
            class="bottom-toolbar__button"
            data-testid="bottom-toolbar-file"
            :aria-label="t('bottomToolbarFile')"
            :title="t('bottomToolbarFile')"
            type="button"
            @click.stop="editor.openFilePickerDialog"
          >
            <SelectionToolbarIcon
              class="bottom-toolbar__icon"
              name="file"
            />
          </button>
          <button
            class="bottom-toolbar__button"
            data-testid="bottom-toolbar-connect"
            :aria-label="t('bottomToolbarConnect')"
            :title="t('bottomToolbarConnect')"
            type="button"
            @click.stop="editor.openCreateEdgeDialog"
          >
            <SelectionToolbarIcon
              class="bottom-toolbar__icon"
              name="connect"
            />
          </button>
          <button
            class="bottom-toolbar__button"
            data-testid="bottom-toolbar-group"
            :aria-label="t('bottomToolbarGroup')"
            :title="t('bottomToolbarGroup')"
            type="button"
            @click.stop="editor.addNode('group')"
          >
            <SelectionToolbarIcon
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

    <div
      v-if="editor.createEdgeDialog.visible"
      class="canvas-dialog-backdrop"
      data-testid="create-edge-dialog"
      @click.self="editor.closeCreateEdgeDialog"
    >
      <div class="canvas-dialog">
        <div class="canvas-dialog__header">
          <h2>{{ t("createEdgeDialogTitle") }}</h2>
        </div>
        <div class="canvas-dialog__field">
          <span>{{ t("fieldSourceNode") }}</span>
          <div
            ref="sourceEdgePickerRef"
            class="canvas-node-picker"
          >
            <button
              class="canvas-node-picker__trigger canvas-dialog__control"
              data-testid="create-edge-source-trigger"
              type="button"
              @click="toggleEdgeNodePicker('source')"
            >
              <span class="canvas-node-picker__trigger-label">{{ getEdgeNodeTriggerLabel('source') }}</span>
              <span class="canvas-node-picker__trigger-chevron">{{ activeEdgeNodePicker === 'source' ? '▴' : '▾' }}</span>
            </button>
            <div
              v-if="activeEdgeNodePicker === 'source'"
              class="canvas-node-picker__panel"
            >
              <input
                ref="sourceEdgeSearchRef"
                v-model="editor.newEdgeSourceQuery"
                class="canvas-dialog__control canvas-node-picker__search"
                data-testid="create-edge-source-query"
                :placeholder="t('fieldSearchNodePlaceholder')"
              >
              <div
                class="canvas-node-picker__options"
                data-testid="create-edge-source-options"
              >
                <button
                  v-for="node in editor.edgeSources"
                  :key="node.id"
                  class="canvas-node-picker__option"
                  data-testid="create-edge-source-option"
                  type="button"
                  @click="selectEdgeNodeOption('source', node.id)"
                >
                  {{ editor.getNodeTitle(node) }}
                </button>
                <p
                  v-if="editor.edgeSources.length === 0"
                  class="canvas-node-picker__empty"
                >
                  {{ t("fieldNoMatchingNodes") }}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div class="canvas-dialog__field">
          <span>{{ t("fieldTarget") }}</span>
          <div
            ref="targetEdgePickerRef"
            class="canvas-node-picker"
          >
            <button
              class="canvas-node-picker__trigger canvas-dialog__control"
              data-testid="create-edge-target-trigger"
              type="button"
              @click="toggleEdgeNodePicker('target')"
            >
              <span class="canvas-node-picker__trigger-label">{{ getEdgeNodeTriggerLabel('target') }}</span>
              <span class="canvas-node-picker__trigger-chevron">{{ activeEdgeNodePicker === 'target' ? '▴' : '▾' }}</span>
            </button>
            <div
              v-if="activeEdgeNodePicker === 'target'"
              class="canvas-node-picker__panel"
            >
              <input
                ref="targetEdgeSearchRef"
                v-model="editor.newEdgeTargetQuery"
                class="canvas-dialog__control canvas-node-picker__search"
                data-testid="create-edge-target-query"
                :placeholder="t('fieldSearchNodePlaceholder')"
              >
              <div
                class="canvas-node-picker__options"
                data-testid="create-edge-target-options"
              >
                <button
                  v-for="node in editor.edgeTargets"
                  :key="node.id"
                  class="canvas-node-picker__option"
                  data-testid="create-edge-target-option"
                  type="button"
                  @click="selectEdgeNodeOption('target', node.id)"
                >
                  {{ editor.getNodeTitle(node) }}
                </button>
                <p
                  v-if="editor.edgeTargets.length === 0"
                  class="canvas-node-picker__empty"
                >
                  {{ t("fieldNoMatchingNodes") }}
                </p>
              </div>
            </div>
          </div>
        </div>
        <label class="canvas-dialog__field">
          {{ t("fieldEdgeLabel") }}
          <input
            v-model="editor.newEdgeLabel"
            class="canvas-dialog__control"
          >
        </label>
        <div class="canvas-dialog__row">
          <label class="canvas-dialog__field">
            <span>{{ t("fieldFromSide") }}</span>
            <select
              v-model="editor.newEdgeFromSide"
              class="canvas-dialog__control"
            >
              <option
                v-for="side in editor.sides"
                :key="side"
                :value="side"
              >{{ getSideLabel(side) }}</option>
            </select>
          </label>
          <label class="canvas-dialog__field">
            <span>{{ t("fieldToSide") }}</span>
            <select
              v-model="editor.newEdgeToSide"
              class="canvas-dialog__control"
            >
              <option
                v-for="side in editor.sides"
                :key="side"
                :value="side"
              >{{ getSideLabel(side) }}</option>
            </select>
          </label>
        </div>
        <div class="canvas-dialog__actions">
          <button
            class="toolbar__button"
            type="button"
            @click="editor.closeCreateEdgeDialog"
          >
            {{ t("dialogCancel") }}
          </button>
          <button
            class="toolbar__button toolbar__button--primary"
            type="button"
            @click="editor.submitCreateEdgeDialog"
          >
            {{ t("inspectorCreateEdgeAction") }}
          </button>
        </div>
      </div>
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

import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue"
import type { CanvasTabBootstrap } from "@/main"
import { useCanvasEditor } from "@/canvas/use-canvas-editor"
import {
  SELECTION_LAYOUT_ICON_NAMES,
  SelectionToolbarIcon,
  createSelectionToolbarTooltips,
} from "@/components/canvas/canvas-selection-toolbar-icon"
import {
  CLEAR_SELECTION_COLOR,
  getCanvasNodeContentStyle as resolveCanvasNodeContentStyle,
  getCanvasNodeStyle as buildCanvasNodeStyle,
  getSelectionColorStyle as resolveSelectionColorStyle,
} from "@/components/canvas/canvas-workspace-display"
import { useCanvasWorkspaceBehavior } from "@/components/canvas/use-canvas-workspace-behavior"
import { createCanvasI18n } from "@/i18n/canvas"
import type { CanvasNode } from "@/canvas/types"

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
  setEditingTextareaRef,
  setSelectionToolbarRef,
} = useCanvasWorkspaceBehavior(editor)
type EdgeNodePickerKind = "source" | "target"

const activeEdgeNodePicker = ref<EdgeNodePickerKind | null>(null)
const fileCardImageOverrides = ref<Record<string, string>>({})
const sourceEdgePickerRef = ref<HTMLElement>()
const sourceEdgeSearchRef = ref<HTMLInputElement>()
const targetEdgePickerRef = ref<HTMLElement>()
const targetEdgeSearchRef = ref<HTMLInputElement>()

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

function getEdgeNodeTriggerLabel(kind: EdgeNodePickerKind): string {
  const nodeId = kind === "source" ? editor.newEdgeSourceId : editor.newEdgeTargetId
  const fallbackLabel = kind === "source" ? t("fieldSelectSourceNode") : t("fieldSelectTargetNode")
  const node = editor.state.document.nodes.find((candidate) => candidate.id === nodeId)
  return node ? editor.getNodeTitle(node) : fallbackLabel
}

function toggleEdgeNodePicker(kind: EdgeNodePickerKind) {
  const nextValue = activeEdgeNodePicker.value === kind ? null : kind
  activeEdgeNodePicker.value = nextValue

  if (nextValue === null) {
    return
  }

  if (kind === "source") {
    editor.newEdgeSourceQuery = ""
  } else {
    editor.newEdgeTargetQuery = ""
  }

  void nextTick(() => {
    if (kind === "source") {
      sourceEdgeSearchRef.value?.focus()
      return
    }

    targetEdgeSearchRef.value?.focus()
  })
}

function selectEdgeNodeOption(kind: EdgeNodePickerKind, nodeId: string) {
  if (kind === "source") {
    editor.setNewEdgeSourceId(nodeId)
  } else {
    editor.setNewEdgeTargetId(nodeId)
  }

  activeEdgeNodePicker.value = null
}

function handleWindowPointerDown(event: PointerEvent) {
  if (!(event.target instanceof HTMLElement)) {
    activeEdgeNodePicker.value = null
    return
  }

  if (
    sourceEdgePickerRef.value?.contains(event.target)
    || targetEdgePickerRef.value?.contains(event.target)
  ) {
    return
  }

  activeEdgeNodePicker.value = null
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

function getCanvasNodeStyle(node: CanvasNode) {
  return buildCanvasNodeStyle(node, editor.getNodeStyle(node))
}

function getCanvasNodeContentStyle(node: CanvasNode) {
  return resolveCanvasNodeContentStyle(node)
}

function getFileCardImageCandidates(source: string): string[] {
  const normalized = source.trim().replace(/\\/g, "/")
  if (!normalized) {
    return []
  }

  const candidates = [normalized]

  if (/^\/data\/assets\//i.test(normalized)) {
    candidates.push(normalized.replace(/^\/data\/assets\//i, "/assets/"))
  } else if (/^data\/assets\//i.test(normalized)) {
    candidates.push(`/${normalized}`)
    candidates.push(normalized.replace(/^data\/assets\//i, "/assets/"))
  } else if (/^\/assets\//i.test(normalized)) {
    candidates.push(normalized.replace(/^\/assets\//i, "/data/assets/"))
  } else if (/^assets\//i.test(normalized)) {
    candidates.push(`/data/${normalized}`)
    candidates.push(`/${normalized}`)
  }

  return [...new Set(candidates.filter(Boolean))]
}

function getFileCardImageSource(node: CanvasNode): string | undefined {
  if (node.type !== "file") {
    return undefined
  }

  const preview = editor.getFileNodePreview(node)
  if (!preview.imageSrc) {
    return undefined
  }

  const candidates = getFileCardImageCandidates(preview.imageSrc)
  const override = fileCardImageOverrides.value[node.id]
  return override && candidates.includes(override) ? override : candidates[0]
}

function handleFileCardImageError(node: CanvasNode) {
  if (node.type !== "file") {
    return
  }

  const preview = editor.getFileNodePreview(node)
  if (!preview.imageSrc) {
    return
  }

  const candidates = getFileCardImageCandidates(preview.imageSrc)
  const currentSource = getFileCardImageSource(node)
  const currentIndex = currentSource ? candidates.indexOf(currentSource) : -1
  const nextSource = candidates[currentIndex + 1]

  if (!nextSource || nextSource === currentSource) {
    return
  }

  fileCardImageOverrides.value = {
    ...fileCardImageOverrides.value,
    [node.id]: nextSource,
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

onMounted(() => {
  window.addEventListener("pointerdown", handleWindowPointerDown)
})

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", handleWindowPointerDown)
})

watch(
  () => editor.createEdgeDialog.visible,
  (visible) => {
    if (!visible) {
      activeEdgeNodePicker.value = null
    }
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

.bottom-toolbar {
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
