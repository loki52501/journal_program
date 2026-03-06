import os
import base64
import hashlib
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def derive_key(password: str, salt: bytes) -> bytes:
    """Derive a 32-byte AES key from password + salt using PBKDF2HMAC-SHA256."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=480_000,
    )
    return kdf.derive(password.encode("utf-8"))


def make_key_check(key: bytes, salt: bytes) -> str:
    """Return a base64-encoded SHA256 hash of key+salt for password verification."""
    digest = hashlib.sha256(key + salt).digest()
    return base64.b64encode(digest).decode("ascii")


def verify_key_check(key: bytes, salt: bytes, stored_check: str) -> bool:
    """Return True if the key matches the stored check hash."""
    return make_key_check(key, salt) == stored_check


def encrypt(plaintext: str, key: bytes) -> str:
    """Encrypt plaintext string with AES-256-GCM. Returns 'b64iv:b64ct:b64tag'."""
    iv = os.urandom(12)
    aesgcm = AESGCM(key)
    # AESGCM.encrypt returns ciphertext + 16-byte tag appended
    ct_with_tag = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
    ct = ct_with_tag[:-16]
    tag = ct_with_tag[-16:]
    return (
        base64.b64encode(iv).decode("ascii")
        + ":"
        + base64.b64encode(ct).decode("ascii")
        + ":"
        + base64.b64encode(tag).decode("ascii")
    )


def decrypt(blob: str, key: bytes) -> str:
    """Decrypt a blob produced by encrypt(). Raises on bad key/tampered data."""
    iv_b64, ct_b64, tag_b64 = blob.split(":")
    iv = base64.b64decode(iv_b64)
    ct = base64.b64decode(ct_b64)
    tag = base64.b64decode(tag_b64)
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(iv, ct + tag, None)
    return plaintext.decode("utf-8")
