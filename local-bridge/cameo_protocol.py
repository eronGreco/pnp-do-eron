# -*- coding: utf-8 -*-
"""
cameo_protocol.py

Protocolo CONGELADO da Silhouette CAMEO 4, identico ao PNP-Cameo-GUI v1.7v.

NAO alterar sem nova captura USBPcap:
- BLOCK1 / BLOCK2 do registration, incluindo TB51,200 TB53,20 TB123,3800,5540,118,118;
- timings 108 ms, 526 ms e 1,015 s;
- sucesso REAL do registration somente b"    0\\x03";
- AutoBlade no holder 1;
- 1 mm = 20 unidades da maquina, comandos M/D na ordem Y,X;
- final do trabalho: M0,0 e READY.
"""

import math
import queue
import time

from persistent_reader import PersistentReader
from usbprint import (
    CameoError,
    ESC_ENQ,
    REG_OK,
    STATUS_MOVING,
    STATUS_READY,
    STATUS_UNLOADED,
    ensure_windows,
    find_device_path,
    open_exclusive,
    setup_kernel32,
    write_exact,
)

BLOCK1 = b"TG1\x03FN0\x03TB50,0\x03TB99\x03"
BLOCK2 = (
    b"TB52,2\x03"
    b"TB51,200\x03"
    b"TB53,20\x03"
    b"TB55,1\x03"
    b"TB123,3800,5540,118,118\x03"
    b"TB99\x03"
)

REG_X_MM = 10.0
REG_Y_MM = 10.0
REG_WIDTH_MM = 277.0
REG_LENGTH_MM = 190.0


def etx(text):
    return text.encode("ascii") + b"\x03"


def su(mm):
    """1 unidade da maquina = 0,05 mm."""
    return int(round(mm * 20.0))


def rounded_rect_points(x, y, w, h, r, arc_steps=8, start_mid_side=False, overcut_mm=0.0):
    r = max(0.0, min(r, w / 2.0, h / 2.0))
    if r <= 0.0001:
        return [(x, y), (x + w, y), (x + w, y + h), (x, y + h), (x, y)]

    pts = []

    if not start_mid_side:
        def arc(cx, cy, a0, a1):
            for i in range(arc_steps + 1):
                a = math.radians(a0 + (a1 - a0) * i / arc_steps)
                pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))

        arc(x + w - r, y + r, -90, 0)
        arc(x + w - r, y + h - r, 0, 90)
        arc(x + r, y + h - r, 90, 180)
        arc(x + r, y + r, 180, 270)
        pts.append(pts[0])
        return pts

    # Caminho com inicio no meio do lado maior (sentido horario), para a
    # lamina se alinhar num trecho reto antes do primeiro arco.
    def arc_skip(cx, cy, a0, a1):
        for i in range(1, arc_steps + 1):
            a = math.radians(a0 + (a1 - a0) * i / arc_steps)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))

    ext = max(0.0, float(overcut_mm))

    if w >= h:
        mx, my = x + w / 2.0, y
        e = min(ext, max(0.0, w / 2.0 - r))
        pts.append((mx, my))
        pts.append((x + w - r, y))
        arc_skip(x + w - r, y + r, -90, 0)
        pts.append((x + w, y + h - r))
        arc_skip(x + w - r, y + h - r, 0, 90)
        pts.append((x + r, y + h))
        arc_skip(x + r, y + h - r, 90, 180)
        pts.append((x, y + r))
        arc_skip(x + r, y + r, 180, 270)
        pts.append((mx + e, my))
    else:
        mx, my = x, y + h / 2.0
        e = min(ext, max(0.0, h / 2.0 - r))
        pts.append((mx, my))
        pts.append((x, y + r))
        arc_skip(x + r, y + r, 180, 270)
        pts.append((x + w - r, y))
        arc_skip(x + w - r, y + r, -90, 0)
        pts.append((x + w, y + h - r))
        arc_skip(x + w - r, y + h - r, 0, 90)
        pts.append((x + r, y + h))
        arc_skip(x + r, y + h - r, 90, 180)
        pts.append((mx, my - e))

    return pts


def path_bytes(page_rect_mm, radius_mm, line_overcut=False, line_overcut_mm=0.1):
    """
    page_rect_mm = (x0,y0,x1,y1) em mm na pagina fisica.
    Depois do registration, (0,0) logico e a marca superior esquerda (10,10) mm.
    """
    x0, y0, x1, y1 = page_rect_mm
    w = x1 - x0
    h = y1 - y0
    x = x0 - REG_X_MM
    y = y0 - REG_Y_MM

    if line_overcut and float(radius_mm) <= 1e-9:
        ext = max(0.0, float(line_overcut_mm))
        corners = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        data = []
        for i in range(4):
            ax, ay = corners[i]
            bx, by = corners[(i + 1) % 4]
            vx, vy = bx - ax, by - ay
            length = math.hypot(vx, vy)
            if length <= 1e-9:
                continue
            ux, uy = vx / length, vy / length
            sx, sy = ax - ux * ext, ay - uy * ext
            ex, ey = bx + ux * ext, by + uy * ext
            data.append(etx(f"M{su(sy)},{su(sx)}"))
            data.append(etx(f"D{su(ey)},{su(ex)}"))
        return b"".join(data)

    ext = max(0.0, float(line_overcut_mm)) if line_overcut else 0.0
    pts = rounded_rect_points(
        x, y, w, h, radius_mm, start_mid_side=True, overcut_mm=ext
    )
    first = pts[0]
    data = [etx(f"M{su(first[1])},{su(first[0])}")]
    for px, py in pts[1:]:
        data.append(etx(f"D{su(py)},{su(px)}"))

    return b"".join(data)


class CameoSession:
    """Uma sessao USB exclusiva = um trabalho fisico."""

    def __init__(self, log=None):
        ensure_windows()
        self.log = log or (lambda msg: None)
        self.k32 = None
        self.handle = None
        self.reader = None

    def __enter__(self):
        path = find_device_path()
        self.k32 = setup_kernel32()
        self.handle = open_exclusive(self.k32, path)
        self.reader = PersistentReader(self.k32, self.handle)
        self.reader.start()
        self.reader.wait_armed()
        return self

    def __exit__(self, exc_type, exc, tb):
        if self.reader is not None:
            self.reader.stop()
        if self.handle:
            self.k32.CloseHandle(self.handle)
        self.reader = None
        self.handle = None

    def query_ready_initial(self):
        self.reader.wait_armed()
        write_exact(self.k32, self.handle, ESC_ENQ)

        deadline = time.monotonic() + 5.0
        while time.monotonic() < deadline:
            try:
                _, resp = self.reader.get(timeout=max(0.05, deadline - time.monotonic()))
            except queue.Empty:
                break

            self.reader.wait_armed()
            if resp == STATUS_READY:
                return
            if resp == STATUS_MOVING:
                raise CameoError("A Cameo está em movimento antes de iniciar o trabalho.")
            if resp == STATUS_UNLOADED:
                raise CameoError("A base não está carregada.")
            raise CameoError(f"Resposta inesperada no READY inicial: {resp!r}")

        raise CameoError("A Cameo não respondeu READY.")

    def wait_ready(self, timeout=45.0):
        deadline = time.monotonic() + timeout

        while time.monotonic() < deadline:
            self.reader.wait_armed()
            write_exact(self.k32, self.handle, ESC_ENQ)

            try:
                _, resp = self.reader.get(timeout=2.0)
            except queue.Empty:
                continue

            self.reader.wait_armed()

            if resp == STATUS_READY:
                return
            if resp == STATUS_MOVING:
                time.sleep(0.35)
                continue
            if resp == STATUS_UNLOADED:
                raise CameoError("A base não está carregada.")
            raise CameoError(f"Resposta inesperada de status: {resp!r}")

        raise CameoError("Timeout aguardando a Cameo voltar a READY.")

    def registration(self):
        self.log("Lendo as registration marks.")

        self.reader.wait_armed()
        write_exact(self.k32, self.handle, BLOCK1)

        time.sleep(0.108)
        self.reader.wait_armed()
        write_exact(self.k32, self.handle, BLOCK2)

        started = time.monotonic()
        next_poll = started + 0.526
        poll_period = 1.015
        deadline = started + 35.0

        while time.monotonic() < deadline:
            now = time.monotonic()

            if now >= next_poll:
                self.reader.wait_armed()
                write_exact(self.k32, self.handle, ESC_ENQ)
                next_poll += poll_period

            try:
                _, resp = self.reader.get(timeout=0.05)
            except queue.Empty:
                continue

            self.reader.wait_armed()

            if resp == STATUS_MOVING:
                continue

            if resp == REG_OK:
                elapsed = time.monotonic() - started
                self.log(f"REGISTRATION OK em {elapsed:.2f} s.")

                self.reader.wait_armed()
                write_exact(self.k32, self.handle, ESC_ENQ)
                try:
                    _, final = self.reader.get(timeout=5.0)
                except queue.Empty:
                    raise CameoError("O registration foi aceito, mas não veio READY final.")
                self.reader.wait_armed()

                if final != STATUS_READY:
                    raise CameoError(f"Registration OK, mas a resposta final foi {final!r}.")
                return elapsed

            stripped = resp.rstrip(b"\x03").strip()
            if stripped.startswith(b"-"):
                raise CameoError("Não foi possível localizar as registration marks.")

            raise CameoError(f"Resposta inesperada durante o registration: {resp!r}")

        raise CameoError("Timeout de 35 s na leitura das registration marks.")

    def configure_autoblade(self, depth, force, speed):
        self.log(f"Configurando a lâmina: profundidade {depth}, força {force}, velocidade {speed}.")

        setup = b"".join([
            etx("\\0,0"),
            etx("Z3800,5540"),
            etx("J1"),
            etx(f"FX{force},1"),
            etx("TJ0"),
            etx(f"!{speed},1"),
            etx("FC0,1,1"),
            etx("FE0,1"),
            etx("FF1,0,1"),
            etx("FF1,1,1"),
            etx(f"FX{force},1"),
            etx("TJ3"),
            etx("FC18,1,1"),
            etx(f"TF{depth},1"),
        ])

        write_exact(self.k32, self.handle, setup)
        self.wait_ready(timeout=15.0)

    def cut_rect(self, page_rect_mm, radius_mm, passes=1, line_overcut=False,
                 line_overcut_mm=0.1, on_pass=None):
        data = path_bytes(
            page_rect_mm, radius_mm,
            line_overcut=line_overcut, line_overcut_mm=line_overcut_mm,
        )
        for p in range(passes):
            write_exact(self.k32, self.handle, data, timeout_ms=5000)
            self.wait_ready(timeout=45.0)
            if on_pass:
                on_pass(p + 1, passes)

    def home(self):
        write_exact(self.k32, self.handle, etx("M0,0"))
        self.wait_ready(timeout=10.0)


def test_connection(log=None):
    log = log or (lambda msg: None)
    with CameoSession(log=log) as s:
        s.query_ready_initial()
        log("Cameo conectada e pronta.")


def read_marks_only(log=None):
    log = log or (lambda msg: None)
    with CameoSession(log=log) as s:
        s.query_ready_initial()
        return s.registration()


def cut_job(card_rects_mm, depth=4, force=18, speed=2, passes=1, radius_mm=3.0,
            line_overcut=False, line_overcut_mm=0.1, log=None, on_progress=None):
    """READY -> registration -> AutoBlade -> cartas -> M0,0 -> READY."""
    log = log or (lambda msg: None)

    if not card_rects_mm:
        raise CameoError("Nenhuma carta selecionada.")

    with CameoSession(log=log) as s:
        s.query_ready_initial()
        log("Cameo pronta.")
        s.registration()
        s.configure_autoblade(depth, force, speed)

        total = len(card_rects_mm)
        for i, r in enumerate(card_rects_mm, start=1):
            x0, y0, x1, y1 = r
            log(f"Cortando {i}/{total}: {x1 - x0:.2f} x {y1 - y0:.2f} mm.")
            s.cut_rect(
                r, radius_mm, passes=passes,
                line_overcut=line_overcut, line_overcut_mm=line_overcut_mm,
                on_pass=(lambda p, tp, idx=i: on_progress(idx, total, p, tp)) if on_progress else None,
            )

        s.home()
        log("Corte concluído. A Cameo voltou para a posição inicial.")
