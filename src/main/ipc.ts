import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import {
  getConfig,
  setConfig,
  getJournals,
  createJournal,
  updateJournal,
  deleteJournal,
  getEntries,
  getEntry,
  createEntry,
  updateEntry,
  deleteEntry,
  getEntryTags,
  getAllTags,
  getEntriesByTag,
  getDb
} from './database'
import {
  setupKey,
  verifyAndSetKey,
  clearSessionKey,
  isSessionActive,
  encrypt,
  decrypt
} from './crypto'

interface EntryContent {
  title: string
  body: string // TipTap JSON stringified
  mood?: string
}

function serializeEntry(row: ReturnType<typeof getEntry>, includeTags = false) {
  if (!row) return null
  const base = {
    id: row.id,
    journalId: row.journal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    wordCount: row.word_count
  }
  if (includeTags) {
    return { ...base, tags: getEntryTags(row.id) }
  }
  return base
}

function decryptEntry(row: ReturnType<typeof getEntry>) {
  if (!row) return null
  let content: EntryContent = { title: '', body: '' }
  try {
    content = JSON.parse(decrypt(row.encrypted_content))
  } catch {
    content = { title: '', body: '' }
  }
  return {
    id: row.id,
    journalId: row.journal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    wordCount: row.word_count,
    tags: getEntryTags(row.id),
    title: content.title,
    body: content.body,
    mood: content.mood
  }
}

export function registerIpcHandlers(): void {
  // ── Auth ──────────────────────────────────────────────────────────────────
  ipcMain.handle('auth:is-setup', () => {
    return !!getConfig('password_hash')
  })

  ipcMain.handle('auth:setup', (_event, password: string) => {
    if (getConfig('password_hash')) {
      return { success: false, error: 'App already set up' }
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' }
    }
    try {
      const { hash, salt } = setupKey(password)
      setConfig('password_hash', hash)
      setConfig('password_salt', salt)

      // Create default journal
      const id = uuidv4()
      createJournal(id, 'My Journal', '#3B82F6', 'book')

      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('auth:login', (_event, password: string) => {
    const hash = getConfig('password_hash')
    const salt = getConfig('password_salt')
    if (!hash || !salt) {
      return { success: false, error: 'App not set up' }
    }
    const ok = verifyAndSetKey(password, hash, salt)
    if (!ok) {
      return { success: false, error: 'Incorrect password' }
    }
    return { success: true }
  })

  ipcMain.handle('auth:logout', () => {
    clearSessionKey()
    return { success: true }
  })

  ipcMain.handle('auth:is-session-active', () => {
    return isSessionActive()
  })

  // ── Journals ──────────────────────────────────────────────────────────────
  ipcMain.handle('journals:list', () => {
    if (!isSessionActive()) throw new Error('Not authenticated')
    return getJournals()
  })

  ipcMain.handle('journals:create', (_event, name: string, color: string, icon: string) => {
    if (!isSessionActive()) throw new Error('Not authenticated')
    const id = uuidv4()
    return createJournal(id, name, color, icon)
  })

  ipcMain.handle(
    'journals:update',
    (_event, id: string, name: string, color: string, icon: string) => {
      if (!isSessionActive()) throw new Error('Not authenticated')
      return updateJournal(id, name, color, icon)
    }
  )

  ipcMain.handle('journals:delete', (_event, id: string) => {
    if (!isSessionActive()) throw new Error('Not authenticated')
    deleteJournal(id)
    return { success: true }
  })

  // ── Entries ───────────────────────────────────────────────────────────────
  ipcMain.handle('entries:list', (_event, journalId?: string) => {
    if (!isSessionActive()) throw new Error('Not authenticated')
    const rows = getEntries(journalId)
    return rows.map((r) => serializeEntry(r, true))
  })

  ipcMain.handle('entries:get', (_event, id: string) => {
    if (!isSessionActive()) throw new Error('Not authenticated')
    const row = getEntry(id)
    if (!row) return null
    return decryptEntry(row)
  })

  ipcMain.handle(
    'entries:create',
    (_event, journalId: string, content: EntryContent, tags: string[]) => {
      if (!isSessionActive()) throw new Error('Not authenticated')
      const id = uuidv4()
      const encryptedContent = encrypt(JSON.stringify(content))
      const wordCount = countWords(content.title + ' ' + content.body)
      const row = createEntry(id, journalId, encryptedContent, wordCount, tags)
      return serializeEntry(row, true)
    }
  )

  ipcMain.handle(
    'entries:update',
    (_event, id: string, content: EntryContent, tags: string[]) => {
      if (!isSessionActive()) throw new Error('Not authenticated')
      const encryptedContent = encrypt(JSON.stringify(content))
      const wordCount = countWords(content.title + ' ' + content.body)
      const row = updateEntry(id, encryptedContent, wordCount, tags)
      return serializeEntry(row, true)
    }
  )

  ipcMain.handle('entries:delete', (_event, id: string) => {
    if (!isSessionActive()) throw new Error('Not authenticated')
    deleteEntry(id)
    return { success: true }
  })

  // ── Tags ──────────────────────────────────────────────────────────────────
  ipcMain.handle('tags:all', () => {
    if (!isSessionActive()) throw new Error('Not authenticated')
    return getAllTags()
  })

  ipcMain.handle('tags:entries', (_event, tag: string) => {
    if (!isSessionActive()) throw new Error('Not authenticated')
    const rows = getEntriesByTag(tag)
    return rows.map((r) => serializeEntry(r, true))
  })

  // ── Search ────────────────────────────────────────────────────────────────
  ipcMain.handle('search:query', (_event, query: string) => {
    if (!isSessionActive()) throw new Error('Not authenticated')
    if (!query.trim()) return []

    const q = query.toLowerCase()
    const allEntries = getEntries()
    const results: ReturnType<typeof decryptEntry>[] = []

    for (const row of allEntries) {
      try {
        const decrypted = decryptEntry(row)
        if (!decrypted) continue
        if (
          decrypted.title.toLowerCase().includes(q) ||
          // Search in body text — extract text from TipTap JSON
          extractTextFromTipTap(decrypted.body).toLowerCase().includes(q) ||
          decrypted.tags.some((t) => t.includes(q))
        ) {
          results.push(decrypted)
        }
      } catch {
        // Skip entries that fail to decrypt
      }
    }

    return results
  })
}

function countWords(text: string): number {
  // Strip HTML/JSON and count words
  const plain = text.replace(/<[^>]*>/g, ' ').replace(/[{}[\]"':,]/g, ' ')
  return plain.split(/\s+/).filter((w) => w.length > 0).length
}

function extractTextFromTipTap(bodyJson: string): string {
  try {
    const doc = JSON.parse(bodyJson)
    return extractText(doc)
  } catch {
    return bodyJson
  }
}

function extractText(node: Record<string, unknown>): string {
  if (node.type === 'text') return String(node.text ?? '')
  if (Array.isArray(node.content)) {
    return (node.content as Record<string, unknown>[]).map(extractText).join(' ')
  }
  return ''
}
