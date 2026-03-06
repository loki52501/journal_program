import { useEffect, useState, useCallback } from 'react'
import { format, isToday, isYesterday, isThisYear } from 'date-fns'
import { Plus, Search, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { EntryMeta } from '../types'

function formatEntryDate(ts: number): string {
  const d = new Date(ts)
  if (isToday(d)) return format(d, 'h:mm a')
  if (isYesterday(d)) return 'Yesterday'
  if (isThisYear(d)) return format(d, 'MMM d')
  return format(d, 'MMM d, yyyy')
}

function groupEntriesByDate(entries: EntryMeta[]): { label: string; entries: EntryMeta[] }[] {
  const groups: Map<string, EntryMeta[]> = new Map()

  for (const entry of entries) {
    const d = new Date(entry.createdAt)
    let label: string
    if (isToday(d)) label = 'Today'
    else if (isYesterday(d)) label = 'Yesterday'
    else if (isThisYear(d)) label = format(d, 'MMMM yyyy')
    else label = format(d, 'MMMM yyyy')

    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(entry)
  }

  return Array.from(groups.entries()).map(([label, entries]) => ({ label, entries }))
}

export default function EntryList() {
  const {
    entries,
    selectedEntryId,
    selectedJournalId,
    viewMode,
    searchQuery,
    setSearchQuery,
    setEntries,
    selectEntry,
    setOpenEntry,
    setIsLoadingEntry,
    journals
  } = useStore()

  const [localSearch, setLocalSearch] = useState(searchQuery)

  const selectedJournal = journals.find((j) => j.id === selectedJournalId)

  // Debounced search
  useEffect(() => {
    if (viewMode !== 'search') return
    const timer = setTimeout(async () => {
      if (!localSearch.trim()) {
        setEntries([])
        return
      }
      const results = await window.api.search.query(localSearch)
      setEntries(results)
      setSearchQuery(localSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch, viewMode])

  async function handleSelectEntry(id: string) {
    if (selectedEntryId === id) return
    selectEntry(id)
    setIsLoadingEntry(true)
    try {
      const entry = await window.api.entries.get(id)
      setOpenEntry(entry)
    } finally {
      setIsLoadingEntry(false)
    }
  }

  async function handleNewEntry() {
    if (!selectedJournalId) return
    const now = new Date()
    const title = format(now, 'MMMM d, yyyy')
    const body = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph' }]
    })
    const meta = await window.api.entries.create(selectedJournalId, { title, body }, [])
    const entry = await window.api.entries.get(meta.id)

    // Add to top of list
    useStore.getState().addEntry(meta)
    selectEntry(meta.id)
    setOpenEntry(entry)

    // Refresh journal count
    const journals = await window.api.journals.list()
    useStore.getState().setJournals(journals)
  }

  const panelTitle =
    viewMode === 'search'
      ? 'Search'
      : viewMode === 'tag'
        ? `#${useStore.getState().activeTag}`
        : selectedJournal?.name ?? 'Entries'

  const groups = groupEntriesByDate(entries)

  return (
    <div className="w-72 bg-gray-50 border-r border-gray-200 flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="h-10 app-drag flex items-center justify-between px-4">
        <span className="text-sm font-semibold text-gray-700 no-drag truncate">{panelTitle}</span>
        {viewMode === 'journal' && selectedJournalId && (
          <button
            onClick={handleNewEntry}
            className="no-drag w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-200 text-gray-500 transition-colors"
            title="New Entry (Cmd+N)"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search input (when in search mode) */}
      {viewMode === 'search' && (
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search entries..."
              className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-8 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-400"
              autoFocus
            />
            {localSearch && (
              <button
                onClick={() => setLocalSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full pb-16 text-gray-400">
            {viewMode === 'search' && !localSearch ? (
              <p className="text-sm">Type to search entries</p>
            ) : viewMode === 'search' ? (
              <p className="text-sm">No results found</p>
            ) : (
              <div className="text-center">
                <p className="text-sm mb-3">No entries yet</p>
                {viewMode === 'journal' && selectedJournalId && (
                  <button
                    onClick={handleNewEntry}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg transition-colors"
                  >
                    Write your first entry
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="py-1">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider sticky top-0 bg-gray-50">
                  {group.label}
                </div>
                {group.entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    isSelected={selectedEntryId === entry.id}
                    onClick={() => handleSelectEntry(entry.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EntryCard({
  entry,
  isSelected,
  onClick
}: {
  entry: EntryMeta & { title?: string; body?: string }
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${
        isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-100'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}
        >
          {(entry as EntryMeta & { title?: string }).title || format(new Date(entry.createdAt), 'MMMM d, yyyy')}
        </p>
        <span className="text-xs text-gray-400 shrink-0 mt-0.5">
          {formatEntryDate(entry.createdAt)}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-gray-400">{entry.wordCount} words</span>
        {entry.tags.length > 0 && (
          <>
            <span className="text-gray-300">·</span>
            <div className="flex gap-1 overflow-hidden">
              {entry.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="text-xs text-blue-500">
                  #{tag}
                </span>
              ))}
              {entry.tags.length > 2 && (
                <span className="text-xs text-gray-400">+{entry.tags.length - 2}</span>
              )}
            </div>
          </>
        )}
      </div>
    </button>
  )
}
