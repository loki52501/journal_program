import pytest
import sqlite3
import tempfile
import os
from db import init_db, is_setup, save_auth, get_auth, \
    create_entry, get_entries, get_entry, update_entry, delete_entry, \
    search_entries


@pytest.fixture
def conn():
    """In-memory SQLite connection for each test."""
    c = init_db(":memory:")
    yield c
    c.close()


def test_init_db_creates_tables(conn):
    tables = {r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()}
    assert "auth" in tables
    assert "entries" in tables


def test_is_setup_false_initially(conn):
    assert is_setup(conn) is False


def test_save_and_get_auth(conn):
    save_auth(conn, "salt123", "check456")
    auth = get_auth(conn)
    assert auth["salt"] == "salt123"
    assert auth["key_check"] == "check456"


def test_is_setup_true_after_save_auth(conn):
    save_auth(conn, "salt", "check")
    assert is_setup(conn) is True


def test_create_entry_returns_id(conn):
    entry_id = create_entry(conn, "My Title", "blob:data:here", 10)
    assert isinstance(entry_id, int)
    assert entry_id > 0


def test_get_entries_empty(conn):
    assert get_entries(conn) == []


def test_get_entries_returns_metadata(conn):
    create_entry(conn, "Title One", "blob1", 5)
    create_entry(conn, "Title Two", "blob2", 8)
    entries = get_entries(conn)
    assert len(entries) == 2
    titles = {e["title"] for e in entries}
    assert "Title One" in titles
    assert "Title Two" in titles
    # Must NOT include blob (encrypted body)
    for e in entries:
        assert "blob" not in e


def test_get_entry_returns_blob(conn):
    entry_id = create_entry(conn, "My Title", "iv:ct:tag", 3)
    entry = get_entry(conn, entry_id)
    assert entry["title"] == "My Title"
    assert entry["blob"] == "iv:ct:tag"
    assert entry["id"] == entry_id


def test_get_entry_not_found(conn):
    assert get_entry(conn, 9999) is None


def test_update_entry(conn):
    entry_id = create_entry(conn, "Old Title", "old:blob:data", 5)
    update_entry(conn, entry_id, "New Title", "new:blob:data", 10)
    entry = get_entry(conn, entry_id)
    assert entry["title"] == "New Title"
    assert entry["blob"] == "new:blob:data"
    assert entry["word_count"] == 10


def test_delete_entry(conn):
    entry_id = create_entry(conn, "Title", "blob", 3)
    delete_entry(conn, entry_id)
    assert get_entry(conn, entry_id) is None


def test_search_entries_finds_by_title(conn):
    create_entry(conn, "Python tips", "blob1", 5)
    create_entry(conn, "Holiday plans", "blob2", 8)
    results = search_entries(conn, "Python")
    assert len(results) == 1
    assert results[0]["title"] == "Python tips"


def test_search_entries_finds_by_body(conn):
    create_entry(conn, "Random title", "blob", 5, body_for_fts="I love hiking")
    results = search_entries(conn, "hiking")
    assert len(results) == 1


def test_search_entries_empty_query_returns_all(conn):
    create_entry(conn, "Entry A", "blob1", 1)
    create_entry(conn, "Entry B", "blob2", 2)
    results = search_entries(conn, "")
    assert len(results) == 2


def test_delete_removes_from_fts(conn):
    entry_id = create_entry(conn, "Secret note", "blob", 2, body_for_fts="classified")
    delete_entry(conn, entry_id)
    results = search_entries(conn, "classified")
    assert results == []
