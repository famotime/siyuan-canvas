# 非公开 API 与风险说明

- 适用版本：SiYuan `v3.5.7`
- 最后核对：2026-02-21
- 稳定性：internal
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/blob/master/kernel/api/router.go>
  - <https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md>

## 1. 公开与非公开的边界

- 公开 API：在 `API_zh_CN.md` 维护，通常稳定、兼容性更好。
- 非公开 API：只在 `router.go` 可见，可能随版本调整，兼容性不保证。

## 2. 使用策略

1. 先找公开 API，无法满足时再评估非公开 API。
2. 非公开 API 必须加降级逻辑（失败回退、版本判断）。
3. 在文档中标注风险等级和替代路径。

## 3. 风险示例

- 同一能力在不同版本可能改端点、改参数、改权限校验。
- 路由存在“计划删除”注释但仍可调用，若不跟进会在未来版本直接失效。

## 4. 建议的兼容实现

```ts
async function callWithFallback(primary: () => Promise<any>, fallback: () => Promise<any>) {
  try {
    return await primary();
  } catch {
    return await fallback();
  }
}
```

典型用途：新端点失败时回退旧端点（或反之），并记录告警日志。

## 5. 本章如何使用

- 判断接口是否可长期依赖：先查是否在官方 API 文档
- 不在官方文档的接口，一律视为 internal
- 任何 internal 依赖都必须在发布前重新验证

