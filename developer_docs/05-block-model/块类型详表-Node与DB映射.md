# 块类型详表 - Node 与 DB 映射

- 适用版本：SiYuan `v3.5.7`
- 官方仓库同步到：`siyuan-note/siyuan@master` + Release `v3.5.7`（2026-02-14）
- 最后核对：2026-02-21
- 稳定性：stable
- 权威来源：
  - <https://github.com/siyuan-community/siyuan-developer-docs/tree/main/docs/zh-Hans/reference/block>
  - <https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md>

## 1. 映射说明

前端 DOM 使用 `data-type` / `data-subtype`，数据库使用 `blocks.type` / `blocks.subtype`。两套值语义一致但命名不同，建议做统一映射层。

## 2. Node 与 DB 映射表

|data-type（Node）|blocks.type|常见 data-subtype / subtype|结构|说明|
|---|---|---|---|---|
|`NodeAttributeView`|`av`|无|叶子块|属性视图（数据库）|
|`NodeAudio`|`audio`|无|叶子块|音频块|
|`NodeBlockQueryEmbed`|`query_embed`|无|叶子块|嵌入块|
|`NodeBlockquote`|`b`|无|容器块|引述块|
|`NodeCodeBlock`|`c`|语言值|叶子块|代码块|
|`NodeDocument`|`d`|无|容器块|文档块|
|`NodeHTMLBlock`|`html`|无|叶子块|HTML 块|
|`NodeHeading`|`h`|`h1`~`h6`|叶子块|标题块|
|`NodeIFrame`|`iframe`|无|叶子块|IFrame 块|
|`NodeList`|`l`|`o`/`u`/`t`|容器块|列表块|
|`NodeListItem`|`i`|`o`/`u`/`t`|容器块|列表项|
|`NodeMathBlock`|`m`|无|叶子块|公式块|
|`NodeParagraph`|`p`|无|叶子块|段落块|
|`NodeSuperBlock`|`s`|无|容器块|超级块|
|`NodeTable`|`t`|无|叶子块|表格块|
|`NodeThematicBreak`|`tb`|无|叶子块|分割线|
|`NodeVideo`|`video`|无|叶子块|视频块|
|`NodeWidget`|`widget`|无|叶子块|挂件块|

## 3. subtype 对照表

|类型|subtype|含义|
|---|---|---|
|`h`|`h1`~`h6`|一到六级标题|
|`l`|`o`|有序列表|
|`l`|`u`|无序列表|
|`l`|`t`|任务列表|
|`i`|`o`|有序列表项|
|`i`|`u`|无序列表项|
|`i`|`t`|任务列表项|

## 4. 使用建议

- SQL 查询时使用 `blocks.type` / `blocks.subtype`。
- DOM 操作时优先读取 `data-type` / `data-subtype`，避免硬编码假设。
- 容器块可包含子块，叶子块默认不再展开子层。
