# siyuan-sdk 使用边界与示例

- 适用版本：SiYuan `v3.5.7`
- 最后核对：2026-02-21
- 稳定性：stable（以官方仓库为准）
- 权威来源：
  - <https://github.com/siyuan-community/siyuan-developer-docs/tree/main/docs/zh-Hans/reference/community>
  - <https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md>

## 1. 什么时候用 SDK

- 需要统一客户端配置（token、超时、http 客户端）
- 需要在同一工程里集中封装内核 API 调用

## 2. 什么时候不用 SDK

- 仅少量接口调用，且项目已有 `fetchSyncPost` 封装
- 需要直接贴合插件运行时行为（优先插件 API）

## 3. 边界原则

- SDK 是“调用层工具”，不是插件生命周期替代品
- 插件 UI 与事件仍由 `Plugin`/`EventBus` 负责
- 数据写入规范仍以内核 API 文档和路由为准

## 4. 统一请求层建议

```ts
export async function requestApi<T>(url: string, body?: any): Promise<T> {
  const r = await fetch("/api" + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.msg || "API error");
  return j.data as T;
}
```

## 5. 本章如何使用

- 先决定调用层是否需要 SDK，再决定接入方式
- 不要在同一项目并行维护多套请求风格
- SDK 升级时优先回归“错误处理”和“鉴权”

