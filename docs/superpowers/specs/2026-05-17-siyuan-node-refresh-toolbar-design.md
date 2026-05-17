# 思源节点浮动刷新按钮设计

## 背景

当前画布中的文件节点已经支持解析为思源文档、思源块、图片或嵌套画布，并在卡片中展示预览内容。对于关联到思源笔记的文档节点或块节点，预览内容只会在节点创建、字段修改或编辑器初始化时刷新。用户在思源里更新原始文档或段落后，画布中的卡片内容不会主动同步，必须依赖重新打开或重新触发解析。

本次需求是在选中关联到思源笔记的节点时，在浮动工具栏增加一个刷新按钮。点击后应重新同步该节点对应的思源内容，并更新卡片中显示的最新文档内容或段落内容。

## 目标

- 在单选文件节点且该节点解析为思源文档或思源块时，浮动工具栏显示刷新按钮。
- 点击刷新按钮后，重新拉取最新 Markdown，并刷新卡片预览 HTML。
- 刷新仅影响当前被选中的思源节点，不修改节点引用值，不改变选区。
- 刷新失败时保留当前显示内容并给出错误提示。

## 方案对比

### 方案一：复用现有文件节点元数据刷新链路

为文件节点元数据层增加“定向刷新单个文件节点”的能力，工具栏按钮只负责调用该能力。

优点：
- 复用现有 `resolveCanvasFileTarget`、`withDocumentPreview`、`withBlockPreview` 逻辑，行为一致。
- 预览数据结构仍然统一存放在 `fileNodeMeta`，不会出现两套刷新路径。
- 后续如果要在别处复用“刷新当前思源节点”，可以直接调用同一个编辑器 API。

缺点：
- 需要把当前全量刷新逻辑抽成“解析单节点”辅助函数，再在全量刷新中复用。

### 方案二：按钮直接写一套专门的刷新逻辑

在点击按钮时读取当前选中节点，按类型分别请求思源文档或块内容并直接覆写缓存。

优点：
- 从交互入口看改动局部。

缺点：
- 会复制现有解析、预览装配和图片提取逻辑。
- 后续全量刷新与定向刷新容易行为分叉。

### 结论

采用方案一。将文件节点元数据解析收敛到单一入口，再在工具栏中暴露受控的刷新动作。

## 详细设计

### 显示条件

刷新按钮满足以下条件时显示：

- 浮动工具栏可见。
- 当前只选中一个节点。
- 选中节点类型为 `file`。
- 解析后的文件节点类型为 `document` 或 `block`。

以下情况不显示：

- 多选。
- 文本、链接、分组节点。
- 普通文件、图片、嵌套 canvas。

### 编辑器能力

在文件节点助手层新增两个能力：

- `refreshFileNodeMetadata(nodeIds?: string[])`
  - 无参数时保持现有全量刷新语义。
  - 传入 `nodeIds` 时仅重新解析这些文件节点并合并回已有 `fileNodeMeta`。
- `canRefreshSelectedSiyuanNode`
  - 基于当前单选节点和解析结果判断是否允许刷新。

同时在编辑器层新增：

- `refreshSelectedSiyuanNode()`
  - 如果当前节点不满足刷新条件，直接返回。
  - 满足条件时调用定向刷新。
  - 刷新成功后关闭颜色/布局弹层，但不清空选区。
  - 刷新失败时弹出错误提示并保留旧缓存。

### 数据流

1. 用户选中文件节点。
2. `selectionToolbar` 渲染时读取 `editor.canRefreshSelectedSiyuanNode`。
3. 用户点击刷新按钮。
4. `editor.refreshSelectedSiyuanNode()` 调用文件节点助手的定向刷新。
5. 助手重新执行：
   - `resolveCanvasFileTarget(node.file, ...)`
   - 若结果是 `block`，调用 `getSiyuanBlockMarkdown()` 并重新生成 `excerptHtml`
   - 若结果是 `document`，调用 `getSiyuanDocumentMarkdown()` 并重新生成 `excerptHtml`
6. `fileNodeMeta[node.id]` 更新后，卡片预览自动重渲染。

### 错误处理

- 单节点刷新失败时不清空原有 `fileNodeMeta[node.id]`。
- 编辑器通过 `showMessage` 给出通用错误提示，例如“无法刷新思源内容”。
- 若节点已不存在、不是文件节点、或当前不是思源文档/块节点，则刷新动作直接无副作用返回。

## 影响文件

- `src/canvas/use-canvas-editor-file-nodes.ts`
  - 抽取单个文件节点解析与富化逻辑，支持全量/定向刷新。
- `src/canvas/use-canvas-editor.ts`
  - 暴露刷新能力与按钮显示条件。
- `src/components/canvas/CanvasWorkspace.vue`
  - 在单选浮动工具栏中增加刷新按钮。
- `src/components/canvas/canvas-selection-toolbar-icon.ts`
  - 增加刷新按钮文案映射。
- `src/components/canvas/canvas-icon.ts`
  - 增加刷新图标。
- `src/i18n/zh_CN.json`
- `src/i18n/en_US.json`
  - 增加刷新按钮和错误提示文案。
- `tests/canvas-use-editor-actions.test.ts`
  - 验证定向刷新后预览内容更新。
- `tests/canvas-workspace.test.ts`
  - 验证刷新按钮显示条件与点击行为。

## 测试策略

- 编辑器层测试：
  - 创建思源文档文件节点，首次预览使用旧内容。
  - 更新 `getSiyuanDocumentMarkdown` mock 返回值。
  - 调用 `refreshSelectedSiyuanNode()`。
  - 断言 `previewHtml` 已变为新内容。
- 组件层测试：
  - 单选文件节点且 `getFileNodePreview(node).kind === 'document'` 时，显示刷新按钮。
  - 点击按钮会调用 `editor.refreshSelectedSiyuanNode()`。
  - 非思源节点或多选时不显示刷新按钮。

## 风险与约束

- 当前 `refreshFileNodeMetadata` 带有版本号并发保护，扩展为定向刷新时要避免全量刷新结果被旧的定向刷新覆盖，反之亦然。
- 工具栏按钮只应服务于思源文档/块节点，不能误显示给图片或普通文件节点，否则用户会期望不存在的同步行为。
- 保持现有工作区其他刷新逻辑不变，不引入自动轮询或隐式同步。
