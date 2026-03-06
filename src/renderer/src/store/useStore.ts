import { create } from 'zustand'
import type { Journal, EntryMeta, Entry, TagCount, ViewMode } from '../types'

interface StoreState {
  isSetup: boolean
  isAuthenticated: boolean
  journals: Journal[]
  selectedJournalId: string | null
  entries: EntryMeta[]
  selectedEntryId: string | null
  openEntry: Entry | null
  tags: TagCount[]
  viewMode: ViewMode
  activeTag: string | null
  searchQuery: string
  isLoadingEntry: boolean
  isSaving: boolean
  sidebarCollapsed: boolean

  // Actions
  setIsSetup: (v: boolean) => void
  setIsAuthenticated: (v: boolean) => void
  setJournals: (journals: Journal[]) => void
  selectJournal: (id: string | null) => void
  setEntries: (entries: EntryMeta[]) => void
  selectEntry: (id: string | null) => void
  setOpenEntry: (entry: Entry | null) => void
  setTags: (tags: TagCount[]) => void
  setViewMode: (mode: ViewMode) => void
  setActiveTag: (tag: string | null) => void
  setSearchQuery: (q: string) => void
  setIsLoadingEntry: (v: boolean) => void
  setIsSaving: (v: boolean) => void
  setSidebarCollapsed: (v: boolean) => void
  updateEntryMeta: (meta: EntryMeta) => void
  removeEntry: (id: string) => void
  addEntry: (meta: EntryMeta) => void
}

export const useStore = create<StoreState>((set) => ({
  isSetup: false,
  isAuthenticated: false,
  journals: [],
  selectedJournalId: null,
  entries: [],
  selectedEntryId: null,
  openEntry: null,
  tags: [],
  viewMode: 'journal',
  activeTag: null,
  searchQuery: '',
  isLoadingEntry: false,
  isSaving: false,
  sidebarCollapsed: false,

  setIsSetup: (v) => set({ isSetup: v }),
  setIsAuthenticated: (v) => set({ isAuthenticated: v }),
  setJournals: (journals) => set({ journals }),
  selectJournal: (id) => set({ selectedJournalId: id }),
  setEntries: (entries) => set({ entries }),
  selectEntry: (id) => set({ selectedEntryId: id }),
  setOpenEntry: (entry) => set({ openEntry: entry }),
  setTags: (tags) => set({ tags }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveTag: (tag) => set({ activeTag: tag }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setIsLoadingEntry: (v) => set({ isLoadingEntry: v }),
  setIsSaving: (v) => set({ isSaving: v }),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  updateEntryMeta: (meta) =>
    set((state) => ({
      entries: state.entries.map((e) => (e.id === meta.id ? meta : e))
    })),
  removeEntry: (id) =>
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
      selectedEntryId: state.selectedEntryId === id ? null : state.selectedEntryId,
      openEntry: state.openEntry?.id === id ? null : state.openEntry
    })),
  addEntry: (meta) =>
    set((state) => ({
      entries: [meta, ...state.entries]
    }))
}))
