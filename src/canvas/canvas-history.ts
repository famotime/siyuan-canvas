import type { CanvasDocument } from "@/canvas/types"

export interface CanvasHistorySnapshot {
  document: CanvasDocument
  selectedNodeIds: string[]
  selectedNodeId: string
  selectedEdgeId: string
}

export interface CanvasHistoryStackOptions {
  /**
   * 历史栈最多保留多少步。超出时丢弃最早的一步。默认 100。
   */
  capacity?: number
  /**
   * 默认的合并窗口（毫秒）。指定 coalesceKey 的 record 在窗口内会被合并为单步。默认 200ms。
   */
  defaultCoalesceMs?: number
}

export interface CanvasHistoryRecordOptions {
  /**
   * 如果连续两次 record 的 coalesceKey 相同且时间间隔 < coalesceMs，则不入栈，
   * 视为延续同一步操作。例如 `drag-${nodeId}` 用于拖拽合并，`resize-${nodeId}` 用于尺寸合并。
   */
  coalesceKey?: string
  /**
   * 覆盖 stack 默认的合并窗口。
   */
  coalesceMs?: number
  /**
   * 当前时间戳，单测中可注入；默认 Date.now()。
   */
  now?: number
}

/**
 * 简单的快照式历史栈。每次外部数据变更都先 `record(snapshot)`，
 * undo/redo 调用方负责把返回的快照应用回业务状态。
 *
 * 支持基于 `coalesceKey` 的相邻合并：拖拽节点、resize 节点这类高频连续变更
 * 不会撑爆历史栈，每次"完整操作"只生成一个 undo 步。
 */
export class CanvasHistoryStack {
  private undoStack: CanvasHistorySnapshot[] = []
  private redoStack: CanvasHistorySnapshot[] = []
  private readonly capacity: number
  private readonly defaultCoalesceMs: number
  private lastCoalesceKey: string | undefined
  private lastRecordAt = 0

  constructor(options: CanvasHistoryStackOptions = {}) {
    this.capacity = Math.max(1, options.capacity ?? 100)
    this.defaultCoalesceMs = Math.max(0, options.defaultCoalesceMs ?? 200)
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /**
   * 记录一个新的"现在状态"快照。
   * 若 coalesceKey 与上一次相同且在 coalesceMs 窗口内，则跳过入栈（视为同一步操作的中间态）。
   * 任何成功入栈都会清空 redo 栈（线性历史）。
   */
  record(snapshot: CanvasHistorySnapshot, options: CanvasHistoryRecordOptions = {}): void {
    const now = options.now ?? Date.now()
    const coalesceMs = options.coalesceMs ?? this.defaultCoalesceMs

    if (
      options.coalesceKey
      && this.lastCoalesceKey === options.coalesceKey
      && now - this.lastRecordAt < coalesceMs
    ) {
      this.lastRecordAt = now
      return
    }

    this.undoStack.push(snapshot)
    if (this.undoStack.length > this.capacity) {
      this.undoStack.shift()
    }
    this.redoStack = []
    this.lastCoalesceKey = options.coalesceKey
    this.lastRecordAt = now
  }

  /**
   * 撤销：把当前快照压入 redo 栈，返回上一个快照供调用方恢复。
   * 没有可撤销内容时返回 null。
   */
  undo(currentSnapshot: CanvasHistorySnapshot): CanvasHistorySnapshot | null {
    if (this.undoStack.length === 0) {
      return null
    }

    const previous = this.undoStack.pop() as CanvasHistorySnapshot
    this.redoStack.push(currentSnapshot)
    // 撤销后断开合并链，避免下一次拖拽与撤销前的同 key 操作误合
    this.lastCoalesceKey = undefined
    return previous
  }

  /**
   * 重做：把当前快照压入 undo 栈，返回 redo 栈顶供调用方恢复。
   * 没有可重做内容时返回 null。
   */
  redo(currentSnapshot: CanvasHistorySnapshot): CanvasHistorySnapshot | null {
    if (this.redoStack.length === 0) {
      return null
    }

    const next = this.redoStack.pop() as CanvasHistorySnapshot
    this.undoStack.push(currentSnapshot)
    this.lastCoalesceKey = undefined
    return next
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.lastCoalesceKey = undefined
    this.lastRecordAt = 0
  }
}

/**
 * 深拷贝一个 CanvasDocument，确保历史快照与运行时状态相互独立。
 * CanvasDocument 是普通 JSON 结构（无 Date/Map/RegExp），用 JSON 序列化即可。
 */
export function cloneCanvasDocument(document: CanvasDocument): CanvasDocument {
  return JSON.parse(JSON.stringify(document)) as CanvasDocument
}
