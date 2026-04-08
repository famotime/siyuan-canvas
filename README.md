# SiYuan Canvas

SiYuan Canvas is a SiYuan plugin for importing, editing, and exporting Obsidian `.canvas` files using the open JSON Canvas format.

## What it does

- Opens standard `.canvas` files from the SiYuan workspace
- Imports local `.canvas` files for editing inside SiYuan
- Edits `text`, `file`, `link`, and `group` nodes
- Creates and edits edges with side anchors and labels
- Saves back to the workspace or exports a standard `.canvas` file for Obsidian
- Preserves unknown JSON Canvas fields during parse and export

## Current interaction model

- Open a blank canvas from the top bar or command palette
- Use the toolbar to open a workspace path, import a local file, save, or export
- Add nodes from the toolbar
- Drag node headers to move cards
- Drag the bottom-right handle to resize cards
- Edit node and edge properties in the right inspector
- Double-click link nodes to open the URL
- Double-click `.canvas` file nodes to open them in a new plugin tab

## Development

```bash
pnpm install
pnpm test
pnpm build
```

Set `VITE_SIYUAN_WORKSPACE_PATH` in `.env` if you want `pnpm dev` to build directly into a local SiYuan workspace.

## Notes

- The plugin targets the open JSON Canvas format maintained by `obsidianmd/jsoncanvas`.
- The current implementation prioritizes file-format compatibility and core editing over full visual parity with Obsidian Canvas.
