import { useEffect, useState, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import CharacterCount from '@tiptap/extension-character-count'
import { format } from 'date-fns'
import {
  Bold,
  Italic,
  UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
  Trash2,
  Tag,
  X,
  Check,
  Loader2,
  Lock
} from 'lucide-react'
import { useStore } from '../store/useStore'

const MOODS = [
  { label: 'Great', emoji: '😄' },
  { label: 'Good', emoji: '🙂' },
  { label: 'Okay', emoji: '😐' },
  { label: 'Bad', emoji: '😞' },
  { label: 'Awful', emoji: '😢' }
]

export default function Editor() {
  const {
    openEntry,
    selectedEntryId,
    isLoadingEntry,
    isSaving,
    setIsSaving,
    setOpenEntry,
    updateEntryMeta,
    removeEntry,
    selectEntry,
    setEntries,
    selectedJournalId,
    setJournals
  } = useStore()

  const [title, setTitle] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [mood, setMood] = useState<string | undefined>()
  const [showTagInput, setShowTagInput] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const entryIdRef = useRef<string | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({
        placeholder: 'Write your thoughts...'
      }),
      CharacterCount
    ],
    editorProps: {
      attributes: {
        class:
          'prose prose-lg max-w-none font-serif focus:outline-none min-h-[400px] text-gray-800 leading-relaxed'
      }
    },
    onUpdate: () => {
      setSaveStatus('unsaved')
      scheduleSave()
    }
  })

  // Load entry into editor when it changes
  useEffect(() => {
    if (!openEntry || openEntry.id === entryIdRef.current) return

    entryIdRef.current = openEntry.id
    setTitle(openEntry.title ?? '')
    setTags(openEntry.tags ?? [])
    setMood(openEntry.mood)
    setSaveStatus('saved')

    if (editor && openEntry.body) {
      try {
        const doc = JSON.parse(openEntry.body)
        editor.commands.setContent(doc, false)
      } catch {
        editor.commands.setContent(openEntry.body, false)
      }
    } else if (editor) {
      editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] }, false)
    }
  }, [openEntry?.id, editor])

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      performSave()
    }, 1500)
  }, [openEntry?.id, title, tags, mood])

  const performSave = useCallback(async () => {
    const id = entryIdRef.current
    if (!id || !editor) return

    setSaveStatus('saving')
    const body = JSON.stringify(editor.getJSON())
    const content = { title, body, mood }

    try {
      const meta = await window.api.entries.update(id, content, tags)
      if (meta) {
        updateEntryMeta(meta)
        // Refresh tags
        const allTags = await window.api.tags.all()
        useStore.getState().setTags(allTags)
      }
      setSaveStatus('saved')
    } catch (err) {
      console.error('Save failed:', err)
      setSaveStatus('unsaved')
    }
  }, [editor, title, tags, mood])

  // Save on title/tags/mood change
  useEffect(() => {
    if (!openEntry) return
    setSaveStatus('unsaved')
    scheduleSave()
  }, [title, tags, mood])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  async function handleDelete() {
    if (!selectedEntryId) return
    const ok = window.confirm('Delete this entry? This cannot be undone.')
    if (!ok) return

    await window.api.entries.delete(selectedEntryId)
    removeEntry(selectedEntryId)
    setOpenEntry(null)
    selectEntry(null)
    entryIdRef.current = null

    // Refresh journals for count
    const journals = await window.api.journals.list()
    setJournals(journals)
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
    }
    setTagInput('')
    setShowTagInput(false)
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag))
  }

  // Empty state
  if (!selectedEntryId && !isLoadingEntry) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-300 bg-white">
        <Lock className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm opacity-60">Select an entry or create a new one</p>
      </div>
    )
  }

  // Loading state
  if (isLoadingEntry) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
      </div>
    )
  }

  if (!openEntry) return null

  const wordCount = editor?.storage.characterCount.words() ?? openEntry.wordCount

  return (
    <div className="flex-1 flex flex-col bg-white h-full">
      {/* Editor toolbar */}
      <div className="h-10 app-drag border-b border-gray-100 flex items-center justify-between px-4">
        <div className="no-drag flex items-center gap-1">
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBold().run()}
            active={editor?.isActive('bold') ?? false}
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            active={editor?.isActive('italic') ?? false}
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            active={editor?.isActive('underline') ?? false}
            title="Underline"
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </ToolbarButton>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor?.isActive('heading', { level: 1 }) ?? false}
            title="Heading 1"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor?.isActive('heading', { level: 2 }) ?? false}
            title="Heading 2"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </ToolbarButton>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            active={editor?.isActive('bulletList') ?? false}
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            active={editor?.isActive('orderedList') ?? false}
            title="Numbered List"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            active={editor?.isActive('blockquote') ?? false}
            title="Quote"
          >
            <Quote className="w-3.5 h-3.5" />
          </ToolbarButton>
        </div>

        <div className="no-drag flex items-center gap-3">
          {/* Save status */}
          <SaveIndicator status={saveStatus} />

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
            title="Delete entry"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Entry content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">
          {/* Date */}
          <p className="text-xs text-gray-400 mb-4 font-medium uppercase tracking-wider">
            {format(new Date(openEntry.createdAt), "EEEE, MMMM d, yyyy 'at' h:mm a")}
          </p>

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full text-2xl font-bold text-gray-900 placeholder-gray-300 focus:outline-none mb-4 bg-transparent"
          />

          {/* Mood row */}
          <div className="flex items-center gap-2 mb-5">
            {MOODS.map((m) => (
              <button
                key={m.label}
                onClick={() => setMood(mood === m.label ? undefined : m.label)}
                title={m.label}
                className={`text-lg transition-all ${mood === m.label ? 'scale-125' : 'opacity-30 hover:opacity-70'}`}
              >
                {m.emoji}
              </button>
            ))}
          </div>

          {/* TipTap editor */}
          <EditorContent editor={editor} />

          {/* Tags */}
          <div className="mt-8 pt-4 border-t border-gray-100">
            <div className="flex items-center flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded-full"
                >
                  #{tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-blue-800">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {showTagInput ? (
                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addTag()
                      if (e.key === 'Escape') setShowTagInput(false)
                    }}
                    placeholder="tag name"
                    className="border-b border-blue-400 text-sm text-gray-700 focus:outline-none w-24 py-0.5"
                    autoFocus
                  />
                  <button onClick={addTag} className="text-blue-500 hover:text-blue-700">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setShowTagInput(false)} className="text-gray-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTagInput(true)}
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors"
                >
                  <Tag className="w-3 h-3" />
                  Add tag
                </button>
              )}
            </div>
          </div>

          {/* Word count */}
          <div className="mt-4 text-xs text-gray-300">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </div>
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({
  onClick,
  active,
  children,
  title
}: {
  onClick: () => void
  active: boolean
  children: React.ReactNode
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
        active ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

function SaveIndicator({ status }: { status: 'saved' | 'saving' | 'unsaved' }) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        Saving...
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-400">
        <Lock className="w-3 h-3 text-green-500" />
        Encrypted
      </span>
    )
  }
  return <span className="text-xs text-orange-400">Unsaved</span>
}
