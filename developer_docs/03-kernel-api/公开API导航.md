# 公开 API 导航

- 适用版本：SiYuan `v3.5.7`
- 官方仓库同步到：`siyuan-note/siyuan@master` + Release `v3.5.7`（2026-02-14）
- 最后核对：2026-02-21
- 稳定性：stable
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md>

## 1. 调用规范

- 端点默认：`http://127.0.0.1:6806`
- 主体以 `POST /api/*` 为主（部分系统接口同时支持 GET）
- 统一返回结构：

```json
{
  "code": 0,
  "msg": "",
  "data": {}
}
```

- `code != 0` 代表失败，需处理 `msg`

## 2. 公开 API 模块总览（与 API_zh_CN 同步）

- 笔记本（notebook）
- 文档（filetree/doc）
- 资源（asset）
- 块（block）
- 属性（attr）
- SQL（query/sqlite）
- 模板（template）
- 文件（file）
- 导出（export）
- 转换（convert）
- 通知（notification）
- 网络（network）
- 系统（system）

完整端点索引见：`reference/07-official-index/官方API全量索引-按模块.md`

## 3. 插件开发常用分类

- 笔记本：`/api/notebook/*`
- 文档树：`/api/filetree/*`
- 块操作：`/api/block/*`
- 块属性：`/api/attr/*`
- SQL：`/api/query/sql`
- 文件：`/api/file/*`
- 数据库/属性视图：`/api/av/*`
- 通知：`/api/notification/*`
- 系统：`/api/system/version`、`/api/system/currentTime`

## 4. 插件常用组合

### 场景：插入并标记块

1. `/api/block/insertBlock`
2. `/api/attr/setBlockAttrs`

### 场景：按关键词找块

1. `/api/query/sql`
2. 根据结果二次调用 `/api/block/getBlockKramdown`

## 4.1 常用接口示例

完整示例见：`reference/03-kernel-api/常用接口调用示例.md`

## 5. 响应处理建议

- 为接口错误定义统一错误类
- 记录 `url + data + code + msg` 到调试日志
- 给用户展示可读错误（`showMessage`）

## 6. 本章如何使用

- 先看 API 分类，再进入对应专题
- 数据库功能请直接跳 `reference/04-database-av/`
- 遇到接口失效，先看 `弃用接口迁移清单-2026H1.md`
- 需要全量端点时，转到 `reference/07-official-index/官方API全量索引-按模块.md`
