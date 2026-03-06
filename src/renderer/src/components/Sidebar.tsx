import { useState } from 'react'
import {
  BookOpen,
  Tag,
  Search,
  Plus,
  LogOut,
  ChevronDown,
  ChevronRight,
  X,
  Check
} from 'lucide-react'
import { useStore } from '../store/useStore'
import type { Journal } from '../types'

const JOURNAL_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
]

const JOURNAL_ICONS = ['book', 'star', 'heart', 'coffee', 'sun', 'moon', 'cloud', 'leaf']

const ICON_MAP: Record<string, string> = {
  book: '📔', star: '⭐', heart: '❤️', coffee: '☕',
  sun: '☀️', moon: '🌙', cloud: '☁️', leaf: '🍃'
}

export default function Sidebar() {
  const {
    journals,
    selectedJournalId,
    tags,
    viewMode,
    activeTag,
    setIsAuthenticated,
    selectJournal,
    setEntries,
    setViewMode,
    setActiveTag,
    setSearchQuery,
    setOpenEntry,
    selectEntry,
    setJournals
  } = useStore()

  const [journalsOpen, setJournalsOpen] = useState(true)
  const [tagsOpen, setTagsOpen] = useState(true)
  const [showNewJournal, setShowNewJournal] = useState(false)
  const [newJournalName, setNewJournalName] = useState('')
  const [newJournalColor, setNewJournalColor] = useState(JOURNAL_COLORS[0])
  const [newJournalIcon, setNewJournalIcon] = useState('book')
  const [creatingJournal, setCreatingJournal] = useState(false)
  const [editingJournal, setEditingJournal] = useState<Journal | null>(null)

  async function handleSelectJournal(id: string) {
    selectJournal(id)
    setViewMode('journal')
    setActiveTag(null)
    setOpenEntry(null)
    selectEntry(null)
    const entries = await window.api.entries.list(id)
    setEntries(entries)
  }

  async function handleLogout() {
    await window.api.auth.logout()
    setIsAuthenticated(false)
  }

  async function handleCreateJournal() {
    if (!newJournalName.trim()) return
    setCreatingJournal(true)
    try {
      const journal = await window.api.journals.create(
        newJournalName.trim(),
        newJournalColor,
        newJournalIcon
      )
      const updated = await window.api.journals.list()
      setJournals(updated)
      setShowNewJournal(false)
      setNewJournalName('')
      setNewJournalColor(JOURNAL_COLORS[0])
      setNewJournalIcon('book')
      await handleSelectJournal(journal.id)
    } finally {
      setCreatingJournal(false)
    }
  }

  async function handleTagClick(tag: string) {
    setViewMode('tag')
    setActiveTag(tag)
    selectJournal(null)
    selectEntry(null)
    setOpenEntry(null)
    const entries = await window.api.tags.entries(tag)
    setEntries(entries)
  }

  async function handleSearchMode() {
    setViewMode('search')
    setActiveTag(null)
    setOpenEntry(null)
    selectEntry(null)
  }

  return (
    <aside className="w-56 bg-sidebar-bg flex flex-col h-full shrink-0 border-r border-white/5">
      {/* Title bar drag region */}
      <div className="h-10 app-drag flex items-center px-4">
        <div className="flex items-center gap-2 no-drag">
          <BookOpen className="w-4 h-4 text-blue-400" />
          <span className="text-white text-sm font-semibold tracking-tight">Lumina</span>
        </div>
      </div>

      {/* Search button */}
      <div className="px-3 pb-2">
        <button
          onClick={handleSearchMode}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            viewMode === 'search'
              ? 'bg-blue-600 text-white'
              : 'text-sidebar-text hover:bg-white/5'
          }`}
        >
          <Search className="w-4 h-4" />
          Search
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-4">
        {/* Journals section */}
        <div>
          <button
            onClick={() => setJournalsOpen(!journalsOpen)}
            className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-semibold text-sidebar-text/50 uppercase tracking-wider hover:text-sidebar-text transition-colors"
          >
            Journals
            {journalsOpen ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>

          {journalsOpen && (
            <div className="space-y-0.5 mt-1">
              {journals.map((journal) => (
                <JournalItem
                  key={journal.id}
                  journal={journal}
                  isActive={selectedJournalId === journal.id && viewMode === 'journal'}
                  onClick={() => handleSelectJournal(journal.id)}
                  onEdit={() => setEditingJournal(journal)}
                />
              ))}

              {/* New journal button */}
              {!showNewJournal ? (
                <button
                  onClick={() => setShowNewJournal(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sidebar-text/40 hover:text-sidebar-text/70 text-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Journal
                </button>
              ) : (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={newJournalName}
                    onChange={(e) => setNewJournalName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateJournal()
                      if (e.key === 'Escape') setShowNewJournal(false)
                    }}
                    placeholder="Journal name..."
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm placeholder-sidebar-text/30 focus:outline-none focus:border-blue-400"
                    autoFocus
                  />
                  {/* Color picker */}
                  <div className="flex gap-1.5 flex-wrap">
                    {JOURNAL_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewJournalColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-5 h-5 rounded-full transition-transform ${newJournalColor === c ? 'scale-125 ring-2 ring-white/50' : ''}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleCreateJournal}
                      disabled={!newJournalName.trim() || creatingJournal}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs py-1.5 rounded-lg transition-colors"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setShowNewJournal(false)}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-sidebar-text text-xs rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tags section */}
        {tags.length > 0 && (
          <div className="pt-2">
            <button
              onClick={() => setTagsOpen(!tagsOpen)}
              className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-semibold text-sidebar-text/50 uppercase tracking-wider hover:text-sidebar-text transition-colors"
            >
              Tags
              {tagsOpen ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
            {tagsOpen && (
              <div className="space-y-0.5 mt-1">
                {tags.slice(0, 12).map((t) => (
                  <button
                    key={t.tag}
                    onClick={() => handleTagClick(t.tag)}
                    className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      viewMode === 'tag' && activeTag === t.tag
                        ? 'bg-blue-600 text-white'
                        : 'text-sidebar-text hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5" />
                      {t.tag}
                    </span>
                    <span className="text-xs opacity-50">{t.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Logout */}
      <div className="p-3 border-t border-white/5">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sidebar-text/50 hover:text-sidebar-text hover:bg-white/5 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Lock Journal
        </button>
      </div>
    </aside>
  )
}

function JournalItem({
  journal,
  isActive,
  onClick,
  onEdit
}: {
  journal: Journal
  isActive: boolean
  onClick: () => void
  onEdit: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors group ${
        isActive ? 'bg-white/15 text-white' : 'text-sidebar-text hover:bg-white/5'
      }`}
    >
      <span className="text-base leading-none">{ICON_MAP[journal.icon] ?? '📔'}</span>
      <span className="flex-1 text-left truncate">{journal.name}</span>
      <span className="text-xs opacity-40 shrink-0">{journal.entry_count}</span>
    </button>
  )
}
