# Canvas Theme Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the canvas editor tab follow SiYuan light and dark themes automatically, including live updates while the tab remains open.

**Architecture:** Add a small theme bridge in the mount layer so each mounted canvas root receives a `data-theme-mode` attribute derived from the host environment. Refactor the canvas workspace styles to semantic `--canvas-*` tokens backed by SiYuan `--b3-*` variables, with small dark-mode overrides where contrast needs tuning.

**Tech Stack:** TypeScript, Vue 3, Vitest, Vue Test Utils, SiYuan plugin API

---

### Task 1: Add failing tests for mount-layer theme syncing

**Files:**
- Modify: `src/main.ts`
- Create: `tests/canvas-theme-sync.test.ts`
- Test: `tests/canvas-theme-sync.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("applies the detected host theme mode on mount and updates after switch-protyle-mode", () => {
  document.documentElement.setAttribute("data-theme-mode", "dark")
  const host = document.createElement("div")
  document.body.append(host)

  mountCanvasApp(host, {}, vi.fn())

  expect(host.firstElementChild?.getAttribute("data-theme-mode")).toBe("dark")

  document.documentElement.setAttribute("data-theme-mode", "light")
  plugin.eventBus.emit("switch-protyle-mode")

  expect(host.firstElementChild?.getAttribute("data-theme-mode")).toBe("light")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/canvas-theme-sync.test.ts`
Expected: FAIL because the mount layer does not yet expose or update the canvas root theme attribute.

- [ ] **Step 3: Write minimal implementation**

```ts
function syncCanvasTheme(root: HTMLElement) {
  root.dataset.themeMode = detectHostThemeMode()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/canvas-theme-sync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/canvas-theme-sync.test.ts src/main.ts
git commit -m "test: cover canvas theme sync"
```

### Task 2: Add failing workspace test for theme hook and refactor styles

**Files:**
- Modify: `src/components/canvas/CanvasWorkspace.vue`
- Modify: `tests/canvas-workspace.test.ts`
- Test: `tests/canvas-workspace.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("renders a stable canvas root for host theme attributes", () => {
  currentEditor = createEditorMock()

  const wrapper = mount(CanvasWorkspace, {
    props: {
      bootstrap: {},
      plugin: {},
      setTitle: vi.fn(),
    },
  })

  expect(wrapper.find("[data-testid='canvas-shell']").exists()).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/canvas-workspace.test.ts`
Expected: FAIL because the canvas shell does not yet expose the test hook.

- [ ] **Step 3: Write minimal implementation**

```vue
<div
  class="canvas-shell"
  data-testid="canvas-shell"
>
```

Then replace hard-coded colors with semantic canvas tokens:

```scss
.canvas-shell {
  --canvas-bg: var(--b3-theme-background);
  --canvas-surface: var(--b3-theme-surface);
  --canvas-border: var(--b3-border-color);
  --canvas-text: var(--b3-theme-on-surface);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/canvas-workspace.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/CanvasWorkspace.vue tests/canvas-workspace.test.ts
git commit -m "feat: adapt canvas workspace theme tokens"
```

### Task 3: Verify regression safety

**Files:**
- Modify: `src/main.ts`
- Modify: `src/components/canvas/CanvasWorkspace.vue`
- Modify: `tests/canvas-theme-sync.test.ts`
- Modify: `tests/canvas-workspace.test.ts`

- [ ] **Step 1: Run focused tests**

```bash
pnpm test tests/canvas-theme-sync.test.ts tests/canvas-workspace.test.ts
```

Expected: PASS

- [ ] **Step 2: Run broader regression tests**

```bash
pnpm test
```

Expected: PASS

- [ ] **Step 3: Run production build**

```bash
pnpm build
```

Expected: build succeeds and outputs `dist/`

- [ ] **Step 4: Commit**

```bash
git add src/main.ts src/components/canvas/CanvasWorkspace.vue tests/canvas-theme-sync.test.ts tests/canvas-workspace.test.ts docs/superpowers/specs/2026-04-11-canvas-theme-adaptation-design.md docs/superpowers/plans/2026-04-11-canvas-theme-adaptation.md
git commit -m "feat: sync canvas theme with siyuan mode"
```
