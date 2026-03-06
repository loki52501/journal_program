import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  },

  // Auth
  auth: {
    isSetup: (): Promise<boolean> => ipcRenderer.invoke('auth:is-setup'),
    setup: (password: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('auth:setup', password),
    login: (password: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('auth:login', password),
    logout: (): Promise<{ success: boolean }> => ipcRenderer.invoke('auth:logout'),
    isSessionActive: (): Promise<boolean> => ipcRenderer.invoke('auth:is-session-active')
  },

  // Journals
  journals: {
    list: () => ipcRenderer.invoke('journals:list'),
    create: (name: string, color: string, icon: string) =>
      ipcRenderer.invoke('journals:create', name, color, icon),
    update: (id: string, name: string, color: string, icon: string) =>
      ipcRenderer.invoke('journals:update', id, name, color, icon),
    delete: (id: string) => ipcRenderer.invoke('journals:delete', id)
  },

  // Entries
  entries: {
    list: (journalId?: string) => ipcRenderer.invoke('entries:list', journalId),
    get: (id: string) => ipcRenderer.invoke('entries:get', id),
    create: (
      journalId: string,
      content: { title: string; body: string; mood?: string },
      tags: string[]
    ) => ipcRenderer.invoke('entries:create', journalId, content, tags),
    update: (
      id: string,
      content: { title: string; body: string; mood?: string },
      tags: string[]
    ) => ipcRenderer.invoke('entries:update', id, content, tags),
    delete: (id: string) => ipcRenderer.invoke('entries:delete', id)
  },

  // Tags
  tags: {
    all: () => ipcRenderer.invoke('tags:all'),
    entries: (tag: string) => ipcRenderer.invoke('tags:entries', tag)
  },

  // Search
  search: {
    query: (q: string) => ipcRenderer.invoke('search:query', q)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}

export type API = typeof api
