import json
import os
import re
import secrets
import base64
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path

from db import (
    init_db, is_setup, save_auth, get_auth,
    create_entry, get_entries, get_entry,
    update_entry, delete_entry, search_entries,
)
from crypto import derive_key, make_key_check, verify_key_check, encrypt, decrypt

INDEX_HTML = Path(__file__).parent / "index.html"

# Module-level state (single process, single user)
_state = {
    "conn": None,
    "key": None,        # bytes | None — in-memory encryption key
    "sessions": set(),  # valid session tokens
}


def make_server(host: str, port: int, db_path: str) -> HTTPServer:
    _state["conn"] = init_db(db_path)
    return HTTPServer((host, port), _Handler)


def _json_response(handler, status: int, data: dict):
    body = json.dumps(data).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _read_body(handler) -> dict:
    length = int(handler.headers.get("Content-Length", 0))
    if length == 0:
        return {}
    return json.loads(handler.rfile.read(length))


def _check_auth(handler) -> bool:
    auth = handler.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return False
    token = auth[7:]
    return token in _state["sessions"]


def _strip_html(html_str: str) -> str:
    """Strip HTML tags for FTS indexing."""
    return re.sub(r"<[^>]+>", " ", html_str)


class _Handler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass  # suppress access logs

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/" or path == "/index.html":
            self._serve_index()
        elif path == "/api/auth/status":
            self._auth_status()
        elif path == "/api/entries/search":
            self._search_entries(parse_qs(parsed.query).get("q", [""])[0])
        elif path == "/api/entries":
            self._list_entries()
        else:
            m = re.match(r"^/api/entries/(\d+)$", path)
            if m:
                self._get_entry(int(m.group(1)))
            else:
                _json_response(self, 404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path

        if path == "/api/auth/setup":
            self._auth_setup()
        elif path == "/api/auth/login":
            self._auth_login()
        elif path == "/api/auth/logout":
            self._auth_logout()
        elif path == "/api/entries":
            self._create_entry()
        else:
            _json_response(self, 404, {"error": "not found"})

    def do_PUT(self):
        m = re.match(r"^/api/entries/(\d+)$", urlparse(self.path).path)
        if m:
            self._update_entry(int(m.group(1)))
        else:
            _json_response(self, 404, {"error": "not found"})

    def do_DELETE(self):
        m = re.match(r"^/api/entries/(\d+)$", urlparse(self.path).path)
        if m:
            self._delete_entry(int(m.group(1)))
        else:
            _json_response(self, 404, {"error": "not found"})

    # --- Serve static ---

    def _serve_index(self):
        try:
            content = INDEX_HTML.read_bytes()
        except FileNotFoundError:
            content = b"<h1>index.html not found</h1>"
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    # --- Auth ---

    def _auth_status(self):
        conn = _state["conn"]
        _json_response(self, 200, {
            "setup": is_setup(conn),
            "locked": _state["key"] is None,
        })

    def _auth_setup(self):
        conn = _state["conn"]
        if is_setup(conn):
            _json_response(self, 400, {"error": "already set up"})
            return
        body = _read_body(self)
        password = body.get("password", "")
        if len(password) < 1:
            _json_response(self, 400, {"error": "password required"})
            return
        salt = os.urandom(32)
        key = derive_key(password, salt)
        key_check = make_key_check(key, salt)
        save_auth(conn, base64.b64encode(salt).decode(), key_check)
        _json_response(self, 200, {"ok": True})

    def _auth_login(self):
        conn = _state["conn"]
        if not is_setup(conn):
            _json_response(self, 400, {"error": "not set up"})
            return
        body = _read_body(self)
        password = body.get("password", "")
        auth = get_auth(conn)
        salt = base64.b64decode(auth["salt"])
        key = derive_key(password, salt)
        if not verify_key_check(key, salt, auth["key_check"]):
            _json_response(self, 401, {"error": "Invalid password"})
            return
        _state["key"] = key
        token = secrets.token_urlsafe(32)
        _state["sessions"].add(token)
        _json_response(self, 200, {"token": token})

    def _auth_logout(self):
        _state["key"] = None
        _state["sessions"].clear()
        _json_response(self, 200, {"ok": True})

    # --- Entries ---

    def _list_entries(self):
        if not _check_auth(self):
            _json_response(self, 401, {"error": "unauthorized"})
            return
        entries = get_entries(_state["conn"])
        _json_response(self, 200, entries)

    def _create_entry(self):
        if not _check_auth(self):
            _json_response(self, 401, {"error": "unauthorized"})
            return
        body = _read_body(self)
        title = body.get("title", "Untitled")
        entry_body = body.get("body", "")
        word_count = body.get("word_count", 0)
        key = _state["key"]
        blob = encrypt(json.dumps({"title": title, "body": entry_body}), key)
        plain_body = _strip_html(entry_body)
        entry_id = create_entry(_state["conn"], title, blob, word_count, plain_body)
        _json_response(self, 201, {"id": entry_id})

    def _get_entry(self, entry_id: int):
        if not _check_auth(self):
            _json_response(self, 401, {"error": "unauthorized"})
            return
        row = get_entry(_state["conn"], entry_id)
        if row is None:
            _json_response(self, 404, {"error": "not found"})
            return
        try:
            data = json.loads(decrypt(row["blob"], _state["key"]))
        except Exception:
            _json_response(self, 200, {**row, "body": "[Entry could not be decrypted]"})
            return
        _json_response(self, 200, {
            "id": row["id"],
            "title": data["title"],
            "body": data["body"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "word_count": row["word_count"],
        })

    def _update_entry(self, entry_id: int):
        if not _check_auth(self):
            _json_response(self, 401, {"error": "unauthorized"})
            return
        if get_entry(_state["conn"], entry_id) is None:
            _json_response(self, 404, {"error": "not found"})
            return
        body = _read_body(self)
        title = body.get("title", "Untitled")
        entry_body = body.get("body", "")
        word_count = body.get("word_count", 0)
        blob = encrypt(json.dumps({"title": title, "body": entry_body}), _state["key"])
        plain_body = _strip_html(entry_body)
        update_entry(_state["conn"], entry_id, title, blob, word_count, plain_body)
        _json_response(self, 200, {"ok": True})

    def _delete_entry(self, entry_id: int):
        if not _check_auth(self):
            _json_response(self, 401, {"error": "unauthorized"})
            return
        if get_entry(_state["conn"], entry_id) is None:
            _json_response(self, 404, {"error": "not found"})
            return
        delete_entry(_state["conn"], entry_id)
        _json_response(self, 200, {"ok": True})

    def _search_entries(self, query: str):
        if not _check_auth(self):
            _json_response(self, 401, {"error": "unauthorized"})
            return
        try:
            results = search_entries(_state["conn"], query)
        except Exception:
            results = []
        _json_response(self, 200, results)
