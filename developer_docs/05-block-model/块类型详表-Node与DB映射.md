# 块类型详表 - Node 与 DB 映射

- 适用版本：SiYuan `v3.8.3`
- 官方仓库同步到：`siyuan-note/siyuan@master` + Release `v3.8.3`（2026-09-13）
- 最后核对：2026-09-13
- 稳定性：stable
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/blob/master/kernel/treenode/node.go>
  - <https://github.com/siyuan-note/siyuan/blob/master/docs/SY-FORMAT.zh-CN.md>
  - <https://github.com/siyuan-note/siyuan/blob/master/docs/TABS.md>

## 1. 双层类型体系概述

思源笔记在前端 DOM、编辑器 AST 与后端 SQLite 数据库中采用了对应但缩写不同的两套类型体系：
- **前端 DOM / AST 层**：DOM 节点使用 `data-type="NodeParagraph"`、`data-type="NodeCustomBlock"` 等完整 PascalCase 标识。
- **数据库 SQL 层**：SQLite `blocks.type` 字段使用缩写标识，例如 `p`（段落）、`custom`（自定义块）、`tabs`（选项卡容器）。

在插件开发中，建议抽象一层类型转换函数，避免在业务代码中混用硬编码字符串。

## 2. 全量映射表（Node 与 DB 对应）

| AST 节点类型 (`Node.Type`) | 前端 DOM `data-type` | SQLite `blocks.type` | 结构属性 | 常见 `subtype` / 说明 |
|---|---|---|---|---|
| `NodeCustomBlock` | `NodeCustomBlock` | `custom` | **叶子块** | **v3.8.x 插件自定义块**，由 `customBlockRenders` 渲染 |
| `NodeTabs` | `NodeTabs` | `tabs` | **容器块** | **v3.8.x 选项卡容器块**（Spec 3），直属子项只能是 `NodeTabItem` |
| `NodeTabItem` | `NodeTabItem` | `tab` | **容器块** | **v3.8.x 选项卡子项**，只能作为 `tabs` 直属子块，容纳正文块 |
| `NodeCallout` | `NodeCallout` | `callout` | **容器块** | 提示卡片块，容纳普通正文内容 |
| `NodeDocument` | `NodeDocument` | `d` | 容器块 | 文档根块 |
| `NodeHeading` | `NodeHeading` | `h` | 叶子块 | 标题块，`subtype` 为 `h1` 至 `h6` |
| `NodeParagraph` | `NodeParagraph` | `p` | 叶子块 | 普通文本段落块 |
| `NodeCodeBlock` | `NodeCodeBlock` | `c` | 叶子块 | 代码块，`subtype` 为编程语言小写标识（如 `ts`, `go`） |
| `NodeMathBlock` | `NodeMathBlock` | `m` | 叶子块 | KaTeX 数学公式块 |
| `NodeTable` | `NodeTable` | `t` | 叶子块 | 表格块 |
| `NodeList` | `NodeList` | `l` | 容器块 | 列表容器块，`subtype`：`o` (有序), `u` (无序), `t` (任务) |
| `NodeListItem` | `NodeListItem` | `i` | 容器块 | 列表项容器，`subtype` 与父列表对应 |
| `NodeBlockquote` | `NodeBlockquote` | `b` | 容器块 | 引述块（引用正文） |
| `NodeSuperBlock` | `NodeSuperBlock` | `s` | 容器块 | 超级块（多栏并排布局容器） |
| `NodeAttributeView` | `NodeAttributeView`| `av` | 叶子块 | 属性视图（数据库入口块） |
| `NodeBlockQueryEmbed` | `NodeBlockQueryEmbed` | `query_embed` | 叶子块 | SQL 嵌入动态查询块 |
| `NodeHTMLBlock` | `NodeHTMLBlock` | `html` | 叶子块 | 原生 HTML 渲染块 |
| `NodeIFrame` | `NodeIFrame` | `iframe` | 叶子块 | 网页内嵌框架块 |
| `NodeWidget` | `NodeWidget` | `widget` | 叶子块 | 挂件块（小组件微前端） |
| `NodeVideo` | `NodeVideo` | `video` | 叶子块 | 视频播放器块 |
| `NodeAudio` | `NodeAudio` | `audio` | 叶子块 | 音频播放器块 |
| `NodeThematicBreak` | `NodeThematicBreak` | `tb` | 叶子块 | 水平分割线 |

## 3. 容器包含限制规则 (Containment Rules)

思源对容器块的嵌套具有严格的形式验证：

1. **`NodeTabs`（选项卡容器）**：
   - 直属内容块**只能是 `NodeTabItem`**，至少包含一个子项。
   - 严禁直接包含普通段落、标题或其他叶子块。
2. **`NodeTabItem`（选项卡子项）**：
   - 必须直接属于 `NodeTabs`，不能挂在普通文档根节点下，也不能裸放在超级块或列表中。
   - 正文可容纳所有普通内容块，包括嵌套的 `NodeTabs`。
3. **`NodeCustomBlock`（自定义块）**：
   - 属于**叶子块**，内部保存原始文本 payload，不支持在内部直接嵌套 DOM 编辑器 Protyle。

## 4. 类型转换实用工具函数

```ts
export const BLOCK_TYPE_MAP: Record<string, string> = {
  custom: "NodeCustomBlock",
  tabs: "NodeTabs",
  tab: "NodeTabItem",
  callout: "NodeCallout",
  d: "NodeDocument",
  h: "NodeHeading",
  p: "NodeParagraph",
  c: "NodeCodeBlock",
  m: "NodeMathBlock",
  t: "NodeTable",
  l: "NodeList",
  i: "NodeListItem",
  b: "NodeBlockquote",
  s: "NodeSuperBlock",
  av: "NodeAttributeView",
  query_embed: "NodeBlockQueryEmbed",
  html: "NodeHTMLBlock",
  iframe: "NodeIFrame",
  widget: "NodeWidget",
  video: "NodeVideo",
  audio: "NodeAudio",
  tb: "NodeThematicBreak"
};

export function getAstTypeFromDbType(dbType: string): string {
  return BLOCK_TYPE_MAP[dbType] || "NodeParagraph";
}
```
