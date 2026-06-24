# 思源画布 UI/UX 审视与优化方案

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

## 核心问题

### 1. 图标系统未完全统一

当前存在三类图标来源：

- `CanvasIcon`：用于画布主要 UI，带 `fill:none!important` 防护。
- `SyIcon.vue`：使用思源 symbol sprite，未显式加入 `fill:none!important`。
- 组件内联 SVG：如 PNG 导出弹窗、边箭头 marker、Markdown 视频卡片等，部分直接使用 `fill="currentColor"`。

这会带来三个问题：

- 同一界面中图标线条粗细、填充方式、视觉重量不一致。
- 思源全局 CSS 仍可能影响非 `CanvasIcon` 的 SVG。
- “按钮图标尽量线框化”的规范无法被组件层稳定执行。

尤其需要注意：`canvas-icon-registry.ts` 中仍有部分图标包含 `fill="currentColor"`，例如 `center` 的中心点、`help` 的点、`decompose` 的圆点、`canvas-file` 的中心圆、`play`、`record`。这些图标在 `CanvasIcon` 防护逻辑下会被保留实心填充。如果它们用于按钮，应重新评估是否保留实心语义；若只是强化视觉焦点，可以改为线框小圆或空心图形。

### 2. Tooltip 能力分布不均

顶部工具栏有 `data-tooltip`，选区工具栏也通过 CSS 统一处理 tooltip。但 Inspector 工具栏、文档树删除按钮、最近文档删除按钮、右侧 pin 按钮等主要依赖原生 `title`。

原生 `title` 的问题：

- 展示延迟、样式不可控。
- 不适合触控设备。
- 与已有自定义 tooltip 视觉不一致。
- 部分浏览器/宿主环境中反馈不稳定。

建议将所有图标按钮统一使用 `data-tooltip + aria-label + title`，其中 `title` 仅作为兜底，不作为主要体验。

### 3. 按钮形态与语义层级还不够统一

当前界面同时存在多套按钮样式：

- `.toolbar__button`
- `.selection-toolbar__button`
- `.inspector__toolbar-button`
- `.png-export-btn`
- `.conflict-banner__button`
- `.workspace-context-menu__item`
- `SyButton`

视觉上大体协调，但具体尺寸、圆角、hover、focus、禁用、激活态不完全一致。例如顶部工具栏图标按钮是 32px，Inspector pin 是 28px，文档树删除按钮是 24px，弹窗按钮另起一套样式。长期会让用户形成“不确定哪些按钮是同一类操作”的感知。

建议抽象出画布内部按钮规范，而不是强制所有组件使用同一个 Vue 组件：

- IconButton：24 / 28 / 32 三档尺寸，统一 hover、active、focus-visible、disabled。
- TextButton：用于弹窗确认、冲突处理、危险操作。
- MenuItem：用于右键菜单、下拉菜单、命令列表。
- SegmentedControl：用于 Inspector tab、导出范围、背景选项。

### 4. 字体层级偏散，局部字距不必要

当前字体基本跟随思源主题，这是正确方向。但 Inspector section 标题使用 `letter-spacing: 0.04em`，命令类别、标签类文字也存在较多 uppercase/letter spacing 处理。对于中文界面，过度字距会让小字号文字显得松散，影响扫读效率。

建议：

- 中文 UI 文本不使用正字距，`letter-spacing` 统一为 `0`。
- 12px 用于辅助信息、标签、元信息。
- 13px 用于列表项、按钮、表单正文。
- 14px 用于输入框主要编辑内容和命令面板输入。
- 16px 仅用于弹窗标题和重要分区标题。
- 数字状态继续使用 `font-variant-numeric: tabular-nums`。

### 5. 颜色系统可用，但语义对比还可加强

当前颜色从思源变量派生，兼容性好。但存在几个体验风险：

- `color-mix(... transparent)` 在不同主题下可能产生低对比度状态。
- `--canvas-accent-soft` 同时用于选区、active、节点高亮、菜单 hover，语义过宽。
- PNG 导出弹窗仍有较多独立 fallback 色值，和主画布 token 不完全一致。
- 危险、警告、成功色依赖 `--b3-card-*`，在某些主题下可能对按钮文字不够稳定。

建议把颜色 token 拆成更明确的语义：

- `--canvas-action-hover`
- `--canvas-action-active`
- `--canvas-selection-bg`
- `--canvas-current-bg`
- `--canvas-warning-bg`
- `--canvas-danger-bg`
- `--canvas-focus-ring`

这样能避免“所有浅色强调态看起来都像选中”的问题。

### 6. 右侧 Inspector 信息密度高，但操作路径偏重

Inspector 已按文档/选区分 tab，但选区面板中字段、节点连线、创建连线、边属性都以折叠 section 堆叠。对新用户而言，“我选中了节点后应该在哪里改颜色、改文字、建连线”仍需要探索。

当前明显问题：

- 多节点选择时只在字段区出现确认按钮，缺少“批量编辑状态”的更强提示。
- 创建连线流程表单化较重，和画布上的拖拽连线心智不同。
- section toggle 是整行按钮，但视觉上像标题，缺少明确可点击性。
- 一些文字按钮如“确认”“创建连线”可继续保留文字，但建议补充图标，帮助快速识别动作性质。

### 7. 文档树可用，但深层结构展示能力有限

`CanvasWorkspaceTree.vue` 当前模板手写到了 folder、child、grandchild 三层，虽然可能满足多数场景，但从 UX 与可维护性看都有问题：

- 超过三层的目录无法自然展示。
- 同类节点重复模板导致后续样式和交互容易不一致。
- 删除按钮 hover 才出现，桌面端可接受，但触控和低熟练用户可发现性较弱。

建议后续将文档树递归组件化，统一 folder/file 行结构，并提供更稳定的行内动作展示策略：hover 显示、focus 显示、触控设备常显。

### 8. 上下文菜单缺少图标和分组语义

右键菜单目前是纯文字列表。对轻量菜单而言这不是错误，但当前操作包含重命名、打开位置、复制、复制路径、新建、删除等不同语义，纯文字列表的扫描速度较慢。

建议给菜单项增加线框图标：

- 重命名：edit
- 打开所在位置：folder-open
- 复制：copy，需新增图标
- 复制路径：link 或 file-path，需新增图标
- 新建子文件夹：new-folder
- 新建画布：new-canvas
- 删除：delete

危险项继续使用红色，但避免只依赖颜色，图标也应表达危险语义。

### 9. 弹窗样式与主画布浮层不完全一致

PNG 导出弹窗已经比较完整，但它独立维护 `.png-export-*` 样式，部分颜色 fallback 使用 `--b3-theme-primary-lightest` 等不一定存在的变量。导出范围预览 SVG 中存在填充块，也未显式 `style="fill:none!important"` 放在 `<svg>` 上。

建议：

- 弹窗容器统一使用 `.canvas-dialog` 或共享 dialog token。
- 选项卡使用统一 segmented/card option 样式。
- 内联 SVG `<svg>` 加 `style="fill:none!important"`，需要填充的背景块改用 CSS 背景或显式局部 `fill`，并确保不是按钮图标的主视觉。

### 10. 可访问性还可以更系统

已有 `aria-label`、`aria-expanded`、`role="tab"` 等基础属性，但仍有补强空间：

- 所有图标按钮应有 `aria-label`。
- 下拉菜单项应补 `role="menuitem"`。
- 当前 active 菜单项可用 `aria-checked` 或 `aria-current` 表达。
- 命令面板输入框应与 listbox 建立 `aria-controls` / `aria-activedescendant`。
- 文档树可考虑 `role="tree"` / `treeitem"`，但不要为了语义破坏键盘交互；如果加 tree role，应同步支持方向键导航。

## 优化设计原则

### 1. 画布优先，控件克制

这是生产力工具，不需要营销化视觉。主画布应保持安静、低干扰；控件应有清晰状态，但不能抢夺节点内容注意力。

### 2. 图标代表高频动作，文字代表确认和风险

建议：

- 高频、可逆、上下文明确的操作使用“线框图标 + tooltip”。
- 破坏性操作、导出确认、冲突覆盖等高风险动作保留文字按钮，并可加左侧图标。
- 菜单项使用“图标 + 文本”，不要只靠图标。

### 3. 所有图标按钮必须线框优先

按钮图标统一使用 `CanvasIcon` 或同等处理方式。所有按钮 SVG 的根元素必须显式包含：

```html
<svg style="fill:none!important" ...>
```

如果某个图标确实需要实心语义，例如录制红点，应在规范中例外说明，并避免被普通按钮图标误用。

### 4. 视觉 token 先行，局部组件少写孤立色值

新增或调整组件时优先使用 `--canvas-*` token。只有文件预览、视频平台标识、实际内容色彩等业务语义允许使用具体色值。

### 5. 状态反馈分层

统一四类状态：

- hover：轻背景变化。
- active/selected：强调色背景 + 边线或左侧条。
- focus-visible：明确 2px focus ring。
- disabled：降低透明度，同时保留可读性。

## 组件级优化建议

### A. 图标系统

优先级：高

建议动作：

1. 将 `CanvasIcon` 作为画布 UI 唯一图标入口。
2. 为 `SyIcon.vue` 的 `<svg>` 增加 `style="fill:none!important"`，或避免在画布组件中使用 `SyIcon`。
3. 扫描 `canvas-icon-registry.ts` 中的 `fill="currentColor"`：
   - `play`、`record` 可作为录制/播放语义例外，但应记录在注释中。
   - `help`、`center`、`decompose`、`canvas-file` 等可改为线框小圆或空心圆。
4. 新增常用菜单图标：`copy`、`copy-path`、`rename`、`external-open`、`more`。
5. 为图标注册表增加测试，验证每个 SVG 根元素经 `hardenStrokeOnlySvgFill()` 后包含 `fill:none!important`。

### B. Tooltip 与 IconButton 规范

优先级：高

建议动作：

1. 定义统一 icon button 属性约定：
   - `aria-label`
   - `data-tooltip`
   - `title`
   - `type="button"`
2. 将 Inspector toolbar、pin button、文档树删除、最近记录删除补齐 `data-tooltip`。
3. 将 tooltip CSS 从 `.toolbar__button` / `.selection-toolbar__button` 扩展为通用选择器，例如 `.canvas-icon-button[data-tooltip]::after`。
4. 触控端继续禁用 hover tooltip，但保留 `aria-label`。

### C. 顶部工具栏

优先级：中

建议动作：

1. 当前工具栏分组合理，可增加“分组 tooltip 或 aria-label”覆盖所有 group。
2. 保存按钮的 dirty/conflict/saving badge 建议增加 tooltip 文案差异，使用户知道小点含义。
3. 缩放百分比按钮可保留文字，因为它是状态 + 操作，不建议强行图标化。
4. 颜色主题按钮打开 popover 时加 `aria-expanded` 和 `aria-haspopup="menu"`。

### D. 选区工具栏

优先级：高

建议动作：

1. 选区工具栏是高频操作区，应保持全图标化，tooltip 必须稳定。
2. 布局菜单现在是“图标 + 文字”，这是正确的，因为布局动作相似，需要文字辅助。
3. 颜色 swatch 应补充 `aria-label`，例如“颜色 1 / 颜色 2”，并在 active 状态补 `aria-pressed`。
4. 边方向菜单应确保三种方向图标的视觉差异足够明显，避免只靠 tooltip 区分。

### E. 右侧 Inspector

优先级：高

建议动作：

1. 将 section 标题的 `letter-spacing` 改为 `0`，提升中文小字号可读性。
2. section toggle 增加 hover 背景或左侧 chevron 热区感，让用户明确可以折叠。
3. Inspector toolbar 图标按钮补统一 tooltip 和 focus-visible。
4. 批量选择状态增加顶部提示条，例如“已选择 3 个节点，修改尺寸后点击应用”。
5. 创建连线表单可增加简化入口：
   - 主路径：画布拖拽锚点创建。
   - 高级路径：Inspector 表单精确选择来源/目标。
6. “创建连线”“确认”保留文字按钮，但建议加 `connect` / `check` 图标。

### F. 文档树与最近文件

优先级：中

建议动作：

1. 将 `CanvasWorkspaceTree` 改为递归渲染，消除三层限制。
2. 行内删除按钮在 hover/focus 显示；触控设备下常显。
3. 文件行右键菜单可增加行尾 “more” 图标，提升菜单可发现性。
4. 文件夹拖拽目标状态可以更强：背景 + 左侧条 + 边框，而不只依赖左侧条。

### G. 上下文菜单

优先级：中

建议动作：

1. 菜单项改为“线框图标 + 文本”。
2. 每个菜单项加 `role="menuitem"`。
3. destructive action 使用 `delete` 图标 + danger 色。
4. 支持键盘 Esc 关闭、上下键移动、Enter 执行。

### H. PNG 导出弹窗

优先级：中

建议动作：

1. 将内联预览 SVG 根元素加 `style="fill:none!important"`。
2. 如果预览需要浅色块，明确给具体子元素 `fill`，避免受全局 fill 影响。
3. 弹窗按钮复用画布 TextButton token。
4. 三列背景选项在窄宽度下改为单列或 `minmax(96px, 1fr)`，避免长中文挤压。

### I. 命令面板

优先级：低到中

建议动作：

1. 命令项可增加图标，提高扫描速度。
2. shortcut 样式可以做成轻量 keycap，但避免过强装饰。
3. 建立 `aria-activedescendant`，提升键盘辅助技术体验。

## 推荐落地顺序

### 第一阶段：统一图标与按钮底座

目标：先解决最影响一致性和后续扩展的问题。

建议包含：

- 扫描并修复按钮图标 SVG 根元素 `fill:none!important` 覆盖问题。
- 统一 `CanvasIcon` 使用范围。
- 给 Inspector、文档树、最近列表图标按钮补 `aria-label`、`data-tooltip`。
- 抽取通用 icon button class 或轻量组件。
- 增加图标线框防护测试。

### 第二阶段：整理视觉 token 与字体层级

目标：让界面更稳定、更像一个完整产品。

建议包含：

- 去掉中文小字号不必要的 `letter-spacing`。
- 拆分 hover、active、selection、current、danger、warning token。
- 统一按钮圆角、尺寸、focus-visible。
- 将 PNG 导出弹窗、冲突按钮、上下文菜单逐步迁移到统一 token。

### 第三阶段：优化高频交互路径

目标：降低新用户上手成本，提高熟练用户效率。

建议包含：

- 选区工具栏补完整 tooltip、aria 状态。
- Inspector 批量编辑提示与创建连线流程优化。
- 文档树递归化、行内菜单可发现性增强。
- 上下文菜单增加图标与键盘操作。

### 第四阶段：可访问性与移动端细节

目标：补足长期质量。

建议包含：

- 命令面板 `aria-controls` / `aria-activedescendant`。
- 文档树如采用 tree role，则同步实现方向键导航。
- 触控设备下行内操作按钮常显，禁用 hover tooltip。
- 检查所有文字在窄宽度下不溢出按钮或卡片。

## 验收标准

1. 所有画布 UI 图标按钮均使用线框图标，根 `<svg>` 明确具备 `style="fill:none!important"` 或通过 `CanvasIcon` 自动注入。
2. 所有图标按钮具备 `aria-label`、`data-tooltip`、`title`。
3. hover、active、focus-visible、disabled 四类状态在顶部工具栏、选区工具栏、Inspector、文档树中表现一致。
4. 中文小字号 UI 不使用额外字距。
5. PNG 导出弹窗、上下文菜单、命令面板与主画布 token 统一。
6. 文档树超过三层仍可正常展示和操作。
7. 暗色/亮色主题下按钮、菜单、输入框、警告/危险状态均满足可读对比。

## 总结

当前项目的 UI 基础已经比较完整，主要问题不是“缺少设计”，而是随着功能增长出现了多套局部控件、局部图标和局部状态样式。建议后续以“图标系统统一”和“按钮/tooltip 规范统一”为切入点，这两项能最快提升专业感和可维护性；再逐步优化 Inspector、文档树和上下文菜单的交互密度与可发现性。
