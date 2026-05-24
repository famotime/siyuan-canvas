import type { CanvasNodeLayoutAction } from '@/canvas/types'
import type { CanvasI18nTranslator } from '@/canvas/use-canvas-editor-shared'
import {
  CanvasIcon,
  type CanvasIconName,
} from '@/components/canvas/canvas-icon'

export type SelectionToolbarIconName = CanvasIconName

export function createSelectionToolbarTooltips(t: CanvasI18nTranslator) {
  return {
    align: t('selectionToolbarAlign'),
    center: t('selectionToolbarCenter'),
    color: t('selectionToolbarColor'),
    convert: t('selectionToolbarConvert'),
    convertToText: t('selectionToolbarConvertToText'),
    decompose: t('selectionToolbarDecompose'),
    createGroup: t('selectionToolbarCreateGroup'),
    delete: t('selectionToolbarDelete'),
    edit: t('selectionToolbarEdit'),
    refresh: t('selectionToolbarRefresh'),
  } as const
}

export const EDGE_DIRECTION_ICON_NAMES = {
  both: 'direction-both',
  none: 'direction-none',
  single: 'direction-single',
} as const

export const SELECTION_LAYOUT_ICON_NAMES: Record<CanvasNodeLayoutAction, SelectionToolbarIconName> = {
  'arrange-column': 'arrange-column',
  'arrange-grid': 'arrange-grid',
  'arrange-row': 'arrange-row',
  'bottom-align': 'bottom-align',
  'center-horizontal': 'center-horizontal',
  'center-vertical': 'center-vertical',
  'distribute-horizontal': 'distribute-horizontal',
  'distribute-vertical': 'distribute-vertical',
  'left-align': 'left-align',
  'right-align': 'right-align',
  'stretch-horizontal': 'stretch-horizontal',
  'stretch-vertical': 'stretch-vertical',
  'top-align': 'top-align',
}

export const SelectionToolbarIcon = CanvasIcon
