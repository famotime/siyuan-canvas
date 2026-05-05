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
}

/**
 * 简单的快照式历史栈。每次外部数据变更都先 `record(snapshot)`，
 * undo/redo 调用方负责把返回的快照应用回业务状态。
 *
 * 对比命令模式，快照法实现简单、对现有 commitDocument 入口侵入小，
 * 同时由于 CanvasDocument 体量可控（一般几十~几百节点的 JSON），内存可承受。
 */
export class CanvasHistoryStack {
  private undoStack: CanvasHistorySnapshot[] = []
  private redoStack: CanvasHistorySnapshot[] = []
  private readonly capacity: number

  constructor(options: CanvasHistoryStackOptions = {}) {
    this.capacity = Math.max(1, options.capacity ?? 100)
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /** 记录一个新的"现在状态"快照，并清空 redo 栈（线性历史） */
  record(snapshot: CanvasHistorySnapshot): void {
    this.undoStack.push(snapshot)
    if (this.undoStack.length > this.capacity) {
      this.undoStack.shift()
    }
    this.redoStack = []
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
    return next
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}

/**
 * 深拷贝一个 CanvasDocument，确保历史快照与运行时状态相互独立。
 * CanvasDocument 是普通 JSON 结构（无 Date/Map/RegExp），用 JSON 序列化即可。
 */
export function cloneCanvasDocument(document: CanvasDocument): CanvasDocument {
  return JSON.parse(JSON.stringify(document)) as CanvasDocument
}
