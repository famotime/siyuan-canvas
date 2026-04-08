# SiYuan Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the missing plugin features identified in `docs/2026-04-08-siyuan-canvas-progress-review.md` and keep that progress document updated after each completed feature.

**Architecture:** Extend the existing canvas editor incrementally instead of rewriting it. Keep responsibilities separated between plugin-level persistence and integration, editor-state-level document/session logic, and Vue UI-level interaction and rendering.

**Tech Stack:** SiYuan plugin API, Vue 3, TypeScript, Vitest, Vite

---

## File structure

- `src/index.ts`
  - Plugin lifecycle, top bar, commands, settings dialog, plugin data persistence, recent files coordination
- `src/main.ts`
  - Canvas tab bootstrap contract
- `src/canvas/editor-state.ts`
  - Document/session state, selection state, dirty/save/conflict flow
- `src/canvas/file-service.ts`
  - File loading/saving plus conflict metadata support
- `src/canvas/siyuan-text-gateway.ts`
  - Low-level file API adapter
- `src/canvas/use-canvas-editor.ts`
  - Main editor behavior and keyboard bindings
- `src/components/canvas/CanvasWorkspace.vue`
  - Toolbar, stage, inspector, recent files, advanced preview rendering
- `src/canvas/types.ts`
  - Shared canvas and integration types
- `src/api.ts`
  - SiYuan API helpers for docs, blocks, assets, and queries
- `tests/*.test.ts`
  - Regression coverage for each new behavior
- `docs/2026-04-08-siyuan-canvas-progress-review.md`
  - Progress tracking updated after each feature completion

## Execution order

### Phase P0: Safety and continuity

- [x] Add settings data model and plugin persistence helpers
- [x] Add recent file tracking and commands/UI entry points
- [x] Add file snapshot metadata and external-change conflict detection
- [x] Update progress review document for completed P0 items

### Phase P1: Deeper SiYuan integration

- [x] Add document and asset lookup helpers in `src/api.ts`
- [x] Resolve file nodes into SiYuan docs/assets when possible
- [x] Improve file-node activation and preview metadata
- [x] Update progress review document for completed P1 items

### Phase P2: Editing productivity

- [x] Add multi-selection state
- [x] Add modifier-key multi-selection and grouped manipulation behavior
- [x] Add keyboard shortcuts for delete, duplicate, select all, and cancel selection
- [x] Update progress review document for completed P2 items

### Phase P3: Presentation and preview

- [x] Add richer node preview cards for file/link/doc-like nodes
- [x] Improve preview rendering using resolved SiYuan metadata
- [x] Update progress review document for completed P3 items

## Verification strategy

- [ ] For each feature, add a failing Vitest regression first
- [ ] Run the targeted test and confirm the expected failure
- [ ] Implement the minimal production code to pass
- [ ] Run the targeted test again
- [ ] Periodically run the full test suite
- [ ] Run `npm run build` after each phase
- [ ] Finish with full verification:
  - `npm test`
  - `npm run build`
