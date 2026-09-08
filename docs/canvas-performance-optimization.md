# 思源画布（siyuan-canvas）大规模节点性能瓶颈深度分析与建议方案

## 1. 概述与现状分析

在思源画布（siyuan-canvas）的使用过程中，随着画布复杂度的增加（如知识图谱梳理、书籍框架整理、大规模文献笔记拼贴等），画布内包含的节点数量常常会达到 **100 ~ 500+** 个，连线条数达到 **100 ~ 1000+** 条。

在此类大规模节点场景下，用户会明显感知到操作性能的恶化：
1. **画布平移（Pan）与缩放（Zoom）卡顿**：拖拽画布或滚轮缩放时帧率严重下降（跌至 10~30 FPS 以下），伴随画面明显掉帧与撕裂感。
2. **节点拖拽移动（Drag）严重掉帧甚至假死**：当拖拽卡片或多选卡片移动时，光标与卡片位置不同步，产生严重拖尾和数百毫秒至数秒的界面冻结。
3. **选区操作与节点点击延迟**：点击选中卡片、拉框多选时响应迟缓，界面反应慢半拍。
4. **内存占用居高不下与浏览器进程风扇狂转**：CPU 核心长期处于高负载状态，随着操作次数增加，垃圾回收（GC）停顿日益明显。

本文基于当前代码库的渲染架构、数据流驱动模型以及组件生命周期，进行全链路深度分析，定位卡顿根源，并提供分阶段、可落地的优化演进方案。

---

## 2. 核心性能瓶颈深度根因分析

经过对源码的深度跟踪和渲染管线排查，导致卡顿的核心瓶颈主要分布在 **DOM 树与渲染模型**、**Vue 响应式与数据流**、**算法复杂度与模板求值** 以及 **原生渲染副作用** 四个层级。

```
                                  性能瓶颈全景图
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. DOM & 渲染树层级                                                         │
│   ├─ 缺少视口虚拟化：所有节点不论可视与否全部实打实常驻 DOM (v-for 全量)     │
│   ├─ 卡片控制手柄膨胀：每个节点无条件挂载 13 个把手 (500 节点 = 6500+ 个按钮) │
│   ├─ 巨型双层 SVG：尺寸达数万像素，双层叠加，边路径每条重复渲染 3 次          │
│   └─ Link 节点 iframe 全量驻留：未受控的第三方页面与视频播放器争抢 GPU       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. 交互与状态提交层级                                                       │
│   ├─ PointerMove 帧级调用 commitDocument：一秒数十次深拷贝快照与历史记录     │
│   ├─ 每一帧触发全量 validateCanvasDocument 校验与全量搜索索引更新            │
│   └─ Board Metrics 漂移效应：拖拽越界导致 board.left 变动，引发全局 Reflow   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. 算法与模板求值层级                                                       │
│   ├─ 连线路径复杂度 O(E × N)：数组线性 find() 查找两端节点，无索引与缓存    │
│   ├─ Markdown 模板实时同步编译：每次响应式变动导致数百节点重复执行 Marked    │
│   ├─ FileCard 重复求值：单卡片在模板与辅助函数中重复调用 8 次预览方法       │
│   └─ 装饰与选区判定：线性遍历 searchDecorations 与数组 includes             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. 响应式系统与副作用层级                                                   │
│   ├─ watch(nodes, { deep: true })：深度监听大数组，全属性变更递归比对       │
│   ├─ 整个 CanvasEditorState 被 reactive() 深度代理包裹                       │
│   └─ v-native-render 重复触发：每次 updated 均执行 querySelectorAll 与 Protyle│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.1 DOM 树与渲染模型瓶颈（DOM & Render Tree）

#### 2.1.1 缺少视口虚拟化（No Viewport Culling / Virtualization）
- **源码定位**：`src/components/canvas/CanvasWorkspace.vue` 第 525 行
  ```html
  <article
    v-for="node in editor.displayNodes"
    :key="node.id"
    class="canvas-node"
    ...
  >
  ```
- **原因剖析**：
  画布没有实现**视口裁剪（Culling）**或**虚拟滚动（Virtualization）**。当画布中有 500 个块时，即便用户当前视口（Viewport）仅能看到屏幕中央的 10 个块，屏幕可视区域外的 490 个块依然完整地存在于 DOM 树中。
- **性能代价**：
  现代浏览器对于包含数千个拥有复杂阴影、圆角、内联样式、富文本内容的 DOM 元素，在进行样式重计算（Recalculate Style）、重排（Reflow/Layout）以及图层合成（Composite/Rasterize）时，计算耗时与 DOM 节点数量呈超线性关系。平移画布时，即便利用了 CSS `transform`，超大面积的合成层也极其消耗显存和 GPU 栅格化性能。

#### 2.1.2 控制手柄（Resize Handles & Anchors）静态挂载引发 DOM 爆炸
- **源码定位**：`src/components/canvas/CanvasWorkspace.vue` 第 831~862 行
  ```html
  <template v-if="!node.collapsed">
    <!-- 4 个连接锚点按钮 -->
    <button v-for="side in editor.sides" class="canvas-node__anchor" ... />
    <!-- 8 个方向调整尺寸按钮 -->
    <button v-for="segment in NODE_RESIZE_SEGMENTS" class="canvas-node__resize-handle" ... />
    <!-- 1 个右下角缩放把手按钮 -->
    <button class="canvas-node__resize-corner" ...>
  </template>
  ```
- **原因剖析**：
  每一个处于非折叠状态的节点，其模板内都直接渲染了：
  - 4 个连线锚点（Anchor）
  - 8 个边界尺寸把手（Resize Handle）
  - 1 个右下角角标把手（Corner Handle）
- **性能代价**：
  每个节点额外固定产生 **13 个 DOM 按钮节点**。
  若画布中有 500 个节点，仅把手按钮就产生了：
  $$500 \times 13 = 6,500 \text{ 个 DOM 元素}$$
  加上卡片内部的 header、body、markdown 标签等，整个 DOM 树的节点总数迅速突破 **15,000 ~ 25,000** 个。然而在绝大多数时间里，用户只会与当前选中的 1 个或数个节点交互，未选中节点的控制把手完全是静止且无用的 DOM 负担。

#### 2.1.3 巨型双层 SVG 画布全量重绘
- **源码定位**：`src/components/canvas/CanvasWorkspace.vue` 第 392~503 行 与 第 865~903 行
- **原因剖析**：
  1. 画布上存在两个与 `board` 等宽等高的巨大 `<svg>` 元素：一个用于基础路径渲染（`.stage__edges`），另一个用于交互覆盖与热区捕获（`.stage__edges--interactive`）。
  2. `board.width` 与 `board.height` 在节点分布散开时，动辄达到 $10,000 \text{px} \times 10,000 \text{px}$ 甚至更大。
  3. 对于每条连线（Edge），系统在 SVG 中重复渲染了：
     - 底层基础路径 `<path class="stage__edge" />`
     - 交互高亮路径 `<path class="stage__edge stage__edge--overlay" />`
     - 交互命中区域 `<path class="stage__edge stage__edge--hit-area" />`
     - 标签文本 `<text class="stage__edge-label" />`
- **性能代价**：
  500 条边意味着生成超过 1500 个复杂的贝塞尔曲线 SVG `<path>` 元素。超大尺寸的 SVG 容器使得浏览器无法高效进行局部重绘缓存，任何路径数据的变动都会迫使浏览器重新解析并栅格化大面积矢量图形。

#### 2.1.4 Link 节点 iframe 全量加载与 GPU 抢占
- **源码定位**：`src/components/canvas/CanvasWorkspace.vue` 第 622~634 行
- **原因剖析**：
  如果用户在画布中添加了网页链接或 Bilibili 视频卡片，每个卡片都会直接创建一个真实的 `<iframe>`。
- **性能代价**：
  虽然使用了 `loading="lazy"`，但在画布平移穿过这些节点时，浏览器会为每一个 iframe 初始化独立的渲染上下文，消耗数以百兆计的内存与 GPU 进程资源，严重影响主界面平滑度。

---

### 2.2 交互与状态提交层级（Interaction & Commit Pipeline）

#### 2.2.1 拖拽中每一帧（PointerMove）高频全量提交（Unthrottled `commitDocument`）
- **源码定位**：`src/canvas/use-canvas-editor-gestures.ts` 第 521~545 行 与 `src/canvas/use-canvas-editor.ts` 第 678~693 行
  ```ts
  // use-canvas-editor-gestures.ts: startDrag
  startPointerGesture(event, (dx, dy, moveEvent) => {
    // ... 对齐计算 ...
    const movedDocument = state.document.nodes.reduce(...)
    commitDocument(movedDocument, { coalesceKey: `drag-${node.id}` })
  })

  // use-canvas-editor.ts: commitDocument
  function commitDocument(nextDocument: CanvasDocument, options: { coalesceKey?: string } = {}) {
    history.record(
      {
        document: cloneCanvasDocument(state.document), // 1. 全量深拷贝
        selectedNodeIds: [...state.selectedNodeIds],
        ...
      },
      { coalesceKey: options.coalesceKey },
    )
    historyVersion.value++
    state.patchDocument(nextDocument)                // 2. 替换响应式对象
    state.issues = validateCanvasDocument(nextDocument) // 3. 全量规范性校验
    notifyCanvasSearchChanged()                      // 4. 触发搜索更新
  }
  ```
- **原因剖析**：
  当用户在画布上按住并拖动卡片时，鼠标每移动 1 个像素就会触发一次 `pointermove`（每秒可达 60~120 次）。在每一次移动的回调中，系统**同步**执行了：
  1. `cloneCanvasDocument(state.document)`：使用递归/解构对**整个画布文档进行完全深拷贝**（即便是 coalesce 合并历史，快照也是在调用前无条件深拷贝创建的）；
  2. `state.patchDocument(nextDocument)`：替换响应式 `document` 对象；
  3. `validateCanvasDocument(nextDocument)`：遍历所有节点和连线执行 JSON Canvas 规范全量校验；
  4. `notifyCanvasSearchChanged()`：通知画布搜索索引更新。
- **性能代价**：
  高频运行下，每秒产生数百个大型无用临时对象，瞬间占满 V8 新生代内存，引发高频的垃圾回收（GC Minor/Major Pause），直接导致主线程严重掉帧、卡死。

#### 2.2.2 画布外包围盒（Board Metrics）偏移导致“全局样式重排多米诺”
- **源码定位**：`src/canvas/board.ts` 与 `src/canvas/use-canvas-editor.ts` 第 604~611 行
  ```ts
  function getNodeStyle(node: CanvasNode) {
    return {
      height: `${node.height}px`,
      left: `${toBoardX(board.value, node.x)}px`, // node.x - board.left
      top: `${toBoardY(board.value, node.y)}px`,  // node.y - board.top
      width: `${node.width}px`,
    }
  }
  ```
- **原因剖析**：
  节点的绝对定位 `left` 和 `top` 是以 `board.left` 和 `board.top` 为原点相对计算的。`board` 由所有节点的包围盒加上 padding 计算而来。
- **性能代价**：
  当用户将某个节点往左或往上拖拽越过原包围盒边界时，`board.left` 或 `board.top` 会随之变化。由于所有节点的 `left/top` 样式都绑定了 `board.value`，这会导致**全画布所有原本静止的 500 个节点**的 CSS `left` 和 `top` 属性全部同步发生变动，迫使浏览器引擎对整个画布图层执行全量 Reflow（重排）！

---

### 2.3 算法复杂度与模板求值瓶颈（Algorithm & Template Invocation）

#### 2.3.1 连线路径计算的高阶复杂度：$O(E \times N)$ 暴击
- **源码定位**：`src/canvas/use-canvas-editor.ts` 第 621~646 行
  ```ts
  function getEdgePath(edge: CanvasEdge): string {
    const fromNode = state.document.nodes.find((node) => node.id === edge.fromNode)
    const toNode = state.document.nodes.find((node) => node.id === edge.toNode)
    if (!fromNode || !toNode) return ""
    // ...
  }
  ```
- **原因剖析**：
  1. `getEdgePath` 与 `getEdgeLabelPosition` 通过 `state.document.nodes.find(...)` 在**普通数组中进行线性查找**。
  2. 在模板中，每条边渲染时，基础路径、overlay 路径、hit-area 路径以及 label 定位分别独立调用了 `getEdgePath` 和 `getEdgeLabelPosition`（单条边单次渲染调用 3~4 次）。
- **性能代价**：
  假设画布有 $N$ 个节点、$E$ 条边，单次连线渲染的查找比对次数为：
  $$\text{查找次数} \approx 4 \times E \times (2 \times N) = 8 \times E \times N$$
  当 $N = 500, E = 500$ 时：
  $$\text{查找次数} \approx 8 \times 500 \times 500 = 2,000,000 \text{ 次比对}$$
  每次拖动只要触发一次重新渲染，就需要在模板求值中执行 **200 万次** 循环比对！完全没有任何按 ID 索引的 `Map` 查找或路径缓存机制。

#### 2.3.2 文本节点 Markdown 模板同步解析且无内容缓存
- **源码定位**：`src/components/canvas/CanvasWorkspace.vue` 第 3466~3480 行 与 `src/canvas/markdown-preview.ts` 第 522 行
  ```html
  <!-- 模板中 -->
  <div class="canvas-node__content markdown-preview" v-html="renderCanvasTextNodeContent(node)" />
  ```
  ```ts
  // 辅助函数中
  function renderCanvasTextNodeContent(node: CanvasNode) {
    // ...
    const html = editor.getRenderedMarkdown(markdown) // 同步调用 renderMarkdownPreview
    for (const source of collectWorkspaceStorageImages(html)) {
      void loadTextMarkdownImageBlobUrl(source)
    }
    return applyTextMarkdownImageBlobUrls(html)
  }
  ```
- **原因剖析**：
  1. `renderCanvasTextNodeContent(node)` 在 Vue 模板求值阶段直接执行。
  2. `renderMarkdownPreview` 内部执行复杂的正则占位、代码块提取与还原、`Marked.parse` 词法解析、HTML Sanitize 过滤等重型 CPU 计算。
  3. 该过程**没有任何基于文本内容哈希或 mtime 的缓存机制（Memoization）**。
- **性能代价**：
  当画布有 200 个文本卡片时，任何非相关的状态变动（如仅仅是拉出一个选框、选中另外一个卡片、或者移动一个小方块）导致模板更新时，这 200 个文本节点的 Markdown **全部无差别地重新执行一遍完整的正则与编译流程**！

#### 2.3.3 File 节点预览在模板渲染中重复求值达 8 次
- **源码定位**：`src/components/canvas/CanvasWorkspace.vue` 第 595~603 行 与其关联函数
- **原因剖析**：
  在单次渲染单个 File 节点时，模板及其辅助函数中分别调用：
  - `:canvas-thumbnail-view-box="getCanvasThumbnailViewBox(editor.getFileNodePreview(node).thumbnail)"`（第 595 行）
  - `:preview="editor.getFileNodePreview(node)"`（第 599 行）
  - `getFileCardImageSource(node)`（内部调用）
  - `shouldShowFileCardHeadline(node)`（内部调用）
  - `shouldShowFileCardDetail(node)`（内部调用）
  - `shouldShowFileCardHelper(node)`（内部调用）
  - `getFileCardTooltip(node)`（内部调用）
  - `getFileCardDocumentPreviewHtml(node)`（内部调用）
- **性能代价**：
  每个 File 节点单次渲染被调用 **8 次** `editor.getFileNodePreview(node)`，每次重新组装返回包含标题、缩略图、文件路径信息的复合对象，加剧了 CPU 冗余计算与内存分配。

#### 2.3.4 搜索装饰与选中态判定的数组遍历
- **源码定位**：`src/components/canvas/CanvasWorkspace.vue` 第 3445~3453 行
  ```ts
  function hasCanvasSearchMatch(nodeId: string) {
    return (editor.searchDecorations ?? []).some(decoration => decoration.targetId.startsWith(`node:${nodeId}:`))
  }
  ```
- **原因剖析**：
  每个节点的 class 属性在每次重新计算时，都会对 `searchDecorations` 数组进行 `some` 和 `startsWith` 线性前缀匹配；`selectedNodeIds.includes(node.id)` 也在对数组进行线性查找。

---

### 2.4 响应式系统与三方原生渲染瓶颈（Reactivity & Native Render）

#### 2.4.1 `nodes` 大数组被 `{ deep: true }` 深度监听
- **源码定位**：`src/components/canvas/CanvasWorkspace.vue` 第 2422~2474 行
  ```ts
  watch(
    () => editor.state.document.nodes,
    (newNodes) => {
      // 遍历所有 query 节点、对比已有定时器、创建/清理轮询
    },
    { deep: true, immediate: true }
  )
  ```
- **原因剖析**：
  Vue 的 `deep: true` 监听器会递归收集被监听对象中所有嵌套属性的依赖。在大数组场景下，任何一个节点只要发生位置变化（x 或 y 改动 1px），Vue 必须在底层遍历整棵对象树进行深层比对，并且该回调函数会被无节制地频繁触发。

#### 2.4.2 整个 `CanvasEditorState` 被深度 `reactive()` 包裹
- **源码定位**：`src/canvas/use-canvas-editor.ts` 第 138 行
  ```ts
  const state = reactive(new CanvasEditorState(fileService))
  ```
- **原因剖析**：
  `state.document` 包含成千上万个嵌套对象（每个节点的属性、每条边、历史记录引用等）。Vue 3 的深度 Proxy 在每次读取和修改任意属性时都会介入拦截，带来不容忽视的响应式系统开销。

#### 2.4.3 `v-native-render` 指令无差别、多入口重复触发
- **源码定位**：`src/components/canvas/CanvasWorkspace.vue` 第 2265~2272 行 与 `src/components/canvas/CanvasFileCard.vue` 第 98~115 行
- **原因剖析**：
  1. `v-native-render` 挂载在每个文本与文件容器上，其 `updated` 钩子会在每次 DOM 刷新时执行 `triggerNativeProtyleRender(el)`。
  2. `triggerNativeProtyleRender` 内部无差别执行 `querySelectorAll` 扫描 Mermaid、ECharts、MathJax、Flowchart。
  3. 与此同时，子组件 `CanvasFileCard.vue` 自身又在 `onUpdated` 与 `watch(() => props.documentPreviewHtml)` 中再次调用 `triggerNativeProtyleRender`。
- **性能代价**：
  DOM 更新时，每个卡片都在深层遍历子节点，尝试调用思源原生 Protyle 渲染引擎，造成严重的 JavaScript 阻塞。

---

## 3. 系统性优化方案与实施路线图

针对上述四大层面的瓶颈，我们提出**分阶段、由浅入深、收益递增**的重构与优化方案。

```
                              优化实施路线图
┌─────────────────────────────────────────────────────────────────────────────┐
│ 阶段一：立竿见影的“快赢”优化（Quick Wins，预估工作量：1~2天，收益：显著）     │
│  ├─ 1. 连线节点查找索引化（Map 代替 Array.find，复杂度 O(E×N) -> O(E)）       │
│  ├─ 2. Markdown 渲染结果基于内容的 LRU 缓存（消除无意义的重复解析）           │
│  ├─ 3. 控制手柄“按需/延迟”渲染（仅选中或 Hover 渲染，削减 85% 无用 DOM）      │
│  ├─ 4. 拖拽与高频交互 rAF 节流 + 暂态坐标（取消移动每一帧的 commitDocument）  │
│  └─ 5. 移除 nodes 大数组的 deep watch，优化搜索与选区 Set 查找                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 阶段二：渲染管线与视口裁剪（Virtualization，预估工作量：3~5天，收益：极大）   │
│  ├─ 1. 视口可见性计算与卡片虚拟化裁剪（视口外卡片降级为轻量 Skeleton 或不渲染）│
│  ├─ 2. SVG 连线视口裁剪与双层合一（两端均在视口外的边不渲染）                 │
│  ├─ 3. 坐标原点解耦（基于固定局部原点，避免 board.left 变动引发全体 Reflow） │
│  └─ 4. 原生 Protyle 渲染调度防抖与视口懒执行                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 阶段三：极致体验与架构演进（Architecture Evolution，预估工作量：5~8天）       │
│  ├─ 1. 多层级细节展示（LOD - Level of Detail，大缩放鸟瞰图极简化渲染）       │
│  ├─ 2. 状态树轻量化重构（避免全量 deep reactive 与历史记录结构性共享）       │
│  └─ 3. WebGL / Canvas 混合底图渲染探索（大图谱连线与小地图硬加速）           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.1 阶段一：立竿见影的“快赢”优化（Quick Wins）

这些改动**不改变现有架构和用户交互体验**，改动成本低、风险小，但能立刻解除最严重的 CPU 浪费。

#### 方案 1.1：建立节点索引 Map，连线计算从 $O(E \times N)$ 降至 $O(E)$
- **实现原理**：
  在 `use-canvas-editor.ts` 中维护一个由 `state.document.nodes` 派生的计算属性 `nodeMap = computed(() => new Map(nodes.map(n => [n.id, n])))`。
  连线路径查找直接从 `Map` 取值（$O(1)$），彻底废除 `nodes.find`。
- **重构示例**：
  ```ts
  // 1. 建立基于 Map 的 O(1) 索引
  const nodeMap = computed(() => {
    const map = new Map<string, CanvasNode>()
    for (const node of state.document.nodes) {
      map.set(node.id, node)
    }
    return map
  })

  // 2. 优化 getEdgePath，复杂度由 O(N) 降至 O(1)
  function getEdgePath(edge: CanvasEdge): string {
    const fromNode = nodeMap.value.get(edge.fromNode)
    const toNode = nodeMap.value.get(edge.toNode)
    if (!fromNode || !toNode) return ""

    const from = getAnchor(fromNode, edge.fromSide)
    const to = getAnchor(toNode, edge.toSide)
    return createEdgeCurvePath(from, edge.fromSide, to, edge.toSide)
  }
  ```
- **收益**：500 节点 500 边时，单次渲染的比对次数从 **2,000,000 次骤降至 1,000 次**，连线相关的 CPU 耗时降低 95% 以上。

#### 方案 1.2：Markdown 编译结果加入内容缓存（Memoization）
- **实现原理**：
  使用简单的 `LRUCache<string, string>`（如上限 500 条）或者基于文本内容的哈希缓存。只要 `node.text` 没有发生实质变化，直接返回缓存好的 HTML 字符串，不再重复执行 Marked 解析、正则替换及图片提取。
- **重构示例**：
  ```ts
  // src/canvas/markdown-preview-cache.ts
  const markdownRenderCache = new Map<string, string>()
  const MAX_CACHE_SIZE = 600

  export function getCachedMarkdownPreview(markdown: string): string {
    if (!markdown) return ""
    const cached = markdownRenderCache.get(markdown)
    if (cached !== undefined) {
      return cached
    }

    const rendered = renderMarkdownPreview(markdown)
    if (markdownRenderCache.size >= MAX_CACHE_SIZE) {
      // 简单淘汰最旧的 100 条
      const keysToDelete = Array.from(markdownRenderCache.keys()).slice(0, 100)
      for (const key of keysToDelete) markdownRenderCache.delete(key)
    }
    markdownRenderCache.set(markdown, rendered)
    return rendered
  }
  ```
- **收益**：彻底消除拖动、多选、平移时由于响应式重绘引发的几百个文本卡片全量重新解析 Markdown 的灾难性卡顿。

#### 方案 1.3：控制手柄按需渲染（Conditional Handles）
- **实现原理**：
  修改 `CanvasWorkspace.vue` 中的把手渲染逻辑。**只有当卡片处于 `selected`（被选中）或 `hovered`（鼠标悬浮）状态时**，才渲染 4 个锚点按钮、8 个尺寸拉伸按钮和 1 个缩放角标。
- **重构示例**：
  ```html
  <!-- 仅在需要交互时才渲染控制把手，平时完全不占用 DOM -->
  <template v-if="!node.collapsed && (editor.state.selectedNodeIds.includes(node.id) || hoveredNodeId === node.id)">
    <button
      v-for="side in editor.sides"
      :key="`anchor-${node.id}-${side}`"
      class="canvas-node__anchor"
      ...
    />
    <button
      v-for="segment in NODE_RESIZE_SEGMENTS"
      :key="`resize-${node.id}-${segment.id}`"
      class="canvas-node__resize-handle"
      ...
    />
    <button
      class="canvas-node__resize-corner"
      ...
    />
  </template>
  ```
- **收益**：DOM 树中的控制按钮数量直接从 **6,500+ 个骤降至几十个**，立刻削减整张画布 **60% ~ 80% 的 DOM 节点总数**！

#### 方案 1.4：拖拽解耦与 rAF 帧节流（Ephemeral Dragging）
- **实现原理**：
  在节点拖拽过程中：
  1. **不要在每一帧 `pointermove` 中调用 `commitDocument`**；
  2. 拖拽过程中只维护一个局部的 `dragOffsets: Map<string, { dx: number, dy: number }>`；
  3. 使用 `requestAnimationFrame`（rAF）合并高频的 `pointermove` 事件；
  4. 只有在鼠标松开（`pointerup`）时，才调用一次 `commitDocument` 固化最终坐标与历史记录栈。
- **收益**：拖拽节点时的深拷贝次数从每秒 **60~120 次减少到仅在松开时执行 1 次**！彻底根除拖拽掉帧与垃圾回收停顿。

#### 方案 1.5：移除对 `nodes` 的 deep watch 与优化辅助查找
- **实现原理**：
  1. 移除 `CanvasWorkspace.vue` 中的 `watch(() => editor.state.document.nodes, ..., { deep: true })`，改为只监听由 `query` 节点的 `id`、`sql`、`refreshInterval` 拼接的签名字符串，或者仅监听节点增删；
  2. 将 `selectedNodeIds` 和 `searchDecorations` 转换为 `Set`，使得 `isNodeSelected(id)` 变为 $O(1)$。

---

### 3.2 阶段二：视口裁剪与渲染管线虚拟化（Virtualization & Pipeline）

这是彻底解决**数百上千节点**画布流畅运行的**核心支柱方案**。

#### 方案 2.1：视口卡片轻量虚拟化与裁剪（Viewport Culling）
- **实现原理**：
  1. 根据当前的 `viewport.x`, `viewport.y`, `viewport.scale` 以及容器的宽高，精确计算当前视口在画布世界坐标系中的边界矩形：
     $$\text{ViewRect} = [\text{left}, \text{top}, \text{right}, \text{bottom}]$$
  2. 在外侧增加一个合适的**安全缓冲区（Overscan Margin）**（如四周外扩 300px~500px），避免用户在快速平移画布时边缘卡片出现“白屏闪烁”；
  3. 判断节点包围盒是否与 `ViewRect` 相交。
  4. **两级虚拟化策略（建议采用渐进式骨架方案）**：
     - **完全裁剪（Hard Culling）**：视口完全不可见且不在缓冲区的节点，直接不渲染 DOM；
     - **轻量占位骨架（Soft Culling / Placeholder Skeleton）**：视口外的节点保留外部 `<article class="canvas-node">`（维持尺寸与背景颜色），但**清空其内部所有的复杂 DOM（包括 Markdown HTML、CanvasFileCard、iframe 等）**。
- **架构设计**：
  ```ts
  // use-canvas-viewport-culling.ts
  export function useCanvasViewportCulling(viewport, stageRef, nodes, buffer = 400) {
    const visibleNodeIds = computed(() => {
      const stage = stageRef.value
      if (!stage) return new Set(nodes.value.map(n => n.id))

      // 计算视口在画布世界坐标中的可视范围
      const scale = viewport.scale
      const viewX1 = -viewport.x / scale - buffer
      const viewY1 = -viewport.y / scale - buffer
      const viewX2 = (stage.clientWidth - viewport.x) / scale + buffer
      const viewY2 = (stage.clientHeight - viewport.y) / scale + buffer

      const visible = new Set<string>()
      for (const node of nodes.value) {
        const nodeX2 = node.x + node.width
        const nodeY2 = node.y + node.height
        // AABB 碰撞检测
        if (node.x <= viewX2 && nodeX2 >= viewX1 && node.y <= viewY2 && nodeY2 >= viewY1) {
          visible.add(node.id)
        }
      }
      return visible
    })

    return { visibleNodeIds }
  }
  ```
- **模板中的应用**：
  ```html
  <article
    v-for="node in editor.displayNodes"
    :key="node.id"
    class="canvas-node"
    :style="getCanvasNodeStyle(node)"
  >
    <!-- 仅在节点进入视口可见集合时，才渲染其富文本/图片/iframe等沉重内容 -->
    <template v-if="visibleNodeIds.has(node.id)">
      <div class="canvas-node__body">
        <!-- 完整的卡片内容 -->
      </div>
    </template>
    <!-- 视口外节点：仅展示轻量标题或骨架，内存与渲染开销极小 -->
    <template v-else>
      <div class="canvas-node__placeholder" />
    </template>
  </article>
  ```
- **收益**：无论画布中有 500 个还是 5000 个节点，**在任何时刻，DOM 树中被完整渲染的卡片数量永远稳定在 15~30 个左右**。平移与缩放速度将与小型画布完全一致！

#### 方案 2.2：SVG 连线视口裁剪与图层合并
- **实现原理**：
  1. 遍历连线列表，若一条边的 `fromNode` 与 `toNode` **均位于视口可见集合之外**，且连线包围盒不与视口相交，则该边直接不渲染到 SVG 中。
  2. 合并基础 SVG 与交互层 SVG，使用单层 SVG 结构。交互事件直接挂载在主路径或利用 SVG `<use>` 标签，避免多层巨型 SVG 重叠绘制。
- **收益**：SVG 内的 `<path>` 元素从 1500+ 个降低到几十个，彻底消除矢量图形栅格化开销。

#### 方案 2.3：坐标系原点固定，切断 Board Metrics 的连锁重排
- **实现原理**：
  将 `.stage__world` 内部的世界坐标系原点固定在逻辑坐标 $(0, 0)$，而不是动态依赖 `board.left` 和 `board.top`。
  节点位置直接采用 `left: ${node.x}px; top: ${node.y}px`。
  缩放与平移由外层容器的 `transform: translate(...) scale(...)` 统一接管。
- **收益**：彻底断绝拖拽节点越界导致全体节点 CSS `left/top` 变动引起的全局 Reflow。

---

### 3.3 阶段三：极致体验架构演进（Architecture Evolution）

面向更加庞大（1,000+ 节点以上）的极端图谱场景，提供企业级白板渲染架构。

#### 方案 3.1：多层级细节展示（LOD - Level of Detail）
参考 Google 地图与专业 CAD/白板软件的设计：
- **远景鸟瞰（Zoom < 40%）**：
  用户视角极高，卡片上的细小文字人眼根本无法看清。此时卡片自动切换为**极简色块模式（LOD Low）**：仅显示背景色卡片与缩略名称，完全卸载所有富文本、图片及富媒体 DOM。
- **中景概览（40% <= Zoom <= 90%）**：
  **标准模式（LOD Medium）**：显示卡片标题与纯文本摘要，图片使用低分率缩略图。
- **近景聚焦（Zoom > 90%）**：
  **全功能模式（LOD High）**：完整激活原生 Markdown、数学公式、图表渲染及可编辑交互。

#### 方案 3.2：状态快照结构性共享（Structural Sharing）
在 `CanvasHistory` 中，废除每次粗暴的 `cloneCanvasDocument` 全量拷贝，引入基于结构性共享（如轻量不可变持久化数据结构）的不可变数据方案，使未变更节点的引用保持不变，进一步释放内存与垃圾回收压力。

---

## 4. 优化预期收益对比表

下表为针对包含 **500 个块节点（含 200 个文本卡片、250 个思源引用块、50 个链接/分组）、400 条连线** 的典型中大型知识画布在优化前后的性能指标预估对比：

| 评估指标 | 现状（优化前） | 阶段一优化后（Quick Wins） | 阶段二优化后（虚拟化） | 改善幅度 |
| :--- | :--- | :--- | :--- | :--- |
| **DOM 节点总数** | ~ 20,000 个 | ~ 4,000 个 | **~ 800 个** | **降低约 96%** |
| **画布平移/缩放帧率 (FPS)** | 15 ~ 25 FPS（严重掉帧） | 40 ~ 55 FPS（基本流畅） | **60 FPS（满帧丝滑）** | **提升 2~3 倍** |
| **节点拖拽帧耗时** | 80ms ~ 250ms / 帧 | 10ms ~ 16ms / 帧 | **< 5ms / 帧** | **消除卡顿与拖尾** |
| **单次连线比对次数** | 1,600,000 次 | 800 次（Map 索引） | **~ 80 次（视口裁剪）** | **降低 99.9%** |
| **Markdown 编译调用频率** | 每次微小状态变动全量执行 200 次 | 仅修改内容时执行 1 次 | **仅修改内容且在视口内时执行** | **消除 99% 冗余编译** |
| **拖拽过程深拷贝次数** | 60 ~ 120 次 / 秒 | 仅拖拽结束时 1 次 | **仅拖拽结束时 1 次** | **彻底消除 GC 停顿** |
| **初始加载与渲染耗时** | 2.5s ~ 4.5s | 1.0s ~ 1.5s | **< 400ms** | **首屏速度大幅提升** |

---

## 5. 实施落地建议与优先级规划

建议按照以下工作流程分步实施：

1. **第一优先级（立即实施，投入产出比最高）**：
   - 改造连线计算：引入 `nodeMap = computed(...)`，将 `getEdgePath` 内部的 `find` 替换为 `nodeMap.get`；
   - 增加 Markdown 内容缓存：在 `renderMarkdownPreview` 入口增加内存 LRU 缓存；
   - 控制把手条件渲染：在 `CanvasWorkspace.vue` 中仅对 `selected` 或 `hovered` 的卡片显示把手；
   - 改造 `startDrag`：引入拖拽暂态坐标与 rAF 节流，在 `pointermove` 中停止调用 `commitDocument`。

2. **第二优先级（重点突破，彻底根除规模瓶颈）**：
   - 实现 `useCanvasViewportCulling`，为卡片与 SVG 连线加入视口相交检测；
   - 对视口外卡片采用占位骨架屏蔽重型 DOM 渲染；
   - 移除 `watch(() => nodes, ..., { deep: true })`，优化搜索与选区的查找逻辑。

3. **第三优先级（体验打磨）**：
   - 实现缩放 LOD（层级细节展示）；
   - 深度优化历史记录快照机制，减少长时间使用后的内存堆积。
