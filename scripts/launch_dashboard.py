"""Serve the built RiskLab dashboard and API from a single loopback server."""

import hashlib
import json
import socket
import threading
import time
import webbrowser
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

import uvicorn

ROOT = Path(__file__).resolve().parents[1]
HOST = "127.0.0.1"
PORTS = range(5175, 5195)
INSTANCE = hashlib.sha256(str(ROOT).casefold().encode()).hexdigest()


def launcher_ready() -> dict[str, str]:
    return {"risklab": INSTANCE}


def ready(url: str) -> bool:
    """Identify this checkout's server before sending the browser there."""
    try:
        with urlopen(url + "api/launcher-ready", timeout=0.35) as response:
            return json.load(response) == launcher_ready()
    except (OSError, URLError, ValueError):
        return False


def open_when_ready(url: str, server: uvicorn.Server) -> None:
    """Open the browser after Uvicorn begins responding."""
    while not server.should_exit:
        if server.started and ready(url):
            print(f"RiskLab is ready at {url}. Keep this window open.", flush=True)
            webbrowser.open(url)
            return
        time.sleep(0.15)


def main() -> None:
    """Reuse a running checkout or reserve an available port before serving."""
    for port in PORTS:
        url = f"http://{HOST}:{port}/"
        if ready(url):
            print(f"RiskLab is already running at {url}.")
            webbrowser.open(url)
            return

    print("Starting the RiskLab dashboard and API…", flush=True)
    from fastapi.staticfiles import StaticFiles

    from backend.main import app

    app.get("/api/launcher-ready", include_in_schema=False)(launcher_ready)
    app.mount("/", StaticFiles(directory=ROOT / "frontend" / "dist", html=True))
    for port in PORTS:
        with socket.socket() as listener:
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                listener.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            try:
                listener.bind((HOST, port))
            except OSError:
                continue
            url = f"http://{HOST}:{port}/"
            server = uvicorn.Server(uvicorn.Config(app, host=HOST, port=port))
            threading.Thread(target=open_when_ready, args=(url, server), daemon=True).start()
            server.run(sockets=[listener])
            return
    raise SystemExit(f"RiskLab could not bind to any of these local ports: {', '.join(map(str, PORTS))}.")


if __name__ == "__main__":
    main()
