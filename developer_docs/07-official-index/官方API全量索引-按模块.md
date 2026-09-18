# 官方 API 全量索引（按模块）

- 适用版本：SiYuan `v3.8.3`
- 官方仓库同步到：`siyuan-note/siyuan@master` + Release `v3.8.3`（2026-09-13）
- 最后核对：2026-09-13
- 稳定性：public-index（官方承诺长期兼容）
- 权威来源：
  - [../03-kernel-api/official/API_zh_CN.md](../03-kernel-api/official/API_zh_CN.md)

说明：
- 本页收录官方 `API_zh_CN.md` 文档化公开端点。
- 端点参数、数据结构与响应示例请直接点击链接查阅 [official/API_zh_CN.md](../03-kernel-api/official/API_zh_CN.md)。
- 725 个全量内部与公开路由列表详见 [router.go](../03-kernel-api/official/router.go) 与 [router路由变更与风险索引.md](router路由变更与风险索引.md)。

## 1. 规范与鉴权

- 默认服务地址：`http://127.0.0.1:6806`
- 接口方法：POST（除特殊说明外）
- 统一返回信封：`{ "code": 0, "msg": "", "data": {} }`
- 鉴权请求头：`Authorization: Token <API_TOKEN>`

## 2. 笔记本 (Notebook)

- `/api/notebook/lsNotebooks`：列出所有笔记本
- `/api/notebook/openNotebook`：打开笔记本
- `/api/notebook/closeNotebook`：关闭笔记本
- `/api/notebook/renameNotebook`：重命名笔记本
- `/api/notebook/createNotebook`：创建笔记本
- `/api/notebook/removeNotebook`：删除笔记本
- `/api/notebook/getNotebookConf`：获取笔记本配置
- `/api/notebook/setNotebookConf`：保存笔记本配置

## 3. 文档 (Filetree)

- `/api/filetree/createDocWithMd`：通过 Markdown 文本创建文档
- `/api/filetree/renameDoc`：按路径重命名文档
- `/api/filetree/removeDoc`：按路径删除文档
- `/api/filetree/moveDocs`：按路径移动文档
- `/api/filetree/setSort`：**设置笔记本和文档排序值**
- `/api/filetree/setDocSortMode`：**设置文档的子文档排序方式**
- `/api/filetree/getHPathByPath`：根据物理存储路径获取人类可读路径
- `/api/filetree/getHPathByID`：根据块 ID 获取人类可读路径
- `/api/filetree/getPathByID`：根据块 ID 获取存储路径
- `/api/filetree/getIDsByHPath`：根据人类可读路径获取块 IDs

## 4. 资源文件 (Asset)

- `/api/asset/upload`：上传本地静态附件/资源文件（multipart/form-data）

## 5. 内容块 (Block)

- `/api/block/insertBlock`：插入块（支持 markdown 与 dom）
- `/api/block/prependBlock`：插入前置子块
- `/api/block/appendBlock`：插入后置子块
- `/api/block/updateBlock`：更新块内容
- `/api/block/deleteBlock`：删除指定块
- `/api/block/moveBlock`：移动块到指定目标块前后
- `/api/block/foldBlock`：折叠块
- `/api/block/unfoldBlock`：展开块
- `/api/block/getBlockKramdown`：获取块 Kramdown 文本
- `/api/block/getChildBlocks`：获取直接子块列表
- `/api/block/transferBlockRef`：转移块引用定义

## 6. 属性 (Attr)

- `/api/attr/setBlockAttrs`：设置块 IAL 属性（自定义属性必须以 `custom-` 开头）
- `/api/attr/getBlockAttrs`：获取块全部属性

## 7. 数据库 / 属性视图 (AV)

- `/api/av/renderAttributeView`：查询并渲染属性视图结构
- `/api/av/getAttributeView`：获取指定属性视图原始结构
- `/api/av/getAttributeViewPrimaryKeyValues`：获取属性视图主键列值
- `/api/av/searchAttributeView`：在属性视图中执行过滤搜索
- `/api/av/setAttributeViewBlockAttr`：设置单个单元格值
- `/api/av/batchSetAttributeViewBlockAttrs`：批量设置单元格值
- `/api/av/addAttributeViewBlocks`：绑定已有块作为行条目
- `/api/av/appendAttributeViewDetachedBlocksWithValues`：添加非绑定块条目并附带值
- `/api/av/removeAttributeViewBlocks`：移除条目
- `/api/av/changeAttributeViewLayout`：切换视图布局（table / gallery / kanban）
- `/api/av/setAttributeViewGrouping`：设置视图分组规则
- `/api/av/getAttributeViewFilterAndSort`：获取视图过滤与排序规则
- `/api/av/setAttributeViewFilter`：设置视图过滤规则
- `/api/av/setAttributeViewSort`：设置视图排序规则
- `/api/av/addAttributeViewCol`：添加字段列
- `/api/av/removeAttributeViewCol`：移除字段列
- `/api/av/setAttributeViewColsSort`：设置全局字段列排列次序
- `/api/av/setAttributeViewViewColsSort`：设置指定视图内的字段列排列次序

## 8. 搜索条件组 (Storage)

- `/api/storage/getCriterion`：获取已保存的搜索条件组
- `/api/storage/setCriterion`：保存搜索条件组
- `/api/storage/removeCriterion`：移除搜索条件组

## 9. 结构化 SQL (Query / SQLite)

- `/api/query/sql`：执行只读 SQL 查询
- `/api/sqlite/flushTransaction`：强制提交 SQLite 事务

## 10. 模板 (Template)

- `/api/template/render`：渲染内置模板
- `/api/template/renderSprig`：使用 Sprig 函数引擎渲染模板

## 11. 文件系统 (File)

- `/api/file/getFile`：获取工作空间文件内容
- `/api/file/putFile`：写入工作空间文件（multipart/form-data）
- `/api/file/removeFile`：删除工作空间文件
- `/api/file/renameFile`：重命名工作空间文件
- `/api/file/readDir`：遍历读取工作空间目录

## 12. 导出与转换 (Export / Convert)

- `/api/export/exportMdContent`：导出纯 Markdown 文本
- `/api/export/exportResources`：导出资源与附件
- `/api/convert/pandoc`：调用 Pandoc 执行跨格式转换

## 13. 系统通知 (Notification)

- `/api/notification/pushMsg`：推送信息提示
- `/api/notification/pushErrMsg`：推送错误警告提示

## 14. 网络代理 (Network)

- `/api/network/forwardProxy`：JSON 格式正向代理
- `/api/network/forwardProxyStream`：HTTP 流式正向代理
- `/api/network/forwardProxyWs`：WebSocket 双向代理
- `/api/network/forwardProxyEventSource`：EventSource (SSE) 单向流代理

## 15. 系统状态 (System)

- `/api/system/bootProgress`：获取内核启动初始化进度
- `/api/system/version`：获取思源内核版本号
- `/api/system/currentTime`：获取内核服务器当前 Unix 时间戳
