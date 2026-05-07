import {
  describe,
  expect,
  it,
  vi,
} from "vitest"

vi.mock("siyuan", () => ({
  Dialog: vi.fn(),
}))

import { Dialog } from "siyuan"
import { openHelpDialog } from "@/canvas/help-dialog"

describe("canvas help dialog", () => {
  it("adds left padding so help content does not sit against the dialog edge", () => {
    vi.mocked(Dialog).mockClear()

    openHelpDialog("帮助", [
      {
        action: "平移画布",
        key: "鼠标右键拖拽画布空白区域",
      },
    ])

    expect(Dialog).toHaveBeenCalledTimes(1)
    expect(Dialog).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining("padding: 4px 12px 4px 16px"),
    }))
  })
})
