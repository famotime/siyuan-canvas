# SQL 表结构速查

- 适用版本：SiYuan `v3.5.7`
- 最后核对：2026-02-21
- 稳定性：stable（查询）/ caution（写入）
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md>
  - <https://github.com/siyuan-community/siyuan-developer-docs/tree/main/docs/zh-Hans/reference/database>

## 1. 常用表

- `blocks`：内容块主表
- `refs`：块引用关系
- `attributes`：属性键值
- `assets`：资源文件索引
- `spans`：行内元素索引

详表与字段语义见：`reference/04-database-av/数据库表与字段详解.md`

## 2. blocks 核心字段

- `id`：块 ID
- `parent_id` / `root_id`：父块与文档根块
- `box` / `path` / `hpath`：归属与路径
- `type` / `subtype`：块类型
- `content` / `markdown`：文本内容
- `created` / `updated`：时间戳

## 3. 常见查询

### 根据关键词查块

```sql
SELECT id, type, content
FROM blocks
WHERE content LIKE '%keyword%'
LIMIT 50;
```

### 查某文档下块

```sql
SELECT id, parent_id, type, content
FROM blocks
WHERE root_id = '20210104091228-d0rzbmm';
```

## 4. 安全边界

- 插件中建议只读查询 SQL，写入应走官方 API
- 避免依赖未文档化字段的业务语义
- 大查询注意 `LIMIT` 与分页，避免卡 UI

## 5. 本章如何使用

- 当 API 无法直接满足查询需求时，用 SQL 做补充检索
- 查询结果再回到 `/api/block/*` 或 `/api/attr/*` 做标准化处理
- 不把 SQL 结构当作长期稳定契约
