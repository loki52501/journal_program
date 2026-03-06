import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import Sidebar from './Sidebar'
import EntryList from './EntryList'
import Editor from './Editor'

export default function Layout() {
  const { selectedJournalId, journals, setJournals, setEntries, selectJournal, setTags } =
    useStore()

  // Load initial data
  useEffect(() => {
    async function load() {
      const [journals, tags] = await Promise.all([
        window.api.journals.list(),
        window.api.tags.all()
      ])
      setJournals(journals)
      setTags(tags)
      if (journals.length > 0 && !selectedJournalId) {
        selectJournal(journals[0].id)
      }
    }
    load()
  }, [])

  // Load entries when journal changes
  useEffect(() => {
    async function loadEntries() {
      if (!selectedJournalId) return
      const entries = await window.api.entries.list(selectedJournalId)
      setEntries(entries)
    }
    loadEntries()
  }, [selectedJournalId])

  return (
    <div className="flex h-screen bg-white overflow-hidden select-none">
      {/* Sidebar: journals + navigation */}
      <Sidebar />

      {/* Entry list panel */}
      <EntryList />

      {/* Main editor area */}
      <main className="flex-1 flex flex-col min-w-0">
        <Editor />
      </main>
    </div>
  )
}
