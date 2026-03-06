# Lumina Journal

An encrypted personal journal for your desktop. Entries are stored with AES-256-GCM encryption. The decryption key exists only in memory and is never written to disk.

## Setup

```
pip install pywebview cryptography
python app.py
```

On first launch, you will be prompted to create a master password.

## Data location

Your journal database is stored at:
- **Windows:** `%USERPROFILE%\.lumina_journal\journal.db`
- **macOS/Linux:** `~/.lumina_journal/journal.db`

## Encryption

- Master password → PBKDF2HMAC (SHA-256, 480,000 iterations) → 32-byte AES key
- Each entry encrypted with AES-256-GCM (unique random IV per save)
- The master password and encryption key are never stored on disk
- Only a SHA-256 verification hash is stored to confirm your password at login

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+N | New entry |
| Ctrl+S | Save |
| Ctrl+B | Bold |
| Ctrl+I | Italic |
| Ctrl+U | Underline |
| Ctrl+L | Lock journal |

## Running tests

```
pip install pytest
pytest tests/ -v
```

## Packaging (optional)

To produce a standalone `.exe` with no Python required:

```
pip install pyinstaller
pyinstaller --onefile --windowed --name "Lumina Journal" app.py
```

The executable will be in the `dist/` folder.
