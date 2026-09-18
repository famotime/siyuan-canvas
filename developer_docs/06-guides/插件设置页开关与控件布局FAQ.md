# 思源插件设置页开关与控件布局 FAQ

> **适用版本**: SiYuan >= v3.0.0 (实测至 v3.8.3)  
> **最后核对日期**: 2026-09-18  
> **稳定性**: Stable / 推荐工程实践  
> **分类**: UI规范 / 样式隔离 / 响应式布局排坑

---

## 目录
1. [Q1: 为什么设置页中的开关被拉伸为 100% 宽度，甚至与文字发生换行？](#q1-为什么设置页中的开关被拉伸为-100-宽度甚至与文字发生换行)
2. [Q2: 思源笔记原生开关（Switch）的标准 DOM 结构与类名规范是什么？](#q2-思源笔记原生开关switch的标准-dom-结构与类名规范是什么)
3. [Q3: 为什么输入框、下拉框在设置弹窗里会自动掉到第二行？](#q3-为什么输入框下拉框在设置弹窗里会自动掉到第二行)
4. [Q4: 如何保证所有设置项（开关、输入框、下拉框）与标题保持单行水平排列？](#q4-如何保证所有设置项开关输入框下拉框与标题保持单行水平排列)
5. [Q5: 插件编写样式时，如何彻底避免污染思源全局设置与其他插件？](#q5-插件编写样式时如何彻底避免污染思源全局设置与其他插件)
6. [Q6: 完整推荐模板代码（TypeScript + SCSS）](#q6-完整推荐模板代码typescript--scss)

---

## Q1: 为什么设置页中的开关被拉伸为 100% 宽度，甚至与文字发生换行？

### 现象表现
设置项的布尔开关（Checkbox）变成了巨大的长条矩形，占据整行宽度；或者设置标题文字在上方，开关被挤到下一行。

### 核心根因分析
这通常是由于 **“外部插件全局样式污染”** 与 **“思源底层类名注入机制”** 共同作用导致的：

1. **思源底层 `Setting.addItem` 的类名自动注入**：
   在思源内核中，创建设置项时若传入的表单元素不是 `TEXTAREA`，底层会自动为其添加 `.fn__size200` 工具类：
   ```typescript
   // 思源 setting.ts 内部机制
   if (item.createActionElement) {
       const actionElement = item.createActionElement();
       if (actionElement.tagName !== "TEXTAREA") {
           actionElement.classList.add("fn__size200");
       }
       // ...
   }
   ```
2. **外部样式缺乏命名空间，全局滥用 `!important`**：
   某些插件在自身的 SCSS 中编写了如下粗暴的全局样式：
   ```scss
   // ❌ 危险写法：未做插件作用域隔离，污染所有弹窗！
   .b3-dialog__content .config-item > .fn__size200 {
       width: 100% !important;
       flex: 1 1 100% !important;
   }
   ```
3. **特异度与继承竞争**：
   如果开发者的开关没有声明原生类名 `b3-switch`，或者自身样式的特异度（Specificity）低于上述带有 `!important` 的全局类，开关就会被强制撑满整个父容器。

---

## Q2: 思源笔记原生开关（Switch）的标准 DOM 结构与类名规范是什么？

### 规范标准
思源原生开关必须是一个 `<input type="checkbox">`，且必须携带 `b3-switch fn__flex-center` 两个核心类名。

```typescript
const switchInput = document.createElement("input");
switchInput.type = "checkbox";
// 必须同时包含 b3-switch 和 fn__flex-center
switchInput.className = "b3-switch fn__flex-center";
```

### 为什么必须包含 `b3-switch`？（思源内核原理）
思源的 `Setting.addItem` 在组装外层容器时，有以下关键判断逻辑：
```typescript
// 思源 setting.ts 核心逻辑片段
const isSwitch = actionElement?.classList.contains("b3-switch");
const itemContainer = document.createElement(isSwitch ? "label" : "div");
itemContainer.className = "b3-label fn__flex config-item";
```
- **若包含 `b3-switch`**：思源会将外层包装为 **`<label>`** 标签。用户点击整行文字或整项时，都能触发开关的原生状态切换，提供极佳的交互体验。
- **若不包含 `b3-switch`**：外层为普通 `<div>`，失去整行点击切换特性，且容易被当作普通表单控件异常处理。

### 尺寸与视觉规范
思源原生 `.b3-switch` 的尺寸是固定的：
- **宽度**: `26px`
- **高度**: `16px`
- **圆角**: `12px`
- **内部圆球滑块**: 未选中时 `8px`，选中状态时 `12px`。
- 该尺寸与正文字体（14px / 20px 行高）形成视觉水平黄金对齐。**切忌通过 JS 或 CSS 将开关强制设为 `width: 200px` 或 `width: 100%`**。

---

## Q3: 为什么输入框、下拉框在设置弹窗里会自动掉到第二行？

### 核心根因：思源内置媒体查询折行机制
思源笔记在通用样式库（`base.css`）中配置了针对移动端/窄屏的响应式断点规则：

```css
/* 思源内置响应式样式 */
@media (max-width: 750px) {
    .config-item {
        flex-wrap: wrap; /* 允许子元素折行 */
    }
    .config-item > .fn__size200 {
        flex: 1 1 100%;  /* 强制占满 100% 宽度 */
        margin-top: 8px; /* 控件掉到下一行并产生上边距 */
    }
}
```

### 为什么插件弹窗总会命中这个规则？
大部分插件弹窗的宽度通常设定在 `560px` ~ `680px` 之间。当弹窗挂载在页面中或处于相对窄的视口中时，媒体查询判断屏幕或视口命中 `<= 750px`，导致原本水平排列的控件被强制换行并拉伸撑满第二行。

---

## Q4: 如何保证所有设置项（开关、输入框、下拉框）与标题保持单行水平排列？

针对上述思源窄屏媒体查询折行及外部样式的污染，必须在插件的私有样式中做**精准防御加固**：

### 解决方案：使用现代 CSS `:has()` 选择器锁定单行排版

```scss
// 针对当前插件包含控件的所有设置项，强制单行水平排列
.b3-dialog__content .config-item:has(.b3-switch, .b3-text-field, .b3-select) {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 16px !important;

    // 1. 标题与说明区域（占满剩余空间，但允许收缩）
    .fn__flex-1 {
        flex: 1 1 auto !important;
        min-width: 0 !important; // 防止长文字撑破弹性容器
        margin-right: 12px !important;
    }

    // 2. 原生布尔开关：严格固定尺寸，禁止弹性放大缩小
    .b3-switch {
        flex: 0 0 26px !important;
        width: 26px !important;
        min-width: 26px !important;
        max-width: 26px !important;
        height: 16px !important;
        margin-top: 0 !important;
        cursor: pointer;
    }

    // 3. 文本框、数字框、选择框：统一固定适中宽度（如 200px），抵消 100% 折行
    .b3-text-field,
    .b3-select {
        flex: 0 0 200px !important;
        width: 200px !important;
        min-width: 200px !important;
        max-width: 200px !important;
        margin-top: 0 !important;
        box-sizing: border-box !important;
    }
}
```

---

## Q5: 插件编写样式时，如何彻底避免污染思源全局设置与其他插件？

插件之间互相污染在思源社区中屡见不鲜，最典型的就是插件 A 的设置页样式把插件 B 甚至思源系统设置界面的样式破坏了。

### 必须坚守的三大铁律

#### 铁律一：严禁裸写思源原生公共类名
```scss
// ❌ 极度危险：千万不要这样写！
.config-item { ... }
.b3-dialog__content { ... }
.fn__size200 { width: 100% !important; }
```

#### 铁律二：必须限定插件自身的前缀命名空间
- 方案 A：在弹窗外层注入唯一的容器类（如 `my-plugin-setting`）：
  ```scss
  // ✅ 安全：严格限制在自身弹窗或自身容器下
  .my-plugin-setting-dialog {
      .config-item { ... }
  }
  ```
- 方案 B：如果使用思源原生弹窗创建，利用 `:has([class*="my-plugin-"])` 进行作用域限定：
  ```scss
  // ✅ 安全：仅当当前 .config-item 内部包含带有插件前缀的类名时才生效
  .b3-dialog__content .config-item:has([class*="my-plugin-"]) {
      ...
  }
  ```

#### 铁律三：谨慎在全局属性上使用 `!important`
`!important` 会直接穿透组件边界。只有在**覆写思源底层窄屏媒体查询**或**对抗其他恶意污染**时，在带有自身命名空间的前提下谨慎使用。

---

## Q6: 完整推荐模板代码（TypeScript + SCSS）

### 1. TypeScript 设置项注册模块 (`settings.ts`)

```typescript
import { Setting } from "siyuan";

export function initPluginSettings(plugin: any) {
    const setting = new Setting({
        confirmCallback: () => {
            plugin.saveData("settings.json", plugin.data.settings);
        },
    });

    // 1. 布尔开关项（单行对齐、整行可点）
    const autoSyncSwitch = document.createElement("input");
    autoSyncSwitch.type = "checkbox";
    autoSyncSwitch.className = "b3-switch fn__flex-center my-plugin-control";
    autoSyncSwitch.checked = Boolean(plugin.data.settings?.autoSync);
    autoSyncSwitch.addEventListener("change", () => {
        plugin.data.settings.autoSync = autoSyncSwitch.checked;
    });

    setting.addItem({
        title: "自动同步",
        description: "启用后将在文档修改时自动同步",
        createActionElement: () => autoSyncSwitch,
    });

    // 2. 文本输入项（单行靠右对齐、统一 200px 宽）
    const serverInput = document.createElement("input");
    serverInput.type = "text";
    serverInput.className = "b3-text-field fn__flex-center my-plugin-control";
    serverInput.value = plugin.data.settings?.serverUrl || "";
    serverInput.placeholder = "https://api.example.com";
    serverInput.addEventListener("input", () => {
        plugin.data.settings.serverUrl = serverInput.value.trim();
    });

    setting.addItem({
        title: "服务器地址",
        description: "远程数据服务的完整 URL 地址",
        createActionElement: () => serverInput,
    });

    // 3. 下拉选择项
    const themeSelect = document.createElement("select");
    themeSelect.className = "b3-select fn__flex-center my-plugin-control";
    ["light", "dark", "auto"].forEach(val => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = val;
        themeSelect.appendChild(opt);
    });
    themeSelect.value = plugin.data.settings?.theme || "auto";
    themeSelect.addEventListener("change", () => {
        plugin.data.settings.theme = themeSelect.value;
    });

    setting.addItem({
        title: "展示主题",
        description: "选择插件面板的默认色彩主题",
        createActionElement: () => themeSelect,
    });
}
```

### 2. SCSS 隔离样式 (`settings.scss`)

```scss
// 仅针对包含 my-plugin-control 的设置条目生效，零全局污染
.b3-dialog__content .config-item:has(.my-plugin-control) {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 16px !important;
    padding: 10px 16px !important;

    // 左侧文字区域
    .fn__flex-1 {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        margin-right: 12px !important;
    }

    // 右侧开关：保持思源经典小巧尺寸
    .b3-switch.my-plugin-control {
        flex: 0 0 26px !important;
        width: 26px !important;
        min-width: 26px !important;
        max-width: 26px !important;
        height: 16px !important;
        margin-top: 0 !important;
    }

    // 右侧输入控件：统一固定宽度
    .b3-text-field.my-plugin-control,
    .b3-select.my-plugin-control {
        flex: 0 0 200px !important;
        width: 200px !important;
        min-width: 200px !important;
        max-width: 200px !important;
        margin-top: 0 !important;
        height: 28px !important;
        line-height: 28px !important;
        box-sizing: border-box !important;
    }
}
```
