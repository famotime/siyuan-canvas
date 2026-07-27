import { Protyle, TProtyleAction } from 'siyuan'

const DESTROYED_MARK = '__st_destroyed__'

function safeDestroyProtyle(pt: Protyle | null | undefined) {
  if (!pt) return
  const anyPt = pt as any
  if (anyPt[DESTROYED_MARK]) return
  try { pt.destroy() } catch { }
  anyPt[DESTROYED_MARK] = true
}

export function useProtyleEditor() {
  let protyleInstance: Protyle | null = null
  let protyleHost: HTMLElement | null = null
  let readyTimeoutId: number | null = null

  function mount(container: HTMLElement, blockId: string): void {
    destroy()

    const host = document.createElement('div')
    host.style.width = '100%'
    host.style.height = '100%'
    host.style.overflow = 'auto'
    protyleHost = host
    container.appendChild(host)

    let resolveReady: (() => void) | null = null
    const readyPromise = new Promise<void>((resolve) => { resolveReady = resolve })
    const READY_TIMEOUT_MS = 2000
    readyTimeoutId = window.setTimeout(() => resolveReady?.(), READY_TIMEOUT_MS)

    const actions: TProtyleAction[] = ['cb-get-all', 'cb-get-focus']

    try {
      protyleInstance = new Protyle((window as any).siyuan.ws.app, host, {
        blockId,
        render: {
          breadcrumb: false,
          gutter: true,
          title: false,
          breadcrumbDocName: false,
        },
        action: actions,
        mode: 'wysiwyg',
        after(pt) {
          pt.protyle.wysiwyg.preventKeyup = true
          resolveReady?.()
        },
        click: {
          preventInsetEmptyBlock: true,
        },
      })

      void readyPromise.catch(() => {}).then(() => {
        if (protyleInstance) {
          try { protyleInstance.enable() } catch { }
        }
      })
    } catch {
      destroy()
    }
  }

  function destroy() {
    if (readyTimeoutId !== null) {
      clearTimeout(readyTimeoutId)
      readyTimeoutId = null
    }
    if (protyleInstance) {
      safeDestroyProtyle(protyleInstance)
      protyleInstance = null
    }
    if (protyleHost?.parentElement) {
      try { protyleHost.parentElement.removeChild(protyleHost) } catch { }
    }
    protyleHost = null
  }

  return {
    mount,
    destroy,
  }
}
