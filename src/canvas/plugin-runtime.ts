export interface CanvasPluginRuntime {
  isBrowser: boolean
  isElectron: boolean
  isInWindow: boolean
  isLocal: boolean
  isMobile: boolean
  platform: SyFrontendTypes
}

export function detectCanvasPluginRuntime(
  frontend: SyFrontendTypes,
  locationHref: string,
  loadModule: (moduleId: string) => unknown,
): CanvasPluginRuntime {
  let isElectron = false

  try {
    const remote = loadModule("@electron/remote") as { require?: (moduleId: string) => unknown }
    remote.require?.("@electron/remote/main")
    isElectron = true
  } catch {
    isElectron = false
  }

  return {
    isBrowser: frontend.includes("browser"),
    isElectron,
    isInWindow: locationHref.includes("window.html"),
    isLocal: locationHref.includes("127.0.0.1") || locationHref.includes("localhost"),
    isMobile: frontend === "mobile" || frontend === "browser-mobile",
    platform: frontend,
  }
}
