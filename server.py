"""Serve the local RN app and save generated PDF reports in the project folder."""

from __future__ import annotations

import json
import os
import re
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


PROJECT_ROOT = Path(__file__).resolve().parent
DESTINATION = PROJECT_ROOT / "destino"
MAX_REPORT_SIZE = 25 * 1024 * 1024
MAX_WORKBOOK_SIZE = 25 * 1024 * 1024
REPORT_NAME = re.compile(
    r"^relatorio-horas-extras-\d{14}-\d{4}-(?:0[1-9]|1[0-2])-\d{13}\.pdf$"
)
STATIC_FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/form.html": ("form.html", "text/html; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/form.js": ("form.js", "text/javascript; charset=utf-8"),
}


class LocalAppHandler(BaseHTTPRequestHandler):
    server_version = "FolhaRN/1.0"

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path == "/api/health":
            self._send_json(200, {"status": "ok", "destination": "destino"})
            return

        file_info = STATIC_FILES.get(path)
        if file_info is None:
            self._send_json(404, {"error": "Recurso não encontrado."})
            return

        file_name, content_type = file_info
        content = (PROJECT_ROOT / file_name).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self) -> None:
        path = urlsplit(self.path).path
        if path != "/api/report":
            self._send_json(404, {"error": "Endpoint não encontrado."})
            return
        self._save_report()

    def _save_report(self) -> None:
        if self.headers.get_content_type() != "application/pdf":
            self._send_json(415, {"error": "Envie um relatório PDF."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            self._send_json(411, {"error": "Tamanho do arquivo inválido."})
            return

        if content_length <= 0 or content_length > MAX_REPORT_SIZE:
            self._send_json(413, {"error": "O arquivo está vazio ou excede o limite de 25 MB."})
            return

        file_name = self.headers.get("X-Filename", "")
        if not REPORT_NAME.fullmatch(file_name):
            self._send_json(400, {"error": "Nome de relatório inválido."})
            return

        content = self.rfile.read(content_length)
        if len(content) != content_length:
            self._send_json(400, {"error": "O envio do relatório foi interrompido."})
            return
        if not content.startswith(b"%PDF-"):
            self._send_json(400, {"error": "O arquivo enviado não é um PDF válido."})
            return

        DESTINATION.mkdir(parents=True, exist_ok=True)
        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="wb",
                prefix=".relatorio-horas-extras-",
                suffix=".tmp",
                dir=DESTINATION,
                delete=False,
            ) as temporary_file:
                temporary_path = Path(temporary_file.name)
                temporary_file.write(content)
                temporary_file.flush()
                os.fsync(temporary_file.fileno())

            output_path = DESTINATION / file_name
            os.replace(temporary_path, output_path)
            temporary_path = None
        except OSError as error:
            self._send_json(500, {"error": f"Não foi possível salvar na pasta destino: {error}"})
            return
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)

        self._send_json(201, {"saved": True, "file": f"destino/{file_name}"})

    def _send_json(self, status: int, data: dict[str, str | bool]) -> None:
        content = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format: str, *args: object) -> None:
        message = format % args
        print(f"{self.log_date_time_string()} {self.client_address[0]} {message}")


def main() -> None:
    DESTINATION.mkdir(parents=True, exist_ok=True)
    address = ("127.0.0.1", 8765)
    server = ThreadingHTTPServer(address, LocalAppHandler)
    print("Folha disponível em http://127.0.0.1:8765")
    print(f"As planilhas serão salvas em {DESTINATION}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
