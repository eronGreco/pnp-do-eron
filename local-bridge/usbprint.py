# -*- coding: utf-8 -*-
"""
usbprint.py

Acesso EXCLUSIVO a interface USBPRINT nativa do Windows.

CONGELADO. Copiado do PNP-Cameo-GUI v1.7v, que foi validado fisicamente.
Nao trocar driver, nao usar Zadig, libusb, PyUSB, WinUSB, Inkscape ou Bluetooth.
"""

import ctypes
from ctypes import wintypes
import subprocess
import sys

VID = 0x0B4D
PID = 0x1137
USBPRINT_GUID = "{28d78fad-5a12-11d1-ae5b-0000f803a8c2}"

GENERIC_READ = 0x80000000
GENERIC_WRITE = 0x40000000
OPEN_EXISTING = 3
FILE_FLAG_OVERLAPPED = 0x40000000

WAIT_OBJECT_0 = 0x00000000
WAIT_FAILED = 0xFFFFFFFF
INFINITE = 0xFFFFFFFF

ERROR_IO_PENDING = 997
ERROR_OPERATION_ABORTED = 995
ERROR_SHARING_VIOLATION = 32
ERROR_ACCESS_DENIED = 5

INVALID_HANDLE_VALUE = ctypes.c_void_p(-1).value

ESC_ENQ = b"\x1b\x05"
STATUS_READY = b"0\x03"
STATUS_MOVING = b"1\x03"
STATUS_UNLOADED = b"2\x03"
REG_OK = b"    0\x03"

BUSY_MESSAGE = (
    "A Cameo está sendo utilizada por outro programa. "
    "Feche o Silhouette Studio para continuar."
)


class CameoError(RuntimeError):
    pass


class OVERLAPPED(ctypes.Structure):
    _fields_ = [
        ("Internal", ctypes.c_size_t),
        ("InternalHigh", ctypes.c_size_t),
        ("Offset", wintypes.DWORD),
        ("OffsetHigh", wintypes.DWORD),
        ("hEvent", wintypes.HANDLE),
    ]


def winerr(err):
    return ctypes.FormatError(err).strip()


def find_device_path():
    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    r = subprocess.run(
        ["pnputil", "/enum-interfaces", "/class", USBPRINT_GUID],
        capture_output=True,
        text=True,
        errors="replace",
        creationflags=creationflags,
    )
    if r.returncode != 0:
        raise CameoError("Não consegui enumerar a interface USBPRINT da Cameo.")

    target = f"VID_{VID:04X}&PID_{PID:04X}"
    for raw in r.stdout.splitlines():
        line = raw.strip()
        if "\\\\?\\" in line and target in line.upper():
            return line[line.find("\\\\?\\"):].strip()

    raise CameoError("A Cameo não foi encontrada.")


def setup_kernel32():
    k32 = ctypes.WinDLL("kernel32", use_last_error=True)

    k32.CreateFileW.argtypes = [
        wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID,
        wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE,
    ]
    k32.CreateFileW.restype = wintypes.HANDLE

    k32.CreateEventW.argtypes = [
        wintypes.LPVOID, wintypes.BOOL, wintypes.BOOL, wintypes.LPCWSTR,
    ]
    k32.CreateEventW.restype = wintypes.HANDLE

    k32.ReadFile.argtypes = [
        wintypes.HANDLE, wintypes.LPVOID, wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD), ctypes.POINTER(OVERLAPPED),
    ]
    k32.ReadFile.restype = wintypes.BOOL

    k32.WriteFile.argtypes = [
        wintypes.HANDLE, wintypes.LPCVOID, wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD), ctypes.POINTER(OVERLAPPED),
    ]
    k32.WriteFile.restype = wintypes.BOOL

    k32.GetOverlappedResult.argtypes = [
        wintypes.HANDLE, ctypes.POINTER(OVERLAPPED),
        ctypes.POINTER(wintypes.DWORD), wintypes.BOOL,
    ]
    k32.GetOverlappedResult.restype = wintypes.BOOL

    k32.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    k32.WaitForSingleObject.restype = wintypes.DWORD

    k32.CancelIoEx.argtypes = [wintypes.HANDLE, ctypes.POINTER(OVERLAPPED)]
    k32.CancelIoEx.restype = wintypes.BOOL

    k32.CloseHandle.argtypes = [wintypes.HANDLE]
    k32.CloseHandle.restype = wintypes.BOOL

    return k32


def make_event(k32):
    ev = k32.CreateEventW(None, True, False, None)
    if not ev:
        err = ctypes.get_last_error()
        raise CameoError(f"CreateEvent falhou: {err} {winerr(err)}")
    return ev


def open_exclusive(k32, path):
    """dwShareMode = 0. Sharing violation aborta o trabalho."""
    ctypes.set_last_error(0)
    handle = k32.CreateFileW(
        path,
        GENERIC_READ | GENERIC_WRITE,
        0,  # EXCLUSIVO.
        None,
        OPEN_EXISTING,
        FILE_FLAG_OVERLAPPED,
        None,
    )

    if not handle or handle == INVALID_HANDLE_VALUE:
        err = ctypes.get_last_error()
        if err in (ERROR_SHARING_VIOLATION, ERROR_ACCESS_DENIED):
            raise CameoError(BUSY_MESSAGE)
        raise CameoError(f"Não consegui abrir a Cameo: WinError {err}: {winerr(err)}")

    return handle


def write_exact(k32, handle, data, timeout_ms=5000):
    ev = make_event(k32)
    ov = OVERLAPPED()
    ov.hEvent = ev
    buf = ctypes.create_string_buffer(data)
    immediate = wintypes.DWORD(0)

    try:
        ctypes.set_last_error(0)
        ok = k32.WriteFile(handle, buf, len(data), ctypes.byref(immediate), ctypes.byref(ov))

        if ok:
            n = immediate.value
        else:
            err = ctypes.get_last_error()
            if err != ERROR_IO_PENDING:
                raise CameoError(f"WriteFile falhou: {err} {winerr(err)}")

            rc = k32.WaitForSingleObject(ev, timeout_ms)
            if rc != WAIT_OBJECT_0:
                k32.CancelIoEx(handle, ctypes.byref(ov))
                raise TimeoutError(f"Timeout de escrita ({timeout_ms} ms).")

            transferred = wintypes.DWORD(0)
            if not k32.GetOverlappedResult(
                handle, ctypes.byref(ov), ctypes.byref(transferred), False
            ):
                err = ctypes.get_last_error()
                raise CameoError(f"GetOverlappedResult(write) falhou: {err} {winerr(err)}")
            n = transferred.value

        if n != len(data):
            raise CameoError(f"Escrita USB incompleta: {n}/{len(data)} bytes.")
    finally:
        k32.CloseHandle(ev)


def ensure_windows():
    if sys.platform != "win32":
        raise CameoError("O PNP Cameo Bridge funciona somente no Windows.")
