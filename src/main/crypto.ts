import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto'

// In-memory session key — never written to disk
let sessionKey: Buffer | null = null

const PBKDF2_ITERATIONS = 600_000
const PBKDF2_KEYLEN = 32
const PBKDF2_DIGEST = 'sha512'
const SALT_LEN = 32
const IV_LEN = 12
const AUTH_TAG_LEN = 16

export function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
}

export function generateSalt(): Buffer {
  return randomBytes(SALT_LEN)
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = generateSalt()
  const key = deriveKey(password, salt)
  // Store a verification hash: derive a second key from the derived key
  // This way we verify the password without storing anything that can decrypt entries
  const verificationSalt = randomBytes(SALT_LEN)
  const verificationHash = pbkdf2Sync(key, verificationSalt, 1, 32, 'sha256')
  return {
    hash: verificationHash.toString('hex'),
    salt: [salt.toString('hex'), verificationSalt.toString('hex')].join(':')
  }
}

export function verifyAndSetKey(password: string, storedHash: string, storedSalt: string): boolean {
  try {
    const [saltHex, verSaltHex] = storedSalt.split(':')
    const salt = Buffer.from(saltHex, 'hex')
    const verSalt = Buffer.from(verSaltHex, 'hex')
    const expectedHash = Buffer.from(storedHash, 'hex')

    const key = deriveKey(password, salt)
    const verificationHash = pbkdf2Sync(key, verSalt, 1, 32, 'sha256')

    if (!timingSafeEqual(verificationHash, expectedHash)) {
      return false
    }

    // Password is correct — set session key
    sessionKey = key
    return true
  } catch {
    return false
  }
}

export function setupKey(password: string): { hash: string; salt: string } {
  const result = hashPassword(password)
  // Also derive and set the session key immediately
  const [saltHex] = result.salt.split(':')
  const salt = Buffer.from(saltHex, 'hex')
  sessionKey = deriveKey(password, salt)
  return result
}

export function clearSessionKey(): void {
  if (sessionKey) {
    sessionKey.fill(0)
    sessionKey = null
  }
}

export function isSessionActive(): boolean {
  return sessionKey !== null
}

export function encrypt(plaintext: string): string {
  if (!sessionKey) throw new Error('No active session')

  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', sessionKey, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Format: base64(iv):base64(authTag):base64(encrypted)
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':')
}

export function decrypt(ciphertext: string): string {
  if (!sessionKey) throw new Error('No active session')

  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Invalid ciphertext format')

  const iv = Buffer.from(parts[0], 'base64')
  const authTag = Buffer.from(parts[1], 'base64')
  const encrypted = Buffer.from(parts[2], 'base64')

  const decipher = createDecipheriv('aes-256-gcm', sessionKey, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}
