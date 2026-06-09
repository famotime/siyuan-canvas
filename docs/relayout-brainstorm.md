# 重布局功能设计 — Brainstorm

## 1. 问题陈述

用户在 Canvas 中手动拖拽节点后，连线图往往变得凌乱：节点间距不均、连线交叉、与其他节点重叠。需要一个「一键重布局」功能，从选中节点出发，沿连线关系自动重排所有可达节点，使布局整洁美观。

## 2. 需求约束（硬性）

| 编号 | 约束 |
|------|------|
| C1 | 仅调整节点位置（x, y），不更改节点内容、尺寸、颜色 |
| C2 | 不更改连线关系（fromNode/toNode/fromSide/toSide） |
| C3 | 外框（group）必须继续包含其初始子节点 |
| C4 | 重布局后的节点不得与无关节点/节点群重叠 |
| C5 | 过程中显示加载指示器，禁止用户操作 |
| C6 | 支持 undo/redo（通过现有 commitDocument 机制自动获得） |
| C7 | 可多次迭代计算位置（异步，不阻塞 UI） |

## 3. Brainstorm：候选方案

### 方案 A：分层布局（Layered / Sugiyama）

**思路**：以选中节点为根，沿有向边进行拓扑分层，每层节点水平排列，层间垂直间距固定。

**优点**：
- 布局确定性强，同一图每次结果一致
- 适合树状/DAG 结构（Canvas 最常见场景）
- 实现相对简单，无迭代收敛问题

**缺点**：
- 对环形图需要额外处理（断环）
- 不适合网状/密集图（层太多导致拉伸）

**关键参数**：
- 层间距：80px（水平边）/ 80px（垂直边）
- 同层节点间距：32px
- 层方向：根据选中节点的出边方向自动推断（right→水平分层，bottom→垂直分层）

### 方案 B：力导向布局（Force-Directed）

**思路**：将节点视为带电粒子（互斥），连线视为弹簧（吸引），通过物理模拟迭代收敛到平衡位置。

**优点**：
- 自然处理任意拓扑（树、环、网状）
- 布局美观，节点均匀分布
- 业界成熟算法（Fruchterman-Reingold）

**缺点**：
- 需要多次迭代（50-200 轮），计算量大
- 结果不确定性（受初始位置影响）
- 大节点数（>100）可能卡顿
- 需要异步处理 + loading 状态

**关键参数**：
- 弹簧理想长度：120px
- 斥力系数：与节点面积成正比
- 阻尼系数：0.85
- 最大迭代：200 轮
- 收敛阈值：总位移 < 1px

### 方案 C：树形径向布局（Radial Tree）

**思路**：以选中节点为根，BFS 分层，每层节点沿同心圆弧排列。

**优点**：
- 视觉层次清晰
- 适合星形/树形拓扑

**缺点**：
- 不适合有环的图
- 空间利用率低（圆弧外侧浪费）
- 与 Canvas 的矩形节点不自然

### 方案 D：混合方案（分层 + 力导向修正）

**思路**：先用分层布局确定初始位置，再用力导向做局部修正（消除重叠、优化间距）。

**优点**：
- 兼顾确定性和美观性
- 分层保证主结构清晰，力导向修正局部细节
- 收敛快（力导向只需少量迭代）

**缺点**：
- 实现复杂度最高
- 两套算法需要协调

## 4. 方案评估矩阵

| 维度 | 权重 | A 分层 | B 力导向 | C 径向 | D 混合 |
|------|------|--------|----------|--------|--------|
| 布局美观 | 25% | 7 | 9 | 6 | 9 |
| 实现复杂度 | 20% | 9 | 6 | 7 | 4 |
| 性能（大图） | 20% | 9 | 5 | 8 | 7 |
| 确定性 | 15% | 9 | 4 | 9 | 7 |
| 通用性（各种拓扑） | 10% | 5 | 9 | 3 | 8 |
| 与现有代码一致性 | 10% | 8 | 6 | 5 | 6 |
| **加权总分** | 100% | **7.85** | **6.55** | **6.30** | **6.50** |

## 5. 推荐方案：方案 A — 分层布局

**理由**：
1. Canvas 场景以树状/DAG 为主（笔记之间的引用关系天然是有向的）
2. 实现简单，不需要异步迭代，可以同步完成计算
3. 确定性好，用户预期一致
4. 与现有 `document-layout.ts` 的排列函数模式一致
5. 性能好，O(V + E) 时间复杂度

**对环形图的处理**：检测到环时，断开最后一条回边（按 BFS 发现顺序），将其标记但不参与分层。断开的边在布局后仍然存在，只是节点位置由分层决定。

## 6. 详细算法设计

### 6.1 连通子图提取

```
输入：selectedNodeId, document
输出：connectedSubgraph = { nodes: CanvasNode[], edges: CanvasEdge[] }

1. 以 selectedNodeId 为起点，BFS 遍历所有边（无向）
2. 收集所有可达节点 ID
3. 收集这些节点之间的所有边
4. 返回子图
```

**注意**：边是无向遍历的（fromNode→toNode 和 toNode→fromNode 都算连接），但保留原始方向信息用于分层。

### 6.2 方向推断

```
输入：selectedNode, 子图中的边
输出：primaryDirection: "horizontal" | "vertical"

1. 统计 selectedNode 的出边方向（fromSide）
2. 如果 right/left 占多数 → horizontal（从左到右分层）
3. 如果 top/bottom 占多数 → vertical（从上到下分层）
4. 如果相等或无出边 → 根据 toSide 统计，仍相等则默认 horizontal
```

### 6.3 分层（Layer Assignment）

```
输入：子图, selectedNodeId, primaryDirection
输出：layers: CanvasNode[][]（每层的节点列表）

1. 以 selectedNodeId 为根，BFS 按有向边分配层号
   - selectedNodeId → layer 0
   - fromNode 在 layer N → toNode 在 layer N+1
   - 如果 toNode 已有层号，跳过（避免环）
2. 对于反向边（toNode→fromNode 方向的边），如果 fromNode 层号 > toNode 层号，
   标记为"回边"（参与连通但不参与分层定位）
3. 处理无边连接但属于子图的节点（不应出现，因为子图是按边提取的）
```

### 6.4 层内排序（Crossing Reduction）

```
输入：layers: CanvasNode[][], edges
输出：重排后的 layers（减少连线交叉）

1. 固定 layer 0 的顺序（按原始 y 或 x 排序）
2. 对 layer 1..N，使用重心法（barycenter method）：
   - 每个节点的重心 = 其在上一层邻居的平均位置
   - 按重心排序本层节点
3. 重复 2-3 次（正向+反向扫描）以改善结果
```

### 6.5 坐标计算

```
输入：layers, primaryDirection, GAP_H, GAP_V
输出：Map<nodeId, { x, y }>

参数：
  GAP_H = 80  （层间间距，水平布局时为 x 方向）
  GAP_V = 32  （层内间距，水平布局时为 y 方向）
  如果是 vertical 布局，GAP_H 和 GAP_V 角色互换

1. 计算每层的总高度/宽度：
   layerSize = sum(node.height) + GAP_V * (nodeCount - 1)
2. 居中对齐：
   - 水平布局：每层的 y 起点 = 层中心 - layerSize/2
   - 垂直布局：每层的 x 起点 = 层中心 - layerSize/2
3. 层间距：
   - 水平布局：每层 x = 上层 x + 上层最大宽度 + GAP_H
   - 垂直布局：每层 y = 上层 y + 上层最大高度 + GAP_H
4. 层内排列：
   - 按排序顺序依次放置，间距 GAP_V
```

### 6.6 外框（Group）处理

```
输入：document, 移动的节点, 原始位置快照
输出：调整后的 group 位置

1. 在布局前，记录所有 group 的初始子节点：
   - 遍历所有 group 节点
   - 用 findCanvasNodesInGroup() 找出每个 group 包含的节点
   - 记录 group → containedNodeIds 映射
2. 布局后，对每个 group：
   a. 计算其初始子节点的新边界框（bounding box）
   b. 如果所有子节点仍然在 group 内 → 无需调整
   c. 如果有子节点移出了 group → 调整 group 的位置和大小，
      使其重新包含所有初始子节点（加 padding）
3. group 调整后，检查是否与其他 group 重叠
```

### 6.7 重叠避免

```
输入：布局后的节点, 文档中的其他节点
输出：无重叠的最终位置

1. 将连接子图的节点与其他节点分为两个集合：
   - movableNodes = 子图中的节点
   - obstacleNodes = 文档中不在子图中的节点 + group 节点
2. 对每个 movableNode：
   - 检查是否与任何 obstacleNode 重叠（AABB 检测）
   - 如果重叠，沿 primaryDirection 的反方向推开
   - 重复直到无重叠或达到最大尝试次数（50）
3. 最后检查 movableNodes 之间是否重叠（理论上不会，因为分层间距已保证）
```

### 6.8 边方向推断更新

```
布局完成后，不修改边的 fromSide/toSide。
原因：
- 用户可能手动设置了特定的边方向
- 连线渲染时已有自动弯曲逻辑
- 修改边方向是破坏性操作，不符合 C2 约束
```

## 7. UI 设计

### 7.1 工具栏按钮

**位置**：选中单个节点时，在 selection toolbar 的「刷新」按钮之后显示。

**显示条件**：
- 选中了恰好 1 个节点
- 该节点至少有 1 条连线（否则没有连接节点需要重布局）

**按钮属性**：
- 图标：`layout`（复用现有图标）或新增 `relayout` 图标
- data-testid: `selection-toolbar-relayout`
- tooltip: `t("selectionToolbarRelayout")` → "重布局连接节点"

### 7.2 加载状态

**状态管理**：
- `isRelayouting: Ref<boolean>` — 在 `use-canvas-editor-node-edge-actions.ts` 中定义
- 传递到 `createCanvasEditorBindings()`，模板中可通过 `editor.isRelayouting` 访问

**UI 表现**：
- 按钮显示为 loading 状态（旋转图标或 spinner overlay）
- 画布上显示半透明遮罩 + 居中 spinner
- 禁用所有交互操作（通过遮罩的 pointer-events: none + 高 z-index）

**遮罩模板**：
```html
<div
  v-if="editor.isRelayouting"
  class="canvas-relayout-overlay"
  data-testid="relayout-overlay"
>
  <div class="canvas-relayout-spinner" />
  <span>{{ t('relayoutComputing') }}</span>
</div>
```

### 7.3 i18n

```json
{
  "selectionToolbarRelayout": "重布局连接节点",
  "relayoutComputing": "正在计算布局…",
  "relayoutNoConnectedNodes": "该节点没有连线，无需重布局"
}
```

## 8. 模块设计

### 8.1 新增文件

| 文件 | 职责 |
|------|------|
| `src/canvas/document-relayout.ts` | 重布局核心算法（纯函数） |
| `tests/document-relayout.test.ts` | 重布局算法测试 |

### 8.2 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/canvas/types.ts` | 无需修改（不使用 CanvasNodeLayoutAction，直接返回 CanvasDocument） |
| `src/canvas/document.ts` | barrel export 新增 `relayoutConnectedNodes` |
| `src/canvas/use-canvas-editor-node-edge-actions.ts` | 新增 `relayoutConnectedNodes()` action，`isRelayouting` ref |
| `src/canvas/use-canvas-editor.ts` | 传递 `isRelayouting` 到 bindings |
| `src/canvas/editor-bindings.ts` | 无需修改（通用 proxy） |
| `src/components/canvas/CanvasWorkspace.vue` | 新增按钮 + loading 遮罩 |
| `src/i18n/zh_CN.json` | 新增 3 个翻译键 |
| `src/i18n/en_US.json` | 新增对应英文翻译 |

### 8.3 核心函数签名

```typescript
// src/canvas/document-relayout.ts

export interface RelayoutOptions {
  /** 起始节点 ID */
  selectedNodeId: string
  /** 主方向：horizontal（从左到右）或 vertical（从上到下） */
  primaryDirection?: "horizontal" | "vertical"
  /** 层间间距（默认 80） */
  layerGap?: number
  /** 同层节点间距（默认 32） */
  nodeGap?: number
  /** 外框 padding（默认 24） */
  groupPadding?: number
  /** 最大重叠修正迭代次数（默认 50） */
  maxOverlapFixAttempts?: number
}

export interface RelayoutResult {
  /** 更新后的文档 */
  document: CanvasDocument
  /** 是否成功（false = 没有找到连接节点） */
  success: boolean
  /** 消息（如"无连接节点"） */
  message?: string
}

/**
 * 从 selectedNodeId 出发，沿连线关系找到所有可达节点，
 * 重新布局使节点间距均匀、不重叠。
 * 仅调整位置，不修改连线关系和节点内容。
 */
export function relayoutConnectedNodes(
  document: CanvasDocument,
  options: RelayoutOptions,
): RelayoutResult
```

### 8.4 Action 函数设计

```typescript
// use-canvas-editor-node-edge-actions.ts 中新增

const isRelayouting = ref(false)

async function relayoutConnectedNodes() {
  if (!selectedNode.value || isRelayouting.value) return

  const node = selectedNode.value
  // 检查是否有连线
  const hasEdges = state.document.edges.some(
    e => e.fromNode === node.id || e.toNode === node.id
  )
  if (!hasEdges) {
    showMessage(t("relayoutNoConnectedNodes"))
    return
  }

  isRelayouting.value = true
  closeSelectionPopover()

  try {
    // 使用 requestAnimationFrame + setTimeout 让 UI 更新（显示 loading）
    await new Promise(resolve => setTimeout(resolve, 50))

    const result = relayoutConnectedNodes(state.document, {
      selectedNodeId: node.id,
    })

    if (result.success) {
      commitDocument(result.document)
    } else if (result.message) {
      showMessage(result.message)
    }
  } finally {
    isRelayouting.value = false
  }
}
```

## 9. 算法伪代码

```typescript
function relayoutConnectedNodes(document, options) {
  const { selectedNodeId, layerGap = 80, nodeGap = 32, groupPadding = 24 } = options

  // 1. 提取连通子图
  const subgraph = extractConnectedSubgraph(document, selectedNodeId)
  if (subgraph.nodes.length <= 1) {
    return { document, success: false, message: "无连接节点" }
  }

  // 2. 记录 group 的初始子节点
  const groupChildren = recordGroupChildren(document, subgraph.nodes)

  // 3. 推断主方向
  const direction = options.primaryDirection ?? inferDirection(selectedNodeId, subgraph.edges)

  // 4. 分层
  const layers = assignLayers(subgraph, selectedNodeId, direction)

  // 5. 层内排序（减少交叉）
  const orderedLayers = reduceCrossings(layers, subgraph.edges)

  // 6. 计算坐标
  const positions = computePositions(orderedLayers, direction, layerGap, nodeGap)

  // 7. 记录原始位置快照
  const originalPositions = new Map(subgraph.nodes.map(n => [n.id, { x: n.x, y: n.y }]))

  // 8. 应用位置到文档
  let updatedDoc = applyPositions(document, positions)

  // 9. 调整 group 大小以包含初始子节点
  updatedDoc = adjustGroups(updatedDoc, groupChildren, groupPadding)

  // 10. 重叠修正（与文档中其他节点）
  updatedDoc = resolveOverlaps(updatedDoc, subgraph.nodes, document, direction)

  return { document: updatedDoc, success: true }
}
```

## 10. 边界情况处理

| 场景 | 处理方式 |
|------|----------|
| 选中节点无连线 | 显示提示消息，不执行布局 |
| 子图只有 2 个节点 | 直接按主方向间距排列 |
| 子图包含环 | BFS 断环，回边标记但不影响分层 |
| 子图中所有节点都在同一 group 内 | 调整 group 大小以适应新布局 |
| 子图节点与孤立节点重叠 | 沿反方向推开，最多 50 次迭代 |
| 节点数 > 200 | 仍同步执行（分层算法 O(V+E)），但 UI 上显示 loading 以给出反馈 |
| 多个 group 嵌套 | 外层 group 在内层 group 调整后再调整 |
| 选中节点在 group 内 | 布局该 group 内所有连接节点（不是整个文档） |

## 11. 测试计划

| 测试用例 | 描述 |
|----------|------|
| 线性链 A→B→C | 三个节点线性排列，验证等间距 |
| 树形结构 | 一个根节点分叉到多个叶子 |
| 带环图 | A→B→C→A，验证断环处理 |
| 混合方向 | 部分边向右、部分边向下 |
| 与孤立节点重叠 | 布局后节点推到不重叠位置 |
| Group 包含 | 布局后 group 自动扩展包含子节点 |
| 嵌套 Group | 外层 group 跟随调整 |
| 单节点 | 返回失败 + 提示消息 |
| 大图性能 | 100 节点 + 200 边，验证 < 100ms |

## 12. 实现步骤

1. **核心算法**：`src/canvas/document-relayout.ts`
   - `extractConnectedSubgraph()`
   - `inferDirection()`
   - `assignLayers()`
   - `reduceCrossings()`
   - `computePositions()`
   - `adjustGroups()`
   - `resolveOverlaps()`
   - `relayoutConnectedNodes()` 主入口

2. **单元测试**：`tests/document-relayout.test.ts`

3. **集成**：
   - `document.ts` barrel export
   - `use-canvas-editor-node-edge-actions.ts` action 函数
   - `use-canvas-editor.ts` bindings 传递

4. **UI**：
   - `CanvasWorkspace.vue` 按钮 + loading 遮罩
   - i18n 翻译

5. **图标**：
   - 确认是否复用 `layout` 图标或新增 `relayout` 图标
