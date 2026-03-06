export interface Journal {
  id: string
  name: string
  color: string
  icon: string
  created_at: number
  entry_count: number
}

export interface EntryMeta {
  id: string
  journalId: string
  createdAt: number
  updatedAt: number
  wordCount: number
  tags: string[]
}

export interface Entry extends EntryMeta {
  title: string
  body: string // TipTap JSON string
  mood?: string
}

export interface TagCount {
  tag: string
  count: number
}

export type ViewMode = 'journal' | 'all' | 'tag' | 'search' | 'starred'

export interface AppState {
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
}
