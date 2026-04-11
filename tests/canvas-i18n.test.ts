import {
  describe,
  expect,
  it,
} from "vitest"
import { createCanvasI18n } from "@/i18n/canvas"

describe("canvas i18n", () => {
  it("returns translated settings and toolbar text from the provided locale map", () => {
    const t = createCanvasI18n({
      toolbarNew: "新建",
      settingsDefaultCanvasDirectoryTitle: "默认 Canvas 目录",
      settingsDefaultCanvasDirectoryDescription: "相对保存或打开路径会基于该目录解析。",
    })

    expect(t("toolbarNew")).toBe("新建")
    expect(t("settingsDefaultCanvasDirectoryTitle")).toBe("默认 Canvas 目录")
    expect(t("settingsDefaultCanvasDirectoryDescription")).toBe("相对保存或打开路径会基于该目录解析。")
  })

  it("interpolates placeholders for dynamic canvas labels", () => {
    const t = createCanvasI18n({
      toolbarGraphStats: "{nodes} 个节点 / {edges} 条连线",
      selectionCount: "已选择 {count} 个节点。",
    })

    expect(t("toolbarGraphStats", { edges: 3, nodes: 5 })).toBe("5 个节点 / 3 条连线")
    expect(t("selectionCount", { count: 2 })).toBe("已选择 2 个节点。")
  })
})
