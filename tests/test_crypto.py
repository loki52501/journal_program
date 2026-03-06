import pytest
import base64
from crypto import derive_key, make_key_check, verify_key_check, encrypt, decrypt


def test_derive_key_returns_32_bytes():
    salt = b'\x00' * 16
    key = derive_key("password", salt)
    assert len(key) == 32


def test_derive_key_deterministic():
    salt = b'\xab' * 16
    key1 = derive_key("secret", salt)
    key2 = derive_key("secret", salt)
    assert key1 == key2


def test_derive_key_different_passwords():
    salt = b'\x00' * 16
    key1 = derive_key("password1", salt)
    key2 = derive_key("password2", salt)
    assert key1 != key2


def test_make_key_check_returns_string():
    salt = b'\x00' * 16
    key = derive_key("password", salt)
    check = make_key_check(key, salt)
    assert isinstance(check, str)
    assert len(check) > 0


def test_verify_key_check_correct_password():
    salt = b'\x00' * 16
    key = derive_key("correct_password", salt)
    check = make_key_check(key, salt)
    assert verify_key_check(key, salt, check) is True


def test_verify_key_check_wrong_password():
    salt = b'\x00' * 16
    correct_key = derive_key("correct_password", salt)
    wrong_key = derive_key("wrong_password", salt)
    check = make_key_check(correct_key, salt)
    assert verify_key_check(wrong_key, salt, check) is False


def test_encrypt_returns_blob_format():
    salt = b'\x00' * 16
    key = derive_key("password", salt)
    blob = encrypt("hello world", key)
    parts = blob.split(":")
    assert len(parts) == 3
    # each part is valid base64
    for part in parts:
        base64.b64decode(part)  # should not raise


def test_encrypt_decrypt_roundtrip():
    salt = b'\x00' * 16
    key = derive_key("password", salt)
    original = "My secret journal entry"
    blob = encrypt(original, key)
    result = decrypt(blob, key)
    assert result == original


def test_encrypt_different_blobs_same_plaintext():
    # Each encrypt call uses fresh random IV
    salt = b'\x00' * 16
    key = derive_key("password", salt)
    blob1 = encrypt("same text", key)
    blob2 = encrypt("same text", key)
    assert blob1 != blob2


def test_decrypt_wrong_key_raises():
    salt = b'\x00' * 16
    key1 = derive_key("password1", salt)
    key2 = derive_key("password2", salt)
    blob = encrypt("secret", key1)
    with pytest.raises(Exception):
        decrypt(blob, key2)


def test_encrypt_unicode():
    salt = b'\x00' * 16
    key = derive_key("password", salt)
    original = "日本語テスト — unicode works"
    blob = encrypt(original, key)
    assert decrypt(blob, key) == original
