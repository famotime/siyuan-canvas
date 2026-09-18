# 公开 API 导航

- 适用版本：SiYuan `v3.8.3`
- 官方仓库同步到：`siyuan-note/siyuan@master` + Release `v3.8.3`（2026-09-13）
- 最后核对：2026-09-13
- 稳定性：stable
- 权威来源：
  - [official/API_zh_CN.md](official/API_zh_CN.md)
  - [official/router.go](official/router.go)

## 1. 调用规范与通信信封

### 1.1 端点与鉴权
- **服务端口**：默认运行在 `http://127.0.0.1:6806`。
- **通信方式**：绝大多数采用 `POST /api/*`，入参与出参主体均为 JSON（文件上传/写入采用 `multipart/form-data`）。
- **鉴权头**：外部脚本或未鉴权环境需在 HTTP Header 携带 `Authorization: Token <API_TOKEN>`。前端插件内直接使用 `fetchSyncPost` 时宿主会自动注入鉴权上下文。

### 1.2 统一响应结构

```json
{
  "code": 0,
  "msg": "",
  "data": {}
}
```

- `code === 0`：操作成功，结果保存在 `data`。
- `code !== 0`：操作失败，错误原因在 `msg`（如权限不足、块不存在、参数格式错误等）。

## 2. 公开 API 模块分类与演化

| 模块类别 | 基础端点前缀 | 核心能力 | v3.8.3 新增/强化能力 |
|---|---|---|---|
| **笔记本 (notebook)** | `/api/notebook/*` | 打开/关闭/重命名/新建笔记本、获取与修改配置 | `/api/notebook/reorder` 笔记本顺序重排 |
| **文档树 (filetree)** | `/api/filetree/*` | Markdown 建档、移动/重命名/删除文档、ID 与路径转换 | `/api/filetree/setSort`、`/api/filetree/setDocSortMode`、`/api/filetree/reorderDocs` 自定义排序与层级重排 |
| **内容块 (block)** | `/api/block/*` | 插入/更新/删除/移动/折叠块、取 Kramdown 文本、转移块引用 | 完善对 `NodeCustomBlock` 与 `NodeTabs` 容器块的处理 |
| **块属性 (attr)** | `/api/attr/*` | 读写块的内联属性列表（IAL），操作 `custom-*` 业务状态 | 优化大批量属性并发写入与索引刷新 |
| **SQL 查询 (query)** | `/api/query/*` | 结构化只读 SQL 检索（`blocks`, `refs`, `attributes` 等） | 全文搜索分词与大结果集限制 |
| **属性视图 (av)** | `/api/av/*` | 数据库/属性视图增删改查、批量写值、渲染与结构转换 | `/api/av/setAttrViewContextFilter` 动态过滤、文档与数据库双向转换 |
| **搜索条件 (storage)** | `/api/storage/*` | 插件与系统持久化过滤条件管理 | `/api/storage/setCriterion`、`getCriterion`、`removeCriterion` |
| **资源与文件 (asset/file)** | `/api/asset/*`, `/api/file/*` | 资源上传与管理、工作空间文件读写/重命名/目录遍历 | 强化权限隔离与大文件分块流控 |
| **系统与通知 (system/notification)** | `/api/system/*`, `/api/notification/*` | 版本查询、时间戳、启动进度、桌面通知推送 | 权限鉴权分级强化（管理员/只读区分） |

## 3. 插件开发核心接口导航

### 3.1 块与文档读写
- `/api/filetree/createDocWithMd`：使用 Markdown 文本在指定路径直接创建完整文档。
- `/api/block/insertBlock`：在指定前后位置插入内容块（支持 `markdown` 与 `dom` 格式）。
- `/api/block/getBlockKramdown`：获取指定块的标准 Kramdown 纯文本。
- `/api/block/updateBlock`：使用新 Markdown 文本全量更新指定块。
- `/api/block/deleteBlock`：删除指定块并放入历史回收区。

### 3.2 自定义属性操作
- `/api/attr/setBlockAttrs`：批量设置块属性（如 `attrs: { "custom-status": "done" }`）。
- `/api/attr/getBlockAttrs`：读取指定块的所有 IAL 属性。

### 3.3 数据库 / 属性视图 (AV)
- `/api/av/renderAttributeView`：根据 `avID` 和 `viewID` 渲染表格/画廊/看板结构数据。
- `/api/av/batchSetAttributeViewBlockAttrs`：高并发批量更新多行多列单元格数据。
- `/api/av/setAttrViewContextFilter`：设置属性视图上下文过滤规则。

### 3.4 搜索条件管理 (v3.8.3)
- `/api/storage/setCriterion`：持久化保存自定义搜索或过滤条件组。
- `/api/storage/getCriterion`：读取指定名称的过滤条件。
- `/api/storage/removeCriterion`：清理指定过滤条件。

## 4. 相关文档导航

- [03-kernel-api/常用接口调用示例.md](常用接口调用示例.md)
- [03-kernel-api/非公开API与风险说明.md](非公开API与风险说明.md)
- [03-kernel-api/official/API_zh_CN.md](official/API_zh_CN.md)
- [03-kernel-api/official/router.go](official/router.go)
- [07-official-index/官方API全量索引-按模块.md](../07-official-index/官方API全量索引-按模块.md)
