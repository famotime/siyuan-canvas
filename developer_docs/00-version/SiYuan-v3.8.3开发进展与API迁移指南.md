# SiYuan v3.8.3 开发进展与 API 迁移指南

- 适用版本：SiYuan `v3.8.3` / npm `siyuan@1.2.7`（CHANGELOG 面向 `v1.2.8`）
- 最后核对：2026-09-13
- 稳定性：版本迁移基线
- 本地源码基线：`d:\\MyCodingProjects\\siyuan-note`（Release `v3.8.3` 及后续分支提交）
- 官方类型基线：`d:\\MyCodingProjects\\siyuan-petal`（`v1.2.7` / HEAD）
- 官方示例基线：`d:\\MyCodingProjects\\siyuan-plugin-sample`（`v0.5.1`）
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/releases/tag/v3.8.3>
  - <https://github.com/siyuan-note/siyuan/blob/master/docs/API.zh-CN.md>
  - <https://github.com/siyuan-note/petal>
  - <https://github.com/siyuan-note/plugin-sample>

## 1. 基线演化概览

从 `v3.7.3` 到 `v3.8.3`，思源笔记完成了一轮极具里程碑意义的核心演进：
1. **插件生态进入 3.8+ 时代**：官方示例 `plugin-sample` 将 `minAppVersion` 提升至 `3.8.3`，npm `siyuan` 正式发布至 `1.2.7`。
2. **内核 API 合同强类型化**：`siyuan-petal` 正式引入由内核生成的强类型契约 `types/api/index.d.ts`，`fetchPost` 与 `fetchSyncPost` 拥有了端到端的请求/响应参数类型推导。
3. **内核插件全面转向 Agent 智能体架构**：旧版实验性的 `mcp` 注册接口已正式重构为稳定的 `siyuan.agent.registerCapability`，支持完整的输入输出 JSON Schema 及声明式副作用模型。
4. **前端扩展点大幅丰富**：新增动态工具栏条目（`addToolbarItem`）、编辑器面包屑按钮（`addBreadcrumbButton`）、自定义块渲染器（`customBlockRenders`）、统一命令上下文（`ICommandContext`）、顶栏自定义元素挂载与单输入框快捷对话框。
5. **严格生命周期与 5 秒共享拆除预算**：明确了前端插件在禁用/卸载时的 5 秒共享总预算机制，强化了数据变更通知类型（`sync` 与 `overwrite`）及幂等清理要求。
6. **数据模型与文档规范演进**：正式引入选项卡容器块 `NodeTabs`/`NodeTabItem`（文档 Spec 升级至 3）与自定义块 `NodeCustomBlock`；数据库（AV）文本字段支持 Kramdown 富文本（规范 9）、显示模板过滤/排序与上下文过滤。

---

## 2. 前端插件 API（Plugin API）重大演进

### 2.1 动态编辑器工具栏条目 (`addToolbarItem` / `removeToolbarItem`)
**变更背景**：在 v3.7.x 及更早版本中，插件若要扩展编辑器浮动工具栏，通常只能在 `updateProtyleToolbar` 钩子中向工具栏数组 push 静态对象。这种方式难以根据上下文动态增删按钮，且无法良好配合思源用户自定义工具栏排序与快捷键系统。

**新 API 规范**：
```typescript
this.addToolbarItem({
  name: "custom-action", // 插件内必须唯一且稳定的标识符
  icon: "iconSamplePlugin", // SVG 图标 ID 或 SVG 字符串
  hotkey: "⌥⇧T", // 默认快捷键
  tipPosition: "n",
  tip: "自定义操作",
  click: (protyle: Protyle) => {
    protyle.insert("Hello from toolbar!");
  },
});

// 动态移除
this.removeToolbarItem("custom-action");
```
- **核心优势**：用户在「设置 - 编辑器 - 工具栏」中自定义的排列顺序与快捷键会被持久化保留，即使重新加载插件也不会丢失。

### 2.2 编辑器面包屑按钮 (`addBreadcrumbButton` / `removeBreadcrumbButton`)
**变更背景**：编辑器顶部面包屑区域（Breadcrumb）是用户高频视线所在，v3.8.x 开放了在面包屑右侧追加插件自定义按钮的能力。

**新 API 规范**：
```typescript
const buttonId = this.addBreadcrumbButton({
  id: "toggle-fullscreen",
  icon: "iconFullscreen",
  title: "切换全屏",
  callback: (event: MouseEvent, protyle: IProtyle) => {
    event.preventDefault();
    const editor = protyle.getInstance();
    editor.setFullscreen(!editor.isFullscreen());
  },
});

// 移除
this.removeBreadcrumbButton("toggle-fullscreen");
```
- **配套 Protyle API**：官方提供了 `editor.setFullscreen(boolean)` 与 `editor.isFullscreen()`，方便快速控制当前编辑器实例的全屏状态。

### 2.3 自定义块渲染器 (`customBlockRenders`)
**变更背景**：以往插件要扩展内容展示，通常依赖 iframe 挂件（Widget）或代码块扩展（protyle.options.render.codeBlock）。挂件具有较重沙箱开销，而代码块语义不纯。v3.8.x 正式引入原生的「自定义块（Custom Block）」。

**规范与语法**：
- **Markdown 源码语法**：
  ```markdown
  ;;;plugin-name/block-type
  原始内容（不能包含独占一行的 ;;;）
  ;;;
  ```
  - 包名与块类型均须经过 `encodeURIComponent` 处理。
- **渲染器注册**：
  ```typescript
  this.customBlockRenders["counter"] = {
    render: ({ element, content, setContent }) => {
      let count = Number(content) || 0;
      const btn = document.createElement("button");
      btn.textContent = `当前计数: ${count}`;
      btn.addEventListener("click", () => {
        const next = count + 1;
        // setContent 执行受控写回，只读模式下或非法内容返回 false
        if (setContent(next.toString())) {
          count = next;
          btn.textContent = `当前计数: ${count}`;
        }
      });
      element.append(btn);
      // 返回清理回调函数
      return () => {
        // 移除监听器、定时器等外部资源
      };
    },
  };
  ```
- **底层数据模型**：AST 节点为 `NodeCustomBlock`，数据库类型为 `custom_block`。

### 2.4 统一命令执行上下文 (`ICommandContext`)
**变更背景**：旧版 `addCommand` 回调分散在 `callback`、`editorCallback`、`globalCallback` 等不同属性中，难以根据执行时的主焦点与光标位置灵活判断。

**新 API 规范**：
- `ICommand` 新增 `execute?: (context: ICommandContext) => void | Promise<void>`，优先于旧版回调执行。
- `context` 包含完整运行时上下文：
  - `source`: 命令触发源（快捷键、命令面板等）
  - `focus`: 当前焦点状态
  - `protyle`: 当前激活的编辑器实例（如有）
  - `range`: 当前选中范围（Range）
  - `fileTree`: 文档树上下文
  - `dock`: 当前活动的 Dock 面板
- 新增支持多快捷键与条件执行：
  - `hotkeys?: string[]`: 默认多快捷键列表（优先于 `hotkey`）
  - `when?: (context: ICommandContext) => boolean`: 动态判断命令是否匹配
  - `enabled?: (context: ICommandContext) => boolean`: 动态判断命令是否可用

### 2.5 顶栏自定义元素挂载 (`addTopBar` 自定义元素)
`addTopBar` 新增 `element?: HTMLElement` 参数（仅桌面端主窗口支持）。
当传入 `element` 时，思源将保留插件对该元素的内部样式与事件绑定，思源仅负责设置外层定位、`data-topbar-entry` 及排序。适合挂载复杂的富交互小部件。

### 2.6 单输入框对话框 (`openInputDialog`)
官方新增轻量级单输入框快捷创建函数：
```typescript
import { openInputDialog } from "siyuan";

openInputDialog({
  title: "快速设置",
  label: "输入标签：",
  value: "默认值",
  placeholder: "请输入...",
  type: "text", // 或 "number"
  onConfirm: (value: string, dialog: Dialog) => {
    // 处理业务逻辑并手动销毁
    dialog.destroy();
  },
});
```

### 2.7 闪卡 v2 复习页签 (`openTab` 闪卡选项)
`openTab` 打开闪卡时支持 v2 统一复习会话：
- `reviewSetIDs?: string[]`: 多个卡包取并集去重（不可为空数组）。
- `cardIDs?: string[]`: 有序卡片 ID 列表。
- `query?: IFlashcardQueryAST`: 支持基于 AST 的版本 1 高级查询条件。
- `reviewMode?: "normal" | "reinforcement"`: 常规复习或强化复习。

---

## 3. 严格生命周期与 5 秒共享拆除预算

在 v3.8.x 中，思源对前端插件的生命周期时序与异常隔离制定了严格的契约：

```text
插件实例加载：
await plugin.onload()
       ↓
await plugin.kernel.init() (若声明了 kernels)
       ↓
afterLoadPlugin(plugin)
       ↓
plugin.onLayoutReady()

插件运行时更新：
plugin.onDataChanged(reason?: "sync" | "overwrite")

插件禁用 / 重载 / 卸载：
启动 5 秒共享拆除预算
       ↓
await plugin.onunload() (消耗预算)
       ↓
await plugin.uninstall() (仅彻底移除插件时执行，使用剩余预算)
       ↓
超时强制截断等待，注销外部资源与内核通道
```

### 关键准则：
1. **5 秒共享预算保护**：从收到拆除指令起，思源仅最多等待 5 秒。超时后立即停止等待 Promise 并移除宿主 DOM 与内核通道。插件拆除逻辑必须轻量、幂等。
2. **取消机制配合**：推荐在插件内部维护 `AbortController`，在 `onunload()` 中触发 abort，并在所有未完成的异步操作中检测信号。
3. **数据变更回调 (`onDataChanged`)**：`reason` 包含 `"sync"`（跨设备云同步合并完成）与 `"overwrite"`（本地其他实例修改）。**若插件未覆盖 `onDataChanged`，思源默认会重载整个插件**！若希望无缝热更新状态，务必显式实现该方法。
4. **彻底卸载 (`uninstall`)**：仅在用户从集市或设置中点击“卸载”删除插件时触发一次，用于调用 `removeData()` 清理数据。

---

## 4. 内核插件（Kernel Plugin）规范升级

### 4.1 全面迁移为 Agent Capabilities
早期的实验性 MCP 工具注册模式已被淘汰，内核全面拥抱智能体能力（Agent Capabilities）：
```typescript
import type * as kernel from "siyuan/kernel";

class KernelPlugin {
  private readonly siyuan: kernel.ISiyuan = (globalThis as any).siyuan;

  async onload() {
    const { agent, logger } = this.siyuan;

    await agent.registerCapability(
      "myCapability",
      {
        title: "能力展示标题",
        description: "供 AI 智能体理解和调度该能力的详细语义描述",
        inputSchema: {
          type: "object",
          properties: {
            targetId: { type: "string", description: "目标块 ID" },
          },
          required: ["targetId"],
        },
        actionEffects: {
          // 声明能力对本地环境的影响
          myCapability: {
            localRead: true,
            localWrite: false,
          },
        },
      },
      async (input) => {
        return { success: true, targetId: input.targetId };
      }
    );
  }

  async onunload() {
    await this.siyuan.agent.unregisterCapability("myCapability");
  }
}
```

### 4.2 强类型模块与服务端路由
内核插件统一通过 `import type * as kernel from "siyuan/kernel"` 引入类型，支持：
- `siyuan.logger`: `trace`, `debug`, `info`, `warn`, `error` 异步日志通道。
- `siyuan.storage`: 相对 `data/storage/petal/<name>/` 的沙箱文件读写与 `watcher` 监听。
- `siyuan.rpc`: JSON-RPC 双向绑定与广播。
- `siyuan.server.private`: HTTP、WebSocket、SSE 私有路由服务。

---

## 5. 内核 API 合同与强类型化

在 `siyuan` npm 1.2.7+ 中，核心 API 调用迎来了自动类型推导：
- 引入了内核自动化生成的 `APIPOSTRoutes` 与 `APIGETRoutes`。
- `fetchPost` 与 `fetchSyncPost` 能够根据传入的首参数 URL 自动推断请求载荷 `data` 的结构以及 Promise 的返回数据结构。
- 传输层错误（`-401`, `-403`, `-404`）独立于业务非负错误码进行类型收敛。

---

## 6. 数据块模型与 SY-FORMAT 规范演进

### 6.1 选项卡容器块 (`NodeTabs` & `NodeTabItem`)
- **规范版本**：文档级属性 `Spec` 升级为 `"3"`（包含页签容器块的文档为 Spec 3，普通文档保持 Spec 2）。
- **结构约束**：
  - `NodeTabs` 为容器块（DB `type: "tabbed_container"`），拥有独立的块 ID 与属性（`tabs-active-id`、`tabs-position: "top"|"left"`）。
  - `NodeTabs` 只能直接包含 `NodeTabItem`；`NodeTabItem` 作为页签分项容纳正文块。
- **Markdown 表示**：`:::tabs` 与 `:::tab <标题>`。

### 6.2 自定义块 (`NodeCustomBlock`)
- **结构约束**：叶子块（DB `type: "custom_block"`），无 `Children`。`Data` 保存持久化原始内容，`CustomBlockInfo` 保存 `plugin-name/block-type`。
- **Markdown 表示**：三括号围栏 `;;;plugin/type\ncontent\n;;;`。

---

## 7. 数据库属性视图（AV）重要升级

1. **文本字段支持富文本**：
   - 数据格式：`text.rich: { spec: 1, format: "kramdown", content: "..." }`。
   - 内核在写入时将 Kramdown 作为权威源，并自动派生 `text.content` 纯文本投影。
2. **显示模板与渲染值来源**：
   - 字段支持 `renderTemplate` 显示模板。
   - 过滤（Filter）、分组（Group）、排序（Sort）支持 `valueSource: "stored" | "rendered"`，可基于模板计算后的渲染文本进行过滤与排序。
3. **上下文过滤 (`contextFilter`)**：
   - 视图支持配置 `contextFilter`，支持快速按当前文档环境进行双向反向筛选。
4. **快捷建行与文档转存**：
   - `/api/av/createAttributeViewItemWithMarkdown`: 直接解析 Markdown 并在指定视图中建行。
  - `/api/av/createAttributeViewItemDocs`: 将选中的游离/非绑定行批量转存为正文文档。

---

## 8. 新增公开 API：搜索条件组管理

思源 v3.8.x 正式公开了全文搜索条件组的持久化管理接口：
- `POST /api/storage/getCriteria`: 获取当前用户保存的所有高级搜索条件组（包含排序、分组、包含块类型等配置）。
- `POST /api/storage/setCriterion`: 保存或更新指定名称的搜索条件组。
- `POST /api/storage/removeCriterion`: 移除指定搜索条件组。

---

## 9. 集市打包与清单规范 (Marketplace Spec)

在 `plugin.json` 与发布打包中，请注意以下新规范：
- **图标与预览图**：
  - 支持在 `plugin.json` 中声明 `"icon": "icon.png"` 与 `"preview": "preview.png"`。
  - 图片格式放宽，正式支持 **PNG、JPEG、WebP 和 AVIF**（icon <= 64 KiB，建议 160*160；preview <= 512 KiB，建议 1024*768）。
- **赞助信息**：
  - `funding.links` 支持结构化带标签的链接列表：`[{ "label": "爱发电", "url": "https://..." }]`。
- **启动页外观**：
  - 插件支持在包内附带 `boot-appearances/` 目录，在 `plugin.json` 中声明 `bootAppearances: ["theme-id"]`，供用户在「外观 - 启动页外观」中无代码沙箱加载。
- **打包清单 (`package.zip`)**：
  - 必须包含：`icon` 和 `preview` 文件、`index.js`、`index.css`、`plugin.json`、`README*.md`。
  - 可选包含：`i18n/*`、`kernel.js`（如有内核插件）、`boot-appearances/*`（如有启动外观）。
