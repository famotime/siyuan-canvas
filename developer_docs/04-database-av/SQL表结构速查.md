# SQL 表结构速查

- 适用版本：SiYuan `v3.8.3`
- 官方仓库同步到：`siyuan-note/siyuan@master` + Release `v3.8.3`（2026-09-13）
- 最后核对：2026-09-13
- 稳定性：stable（只读查询）/ caution（严禁直接通过 SQL 写入）
- 权威来源：
  - [../03-kernel-api/official/API_zh_CN.md](../03-kernel-api/official/API_zh_CN.md)
  - [数据库表与字段详解.md](数据库表与字段详解.md)

## 1. 核心 SQLite 关系表总览

| 表名 | 数据粒度 | 核心索引键 | 典型业务场景 |
|---|---|---|---|
| `blocks` | 内容块主表 | `id`, `root_id`, `parent_id`, `box`, `type` | 关键词全文搜索、文档树结构遍历、按块类型聚合 |
| `refs` | 双向链接与块引用 | `def_block_id`, `block_id`, `root_id` | 反向链接统计、引用图谱分析 |
| `attributes` | 块属性键值对 | `block_id`, `name`, `value` | 查询带有 `custom-*` 业务属性的块 |
| `assets` | 静态附件与资源文件 | `path`, `block_id`, `root_id` | 附件被引用次数计算、孤立静态文件分析 |
| `spans` | 行内文本与样式标记 | `block_id`, `type`, `content` | 行内标签（`#标签#`）、链接锚点精确检索 |
| `file_annotation_refs` | 附件批注索引表 | `file_path`, `block_id` | PDF 阅读器高亮与批注关联 |

## 2. blocks 表关键字段规范

- `id`：块唯一标识（22 位时间戳字符）。
- `parent_id` / `root_id`：父块 ID 与文档根块 ID。
- `box` / `path` / `hpath`：笔记本 ID、物理 `.sy` 路径与人类可读层级路径。
- `type` / `subtype`：块主类型与子类型。在 v3.8.3 中：
  - `custom`：插件自定义块（`NodeCustomBlock`）。
  - `tabs`：选项卡容器块（`NodeTabs`）。
  - `tab`：选项卡子页面块（`NodeTabItem`）。
  - `callout`：提示卡片块（`NodeCallout`）。
  - 传统类型：`d` (文档), `h` (标题), `p` (段落), `c` (代码), `m` (公式), `t` (表格), `l` (列表), `i` (列表项), `b` (引述), `s` (超级块), `av` (属性视图)。
- `content` / `markdown`：去掉标记的纯文本内容与带完整标记的 Markdown 文本。
- `ial`：行内属性列表（序列化文本）。
- `created` / `updated`：创建与最后更新时间戳字符串（如 `20260913080000`）。

## 3. 高频实用 SQL 示例

### 3.1 检索自定义块与选项卡容器

```sql
SELECT id, root_id, type, content, updated
FROM blocks
WHERE type IN ('custom', 'tabs', 'tab')
ORDER BY updated DESC
LIMIT 50;
```

### 3.2 跨文档检索包含特定自定义属性的块

```sql
SELECT b.id, b.root_id, b.content, a.name, a.value
FROM blocks AS b
JOIN attributes AS a ON b.id = a.block_id
WHERE a.name = 'custom-task-status' AND a.value = 'in_progress'
LIMIT 50;
```

### 3.3 统计文档的反向链接引用数

```sql
SELECT def_block_id, COUNT(*) AS ref_count
FROM refs
WHERE def_block_root_id = '20260913080000-doc12345'
GROUP BY def_block_id
ORDER BY ref_count DESC;
```

## 4. 安全与性能准则

1. **只读性契约**：思源内核对外部插件只开放只读 SQL 访问，**绝不能尝试执行 `UPDATE`、`DELETE` 或 `DROP`**。
2. **强制分页与限制**：执行全文检索或复杂联表查询时，**必须带上 `LIMIT` 限制**，避免因工作空间海量数据卡顿主线程。
