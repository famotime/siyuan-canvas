import {
  isRef,
  proxyRefs,
} from "vue"

export function createCanvasEditorBindings<T extends object>(
  bindings: T,
  preservedKeys: string[] = [],
): T {
  if (preservedKeys.length === 0) {
    return proxyRefs(bindings) as T
  }

  const preserved = new Set(preservedKeys)
  return new Proxy(bindings as Record<string, unknown>, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver)
      if (typeof key === "string" && preserved.has(key)) {
        return value
      }

      return isRef(value) ? value.value : value
    },
    set(target, key, value, receiver) {
      const current = Reflect.get(target, key, receiver)
      if (typeof key === "string" && !preserved.has(key) && isRef(current) && !isRef(value)) {
        current.value = value
        return true
      }

      return Reflect.set(target, key, value, receiver)
    },
  }) as T
}
