import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'lumina.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3B82F6',
      icon TEXT NOT NULL DEFAULT 'book',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      journal_id TEXT NOT NULL,
      encrypted_content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      word_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS entry_tags (
      entry_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (entry_id, tag),
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_entries_journal ON entries(journal_id);
    CREATE INDEX IF NOT EXISTS idx_entries_created ON entries(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_entry_tags_entry ON entry_tags(entry_id);
    CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON entry_tags(tag);
  `)

  // Create default journal if none exists and app is already set up
  ensureDefaultJournal()
}

function ensureDefaultJournal(): void {
  const hasSetup = db.prepare('SELECT value FROM config WHERE key = ?').get('password_hash')
  if (!hasSetup) return

  const journalCount = (
    db.prepare('SELECT COUNT(*) as count FROM journals').get() as { count: number }
  ).count
  if (journalCount === 0) {
    db.prepare('INSERT INTO journals (id, name, color, icon, created_at) VALUES (?, ?, ?, ?, ?)').run(
      uuidv4(),
      'My Journal',
      '#3B82F6',
      'book',
      Date.now()
    )
  }
}

// Config operations
export function getConfig(key: string): string | null {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function setConfig(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, value)
}

// Journal operations
export interface JournalRow {
  id: string
  name: string
  color: string
  icon: string
  created_at: number
  entry_count?: number
}

export function getJournals(): JournalRow[] {
  return db
    .prepare(
      `SELECT j.*, COUNT(e.id) as entry_count
       FROM journals j
       LEFT JOIN entries e ON e.journal_id = j.id
       GROUP BY j.id
       ORDER BY j.created_at ASC`
    )
    .all() as JournalRow[]
}

export function createJournal(id: string, name: string, color: string, icon: string): JournalRow {
  const now = Date.now()
  db.prepare('INSERT INTO journals (id, name, color, icon, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    name,
    color,
    icon,
    now
  )
  return getJournals().find((j) => j.id === id)!
}

export function updateJournal(
  id: string,
  name: string,
  color: string,
  icon: string
): JournalRow | null {
  db.prepare('UPDATE journals SET name = ?, color = ?, icon = ? WHERE id = ?').run(
    name,
    color,
    icon,
    id
  )
  return (db.prepare('SELECT * FROM journals WHERE id = ?').get(id) as JournalRow) ?? null
}

export function deleteJournal(id: string): void {
  db.prepare('DELETE FROM journals WHERE id = ?').run(id)
}

// Entry operations
export interface EntryRow {
  id: string
  journal_id: string
  encrypted_content: string
  created_at: number
  updated_at: number
  word_count: number
}

export function getEntries(journalId?: string): EntryRow[] {
  if (journalId) {
    return db
      .prepare('SELECT * FROM entries WHERE journal_id = ? ORDER BY created_at DESC')
      .all(journalId) as EntryRow[]
  }
  return db.prepare('SELECT * FROM entries ORDER BY created_at DESC').all() as EntryRow[]
}

export function getEntry(id: string): EntryRow | null {
  return (db.prepare('SELECT * FROM entries WHERE id = ?').get(id) as EntryRow) ?? null
}

export function createEntry(
  id: string,
  journalId: string,
  encryptedContent: string,
  wordCount: number,
  tags: string[]
): EntryRow {
  const now = Date.now()
  const insert = db.transaction(() => {
    db.prepare(
      'INSERT INTO entries (id, journal_id, encrypted_content, created_at, updated_at, word_count) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, journalId, encryptedContent, now, now, wordCount)

    for (const tag of tags) {
      if (tag.trim()) {
        db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag) VALUES (?, ?)').run(id, tag.trim().toLowerCase())
      }
    }
  })
  insert()
  return getEntry(id)!
}

export function updateEntry(
  id: string,
  encryptedContent: string,
  wordCount: number,
  tags: string[]
): EntryRow | null {
  const update = db.transaction(() => {
    db.prepare(
      'UPDATE entries SET encrypted_content = ?, updated_at = ?, word_count = ? WHERE id = ?'
    ).run(encryptedContent, Date.now(), wordCount, id)

    db.prepare('DELETE FROM entry_tags WHERE entry_id = ?').run(id)
    for (const tag of tags) {
      if (tag.trim()) {
        db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag) VALUES (?, ?)').run(id, tag.trim().toLowerCase())
      }
    }
  })
  update()
  return getEntry(id)
}

export function deleteEntry(id: string): void {
  db.prepare('DELETE FROM entries WHERE id = ?').run(id)
}

export function getEntryTags(entryId: string): string[] {
  const rows = db
    .prepare('SELECT tag FROM entry_tags WHERE entry_id = ? ORDER BY tag ASC')
    .all(entryId) as { tag: string }[]
  return rows.map((r) => r.tag)
}

export function getAllTags(): { tag: string; count: number }[] {
  return db
    .prepare(
      'SELECT tag, COUNT(*) as count FROM entry_tags GROUP BY tag ORDER BY count DESC, tag ASC'
    )
    .all() as { tag: string; count: number }[]
}

export function getEntriesByTag(tag: string): EntryRow[] {
  return db
    .prepare(
      'SELECT e.* FROM entries e JOIN entry_tags t ON t.entry_id = e.id WHERE t.tag = ? ORDER BY e.created_at DESC'
    )
    .all(tag) as EntryRow[]
}
