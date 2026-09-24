# 画布滚轮与触控板手势设计说明

> 覆盖范围：`src/canvas/wheel-gesture.ts`、`use-canvas-editor-gestures.ts` 的 `handleStageWheel`、`CanvasWorkspace.vue` 的模板绑定与 `handleNodeWheel`。
> 对应测试：`tests/canvas-wheel-gesture.test.ts`、`tests/canvas-editor-gestures.test.ts`（`wheel navigation` 分组）、`tests/canvas-workspace.test.ts`。

## 1. 背景与目标

改造前，画布对**所有** `wheel` 事件一律按 `deltaY` 缩放，且不检查任何修饰键。后果是触控板双指上下滑动会缩放画布，双指左右滑动无人消费、被浏览器吃掉（在 Chromium 上甚至可能被解释为前进/后退导航）。

本次改造后的目标行为：

| 输入 | 行为 |
| --- | --- |
| 触控板双指滑动 | **平移**画布（内容跟随手指） |
| 触控板双指捏合 | **缩放**（浏览器将其合成为 `ctrlKey: true` 的 wheel 事件） |
| 鼠标滚轮 | **缩放**（保留既有手感） |
| `Ctrl` / `Cmd` + 滚轮 | 缩放 |
| 右键拖拽 | 平移（鼠标用户的既有方式，未改动） |
| 真实触摸屏（`touchstart/move/end`） | 未改动，仍走既有的捏合 + 平移实现 |

鼠标用户不会因此失去平移能力：`startPan` 已支持右键拖拽平移，左键拖拽是框选，所以本方案对鼠标用户是**零体感变化**，只是新增了触控板行为。

## 2. 分层结构

```
CanvasWorkspace.vue
  └─ @wheel="editor.handleStageWheel"        ← 非 passive，可 preventDefault
       └─ use-canvas-editor-gestures.ts
            ├─ isDragging 守卫              ← 拖拽/缩放节点期间冻结视口
            ├─ wheelSourceClassifier        ← 每编辑器实例一个，锁存来源
            │    └─ wheel-gesture.ts        ← 纯模块，DOM-free
            ├─ applyAnchoredZoom()          ← ctrl/meta/鼠标分支
            └─ viewport.x -= dx / y -= dy   ← 触控板平移分支
```

`wheel-gesture.ts` 的输入用结构化类型 `{ deltaMode, deltaX, deltaY }` 而非 `WheelEvent`，保持模块不依赖 DOM，可直接单测。

## 3. 视口模型与平移方向

画布视口遵循 `screen = world * scale + viewport.{x, y}`。

关键陷阱：**wheel 的 delta 是「滚动意图」，不是「拖拽位移」**，两者符号相反。

- `startPan`（指针拖拽）拿到的是手指数位移，直接 `viewport.x += dx`。
- wheel 的 `deltaY > 0` 表示「内容向上滚」，也就是内容应当上移，因此 `viewport.y -= dy`。

所以平移分支**不能照抄 `startPan` 的 `+ dx`**。平移路径同时刻意不读 `getBoundingClientRect()`（避免惯性尾巴期间每帧强制同步布局），也不做边界钳制（与 `startPan` 保持一致）。

## 4. 设备判定：为什么需要启发式 + 手势锁存

浏览器在 `wheel` 事件中**不暴露输入设备类型**，所以鼠标滚轮与触控板双指滑动只能靠增量特征区分。`detectCanvasWheelSource` 的规则：

1. `deltaMode !== 0`（行 / 页模式）→ `mouse`。触控板双指滑动恒为像素模式。
2. `deltaX === 0 && |deltaY| >= 100` → `mouse`。鼠标滚轮按固定刻度步进（Chrome 约 100 像素一格）且没有横向分量。
3. 其余 → `trackpad`。

单看一个事件不足以判定整段手势：触控板快速滑动途中可能恰好发出 `{ dx: 0, dy: 100 }`，若逐事件判定，就会在平移中间插入一次突兀的缩放。因此分类器按**手势锁存**：

- 每次 `classify` 都刷新 `lastEventAt`（**包括 ctrl 事件**——捏合会刷新时效但不翻转锁存值，避免长捏合之后接续的平移被当成新手势重新判定）。
- 距上次事件超过 `WHEEL_GESTURE_IDLE_MS`（250ms）视为新手势，清空锁存值并重新判定。
- 仅在锁存值为空或已进入新手势时才执行判定。

浏览器没有提供手势结束事件，因此**基于时间戳的空闲窗口是唯一可用的手势边界**。

锁存状态由工厂闭包持有、跟随编辑器实例创建，避免使用模块级单例（否则会在多个思源 Tab 之间泄漏）。

## 5. `handleStageWheel` 的检查顺序

顺序本身是语义的一部分，不能随意调整：

```ts
function handleStageWheel(event: WheelEvent) {
  // 1. 零位移事件（部分设备在手指落下时会上报）既不消耗，也不参与来源判定
  if (event.deltaX === 0 && event.deltaY === 0) return

  // 2. 拖拽/缩放卡片期间冻结视口：节点位移按当前 scale 换算，中途改缩放会让卡片跳变
  if (isDragging.value) return

  // 3. 每次事件都参与判定，捏合事件会刷新手势时效但不改变已锁存的来源
  const source = wheelSourceClassifier.classify(event)

  if (event.ctrlKey || event.metaKey || source === "mouse") {
    applyAnchoredZoom(event)
  } else {
    const { x, y } = normalizeCanvasWheelDelta(event)
    viewport.x -= x
    viewport.y -= y
  }

  // 4. 画布已消费该手势
  event.preventDefault()
}
```

要点：

- **零位移事件必须提前返回**，否则会把 `lastEventAt` 刷新、破坏手势边界，且对分类结果产生噪声。
- **`isDragging` 守卫放在判定之前**：`resolveDragDelta` 在拖动时按 `viewport.scale` 换算节点位移，拖拽中途改变 scale 会让卡片跳变。
- **`classify` 必须无条件调用**（即使随后走的是 ctrl 分支），否则捏合期间锁存时效不会被刷新。
- **`ctrlKey || metaKey` 优先级高于分类结果**：捏合事件天然带 `ctrlKey`，这条分支必须能压过「触控板」判定。

## 6. 监听器改为非 passive

模板绑定从 `@wheel.passive="editor.handleWheelZoom"` 改为 `@wheel="editor.handleStageWheel"`。

`preventDefault()` 需要非 passive 监听器。这既是新功能的需要（画布现在消费横向 delta，未消费的横向双指滑动会触发 Chromium 的前进/后退导航），也顺带修复了既有隐患——改造前的 passive 监听器从不调用 `preventDefault`，横向滑动的导航风险已经存在。叠加 Ctrl 滚轮时，非 passive 还能阻止浏览器缩放整个思源界面。

安全性已核实：`.stage` 为 `overflow: hidden`，宿主 tab 元素内联 `overflow: hidden`，插件内不存在可滚动祖先；节点内部的滚动靠 `handleNodeWheel` 的 `stopPropagation` 保护，而 `stopPropagation` 与 passive 无关（只有 `preventDefault` 受 passive 影响）。节点级与浮层级的 `@wheel.passive.stop` 绑定均不受影响。

## 7. 消除「滚轮被吞」死区

改动前这些位置吞掉滚轮只影响缩放，改动后会变成**平移死区**——光标停在卡片上就滑不动画布。三处修正：

1. **删除选中卡片的无条件拦截**。原 `handleNodeWheel` 在 `isSelected` 时直接 `stopPropagation()` 返回，现在选中卡片沿用与未选中卡片相同的「能否继续滚动」判断。
2. **边界判断改为按主轴**。原逻辑只比较 `deltaY`，纯横向滑动会被整段吞掉且不触发 `preventDefault`；现在取 `|deltaX|` 与 `|deltaY|` 中较大者作为主轴，对应取 `scrollWidth/clientWidth/scrollLeft` 或 `scrollHeight/clientHeight/scrollTop`。
3. **移除 `.canvas-node__query-view` 的 `@wheel.stop`**，并把 `.canvas-node__query-content` 加入 `handleNodeWheel` 的可滚动选择器列表。

> 第 3 点需要特别说明：计划阶段曾误判「该元素及其内部 `.query-results-list` 都是 `overflow: hidden`」，因此认为移除 `.stop` 即可。实际上中间层 `.canvas-node__query-content` 是 `overflow-y: auto`（`canvas-workspace.scss:1671`），直接移除 `.stop` 会让滚动查询结果的滚轮**同时**平移画布。修正方式是保留 `.stop` 的移除，但把 `.canvas-node__query-content` 纳入 `handleNodeWheel` 的可滚动区域列表，由既有的边界逻辑接管。

## 8. 附带修复：`toFixed(2)` 吞掉小增量

原 wheel 路径把缩放结果取整后**存回** `viewport.scale`：

```ts
// 改动前
const nextScale = clampViewportScale(Number((viewport.scale * Math.exp(-deltaY * 0.0015)).toFixed(2)))
```

由于结果被写回，误差**每帧丢弃、永不累积**。后果是 `1.00 * exp(-1 * 0.0015) = 0.9985` → `Number("1.00")` → `1.00`，即 **`scale < 1.11` 时任何 `|deltaY| < 4` 的事件都是空操作**。Firefox 的鼠标滚轮上报 ±3 行（折算 ±48 像素前的小增量），触控板捏合产生的正是 1~3 量级的小 delta，所以捏合在默认 100% 缩放下几乎推不动画布。这与「让捏合缩放好用」直接相关，故一并修复。

改法是 wheel 路径**去掉 `toFixed(2)`**，`viewport.scale` 保留全精度。显示侧本来就自行取整（`CanvasWorkspace.vue:148` 的 `Math.round(editor.viewport.scale * 100)`），无需改动。

其余 `toFixed(2)` 位置**保持不变**——它们都是非累积的离散步进，取整无害：

- 触摸屏捏合：使用锁存的 `initialScale` 计算，不读回上一次结果；
- `zoomIn` / `zoomOut`：0.1 的固定步进；
- `resetViewport`：一次性适配。

另一个被检查过的风险点：没有任何代码对 `viewport.scale` 做精确相等比较（`===`），因此全精度存储不会破坏既有判断。

## 9. 已知局限（需知情接受）

启发式无法做到可靠判定，这是浏览器 API 的固有限制，不是实现缺陷。已知误判场景：

| 场景 | 结果 | 说明 |
| --- | --- | --- |
| 触控板**从静止猛地一划** | 首个事件即 `{dx: 0, dy: 118}` → 锁存为 mouse → **整段手势变成缩放** | 锁存救不了这种情况；锁存只救「起始小、逐渐加速」的常见加速曲线 |
| 平移途中**停顿超过 250ms** 再快速滑动 | 被重新判定，可能翻转行为 | 空闲窗口既是优点也是局限 |
| Safari 的鼠标滚轮 | 落在 `trackpad` 分支 → **滚轮变成平移** | WebKit 上报的像素 delta 只有几十，低于 100 阈值 |
| Windows Chrome 的「平滑滚动」鼠标 | 同上 | 平滑插值后单次增量被摊薄 |
| **Magic Mouse 面板滚动** | 判为触控板 → 平移 | **这是有意结果而非意外**：Magic Mouse 的交互模型本就接近触控板 |

### 补救路径（若实际使用中误判明显）

成本都很低，按代价从低到高：

1. `MOUSE_WHEEL_MIN_DELTA_PX` 已抽为具名常量（默认 100），可直接调阈值定标。
2. `src/canvas/debug-log.ts` 的 `enableDebugLog` 开关可用来打印真实的 `{ deltaMode, deltaX, deltaY }` 分布，据实定标而非猜测。
3. 若阈值调不出满意结果，再加一个 `wheelBehavior: 'auto' | 'zoom' | 'pan'` 设置项让用户手动选择，属于 `plugin-data.ts` + 设置面板 + i18n 的机械改动。

## 10. 明确不做（非目标）

- **不加设置开关**：当前选择用启发式而非用户开关，开关留作上述补救路径。
- **不处理 `shift + 滚轮` 的横向滚动特例**：交由分类器自然决定。
- **不改小地图**：`CanvasMinimap.vue` 渲染在 `.stage` 内且没有 `wheel.stop`，滚轮在其上会冒泡平移/缩放画布。它与画布同向，判定为可接受，并已由测试 `bubbles wheel events over the minimap to the stage handler` 固化。
- **不给演示模式加滚轮守卫**：演示模式下 `handleStagePointerDown` 本就允许平移，且节点导航每次都会用 `focusNodeById` 重设视口，加守卫无收益。
- **不修 `watch(stageRef)` 中 touch 监听器重复注册不清理的问题**：既有缺陷，与本次无关。

## 11. 验证要点

自动化测试覆盖了：`normalizeCanvasWheelDelta` 的各 deltaMode 折算、分类器的锁存 / 空闲重置 / 惯性尾巴 / 捏合刷新时效 / 实例隔离，以及 `handleStageWheel` 的平移方向、锚点缩放不变性、ctrl 分支优先级、行模式鼠标滚轮、`isDragging` 冻结、缩放钳制与平移不钳制、零位移忽略。

**仍需真机手动验收**（单测无法覆盖触控板硬件行为）：

1. 触控板双指滑动 → 画布平移，方向跟随手指，缩放百分比不变。
2. 触控板捏合 → 以指针为锚点缩放，且**小幅捏合也能推动**（第 8 节的验证点）。
3. 鼠标滚轮 → 仍缩放；`Ctrl` + 滚轮 → 缩放且不再缩放整个思源界面。
4. 光标停在**选中卡片**上双指滑动 → 能平移（第 7 节第 1 点的验证点）。
5. 卡片正文 / 查询结果可滚动时滚轮 → 先滚内容，到边界后转为平移；纯横向滑动不被吞掉。
6. 平移途中猛划、停顿后急划 → 记录第 9 节误判在真实使用中的严重程度，据此决定是否调阈值。
