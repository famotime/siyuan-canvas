import {
  defineComponent,
  h,
} from 'vue'
import type { PropType } from 'vue'
import {
  getCanvasIconMarkup,
  type CanvasIconName,
} from "@/components/canvas/canvas-icon-registry"

export type { CanvasIconName } from "@/components/canvas/canvas-icon-registry"
export { getCanvasIconMarkup } from "@/components/canvas/canvas-icon-registry"

const STROKED_SHAPE_TAGS = /<(path|circle|rect|ellipse|polygon|polyline)\b([^>]*\bstroke="[^"]+"[^>]*?)(\/?)>/g

export function hardenStrokeOnlySvgFill(svg: string) {
  if (!svg) {
    return ''
  }

  return svg.replace(STROKED_SHAPE_TAGS, (match, tag: string, attrs: string, selfClosing: string) => {
    const hasFill = /\bfill="/.test(attrs)
    const fillIsNone = /\bfill="none"/.test(attrs)
    const hasStyle = /\bstyle="/.test(attrs)
    const styleDefinesFill = /\bstyle="[^"]*\bfill\s*:/.test(attrs)

    if (hasFill && !fillIsNone) {
      return match
    }

    let nextAttrs = attrs
    if (!hasFill) {
      nextAttrs += ' fill="none"'
    }

    if (hasStyle) {
      if (styleDefinesFill) {
        return `<${tag}${nextAttrs}${selfClosing}>`
      }
      nextAttrs = nextAttrs.replace(/\bstyle="([^"]*)"/, (_, style: string) => {
        const trimmedStyle = style.trim()
        const normalized = trimmedStyle.length === 0 || trimmedStyle.endsWith(';')
          ? trimmedStyle
          : `${trimmedStyle};`
        return `style="${normalized}fill:none"`
      })
    }
    else {
      nextAttrs += ' style="fill:none"'
    }

    return `<${tag}${nextAttrs}${selfClosing}>`
  })
}

export const CanvasIcon = defineComponent({
  name: 'CanvasIcon',
  props: {
    name: {
      required: true,
      type: String as PropType<CanvasIconName>,
    },
    size: {
      default: 18,
      type: Number,
    },
  },
  setup(props, { attrs }) {
    return () => h('span', {
      ...attrs,
      'aria-hidden': 'true',
      innerHTML: hardenStrokeOnlySvgFill(getCanvasIconMarkup(props.name)),
      style: [
        attrs.style as object | string | undefined,
        {
          display: 'inline-flex',
          fontSize: `${props.size}px`,
          lineHeight: 0,
        },
      ],
    })
  },
})
