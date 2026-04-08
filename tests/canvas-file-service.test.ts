import {
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { CanvasFileService } from "@/canvas/file-service"

describe("canvas file service", () => {
  it("loads and parses a canvas document from a gateway", async () => {
    const gateway = {
      readText: vi.fn(async () =>
        JSON.stringify({
          nodes: [
            {
              id: "n1",
              type: "text",
              text: "hello",
              x: 0,
              y: 0,
              width: 320,
              height: 180,
            },
          ],
          edges: [],
        })),
      writeText: vi.fn(),
    }

    const service = new CanvasFileService(gateway)
    const result = await service.load("/data/storage/canvas/example.canvas")

    expect(gateway.readText).toHaveBeenCalledWith("/data/storage/canvas/example.canvas")
    expect(result.path).toBe("/data/storage/canvas/example.canvas")
    expect(result.parseResult.errors).toEqual([])
    expect(result.parseResult.document?.nodes[0]?.id).toBe("n1")
  })

  it("stringifies and saves through the gateway", async () => {
    const gateway = {
      readText: vi.fn(),
      writeText: vi.fn(async () => undefined),
    }

    const service = new CanvasFileService(gateway)
    await service.save("/data/storage/canvas/example.canvas", {
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "hello",
          x: 0,
          y: 0,
          width: 320,
          height: 180,
        },
      ],
      edges: [],
    })

    expect(gateway.writeText).toHaveBeenCalledTimes(1)
    const [, written] = gateway.writeText.mock.calls[0]
    expect(JSON.parse(written)).toMatchObject({
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "hello",
        },
      ],
      edges: [],
    })
  })
})
