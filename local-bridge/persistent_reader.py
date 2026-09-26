# -*- coding: utf-8 -*-
"""
persistent_reader.py

BULK-IN overlapped SEMPRE pendente.

CONGELADO: nao usar timeouts curtos com CancelIoEx durante o registration.
CancelIoEx acontece apenas no encerramento da sessao.
"""

import ctypes
from ctypes import wintypes
import queue
import threading
import time

from usbprint import (
    CameoError,
    ERROR_IO_PENDING,
    ERROR_OPERATION_ABORTED,
    INFINITE,
    OVERLAPPED,
    WAIT_FAILED,
    make_event,
    winerr,
)


class PersistentReader:
    def __init__(self, k32, handle, size=64):
        self.k32 = k32
        self.handle = handle
        self.size = size
        self.messages = queue.Queue()
        self.stop_event = threading.Event()
        self.armed_event = threading.Event()
        self.lock = threading.Lock()
        self.current_ov = None
        self.thread = threading.Thread(target=self._worker, daemon=True)

    def start(self):
        self.thread.start()
        if not self.armed_event.wait(2.0):
            raise CameoError("Não consegui armar o BULK-IN da Cameo.")

    def wait_armed(self, timeout=2.0):
        if not self.armed_event.wait(timeout):
            raise CameoError("BULK-IN não ficou pendente antes do comando.")

    def get(self, timeout):
        kind, ts, value = self.messages.get(timeout=timeout)
        if kind == "error":
            raise value
        return ts, value

    def stop(self):
        self.stop_event.set()
        with self.lock:
            ov = self.current_ov
        if ov is not None:
            self.k32.CancelIoEx(self.handle, ctypes.byref(ov))
        self.thread.join(timeout=2.0)

    def _worker(self):
        while not self.stop_event.is_set():
            ev = None
            try:
                ev = make_event(self.k32)
                ov = OVERLAPPED()
                ov.hEvent = ev
                buf = ctypes.create_string_buffer(self.size)
                immediate = wintypes.DWORD(0)

                with self.lock:
                    self.current_ov = ov

                ctypes.set_last_error(0)
                ok = self.k32.ReadFile(
                    self.handle, buf, self.size, ctypes.byref(immediate), ctypes.byref(ov)
                )

                if ok:
                    data = bytes(buf.raw[: immediate.value])
                    if data:
                        self.messages.put(("data", time.monotonic(), data))
                    continue

                err = ctypes.get_last_error()
                if err != ERROR_IO_PENDING:
                    raise CameoError(f"ReadFile falhou: {err} {winerr(err)}")

                self.armed_event.set()
                rc = self.k32.WaitForSingleObject(ev, INFINITE)
                self.armed_event.clear()

                if rc == WAIT_FAILED:
                    err = ctypes.get_last_error()
                    raise CameoError(f"WaitForSingleObject falhou: {err} {winerr(err)}")

                transferred = wintypes.DWORD(0)
                if not self.k32.GetOverlappedResult(
                    self.handle, ctypes.byref(ov), ctypes.byref(transferred), False
                ):
                    err = ctypes.get_last_error()
                    if self.stop_event.is_set() and err == ERROR_OPERATION_ABORTED:
                        return
                    raise CameoError(f"GetOverlappedResult(read) falhou: {err} {winerr(err)}")

                data = bytes(buf.raw[: transferred.value])
                if data:
                    self.messages.put(("data", time.monotonic(), data))

            except Exception as e:  # noqa: BLE001
                if not self.stop_event.is_set():
                    self.messages.put(("error", time.monotonic(), e))
                return

            finally:
                with self.lock:
                    self.current_ov = None
                if ev:
                    self.k32.CloseHandle(ev)

        self.armed_event.clear()
