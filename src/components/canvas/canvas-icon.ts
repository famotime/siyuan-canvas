import {
  defineComponent,
  h,
} from 'vue'
import type { PropType } from 'vue'

const STROKED_SHAPE_TAGS = /<(path|circle|rect|ellipse|polygon|polyline)\b([^>]*\bstroke="[^"]+"[^>]*?)(\/?)>/g

export type CanvasIconName =
  | 'new'
  | 'new-canvas'
  | 'new-folder'
  | 'open'
  | 'help'
  | 'save'
  | 'undo'
  | 'redo'
  | 'topbar'
  | 'zoom-in'
  | 'zoom-out'
  | 'reset-viewport'
  | 'delete'
  | 'decompose'
  | 'color'
  | 'center'
  | 'edit'
  | 'refresh'
  | 'text'
  | 'file'
  | 'connect'
  | 'group'
  | 'align'
  | 'left-align'
  | 'center-horizontal'
  | 'right-align'
  | 'top-align'
  | 'center-vertical'
  | 'bottom-align'
  | 'arrange-row'
  | 'arrange-column'
  | 'arrange-grid'
  | 'distribute-horizontal'
  | 'distribute-vertical'
  | 'stretch-horizontal'
  | 'stretch-vertical'
  | 'direction-none'
  | 'direction-single'
  | 'direction-both'
  | 'sort'
  | 'expand-all'
  | 'folder'
  | 'folder-open'
  | 'canvas-file'
  | 'chevron-right'
  | 'close'
  | 'search'

const CANVAS_ICON_MARKUP: Record<CanvasIconName, string> = {
  align: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M42 19H6" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 9H6" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 29H6" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 39H6" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'arrange-column': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="7" width="32" height="6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="8" y="21" width="32" height="6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="8" y="35" width="32" height="6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'arrange-grid': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 14C26.7614 14 29 11.7614 29 9C29 6.23858 26.7614 4 24 4C21.2386 4 19 6.23858 19 9C19 11.7614 21.2386 14 24 14Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 44C26.7614 44 29 41.7614 29 39C29 36.2386 26.7614 34 24 34C21.2386 34 19 36.2386 19 39C19 41.7614 21.2386 44 24 44Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 19H4V29H14V19Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 19H34V29H44V19Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 9H9V19" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 39H9V29" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M29 9H40V19" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M29 39H39V29" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'arrange-row': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="7" y="8" width="6" height="32" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="21" y="8" width="6" height="32" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="35" y="8" width="6" height="32" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'bottom-align': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="17" y="6" width="14" height="28" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M42 42H6" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  center: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 6H8C6.89543 6 6 6.89543 6 8V16" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 42H8C6.89543 42 6 41.1046 6 40V32" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 42H40C41.1046 42 42 41.1046 42 40V32" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 6H40C41.1046 6 42 6.89543 42 8V16" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 31C27.866 31 31 27.866 31 24C31 20.134 27.866 17 24 17C20.134 17 17 20.134 17 24C17 27.866 20.134 31 24 31Z" fill="none" stroke="currentColor" stroke-width="4" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 17L24 13" stroke="currentColor" stroke-width="4" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 35L24 31" stroke="currentColor" stroke-width="4" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 24H31" stroke="currentColor" stroke-width="4" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 24H13" stroke="currentColor" stroke-width="4" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 26C25.1046 26 26 25.1046 26 24C26 22.8954 25.1046 22 24 22C22.8954 22 22 22.8954 22 24C22 25.1046 22.8954 26 24 26Z" fill="currentColor"/></svg>`,
  'center-horizontal': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="7" y="12" width="6" height="24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="21" y="8" width="6" height="32" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="35" y="15" width="6" height="18" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'center-vertical': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="7" width="24" height="6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="8" y="21" width="32" height="6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="15" y="35" width="18" height="6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  color: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 40.9444C26.123 42.8446 28.9266 44 32 44C38.6274 44 44 38.6274 44 32C44 26.4085 40.1757 21.7102 35 20.3781" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M13 20.3781C7.82432 21.7102 4 26.4085 4 32C4 38.6274 9.37258 44 16 44C22.6274 44 28 38.6274 28 32C28 30.4506 27.7063 28.9697 27.1716 27.6101" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24 28C30.6274 28 36 22.6274 36 16C36 9.37258 30.6274 4 24 4C17.3726 4 12 9.37258 12 16C12 22.6274 17.3726 28 24 28Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>`,
  connect: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 24L43 24" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 4H20C18.8954 4 18 4.89543 18 6V14C18 15.1046 18.8954 16 20 16H28C29.1046 16 30 15.1046 30 14V6C30 4.89543 29.1046 4 28 4Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M16 32H8C6.89543 32 6 32.8954 6 34V42C6 43.1046 6.89543 44 8 44H16C17.1046 44 18 43.1046 18 42V34C18 32.8954 17.1046 32 16 32Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M40 32H32C30.8954 32 30 32.8954 30 34V42C30 43.1046 30.8954 44 32 44H40C41.1046 44 42 43.1046 42 42V34C42 32.8954 41.1046 32 40 32Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24 24V16" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M36 32V24" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 32V24" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  delete: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 10V44H39V10H9Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M20 20V33" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 20V33" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 10H44" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 10L19.289 4H28.7771L32 10H16Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>`,
  'direction-both': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 16H13C8.02944 16 4 20.0294 4 25C4 29.9706 8.02944 34 13 34C15.4758 34 17.7181 33.0003 19.3453 31.3826C20.9849 29.7525 24 25 24 25C24 25 27.0057 20.2685 28.632 18.6401C30.261 17.009 32.5127 16 35 16C39.9706 16 44 20.0294 44 25C44 29.9706 39.9706 34 35 34H31" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 30L31 34L35 38" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 12L17 16L13 20" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'direction-none': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.5 24L38.5 24" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'direction-single': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M41.9999 24H5.99994" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 12L42 24L30 36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'distribute-horizontal': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="10" width="28" height="12" transform="rotate(90 30 10)" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M40 6V42" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 6V42" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'distribute-vertical': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="38" y="30" width="28" height="12" transform="rotate(180 38 30)" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M42 40H6" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 8L6 8" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  edit: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M42 26V40C42 41.1046 41.1046 42 40 42H8C6.89543 42 6 41.1046 6 40V8C6 6.89543 6.89543 6 8 6L22 6" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 26.7199V34H21.3172L42 13.3081L34.6951 6L14 26.7199Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>`,
  refresh: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M39.8 19C37.7 11.1 30.5 5.3 22 5.3C11.8 5.3 3.5 13.6 3.5 23.8C3.5 34 11.8 42.3 22 42.3C30.1 42.3 37 37.1 39.4 29.8" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 19H40.5V10.5" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'expand-all': `<svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 8.01189C20.5 8.01205 16.0714 7.93823 15 13.0006C13.917 18.1178 9.85714 22.8479 8 24.0001" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 40.0002C20.5 40.0005 16.0714 40.0631 15 35.0007C13.917 29.8835 9.85714 25.1524 8 24.0002" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="24.0001" r="4" fill="#333"/><path d="M8 24.0001L22 24.0001" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 24.0006H42" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 8.00098H42" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 40.001H42" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  file: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 44H38C39.1046 44 40 43.1046 40 42V14H30V4H10C8.89543 4 8 4.89543 8 6V42C8 43.1046 8.89543 44 10 44Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 4L40 14" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 22V36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 22H24L30 22" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  group: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4H4V12H12V4Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M44 36H36V44H44V36Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M12 36H4V44H12V36Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M44 4H36V12H44V4Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M8 36V12" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 36V12" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8H36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 40H36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path fill-rule="evenodd" clip-rule="evenodd" d="M16 16H25.6V22.4H32V32H22.4V25.6H16V16Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  help: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M17 18C17 14.134 20.134 11 24 11C27.866 11 31 14.134 31 18C31 21.866 27.866 25 24 25V28" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="35" r="2" fill="currentColor"/></svg>`,
  new: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24 16V32" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 24L32 24" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'new-canvas': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 44H38C39.1046 44 40 43.1046 40 42V14H30V4H10C8.89543 4 8 4.89543 8 6V42C8 43.1046 8.89543 44 10 44Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 4L40 14" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 24V36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 30H30" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'new-folder': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 9V41L9 21H39.5V15C39.5 13.8954 38.6046 13 37.5 13H24L19 7H6C4.89543 7 4 7.89543 4 9Z" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 41L44 21H8.8125L4 41H40Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 30V38" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 34H28" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  open: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 9V41L9 21H39.5V15C39.5 13.8954 38.6046 13 37.5 13H24L19 7H6C4.89543 7 4 7.89543 4 9Z" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 41L44 21H8.8125L4 41H40Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'left-align': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 6H32V12H16V6Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 42L6 6" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M16 21H36V27H16V21Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 36H42V42H16V36Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'reset-viewport': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M33 6H42V15" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 33V42H33" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 42H6V33" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 15V6H15" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'right-align': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M42 42V6" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M16 6H32V12H16V6Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 21H32V27H12V21Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 36H32V42H6V36Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  save: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9C6 7.34315 7.34315 6 9 6H34.2814L42 13.2065V39C42 40.6569 40.6569 42 39 42H9C7.34315 42 6 40.6569 6 39V9Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path fill-rule="evenodd" clip-rule="evenodd" d="M24.0083 6L24 13.3846C24 13.7245 23.5523 14 23 14H15C14.4477 14 14 13.7245 14 13.3846L14 6H24.0083Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M9 6H34.2814" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 26H34" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 34H24.0083" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  undo: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.2721 36.7279C14.5294 39.9853 19.0294 42 24 42C33.9411 42 42 33.9411 42 24C42 14.0589 33.9411 6 24 6C19.0294 6 14.5294 8.01472 11.2721 11.2721C9.61407 12.9301 6 17 6 17" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 9V17H14" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  redo: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M36.7279 36.7279C33.4706 39.9853 28.9706 42 24 42C14.0589 42 6 33.9411 6 24C6 14.0589 14.0589 6 24 6C28.9706 6 33.4706 8.01472 36.7279 11.2721C38.3859 12.9301 42 17 42 17" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 8V17H33" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  decompose: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 8.01189C20.5 8.01205 16.0714 7.93823 15 13.0006C13.917 18.1178 9.85714 22.8479 8 24.0001" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 40.0002C20.5 40.0005 16.0714 40.0631 15 35.0007C13.917 29.8835 9.85714 25.1524 8 24.0002" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="24.0001" r="4" fill="currentColor"/><path d="M8 24.0001L22 24.0001" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 24.0006H42" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 8.00098H42" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 40.001H42" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'expand-all': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 10C6 7.79086 7.79086 6 10 6H38C40.2091 6 42 7.79086 42 10V38C42 40.2091 40.2091 42 38 42H10C7.79086 42 6 40.2091 6 38V10Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M6 32H42" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 16L24 20L28 16" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 26V38" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 26V38" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  topbar: `<svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M24 24V19L39 4L44 9L29 24H24Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="fill:none!important"/><path d="M16 24H9C6.23858 24 4 26.2386 4 29C4 31.7614 6.23858 34 9 34H39C41.7614 34 44 36.2386 44 39C44 41.7614 41.7614 44 39 44H18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="fill:none!important"/></svg>`,
  folder: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 8C5 6.89543 5.89543 6 7 6H19L24 11H41C42.1046 11 43 11.8954 43 13V40C43 41.1046 42.1046 42 41 42H7C5.89543 42 5 41.1046 5 40V8Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round" fill="none"/></svg>`,
  'folder-open': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 9V41L9 21H39.5V15C39.5 13.8954 38.6046 13 37.5 13H24L19 7H6C4.89543 7 4 7.89543 4 9Z" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M40 41L44 21H8.8125L4 41H40Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'canvas-file': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 44H38C39.1046 44 40 43.1046 40 42V14H30V4H10C8.89543 4 8 4.89543 8 6V42C8 43.1046 8.89543 44 10 44Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 4L40 14" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="26" r="3" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="30" cy="34" r="3" fill="none" stroke="currentColor" stroke-width="3"/><path d="M21 27L27 33" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  'chevron-right': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 12L31 24L19 36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  close: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 14L34 34" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 34L34 14" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  search: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 38C30.3888 38 38 30.3888 38 21C38 11.6112 30.3888 4 21 4C11.6112 4 4 11.6112 4 21C4 30.3888 11.6112 38 21 38Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round" fill="none"/><path d="M33.222 33.2217L41.7073 41.707" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sort: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 11.5H29" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 24.5H29" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M36 11.5V37.5L42 30.5" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 37.5H29" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'stretch-horizontal': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 7H42" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M8 24H40" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M13.9907 30L8 24.0046L14 18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M34.0093 18L40 23.9954L34 30" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 41H42" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`,
  'stretch-vertical': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 42L7 6" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M18 13.9907L23.9954 8L30 14" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 34.0093L24.0046 40L18 34" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 8V40" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M41 42L41 6" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`,
  text: `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 8H32" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M28 21H44" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M18 42L18 8" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M36 42L36 21" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`,
  'top-align': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="17" y="14.5" width="14" height="28" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M42 6.5H6" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'zoom-in': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 38C30.3888 38 38 30.3888 38 21C38 11.6112 30.3888 4 21 4C11.6112 4 4 11.6112 4 21C4 30.3888 11.6112 38 21 38Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M21 15L21 27" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.0156 21.0156L27 21" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M33.2216 33.2217L41.7069 41.707" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  'zoom-out': `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 38C30.3888 38 38 30.3888 38 21C38 11.6112 30.3888 4 21 4C11.6112 4 4 11.6112 4 21C4 30.3888 11.6112 38 21 38Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M15 21L27 21" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M33.2216 33.2217L41.7069 41.707" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
}

export function getCanvasIconMarkup(name: CanvasIconName) {
  return CANVAS_ICON_MARKUP[name] ?? CANVAS_ICON_MARKUP.help
}

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
