import pytest
import threading
import json
import urllib.request
import urllib.error
import socket
import time
import tempfile
import os


def find_free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def server():
    """Start a real server in a thread for integration tests."""
    from server import make_server
    db_file = tempfile.mktemp(suffix=".db")
    port = find_free_port()
    srv = make_server("127.0.0.1", port, db_file)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    time.sleep(0.1)  # let server start
    yield {"port": port, "url": f"http://127.0.0.1:{port}"}
    srv.shutdown()
    # Close the SQLite connection before unlinking (required on Windows)
    import server as srv_module
    if srv_module._state["conn"]:
        srv_module._state["conn"].close()
        srv_module._state["conn"] = None
    os.unlink(db_file)


def get(server, path, token=None):
    req = urllib.request.Request(f"{server['url']}{path}")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def post(server, path, body=None, token=None):
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(
        f"{server['url']}{path}", data=data,
        headers={"Content-Type": "application/json"}
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def put(server, path, body=None, token=None):
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(
        f"{server['url']}{path}", data=data,
        headers={"Content-Type": "application/json"},
        method="PUT"
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def delete(server, path, token=None):
    req = urllib.request.Request(
        f"{server['url']}{path}", method="DELETE"
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


# --- Auth tests ---

def test_auth_status_not_setup(server):
    status, body = get(server, "/api/auth/status")
    assert status == 200
    assert body["setup"] is False
    assert body["locked"] is True


def test_auth_setup(server):
    status, body = post(server, "/api/auth/setup", {"password": "MySecret123"})
    assert status == 200
    assert body["ok"] is True


def test_auth_status_after_setup(server):
    status, body = get(server, "/api/auth/status")
    assert status == 200
    assert body["setup"] is True
    assert body["locked"] is True


def test_auth_login_wrong_password(server):
    status, body = post(server, "/api/auth/login", {"password": "WrongPassword"})
    assert status == 401
    assert "token" not in body


def test_auth_login_correct_password(server):
    status, body = post(server, "/api/auth/login", {"password": "MySecret123"})
    assert status == 200
    assert "token" in body
    assert len(body["token"]) > 10


def test_entries_requires_auth(server):
    status, _ = get(server, "/api/entries")
    assert status == 401


def test_auth_logout(server):
    _, login_body = post(server, "/api/auth/login", {"password": "MySecret123"})
    token = login_body["token"]
    status, body = post(server, "/api/auth/logout", token=token)
    assert status == 200
    # token no longer works
    status2, _ = get(server, "/api/entries", token=token)
    assert status2 == 401


# --- Entry CRUD tests ---

@pytest.fixture(scope="module")
def token(server):
    # Server may already be set up from earlier tests in the module
    try:
        _, body = post(server, "/api/auth/login", {"password": "MySecret123"})
        return body["token"]
    except Exception:
        post(server, "/api/auth/setup", {"password": "MySecret123"})
        _, body = post(server, "/api/auth/login", {"password": "MySecret123"})
        return body["token"]


def test_create_and_list_entry(server, token):
    status, body = post(server, "/api/entries", {
        "title": "Test Entry",
        "body": "<p>Hello world</p>",
        "word_count": 2
    }, token=token)
    assert status == 201
    assert "id" in body

    status2, entries = get(server, "/api/entries", token=token)
    assert status2 == 200
    assert any(e["title"] == "Test Entry" for e in entries)
    # body should NOT be in list response
    for e in entries:
        assert "body" not in e
        assert "blob" not in e


def test_get_entry_decrypted(server, token):
    _, created = post(server, "/api/entries", {
        "title": "Private Thoughts",
        "body": "<p>My secret</p>",
        "word_count": 3
    }, token=token)
    entry_id = created["id"]

    status, entry = get(server, f"/api/entries/{entry_id}", token=token)
    assert status == 200
    assert entry["title"] == "Private Thoughts"
    assert entry["body"] == "<p>My secret</p>"


def test_update_entry(server, token):
    _, created = post(server, "/api/entries", {
        "title": "Old Title",
        "body": "<p>Old body</p>",
        "word_count": 2
    }, token=token)
    entry_id = created["id"]

    status, _ = put(server, f"/api/entries/{entry_id}", {
        "title": "New Title",
        "body": "<p>New body</p>",
        "word_count": 3
    }, token=token)
    assert status == 200

    _, updated = get(server, f"/api/entries/{entry_id}", token=token)
    assert updated["title"] == "New Title"
    assert updated["body"] == "<p>New body</p>"


def test_delete_entry(server, token):
    _, created = post(server, "/api/entries", {
        "title": "To Delete",
        "body": "<p>bye</p>",
        "word_count": 1
    }, token=token)
    entry_id = created["id"]

    status, _ = delete(server, f"/api/entries/{entry_id}", token=token)
    assert status == 200

    status2, _ = get(server, f"/api/entries/{entry_id}", token=token)
    assert status2 == 404


def test_search_entries(server, token):
    post(server, "/api/entries", {
        "title": "Hiking adventure",
        "body": "<p>Went up the mountain</p>",
        "word_count": 5
    }, token=token)
    post(server, "/api/entries", {
        "title": "Daily notes",
        "body": "<p>Just a regular day</p>",
        "word_count": 5
    }, token=token)

    status, results = get(server, "/api/entries/search?q=mountain", token=token)
    assert status == 200
    assert any("Hiking" in e["title"] for e in results)
