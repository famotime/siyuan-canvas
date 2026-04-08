# 思源 Canvas

思源 Canvas 是一个思源笔记插件，用于导入、编辑并导出 Obsidian `.canvas` 文件，底层遵循开放的 JSON Canvas 格式。

## 已实现能力

- 打开思源工作区内的标准 `.canvas` 文件
- 导入本地 `.canvas` 文件到思源内编辑
- 编辑 `text`、`file`、`link`、`group` 四类节点
- 创建和编辑带方向锚点、标签的连线
- 保存回思源工作区，或导出为可回到 Obsidian 的标准 `.canvas`
- 解析与导出时尽量保留未知扩展字段

## 当前交互方式

- 通过顶栏按钮或命令面板打开空白 Canvas 页签
- 在顶部工具栏中执行按路径打开、导入、保存、导出
- 通过工具栏添加节点
- 拖动节点头部移动卡片
- 拖动右下角手柄调整卡片尺寸
- 在右侧属性面板编辑节点和连线字段
- 双击链接节点可打开 URL
- 双击指向 `.canvas` 的文件节点可在新页签中继续打开

## 开发命令

```bash
pnpm install
pnpm test
pnpm build
```

如果希望 `pnpm dev` 直接输出到本地思源工作区，请在 `.env` 中配置 `VITE_SIYUAN_WORKSPACE_PATH`。

## 说明

- 插件实现以 `obsidianmd/jsoncanvas` 公开规范为基线。
- 当前版本优先保证文件互通与核心编辑闭环，不追求与 Obsidian Canvas 的完全视觉一致。
