# -*- coding: utf-8 -*-
"""
validation.py

O bridge aceita SOMENTE geometria em mm e parametros de corte.
Nunca PDF, imagem, pixels, caminho de arquivo ou comando de shell.
"""

from usbprint import CameoError

A4_W_MM = 297.0
A4_H_MM = 210.0

RANGES = {
    "depth": (1, 10),
    "force": (1, 33),
    "speed": (1, 10),
    "passes": (1, 5),
}

ALLOWED_JOB_KEYS = {
    "sheet", "cards", "settings",
    "depth", "force", "speed", "passes",
    "radiusMm", "lineOvercut", "lineOvercutMm",
    "markArmMm", "sheetWidthMm", "sheetHeightMm",
}

# Braco do L das marcas. 10 mm e o unico valor validado fisicamente;
# 10 a 20 mm e experimental e muda somente o TB51.
MARK_ARM_DEFAULT_MM = 10.0
MARK_ARM_RANGE_MM = (10.0, 20.0)


def _int_in_range(payload, key):
    value = payload.get(key)
    low, high = RANGES[key]
    if not isinstance(value, int) or isinstance(value, bool):
        raise CameoError(f"Parâmetro inválido: {key}.")
    if not low <= value <= high:
        raise CameoError(f"Parâmetro fora da faixa permitida: {key}.")
    return value


def validate_job(payload):
    if not isinstance(payload, dict):
        raise CameoError("Requisição inválida.")

    unknown = set(payload.keys()) - ALLOWED_JOB_KEYS
    if unknown:
        raise CameoError("A requisição contém campos não permitidos.")

    settings = payload.get("settings")
    if not isinstance(settings, dict):
        settings = payload

    depth = _int_in_range(settings, "depth")
    force = _int_in_range(settings, "force")
    speed = _int_in_range(settings, "speed")
    passes = _int_in_range(settings, "passes")

    radius = settings.get("radiusMm", 0)
    if not isinstance(radius, (int, float)) or isinstance(radius, bool):
        raise CameoError("Parâmetro inválido: raio.")
    if not 0 <= float(radius) <= 10:
        raise CameoError("Parâmetro fora da faixa permitida: raio.")

    line_overcut = bool(settings.get("lineOvercut", False))
    line_overcut_mm = settings.get("lineOvercutMm", 0.1)
    if not isinstance(line_overcut_mm, (int, float)) or isinstance(line_overcut_mm, bool):
        raise CameoError("Parâmetro inválido: sobrecorte de linha.")
    if not 0 <= float(line_overcut_mm) <= 1.0:
        raise CameoError("Parâmetro fora da faixa permitida: sobrecorte de linha.")

    raw_cards = payload.get("cards")
    if not isinstance(raw_cards, list) or not raw_cards:
        raise CameoError("Nenhuma carta selecionada.")
    if len(raw_cards) > 200:
        raise CameoError("Quantidade de cartas acima do limite.")

    cards = []
    for card in raw_cards:
        if not isinstance(card, dict):
            raise CameoError("Geometria de carta inválida.")
        try:
            x0 = float(card["x0Mm"] if "x0Mm" in card else card["x0"])
            y0 = float(card["y0Mm"] if "y0Mm" in card else card["y0"])
            x1 = float(card["x1Mm"] if "x1Mm" in card else card["x1"])
            y1 = float(card["y1Mm"] if "y1Mm" in card else card["y1"])
        except (KeyError, TypeError, ValueError):
            raise CameoError("Geometria de carta inválida.")

        if not (x1 - x0 > 1.0 and y1 - y0 > 1.0):
            raise CameoError("Uma carta tem tamanho inválido.")
        if not (0 <= x0 < x1 <= A4_W_MM and 0 <= y0 < y1 <= A4_H_MM):
            raise CameoError("Uma carta está fora da folha A4.")

        cards.append((x0, y0, x1, y1))

    mark_arm = payload.get("markArmMm", MARK_ARM_DEFAULT_MM)
    if not isinstance(mark_arm, (int, float)) or isinstance(mark_arm, bool):
        raise CameoError("Parâmetro inválido: tamanho da marca.")
    if not MARK_ARM_RANGE_MM[0] <= float(mark_arm) <= MARK_ARM_RANGE_MM[1]:
        raise CameoError("Parâmetro fora da faixa permitida: tamanho da marca.")

    # O registration congelado so conhece A4 deitada.
    sw = payload.get("sheetWidthMm", A4_W_MM)
    sh = payload.get("sheetHeightMm", A4_H_MM)
    if not all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in (sw, sh)):
        raise CameoError("Tamanho de folha inválido.")
    if abs(float(sw) - A4_W_MM) > 0.5 or abs(float(sh) - A4_H_MM) > 0.5:
        raise CameoError("O programa local só corta folha A4 deitada (297 x 210 mm).")

    sheet = payload.get("sheet", 1)
    if not isinstance(sheet, int) or isinstance(sheet, bool) or sheet < 1:
        raise CameoError("Número de folha inválido.")

    return {
        "sheet": sheet,
        "cards": cards,
        "depth": depth,
        "force": force,
        "speed": speed,
        "passes": passes,
        "radius_mm": float(radius),
        "line_overcut": line_overcut,
        "line_overcut_mm": float(line_overcut_mm),
        "mark_arm_mm": float(mark_arm),
    }
