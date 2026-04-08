# 官方 API 全量索引（按模块）

- 适用版本：SiYuan `v3.5.7`
- 官方仓库同步到：`siyuan-note/siyuan@master` + Release `v3.5.7`（2026-02-14）
- 最后核对：2026-02-21
- 稳定性：public-index
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md>

说明：
- 本页是“索引层”，不复制官方长示例。
- 端点详情与参数示例请直接跳官方 `API_zh_CN.md`。
- 主文档层（`01`~`06`）只保留插件高频接口与实践说明。

## 1. 规范

- 参数和返回值规范
- 鉴权规范（`Authorization: Token xxx`）

## 2. 笔记本（notebook）

- `/api/notebook/lsNotebooks`
- `/api/notebook/openNotebook`
- `/api/notebook/closeNotebook`
- `/api/notebook/renameNotebook`
- `/api/notebook/createNotebook`
- `/api/notebook/removeNotebook`
- `/api/notebook/getNotebookConf`
- `/api/notebook/setNotebookConf`

## 3. 文档（filetree）

- `/api/filetree/createDocWithMd`
- `/api/filetree/renameDoc`
- `/api/filetree/renameDocByID`
- `/api/filetree/removeDoc`
- `/api/filetree/removeDocByID`
- `/api/filetree/moveDocs`
- `/api/filetree/moveDocsByID`
- `/api/filetree/getHPathByPath`
- `/api/filetree/getHPathByID`
- `/api/filetree/getPathByID`
- `/api/filetree/getIDsByHPath`

## 4. 资源（asset）

- `/api/asset/upload`

## 5. 块（block）

- `/api/block/insertBlock`
- `/api/block/prependBlock`
- `/api/block/appendBlock`
- `/api/block/updateBlock`
- `/api/block/deleteBlock`
- `/api/block/moveBlock`
- `/api/block/foldBlock`
- `/api/block/unfoldBlock`
- `/api/block/getBlockKramdown`
- `/api/block/getChildBlocks`
- `/api/block/transferBlockRef`

## 6. 属性（attr）

- `/api/attr/setBlockAttrs`
- `/api/attr/getBlockAttrs`

## 7. SQL（query/sqlite）

- `/api/query/sql`
- `/api/sqlite/flushTransaction`

## 8. 模板（template）

- `/api/template/render`
- `/api/template/renderSprig`

## 9. 文件（file）

- `/api/file/getFile`
- `/api/file/putFile`
- `/api/file/removeFile`
- `/api/file/renameFile`
- `/api/file/readDir`

## 10. 导出（export）

- `/api/export/exportMdContent`
- `/api/export/exportResources`

## 11. 转换（convert）

- `/api/convert/pandoc`

## 12. 通知（notification）

- `/api/notification/pushMsg`
- `/api/notification/pushErrMsg`

## 13. 网络（network）

- `/api/network/forwardProxy`

## 14. 系统（system）

- `/api/system/bootProgress`
- `/api/system/version`
- `/api/system/currentTime`

## 15. 与主文档映射

- 调用规范与高频场景：`reference/03-kernel-api/公开API导航.md`
- 迁移与弃用：`reference/03-kernel-api/弃用接口迁移清单-2026H1.md`
- AV 实战：`reference/04-database-av/AV增删改查与参数模型.md`
