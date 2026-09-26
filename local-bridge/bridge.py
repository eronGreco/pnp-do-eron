# -*- coding: utf-8 -*-
"""
bridge.py

PNP Cameo Bridge: servico local minimo que e o UNICO autorizado a falar
com a Silhouette Cameo 4.

SEGURANCA:
- escuta somente em 127.0.0.1 (nunca 0.0.0.0);
- CORS restrito as origens oficiais do app;
- token de sessao gerado a cada execucao (handshake em /health);
- aceita SOMENTE numeros: geometria em mm e parametros de corte;
- nunca recebe PDF, imagem, pixels ou caminho de arquivo;
- nunca executa comando de shell.

Somente biblioteca padrao do Python 3.9+. Nada para instalar.
"""

import json
import os
import queue
import secrets
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from cameo_protocol import cut_job, read_marks_only, test_connection
from usbprint import CameoError
from validation import validate_job

VERSION = "1.0.2"
HOST = "127.0.0.1"
PORT = 8787

DEFAULT_ALLOWED_ORIGINS = {
    "https://pnp.eron.dev.br",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
}
EXTRA_ALLOWED_ORIGINS = {
    origin.strip()
    for origin in os.environ.get("PNP_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
}
ALLOWED_ORIGINS = DEFAULT_ALLOWED_ORIGINS | EXTRA_ALLOWED_ORIGINS

SESSION_TOKEN = secrets.token_urlsafe(24)

_job_lock = threading.Lock()
_subscribers = set()
_subscribers_lock = threading.Lock()


def publish(event):
    payload = json.dumps(event, ensure_ascii=False)
    with _subscribers_lock:
        targets = list(_subscribers)
    for q in targets:
        try:
            q.put_nowait(payload)
        except queue.Full:
            pass


def log_event(message):
    publish({"type": "log", "message": message})


def allowed_origin(origin):
    if not origin:
        return None
    if origin in ALLOWED_ORIGINS:
        return origin
    return None


class Handler(BaseHTTPRequestHandler):
    server_version = f"PNPCameoBridge/{VERSION}"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass

    # ---------- helpers ----------

    def _cors(self):
        origin = allowed_origin(self.headers.get("Origin"))
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Bridge-Token")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Max-Age", "600")
            # Private Network Access: site em HTTPS chamando 127.0.0.1.
            if self.headers.get("Access-Control-Request-Private-Network") == "true":
                self.send_header("Access-Control-Allow-Private-Network", "true")

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _origin_ok(self):
        origin = self.headers.get("Origin")
        if origin is None:
            return True  # chamada direta local, sem navegador.
        return allowed_origin(origin) is not None

    def _token_ok(self, token=None):
        return secrets.compare_digest(token or self.headers.get("X-Bridge-Token", ""), SESSION_TOKEN)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        if length > 256 * 1024:
            raise CameoError("Requisição grande demais para o bridge.")
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            raise CameoError("Requisição inválida.")

    # ---------- HTTP ----------

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self._cors()
        self.end_headers()

    def do_GET(self):
        if not self._origin_ok():
            self._json(403, {"error": "Origem não autorizada."})
            return

        path = self.path.split("?")[0]

        if path == "/health":
            self._json(200, {
                "ok": True,
                "version": VERSION,
                "token": SESSION_TOKEN,
                "platform": sys.platform,
            })
            return

        if path == "/events":
            token = ""
            if "?" in self.path:
                for part in self.path.split("?", 1)[1].split("&"):
                    if part.startswith("token="):
                        token = part[len("token="):]
            if not self._token_ok(token):
                self._json(403, {"error": "Sessão local inválida."})
                return
            self._stream_events()
            return

        self._json(404, {"error": "Endpoint inexistente."})

    def do_POST(self):
        if not self._origin_ok():
            self._json(403, {"error": "Origem não autorizada."})
            return
        if not self._token_ok():
            self._json(403, {"error": "Sessão local inválida."})
            return

        path = self.path.split("?")[0]

        try:
            payload = self._read_json()

            if path == "/test-connection":
                if not _job_lock.acquire(blocking=False):
                    raise CameoError("Já existe um trabalho em andamento.")
                try:
                    test_connection(log=log_event)
                finally:
                    _job_lock.release()
                self._json(200, {
                    "connected": True,
                    "state": "ready",
                    "message": "Cameo conectada e pronta.",
                })
                return

            if path == "/read-marks":
                if not _job_lock.acquire(blocking=False):
                    raise CameoError("Já existe um trabalho em andamento.")
                try:
                    elapsed = read_marks_only(log=log_event) or 0.0
                finally:
                    _job_lock.release()
                self._json(200, {
                    "ok": True,
                    "elapsedSeconds": round(float(elapsed), 2),
                    "message": "Marcas lidas com sucesso.",
                })
                return

            if path == "/cut-job":
                job = validate_job(payload)
                if not _job_lock.acquire(blocking=False):
                    raise CameoError("Já existe um trabalho em andamento.")
                try:
                    log_event(f"Iniciando corte da folha {job['sheet']} com {len(job['cards'])} cartas.")
                    cut_job(
                        job["cards"],
                        depth=job["depth"],
                        force=job["force"],
                        speed=job["speed"],
                        passes=job["passes"],
                        radius_mm=job["radius_mm"],
                        line_overcut=job["line_overcut"],
                        line_overcut_mm=job["line_overcut_mm"],
                        log=log_event,
                        on_progress=lambda card, total, p, tp: publish({
                            "type": "progress",
                            "card": card,
                            "totalCards": total,
                            "pass": p,
                            "totalPasses": tp,
                        }),
                    )
                finally:
                    _job_lock.release()
                publish({"type": "done", "message": "Corte concluído."})
                self._json(200, {"ok": True})
                return

            self._json(404, {"error": "Endpoint inexistente."})

        except CameoError as e:
            publish({"type": "error", "message": str(e)})
            self._json(400, {"error": str(e)})
        except TimeoutError as e:
            publish({"type": "error", "message": str(e)})
            self._json(504, {"error": "A Cameo não respondeu no tempo esperado."})
        except Exception as e:  # noqa: BLE001
            publish({"type": "error", "message": "Falha inesperada no bridge."})
            self._json(500, {
                "error": "Falha inesperada no bridge.",
                "diagnostic": f"{type(e).__name__}: {e}",
            })

    # ---------- SSE ----------

    def _stream_events(self):
        q = queue.Queue(maxsize=200)
        with _subscribers_lock:
            _subscribers.add(q)

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self._cors()
        self.end_headers()

        try:
            while True:
                try:
                    payload = q.get(timeout=15.0)
                except queue.Empty:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
                    continue
                self.wfile.write(f"data: {payload}\n\n".encode("utf-8"))
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            with _subscribers_lock:
                _subscribers.discard(q)


def main():
    if sys.platform != "win32":
        print("Atenção: o corte só funciona no Windows com o driver USBPRINT nativo.")

    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.daemon_threads = True

    print("PNP Cameo Bridge " + VERSION)
    print(f"Escutando em http://{HOST}:{PORT} (somente este computador).")
    print("Deixe esta janela aberta enquanto usa o corte. Feche para encerrar.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Encerrando o bridge.")
    finally:
        server.server_close()
        time.sleep(0.1)


if __name__ == "__main__":
    main()
