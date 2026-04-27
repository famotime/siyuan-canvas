# 思源 Canvas

思源 Canvas 是一个思源笔记插件，用于导入、编辑并导出 Obsidian `.canvas` 文件，底层遵循开放的 JSON Canvas 格式。

## 已实现能力

- 打开思源工作区内的标准 `.canvas` 文件
- 导入本地 `.canvas` 文件到思源内编辑
- 编辑 `text`、`file`、`link`、`group` 四类节点
- 创建和编辑带方向锚点、标签的连线
- 保存回思源工作区，或导出为兼容 Obsidian 的标准 `.canvas`
- 双击指向 `.canvas` 的文件节点可在新页签中打开

## 说明

- 插件实现以 `obsidianmd/jsoncanvas` 公开规范为基线。
- 当前版本优先保证文件互通与核心编辑闭环，不追求与 Obsidian Canvas 的完全视觉一致。
