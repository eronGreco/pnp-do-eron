/**
 * Converte os milimetros do projeto em pixels da propria arte. A arte enviada
 * pelo usuario e tratada como a face da carta inteira, sem sangria.
 */

export type BleedGeometry = {
  /** Pixels aparados de cada lado antes de criar a sangria. */
  trimX: number;
  trimY: number;
  /** Tamanho da arte depois da apara: e isso que vira a face da carta. */
  cropW: number;
  cropH: number;
  /** Largura da faixa de sangria criada, em pixels. */
  bandX: number;
  bandY: number;
  /** Tamanho final da imagem gerada (carta + sangria nos dois lados). */
  outW: number;
  outH: number;
};

export function bleedGeometry(
  srcW: number,
  srcH: number,
  cardWidthMm: number,
  cardHeightMm: number,
  bleedMm: number,
  trimMm: number,
): BleedGeometry {
  const safeW = Math.max(1, Math.floor(srcW));
  const safeH = Math.max(1, Math.floor(srcH));
  const cardW = Math.max(1, cardWidthMm);
  const cardH = Math.max(1, cardHeightMm);

  const trimX = clamp(Math.round((Math.max(0, trimMm) * safeW) / cardW), 0, Math.floor(safeW / 4));
  const trimY = clamp(Math.round((Math.max(0, trimMm) * safeH) / cardH), 0, Math.floor(safeH / 4));

  const cropW = Math.max(1, safeW - trimX * 2);
  const cropH = Math.max(1, safeH - trimY * 2);

  const bandX = Math.max(0, Math.round((Math.max(0, bleedMm) * cropW) / cardW));
  const bandY = Math.max(0, Math.round((Math.max(0, bleedMm) * cropH) / cardH));

  return {
    trimX,
    trimY,
    cropW,
    cropH,
    bandX,
    bandY,
    outW: cropW + bandX * 2,
    outH: cropH + bandY * 2,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Espelha um indice de pixel para dentro da arte, repetindo em zigue-zague. */
export function reflectIndex(value: number, length: number): number {
  if (length <= 1) return 0;
  const period = length * 2;
  const wrapped = ((value % period) + period) % period;
  return wrapped < length ? wrapped : period - 1 - wrapped;
}

export function clampIndex(value: number, length: number): number {
  return Math.max(0, Math.min(length - 1, value));
}
