import type { CanvasNodeLayoutAction } from "@/canvas/types"

import {
  defineComponent,
  h,
} from "vue"
import type { PropType } from "vue"
import type { CanvasI18nTranslator } from "@/canvas/use-canvas-editor-shared"

export type SelectionToolbarIconName =
  | "delete"
  | "color"
  | "center"
  | "edit"
  | "group"
  | "align"
  | "left-align"
  | "center-horizontal"
  | "right-align"
  | "top-align"
  | "center-vertical"
  | "bottom-align"
  | "arrange-row"
  | "arrange-column"
  | "arrange-grid"
  | "distribute-horizontal"
  | "distribute-vertical"
  | "stretch-horizontal"
  | "stretch-vertical"

export function createSelectionToolbarTooltips(t: CanvasI18nTranslator) {
  return {
    align: t("selectionToolbarAlign"),
    center: t("selectionToolbarCenter"),
    color: t("selectionToolbarColor"),
    createGroup: t("selectionToolbarCreateGroup"),
    delete: t("selectionToolbarDelete"),
    edit: t("selectionToolbarEdit"),
  } as const
}

export const SELECTION_LAYOUT_ICON_NAMES: Record<CanvasNodeLayoutAction, SelectionToolbarIconName> = {
  "arrange-column": "arrange-column",
  "arrange-grid": "arrange-grid",
  "arrange-row": "arrange-row",
  "bottom-align": "bottom-align",
  "center-horizontal": "center-horizontal",
  "center-vertical": "center-vertical",
  "distribute-horizontal": "distribute-horizontal",
  "distribute-vertical": "distribute-vertical",
  "left-align": "left-align",
  "right-align": "right-align",
  "stretch-horizontal": "stretch-horizontal",
  "stretch-vertical": "stretch-vertical",
  "top-align": "top-align",
}

const SELECTION_TOOLBAR_ICONS: Record<SelectionToolbarIconName, { paths: string[], viewBox: string }> = {
  align: {
    paths: [
      "M6 6h12",
      "M6 12h8",
      "M6 18h14",
      "M4 4v16",
    ],
    viewBox: "0 0 24 24",
  },
  "arrange-column": {
    paths: [
      "M6 4h12v4H6z",
      "M6 10h12v4H6z",
      "M6 16h12v4H6z",
    ],
    viewBox: "0 0 24 24",
  },
  "arrange-grid": {
    paths: [
      "M5 5h5v5H5z",
      "M14 5h5v5h-5z",
      "M5 14h5v5H5z",
      "M14 14h5v5h-5z",
    ],
    viewBox: "0 0 24 24",
  },
  "arrange-row": {
    paths: [
      "M4 7h4v10H4z",
      "M10 7h4v10h-4z",
      "M16 7h4v10h-4z",
    ],
    viewBox: "0 0 24 24",
  },
  "bottom-align": {
    paths: [
      "M4 19h16",
      "M7 8v11",
      "M12 5v14",
      "M17 11v8",
    ],
    viewBox: "0 0 24 24",
  },
  center: {
    paths: [
      "M9 4H7a3 3 0 0 0-3 3v2",
      "M15 4h2a3 3 0 0 1 3 3v2",
      "M20 15v2a3 3 0 0 1-3 3h-2",
      "M9 20H7a3 3 0 0 1-3-3v-2",
      "M12 9v6",
      "M9 12h6",
    ],
    viewBox: "0 0 24 24",
  },
  "center-horizontal": {
    paths: [
      "M12 4v16",
      "M7 7h10",
      "M9 12h6",
      "M6 17h12",
    ],
    viewBox: "0 0 24 24",
  },
  "center-vertical": {
    paths: [
      "M4 12h16",
      "M7 7v10",
      "M12 9v6",
      "M17 6v12",
    ],
    viewBox: "0 0 24 24",
  },
  color: {
    paths: [
      "M12 4c4.97 0 9 3.13 9 7 0 2.76-2.04 5.14-5 6.27-.9.34-1.5 1.2-1.5 2.17 0 .85-.69 1.56-1.54 1.56H12C7.03 21 3 17.87 3 14s4.03-10 9-10Z",
      "M8 11h.01",
      "M10.5 8.5h.01",
      "M14 8h.01",
      "M16 11h.01",
    ],
    viewBox: "0 0 24 24",
  },
  delete: {
    paths: [
      "M4 7h16",
      "M9 4h6",
      "M7 7l1 12h8l1-12",
      "M10 11v5",
      "M14 11v5",
      "M9 7V5h6v2",
    ],
    viewBox: "0 0 24 24",
  },
  "distribute-horizontal": {
    paths: [
      "M5 6v12",
      "M19 6v12",
      "M8 9h2v6H8z",
      "M14 9h2v6h-2z",
      "M10 12h4",
    ],
    viewBox: "0 0 24 24",
  },
  "distribute-vertical": {
    paths: [
      "M6 5h12",
      "M6 19h12",
      "M9 8v2h6V8",
      "M9 14v2h6v-2",
      "M12 10v4",
    ],
    viewBox: "0 0 24 24",
  },
  edit: {
    paths: [
      "M4 20h4l10-10-4-4L4 16v4",
      "M12 6l4 4",
      "M14 4l4 4",
    ],
    viewBox: "0 0 24 24",
  },
  group: {
    paths: [
      "M4 7h7v7H4z",
      "M13 7h7v7h-7z",
      "M8 14h8v3H8z",
    ],
    viewBox: "0 0 24 24",
  },
  "left-align": {
    paths: [
      "M4 4v16",
      "M7 7h11",
      "M7 12h8",
      "M7 17h13",
    ],
    viewBox: "0 0 24 24",
  },
  "right-align": {
    paths: [
      "M20 4v16",
      "M6 7h11",
      "M9 12h8",
      "M4 17h13",
    ],
    viewBox: "0 0 24 24",
  },
  "stretch-horizontal": {
    paths: [
      "M5 6v12",
      "M19 6v12",
      "M8 9h8v6H8z",
      "M7 12h-2",
      "M19 12h-2",
    ],
    viewBox: "0 0 24 24",
  },
  "stretch-vertical": {
    paths: [
      "M6 5h12",
      "M6 19h12",
      "M9 8h6v8H9z",
      "M12 7V5",
      "M12 19v-2",
    ],
    viewBox: "0 0 24 24",
  },
  "top-align": {
    paths: [
      "M4 5h16",
      "M7 5v11",
      "M12 5v14",
      "M17 5v8",
    ],
    viewBox: "0 0 24 24",
  },
}

export const SelectionToolbarIcon = defineComponent({
  name: "SelectionToolbarIcon",
  props: {
    name: {
      required: true,
      type: String as PropType<SelectionToolbarIconName>,
    },
    size: {
      default: 18,
      type: Number,
    },
  },
  setup(props) {
    return () => {
      const icon = SELECTION_TOOLBAR_ICONS[props.name]

      return h(
        "svg",
        {
          "aria-hidden": "true",
          fill: "none",
          height: props.size,
          viewBox: icon.viewBox,
          width: props.size,
          xmlns: "http://www.w3.org/2000/svg",
        },
        icon.paths.map((path) => h("path", {
          d: path,
          stroke: "currentColor",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "stroke-width": "1.7",
        })),
      )
    }
  },
})
