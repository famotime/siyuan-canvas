# siyuan-sdk 使用边界与示例

- 适用版本：SiYuan `v3.8.3`
- 官方仓库同步到：`siyuan-note/siyuan@master` + Release `v3.8.3`（2026-09-13）
- 最后核对：2026-09-13
- 稳定性：stable
- 权威来源：
  - <https://github.com/siyuan-community/siyuan-sdk>
  - [../03-kernel-api/official/API_zh_CN.md](../03-kernel-api/official/API_zh_CN.md)

## 1. 概念区分：原生插件 API vs 社区 SDK

在思源开发生态中，需区分两种开发形态：

| 形态 | 核心包 | 运行宿主 | 适用场景 |
|---|---|---|---|
| **原生插件开发** | `siyuan` (petal) | 思源主窗口渲染进程 / Goja 内核 | 界面挂载（顶栏、工具栏、面包屑、Dock）、事件总线监听、富文本编辑器交互 |
| **外部独立工具 / 脚本** | `siyuan-sdk` | 独立 Node.js / Python / 命令行脚本 | 外部自动化数据迁移、定时备份、外部 Webhook 联动、离线文档处理 |

> [!NOTE]
> 在本项目（思源插件模板）内，**请优先使用原生 `siyuan` 库提供的 `fetchSyncPost` 和生命周期钩子**，无需额外引入笨重的第三方外部 HTTP SDK。

## 2. 外部脚本中使用 SDK 调用示例

当编写外部 Node.js 独立小工具时，推荐如下极简请求封装：

```ts
interface ISiYuanClientOptions {
  baseURL?: string; // 默认 "http://127.0.0.1:6806"
  token?: string;   // 鉴权 API Token
}

export class SiYuanClient {
  private baseURL: string;
  private token: string;

  constructor(options: ISiYuanClientOptions = {}) {
    this.baseURL = options.baseURL || "http://127.0.0.1:6806";
    this.token = options.token || "";
  }

  async request<T = any>(endpoint: string, payload: Record<string, unknown> = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.token) {
      headers["Authorization"] = `Token ${this.token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (result.code !== 0) {
      throw new Error(`[SiYuan Error ${result.code}] ${result.msg}`);
    }
    return result.data as T;
  }
}
```

## 3. 插件内调用建议

- 插件运行在思源内部，通过 `fetchSyncPost` 发起请求时**无需手动配置端口或 Token**，宿主会自动补全内部环境上下文。
- 绝不要在前端插件内部通过硬编码 `http://127.0.0.1:6806` 调用接口，这在移动端或远程 Docker 访问场景下会导致请求跨域或连接失败。
