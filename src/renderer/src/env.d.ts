/// <reference types="vite/client" />

import type { API } from '../../preload'

declare global {
  interface Window {
    api: API
    electron: {
      ipcRenderer: {
        on: (channel: string, func: (...args: unknown[]) => void) => void
        off: (channel: string, func: (...args: unknown[]) => void) => void
        send: (channel: string, ...args: unknown[]) => void
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      }
    }
  }
}
