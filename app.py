import socket
import threading
import os
import webview
from server import make_server

APP_TITLE = "Lumina Journal"
DB_PATH = os.path.join(
    os.path.expanduser("~"), ".lumina_journal", "journal.db"
)


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    port = _find_free_port()
    srv = make_server("127.0.0.1", port, DB_PATH)

    thread = threading.Thread(target=srv.serve_forever, daemon=True)
    thread.start()

    webview.create_window(
        title=APP_TITLE,
        url=f"http://127.0.0.1:{port}",
        width=1280,
        height=800,
        min_size=(900, 600),
        frameless=False,
        easy_drag=False,
        text_select=True,
    )
    webview.start()


if __name__ == "__main__":
    main()
