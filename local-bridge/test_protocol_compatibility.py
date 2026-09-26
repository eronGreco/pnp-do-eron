# -*- coding: utf-8 -*-
"""Regressoes do protocolo congelado da Cameo 4, sem acessar hardware."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from cameo_protocol import BLOCK1, BLOCK2, path_bytes
from usbprint import ESC_ENQ, REG_OK, STATUS_MOVING, STATUS_READY, STATUS_UNLOADED


class ProtocolCompatibilityTests(unittest.TestCase):
    def test_registration_bytes_are_frozen(self):
        self.assertEqual(BLOCK1, b"TG1\x03FN0\x03TB50,0\x03TB99\x03")
        self.assertEqual(
            BLOCK2,
            b"TB52,2\x03TB51,200\x03TB53,20\x03TB55,1\x03"
            b"TB123,3800,5540,118,118\x03TB99\x03",
        )
        self.assertEqual(ESC_ENQ, b"\x1b\x05")
        self.assertEqual(REG_OK, b"    0\x03")
        self.assertEqual(STATUS_READY, b"0\x03")
        self.assertEqual(STATUS_MOVING, b"1\x03")
        self.assertEqual(STATUS_UNLOADED, b"2\x03")
        self.assertNotEqual(b"    1\x03", STATUS_MOVING)

    def test_real_52_mm_card_uses_y_x_and_mark_origin(self):
        data = path_bytes((10.0, 10.0, 62.0, 62.0), 3.0)
        commands = [command for command in data.split(b"\x03") if command]
        self.assertTrue(commands[0].startswith(b"M"))
        self.assertTrue(all(command[:1] in (b"M", b"D") for command in commands))

    def test_line_overcut_does_not_change_rounded_corners(self):
        rect = (30.25, 40.5, 87.25, 129.5)
        without_overcut = path_bytes(rect, 3.0, line_overcut=False)
        with_overcut = path_bytes(rect, 3.0, line_overcut=True, line_overcut_mm=0.1)
        self.assertEqual(with_overcut, without_overcut)

    def test_line_overcut_changes_only_square_corners(self):
        rect = (30.25, 40.5, 87.25, 129.5)
        without_overcut = path_bytes(rect, 0.0, line_overcut=False)
        with_overcut = path_bytes(rect, 0.0, line_overcut=True, line_overcut_mm=0.1)
        self.assertNotEqual(with_overcut, without_overcut)
        self.assertEqual(len([c for c in with_overcut.split(b"\x03") if c]), 8)


if __name__ == "__main__":
    unittest.main()