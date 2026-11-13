/**
 * 思源 Protyle 原生渲染工具
 * 负责在 DOM 挂载/更新后调度思源前台原生的 Protyle 渲染器（如 mermaid 流程图、MathJax、Flowchart 等），
 * 并提供包含 Mermaid SVG 流程图直绘保底的多重原生渲染能力。
 */

/**
 * 解转义 HTML 实体字符串，恢复 raw 源码
 */
export function unescapeHtmlEntities(str: string): string {
  if (!str) {
    return ''
  }

  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#10;/g, '\n')
    .replace(/\r\n?/g, '\n')
}

const inflightScriptLoads = new Map<string, Promise<unknown>>()

interface ExternalScriptLoadOptions<T> {
  scriptId: string
  relativePath: string
  getGlobal: () => T | null
  onLoaded?: (lib: T) => void
}

function loadExternalScriptOnce<T>(options: ExternalScriptLoadOptions<T>): Promise<T | null> {
  if (typeof window === 'undefined') {
    return Promise.resolve(null)
  }

  const existingLib = options.getGlobal()
  if (existingLib) {
    return Promise.resolve(existingLib)
  }

  if (typeof document === 'undefined' || !document.head) {
    return Promise.resolve(null)
  }

  const existingPromise = inflightScriptLoads.get(options.scriptId) as Promise<T | null> | undefined
  if (existingPromise) {
    return existingPromise
  }

  const win = window as any
  const staleScript = document.getElementById(options.scriptId)
  if (staleScript) {
    staleScript.remove()
  }

  const loadPromise = new Promise<T | null>((resolve) => {
    const script = document.createElement('script')
    script.id = options.scriptId
    script.async = true
    const baseUrl = win.location?.origin || ''
    const scriptUrl = `${baseUrl}${options.relativePath}`
    script.src = scriptUrl

    const finalize = (result: T | null) => {
      inflightScriptLoads.delete(options.scriptId)
      resolve(result)
    }

    script.onload = () => {
      const lib = options.getGlobal()
      if (lib) {
        options.onLoaded?.(lib)
        finalize(lib)
      } else {
        script.remove()
        finalize(null)
      }
    }

    script.onerror = (err) => {
      console.warn(`[siyuan-canvas] Failed to load script: ${scriptUrl}`, err)
      script.remove()
      finalize(null)
    }

    document.head.appendChild(script)
  })

  inflightScriptLoads.set(options.scriptId, loadPromise)
  return loadPromise
}

/**
 * 动态获取或初始化全局 Mermaid 渲染引擎
 */
function getOrInitMermaid(): Promise<any> {
  return loadExternalScriptOnce({
    scriptId: 'siyuan-canvas-mermaid-js',
    relativePath: '/stage/protyle/js/mermaid/mermaid.min.js',
    getGlobal: () => {
      const win = window as any
      return win.mermaid && typeof win.mermaid.render === 'function' ? win.mermaid : null
    },
    onLoaded: (mermaidLib) => {
      try {
        mermaidLib.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })
      } catch (e) {
        console.warn('[siyuan-canvas] win.mermaid.initialize warning:', e)
      }
    },
  })
}

/**
 * 渲染 Mermaid 流程图（包含思源 NodeCodeBlock 与标准代码块）
 */
export async function renderMermaidBlocksDirectly(container: HTMLElement): Promise<void> {
  if (!container || typeof container.querySelectorAll !== 'function') {
    return
  }

  const mermaidNodes = container.querySelectorAll<HTMLElement>(
    '[data-subtype="mermaid"], [data-type="NodeCodeBlock"][data-subtype="mermaid"], .language-mermaid',
  )

  if (mermaidNodes.length === 0) {
    return
  }

  const protyleApi = typeof window !== 'undefined' ? ((window as any).Protyle || (window as any).siyuan?.Protyle) : null

  // 1. 尝试优先使用思源原生 Protyle.mermaidRender
  if (protyleApi && typeof protyleApi.mermaidRender === 'function') {
    try {
      protyleApi.mermaidRender(container, 'stage/protyle')
      return // Native renderer is handling it, exit to prevent fallback conflicts
    } catch (err) {
      console.warn('[siyuan-canvas] Protyle.mermaidRender error:', err)
    }
  }

  // 2. 检查是否有节点未成功生成 SVG，使用直绘保底机制
  const mermaid = await getOrInitMermaid()

  for (let i = 0; i < mermaidNodes.length; i++) {
    const node = mermaidNodes[i]!
    const hasSvg = !!node.querySelector('svg')
    const renderedAttr = node.getAttribute('data-mermaid-rendered')

    if (renderedAttr === 'true' && hasSvg) {
      continue
    }

    const rawDataContent = node.getAttribute('data-content')
    let code = rawDataContent ? unescapeHtmlEntities(rawDataContent) : node.textContent || ''
    code = code.trim()

    if (!code) {
      continue
    }

    if (mermaid && typeof mermaid.render === 'function') {
      const uniqueId = `mermaid-canvas-${Math.random().toString(36).slice(2)}-${i}`
      try {
        const renderResult = await mermaid.render(uniqueId, code)
        const svgHtml = typeof renderResult === 'string' ? renderResult : renderResult?.svg
        if (svgHtml) {
          node.innerHTML = svgHtml
          node.setAttribute('data-mermaid-rendered', 'true')
          const svgEl = node.querySelector('svg')
          if (svgEl) {
            svgEl.style.maxWidth = '100%'
            svgEl.style.height = 'auto'
            svgEl.style.display = 'block'
            svgEl.style.margin = '0 auto'
          }
        }
      } catch (err) {
        console.warn('[siyuan-canvas] Direct mermaid.render failed:', err)
      }
    }
  }
}

/**
 * 宽松 JSON 解析函数，对齐思源前台 looseJsonParse 实现
 */
export function looseJsonParse(text: string): any {
  if (!text) {
    return {}
  }
  try {
    return Function(`"use strict";return (${text})`)()
  } catch {
    return JSON.parse(text)
  }
}

/**
 * 动态获取或初始化全局 ECharts 渲染引擎
 */
function getOrInitEcharts(): Promise<any> {
  return loadExternalScriptOnce({
    scriptId: 'siyuan-canvas-echarts-js',
    relativePath: '/stage/protyle/js/echarts/echarts.min.js',
    getGlobal: () => {
      const win = window as any
      return win.echarts && typeof win.echarts.init === 'function' ? win.echarts : null
    },
  })
}

/**
 * 渲染 ECharts 图表（包含思源 NodeCodeBlock 与标准代码块）
 */
export async function renderEchartsBlocksDirectly(container: HTMLElement): Promise<void> {
  if (!container || typeof container.querySelectorAll !== 'function') {
    return
  }

  const echartsNodes = container.querySelectorAll<HTMLElement>(
    '[data-subtype="echarts"]:not([data-render="true"]), [data-subtype="chart"]:not([data-render="true"]), [data-type="NodeCodeBlock"][data-subtype="echarts"]:not([data-render="true"])',
  )

  if (echartsNodes.length === 0) {
    return
  }

  const protyleApi = typeof window !== 'undefined' ? ((window as any).Protyle || (window as any).siyuan?.Protyle) : null

  // 1. 尝试优先使用思源原生 Protyle.chartRender
  if (protyleApi && typeof protyleApi.chartRender === 'function') {
    try {
      protyleApi.chartRender(container, 'stage/protyle')
      return // Native renderer is handling it, exit to prevent fallback conflicts
    } catch (err) {
      console.warn('[siyuan-canvas] Protyle.chartRender error:', err)
    }
  }

  // 2. 检查是否有节点未成功渲染，使用直绘保底机制
  const echarts = await getOrInitEcharts()

  for (let i = 0; i < echartsNodes.length; i++) {
    const node = echartsNodes[i]!
    const hasRenderedElement = !!node.querySelector('canvas, svg, div[_echarts_instance_]')
    const isRendered = node.getAttribute('data-render') === 'true' || node.getAttribute('data-echarts-rendered') === 'true'

    if (isRendered && hasRenderedElement) {
      continue
    }

    const rawDataContent = node.getAttribute('data-content')
    let code = rawDataContent ? unescapeHtmlEntities(rawDataContent) : node.textContent || ''
    code = code.trim()

    if (!code) {
      continue
    }

    // 设置对齐思源原生的 data-render 标志位
    node.setAttribute('data-render', 'true')
    node.setAttribute('data-echarts-rendered', 'true')

    let renderTarget = (node.querySelector('div[contenteditable="false"]') || node.lastElementChild) as HTMLElement | null
    if (!renderTarget || renderTarget === node) {
      renderTarget = document.createElement('div')
      renderTarget.setAttribute('contenteditable', 'false')
      node.appendChild(renderTarget)
    }

    renderTarget.style.width = '100%'
    renderTarget.style.height = node.style.height || '320px'

    if (echarts && typeof echarts.init === 'function') {
      try {
        const option = looseJsonParse(code)
        const hasCanvas = !!renderTarget.querySelector('canvas, svg')
        const instanceId = renderTarget.getAttribute('_echarts_instance_')
        let chartInstance = instanceId && hasCanvas && typeof echarts.getInstanceById === 'function' ? echarts.getInstanceById(instanceId) : null

        if (!chartInstance) {
          renderTarget.removeAttribute('_echarts_instance_')
          const mode = typeof window !== 'undefined' && (window as any).siyuan?.config?.appearance?.mode === 1 ? 'dark' : undefined
          chartInstance = echarts.init(renderTarget, mode)
        }

        chartInstance.setOption(option, true)
        if (typeof chartInstance.resize === 'function') {
          chartInstance.resize()
        }
      } catch (err) {
        console.warn('[siyuan-canvas] Direct echarts render failed:', err)
        renderTarget.innerHTML = `<div class="ft__error" style="height:320px;" contenteditable="false">echarts render error: <br>${err}</div>`
      }
    }
  }
}

/**
 * 触发多重原生的 Protyle 渲染器
 */
export function triggerNativeProtyleRender(container: HTMLElement | null | undefined): void {
  if (!container || typeof window === 'undefined' || typeof container.querySelector !== 'function') {
    return
  }

  // 1. 异步触发 Mermaid 流程图原生渲染
  void renderMermaidBlocksDirectly(container)

  // 2. 异步触发 ECharts 图表原生/直绘渲染
  void renderEchartsBlocksDirectly(container)

  // 快速短路检查：如果 DOM 容器内不包含任何需要渲染的 data-subtype 属性，直接返回
  if (!container.querySelector('[data-subtype]')) {
    return
  }

  const protyleApi = (window as any).Protyle || (window as any).siyuan?.Protyle
  if (!protyleApi) {
    return
  }

  const cdnPath = 'stage/protyle'

  // 3. 原生 MathJax 数学公式渲染
  if (
    typeof protyleApi.mathRender === 'function' &&
    container.querySelector('[data-subtype="math"]')
  ) {
    try {
      protyleApi.mathRender(container, cdnPath)
    } catch (error) {
      console.warn('[siyuan-canvas] Trigger Protyle.mathRender failed:', error)
    }
  }

  // 4. 原生 Flowchart 流程图渲染
  if (
    typeof protyleApi.flowchartRender === 'function' &&
    container.querySelector('[data-subtype="flowchart"]')
  ) {
    try {
      protyleApi.flowchartRender(container, cdnPath)
    } catch (error) {
      console.warn('[siyuan-canvas] Trigger Protyle.flowchartRender failed:', error)
    }
  }

  // 5. 原生 Mindmap 思维导图渲染
  if (
    typeof protyleApi.mindmapRender === 'function' &&
    container.querySelector('[data-subtype="mindmap"]')
  ) {
    try {
      protyleApi.mindmapRender(container, cdnPath)
    } catch (error) {
      console.warn('[siyuan-canvas] Trigger Protyle.mindmapRender failed:', error)
    }
  }

  // 6. 原生 Graphviz 渲染
  if (
    typeof protyleApi.graphvizRender === 'function' &&
    container.querySelector('[data-subtype="graphviz"]')
  ) {
    try {
      protyleApi.graphvizRender(container, cdnPath)
    } catch (error) {
      console.warn('[siyuan-canvas] Trigger Protyle.graphvizRender failed:', error)
    }
  }

}
