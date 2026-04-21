/* @vitest-environment jsdom */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  beforeAll,
  vi,
} from "vitest"

vi.mock("@/App.vue", () => ({
  default: {
    template: "<div data-testid='mock-canvas-root' />",
  },
}))

import {
  bindPlugin,
  mountCanvasApp,
  unmountCanvasApp,
} from "@/main"

function createEventBus() {
  const listeners = new Map<string, Set<(event: CustomEvent<any>) => void>>()

  return {
    emit(type: string, detail?: unknown) {
      const event = new CustomEvent(type, { detail })
      listeners.get(type)?.forEach(listener => listener(event))
    },
    off: vi.fn((type: string, listener: (event: CustomEvent<any>) => void) => {
      listeners.get(type)?.delete(listener)
    }),
    on: vi.fn((type: string, listener: (event: CustomEvent<any>) => void) => {
      if (!listeners.has(type)) {
        listeners.set(type, new Set())
      }

      listeners.get(type)!.add(listener)
    }),
  }
}

describe("canvas theme sync", () => {
  let host: HTMLDivElement
  let plugin: {
    eventBus: ReturnType<typeof createEventBus>
  }

  beforeAll(() => {
    ;(globalThis as any).requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    }
    ;(globalThis as any).cancelAnimationFrame = () => {}
  })

  beforeEach(() => {
    document.documentElement.setAttribute("data-theme-mode", "dark")
    host = document.createElement("div")
    document.body.append(host)
    plugin = {
      eventBus: createEventBus(),
    }
    bindPlugin(plugin as any)
  })

  afterEach(() => {
    if (host.isConnected) {
      unmountCanvasApp(host)
      host.remove()
    }

    document.documentElement.removeAttribute("data-theme-mode")
  })

  it("applies the detected host theme mode on mount and updates after switch-protyle-mode", () => {
    mountCanvasApp(host, {}, vi.fn())

    expect(host.firstElementChild?.getAttribute("data-theme-mode")).toBe("dark")

    document.documentElement.setAttribute("data-theme-mode", "light")
    plugin.eventBus.emit("switch-protyle-mode")

    expect(host.firstElementChild?.getAttribute("data-theme-mode")).toBe("light")
  })

  it("updates when the host theme attribute changes after the switch event fires", async () => {
    mountCanvasApp(host, {}, vi.fn())

    plugin.eventBus.emit("switch-protyle-mode")
    document.documentElement.setAttribute("data-theme-mode", "light")
    await Promise.resolve()

    expect(host.firstElementChild?.getAttribute("data-theme-mode")).toBe("light")
  })

  it("keeps the current dark theme when host theme attributes disappear transiently", () => {
    mountCanvasApp(host, {}, vi.fn())

    document.documentElement.removeAttribute("data-theme-mode")
    document.body.removeAttribute("data-theme-mode")
    plugin.eventBus.emit("switch-protyle-mode")

    expect(host.firstElementChild?.getAttribute("data-theme-mode")).toBe("dark")
  })

  it("removes the theme listener when the canvas app unmounts", () => {
    mountCanvasApp(host, {}, vi.fn())

    unmountCanvasApp(host)

    expect(plugin.eventBus.off).toHaveBeenCalledWith("switch-protyle-mode", expect.any(Function))
    expect(host.childElementCount).toBe(0)
  })
})
