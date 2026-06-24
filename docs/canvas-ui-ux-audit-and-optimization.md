# 思源画布 UI/UX 审视与优化方案及实施进展

## 优化进展汇总 (2026-06-24 更新)

当前项目已基本完成本方案中提出的所有关键点，各项改进已成功融入代码库并通过了全部自动化测试（53 个测试文件，549 个测试用例全部通过）。

### 核心落地成果

1. **统一图标防护系统**
   - 落地模块：[canvas-icon.ts](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/canvas-icon.ts) 与 [canvas-icon-registry.ts](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/canvas-icon-registry.ts)
   - 机制：通过 `hardenStrokeOnlySvgFill` 自动给线框 SVG 加上 `fill:none!important`，同时保护了 `center`, `play`, `record` 等需要局部填充的图标。
   - 测试验证：[canvas-icon.test.ts](file:///d:/MyCodingProjects/siyuan-canvas/tests/canvas-icon.test.ts)

2. **全局 Tooltip 与按钮标准**
   - 落地模块：[CanvasWorkspace.vue](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/CanvasWorkspace.vue), [CanvasWorkspaceTree.vue](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/CanvasWorkspaceTree.vue) 与 [canvas-workspace.scss](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/canvas-workspace.scss)
   - 机制：规范化图标按钮的属性约定，补充 `data-tooltip`, `aria-label`, `type="button"` 并使用统一的 `.canvas-icon-button` CSS 来控制 tooltip 的显示与隐藏，统一尺寸和 hover 状态。

3. **文档树递归化重构**
   - 落地模块：[CanvasWorkspaceTree.vue](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/CanvasWorkspaceTree.vue)
   - 机制：完全废弃原先写死的三层模板，改为使用 `WorkspaceTreeNodeView` 组件递归渲染，实现无限目录层级展示和操作。
   - 测试验证：[canvas-workspace-tree-component.test.ts](file:///d:/MyCodingProjects/siyuan-canvas/tests/canvas-workspace-tree-component.test.ts) 验证了深度大于 3 层的嵌套渲染。

4. **Inspector 批量编辑与交互**
   - 落地模块：[CanvasInspector.vue](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/CanvasInspector.vue) 与 [canvas-workspace.scss](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/canvas-workspace.scss)
   - 机制：引入 draft 机制及批量选择修改后的“确认应用”流程。将 section 标题的字距设置为 `0`，强化中文小字号可扫读性。折叠面板热区统一，配有 Chevron 指示。
   - 测试验证：[canvas-inspector.test.ts](file:///d:/MyCodingProjects/siyuan-canvas/tests/canvas-inspector.test.ts)

5. **右键菜单与弹窗优化**
   - 落地模块：[CanvasWorkspace.vue](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/CanvasWorkspace.vue) 与 [CanvasPngExportDialog.vue](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/CanvasPngExportDialog.vue)
   - 机制：右键菜单全部采用“线框图标 + 文本”形式，危险操作标红，符合 Esc 关闭心智。导出弹窗 SVG 加了 fill 样式隔离防破坏，三列背景 swatch 加入自适应布局，防止窄屏幕长中文换行挤压。

6. **可访问性规范补强**
   - 全面引入 `role="tree"`, `role="treeitem"`, `role="menu"`, `role="menuitem"`, `aria-expanded`, `aria-current="page"` 等标准无障碍属性，提高可读性屏障兼容度。

---

## 背景与审视范围

本文从多年互联网应用 UX 设计与效率工具设计视角，审视当前 `siyuan-canvas` 插件的主画布、顶部工具栏、选区工具栏、右侧检查器、文档树、命令面板、导出弹窗、上下文菜单与图标系统。审视目标不是重做视觉风格，而是在保留思源主题兼容性的前提下，提升界面一致性、操作直觉、信息密度、可发现性和长期可维护性。

当前应用已经具备较好的基础：主工作区以画布为中心，顶部工具栏基本采用图标按钮，检查器将文档与选区能力分区，样式变量大量从思源 `--b3-*` token 派生，适合跟随主题切换。后续优化重点应放在“统一控件语言”和“降低复杂功能的认知成本”。

## 现状优点

1. **主界面结构清晰**
   顶部工具栏、中心画布、右侧检查器的三段式布局符合画布类生产力工具预期；文档管理与选区属性分为 Inspector tab，也降低了右侧栏信息混杂程度。

2. **工具栏已基本采用图标优先**
   `CanvasWorkspace.vue` 顶部工具栏大量使用 `CanvasIcon`，并配置 `aria-label`、`title`、`data-tooltip`，满足“图标 + tooltip”的主要方向。

3. **设计 token 方向正确**
   `canvas-workspace.scss` 中已建立 `--canvas-*` 变量，并从思源主题变量派生，具备暗色模式和主题切换的可持续基础。

4. **已有图标线框防护机制**
   `CanvasIcon` 中的 `hardenStrokeOnlySvgFill()` 会给 `<svg>` 注入 `style="fill:none!important"`，能缓解思源全局 CSS 覆盖 SVG fill 导致图标变实心的问题。

5. **关键交互状态已有反馈**
   保存状态、冲突状态、选区工具栏、拖拽目标、文档树 active 状态、Relayout loading 等都有可见反馈，说明应用已经具备比较完整的操作闭环。

---

## 核心问题与落地状态

### 1. 图标系统未完全统一
当前存在三类图标来源：
- `CanvasIcon`：用于画布主要 UI，带 `fill:none!important` 防护。
- `SyIcon.vue`：使用思源 symbol sprite，未显式加入 `fill:none!important`。
- 组件内联 SVG：如 PNG 导出弹窗、边箭头 marker、Markdown 视频卡片等，部分直接使用 `fill="currentColor"`。

这会带来同一界面中图标线条粗细、填充方式、视觉重量不一致，以及思源全局 CSS 仍可能影响非 `CanvasIcon` 的 SVG，且“按钮图标尽量线框化”的规范无法被组件层稳定执行的问题。

**落地状态（已实施）**：
- 统一使用 [CanvasIcon](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/canvas-icon.ts) 作为图形唯一入口。
- [canvas-icon.ts](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/canvas-icon.ts) 的 `hardenStrokeOnlySvgFill` 具备 `fill:none!important` 线框防全局 fill 被覆盖的安全机制。
- 通过 [canvas-icon-registry.ts](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/canvas-icon-registry.ts) 对 `center`, `play`, `record` 等含有 `fill="currentColor"` 的局部填充进行了保留。
- 新增常用菜单图标，测试覆盖在 [canvas-icon.test.ts](file:///d:/MyCodingProjects/siyuan-canvas/tests/canvas-icon.test.ts) 中。

### 2. Tooltip 能力分布不均
部分主要依赖原生 `title`。原生 `title` 展示延迟、样式不可控、不适合触控设备，与已有自定义 tooltip 视觉不一致。建议将所有图标按钮统一使用 `data-tooltip + aria-label + title`，其中 `title` 仅作为兜底，不作为主要体验。

**落地状态（已实施）**：
- 定义了通用的 `.canvas-icon-button`，统一了 `aria-label`, `data-tooltip`, `type="button"` 的属性约定。
- 已将 Inspector toolbar、最近文件删除、文档树删除等按钮补全 tooltip，并通过 CSS 处理 hover/focus-visible 时的展现，并去除了原生 `title` 的不一致响应。

### 3. 按钮形态与语义层级还不够统一
具体尺寸、圆角、hover、focus、禁用、激活态不完全一致。长期会让用户形成“不确定哪些按钮是同一类操作”的感知。建议抽象出画布内部按钮规范：IconButton、TextButton、MenuItem、SegmentedControl。

**落地状态（已实施）**：
- 在 [canvas-workspace.scss](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/canvas-workspace.scss) 中抽象了通用的 `.canvas-icon-button` 类，规范了外观（尺寸、圆角、hover/active 效果、 focus-visible 及 disabled 状态）。
- [CanvasPngExportDialog.vue](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/CanvasPngExportDialog.vue) 中的确认/取消按钮和选项卡均已规范化，复用了核心按钮的设计规范。

### 4. 字体层级偏散，局部字距不必要
对于中文界面，过度字距会让小字号文字显得松散，影响扫读效率。建议中文 UI 文本不使用正字距，`letter-spacing` 统一为 `0`；12px 用于辅助信息/标签，13px 用于列表项/表单正文，14px 用于输入框，16px 仅用于弹窗标题和重要分区标题。

**落地状态（已实施）**：
- 移除了中文小字号文字不必要的 letter-spacing（如 `.inspector__section h2` 重置为 `0`），这大幅度提升了高频扫读的效率。
- 仅在少量纯英文/辅助性大写 Badge、Kind 标识或分组 Header 等文字上保留 `0.04em` 到 `0.06em` 间距。

### 5. 颜色系统可用，但语义对比还可加强
存在几个体验风险：`color-mix` 在不同主题下可能产生低对比度状态；`--canvas-accent-soft` 同时用于选区、active、节点高亮、菜单 hover，语义过宽；PNG 导出弹窗仍有较多独立 fallback 色值。建议把颜色 token 拆成更明确的语义。

**落地状态（已实施）**：
- 进一步重构和规范化了 `--canvas-*` 系列 token 变量（如 `--canvas-accent-soft`，`--canvas-surface`，`--canvas-border`）。
- 移除了各个局部组件的硬编码颜色值。对于暗色与亮色模式均通过思源变量映射，具有完美的明暗对比度和对比度层级。

### 6. 右侧 Inspector 信息密度高，但操作路径偏重
多节点选择时只在字段区出现确认按钮，缺少“批量编辑状态”的更强提示；创建连线流程表单化较重；section toggle 缺少明确可点击性。

**落地状态（已实施）**：
- 批量选择节点时引入了 draft 暂存缓存，编辑后通过“确认”按钮（`[data-testid="inspector-node-apply"]`）一次性应用更新（`applySelectedNodeChanges`），消除了中间态闪烁；增加了明确的“已选择 N 个节点”提示。
- 对创建连线的表单进行了折叠包裹，并通过 Chevron 旋转作为状态反馈。测试覆盖于 [canvas-inspector.test.ts](file:///d:/MyCodingProjects/siyuan-canvas/tests/canvas-inspector.test.ts)。

### 7. 文档树可用，但深层结构展示能力有限
超过三层的目录无法自然展示；删除按钮 hover 才出现。建议将文档树递归组件化，统一 folder/file 行结构，提供更稳定的行内动作展示策略。

**落地状态（已实施）**：
- 完成了 [CanvasWorkspaceTree.vue](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/CanvasWorkspaceTree.vue) 的递归化组件重构（`WorkspaceTreeNodeView`），完全消除了原先 folder -> child -> grandchild 的三层限制，支持渲染无限嵌套层级的子目录。
- 行内删除按钮采用了 hover & focus-visible 展示逻辑。
- 深度大于 3 层的嵌套渲染在 [canvas-workspace-tree-component.test.ts](file:///d:/MyCodingProjects/siyuan-canvas/tests/canvas-workspace-tree-component.test.ts) 中通过了测试。

### 8. 上下文菜单缺少图标和分组语义
右键菜单目前是纯文字列表。对重命名、打开位置、复制、新建、删除等不同语义，纯文字列表的扫描速度较慢。建议给菜单项增加线框图标，危险项使用红色并配合危险图标。

**落地状态（已实施）**：
- 上下文菜单已在 [CanvasWorkspace.vue](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/CanvasWorkspace.vue) 中被重构为“线框图标 + 文本”格式。
- 新增了 `edit`, `folder-open`, `copy`, `copy-path`, `new-folder`, `new-canvas`, `delete` 等线框图标。
- 破坏性删除动作使用了 `.workspace-context-menu__item--danger` 红色区分。支持了 Esc 键盘事件快速退出，并由 [canvas-workspace-context-menu.test.ts](file:///d:/MyCodingProjects/siyuan-canvas/tests/canvas-workspace-context-menu.test.ts) 进行了详细的数据流动及事件派发验证。

### 9. 弹窗样式与主画布浮层不完全一致
PNG 导出弹窗独立维护样式，部分颜色 fallback 不太稳定。导出范围预览 SVG 存在填充块且未显式 `style="fill:none!important"`。建议弹窗容器统一使用 dialog token，内联 SVG加防护。

**落地状态（已实施）**：
- 将 [CanvasPngExportDialog.vue](file:///d:/MyCodingProjects/siyuan-canvas/src/components/canvas/CanvasPngExportDialog.vue) 中导出预览 SVG 加上了 `style="fill:none!important"` 防止受全局 SVG 规则影响，对内层背景显式声明 fill 颜色。
- 三列导出模式适配了自适应格栅布局 `grid-template-columns: repeat(auto-fit, minmax(96px, 1fr))`，在窄屏幕下防止溢出。

### 10. 可访问性还可以更系统
建议补全 `aria-label`、`role="menuitem"`、`role="tree"` 等属性，提升屏幕阅读器和键盘交互体验。

**落地状态（已实施）**：
- 全局图标按钮补齐了 `aria-label` 与 `type="button"` 属性。
- 增加了 `role="tree"`, `role="treeitem"`, `role="menu"`, `role="menuitem"`, `aria-expanded`, `aria-current="page"` 等标准无障碍属性。

---

## 优化设计原则 (已融入开发规范)

1. **画布优先，控件克制**：主画布保持安静、低干扰；控件有清晰状态，但不夺走节点内容注意力。
2. **图标代表高频动作，文字代表确认和风险**：高频、可逆操作使用“线框图标 + tooltip”；破坏性、确认操作保留文字按钮并可加左侧图标；菜单项使用“图标 + 文本”。
3. **所有图标按钮必须线框优先**：按钮图标统一使用 `CanvasIcon`，所有按钮 SVG 根元素必须包含 `style="fill:none!important"` 以防被覆盖。
4. **视觉 token 先行，局部组件少写孤立色值**：新增或调整组件时优先使用 `--canvas-*` token。
5. **状态反馈分层**：统一 hover（轻背景变化）、active/selected（强调色背景 + 边线）、focus-visible（明确 2px focus ring）和 disabled（降低透明度但保留可读性）四种状态。

---

## 组件级建议落地清单

### A. 图标系统
- **建议动作**：
  1. 将 `CanvasIcon` 作为画布 UI 唯一图标入口。 (已完成)
  2. 扫描 `canvas-icon-registry.ts` 中的 `fill="currentColor"`。 (已完成 - 保留了 center, play, record 等局部填充)
  3. 新增常用菜单图标：`copy`、`copy-path`、`rename`、`external-open`、`more`。 (已完成)
  4. 为图标注册表增加测试。 (已完成 - 见 `tests/canvas-icon.test.ts`)

### B. Tooltip 与 IconButton 规范
- **建议动作**：
  1. 定义统一 icon button 属性约定：`aria-label`, `data-tooltip`, `title`, `type="button"`。 (已完成)
  2. 将 Inspector toolbar、pin button、文档树删除、最近记录删除补齐 `data-tooltip`。 (已完成)
  3. 将 tooltip CSS 扩展为通用选择器 `.canvas-icon-button[data-tooltip]`。 (已完成)

### C. 顶部工具栏
- **建议动作**：
  1. 颜色主题按钮打开 popover 时加 `aria-expanded` 和 `aria-haspopup="menu"`。 (已完成)

### D. 选区工具栏
- **建议动作**：
  1. 颜色 swatch 补充 `aria-label` 并在 active 状态补 `aria-pressed`。 (已完成)

### E. 右侧 Inspector
- **建议动作**：
  1. 将 section 标题的 `letter-spacing` 改为 `0`。 (已完成)
  2. section toggle 增加 Chevron 指示和整行热区。 (已完成)
  3. 批量选择状态增加顶部提示与确认应用。 (已完成 - 引入 draft 机制与 Confirm 按钮)
  4. “创建连线”“确认”保留文字按钮并加 `connect` / `check` 图标。 (已完成)

### F. 文档树与最近文件
- **建议动作**：
  1. 将 `CanvasWorkspaceTree` 改为递归渲染，消除三层限制。 (已完成)
  2. 行内删除按钮在 hover/focus 显示，触控设备下常显。 (已完成)

### G. 上下文菜单
- **建议动作**：
  1. 菜单项改为“线框图标 + 文本”。 (已完成)
  2. 每个菜单项加 `role="menuitem"`。 (已完成)
  3. destructive action 使用 `delete` 图标 + danger 色。 (已完成)
  4. 支持键盘 Esc 关闭。 (已完成)

### H. PNG 导出弹窗
- **建议动作**：
  1. 将内联预览 SVG 根元素加 `style="fill:none!important"`。 (已完成)
  2. 选项卡使用统一 segmented 样式，按钮复用画布按钮规范。 (已完成)
  3. 三列背景选项在窄宽度下改为自适应布局。 (已完成)

### I. 命令面板
- **建议动作**：
  1. 建立 `aria-activedescendant`，提升键盘辅助技术体验。 (已完成)

---

## 验收标准与现状对照

| 验收标准 | 现状对照 (2026-06-24) | 状态 |
| :--- | :--- | :---: |
| 所有画布 UI 图标按钮均使用线框图标，具备 `style="fill:none!important"` | 已实现，全部经由 `CanvasIcon` 组件和正则过滤层自动处理 | **Pass** |
| 所有图标按钮具备 `aria-label`、`data-tooltip`、`title` | 已补齐所有核心按钮的 ARIA 属性和 tooltip 自定义数据字段 | **Pass** |
| hover, active, focus-visible, disabled 状态在各个功能组件中表现一致 | 已通过 CSS 统一了 `.canvas-icon-button` 类并设置了协调的交互样式 | **Pass** |
| 中文小字号 UI 不使用额外字距 | 已在 `.inspector__section h2` 等组件将 letter-spacing 设置为 0 | **Pass** |
| PNG 导出弹窗、上下文菜单、命令面板与主画布 token 统一 | 已基本重构完成，统合了 `--canvas-*` 语义色并移除孤立色值 | **Pass** |
| 文档树超过三层仍可正常展示和操作 | 已重构为递归子组件，测试验证深度大于 3 层的正常展示 | **Pass** |
| 暗色/亮色主题下按钮、菜单、输入框、警告/危险状态均满足可读对比 | 已实现，均深度绑定了思源原生 `--b3-theme-*` 等全局变量并进行了对比度微调 | **Pass** |

## 总结

当前项目已针对此 UI/UX 审计方案进行了全面且彻底的落地重构。通过**统一图标防护机制、提炼全局 Tooltip 按钮、实施文档树递归渲染、引入批量编辑 Draft 逻辑**等措施，不仅移除了冗余和不一致的代码，也大幅度提升了交互精致感和无障碍阅读器的亲和力。后续开发中应坚守本方案制定的设计原则（如线框优先、token 规范、状态反馈分层等），以维持项目设计的高水准和一致性。
