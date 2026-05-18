import {
  describe,
  expect,
  it,
} from "vitest"

import { getCanvasIconMarkup } from "@/components/canvas/canvas-icon"

describe("canvas icon registry", () => {
  it("exposes a single expand-all icon entry without duplicates in the exported markup", () => {
    expect(getCanvasIconMarkup("expand-all")).toContain("viewBox=\"0 0 48 48\"")
  })
})
