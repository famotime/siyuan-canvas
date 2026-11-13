import 'siyuan'

declare module 'siyuan' {
  export function showMessage(
    text: string,
    timeout?: number,
    type?: "info" | "error" | "warning",
    id?: string,
  ): void

  interface IEventBusMap {
    'switch-protyle-mode': {
      protyle: IProtyle
    }
  }
}
