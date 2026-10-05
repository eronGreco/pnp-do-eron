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
  /** Raio do canto arredondado da arte aparada, em pixels (0 = cantos retos). */
  cornerRx: number;
  cornerRy: number;
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
  cornerMm = 0,
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

  // O raio nunca passa da metade do menor lado, senao os cantos se cruzam.
  const cornerRx = clamp(Math.round((Math.max(0, cornerMm) * cropW) / cardW), 0, Math.floor(cropW / 2));
  const cornerRy = clamp(Math.round((Math.max(0, cornerMm) * cropH) / cardH), 0, Math.floor(cropH / 2));

  return {
    trimX,
    trimY,
    cropW,
    cropH,
    cornerRx,
    cornerRy,
    bandX,
    bandY,
    outW: cropW + bandX * 2,
    outH: cropH + bandY * 2,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Centro do arco do canto que contem o ponto, ou null quando o ponto nao esta num canto. */
function cornerCenter(
  px: number,
  py: number,
  width: number,
  height: number,
  rx: number,
  ry: number,
): [number, number] | null {
  const cx = px < rx ? rx : px > width - rx ? width - rx : null;
  const cy = py < ry ? ry : py > height - ry ? height - ry : null;
  return cx === null || cy === null ? null : [cx, cy];
}

/** Verdadeiro quando o pixel esta dentro do retangulo com cantos arredondados. */
export function insideRoundedRect(
  x: number,
  y: number,
  width: number,
  height: number,
  rx: number,
  ry: number,
): boolean {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  if (rx <= 0 || ry <= 0) return true;
  const px = x + 0.5;
  const py = y + 0.5;
  const center = cornerCenter(px, py, width, height, rx, ry);
  if (!center) return true;
  const nx = (px - center[0]) / rx;
  const ny = (py - center[1]) / ry;
  return nx * nx + ny * ny <= 1;
}

/**
 * Leva um pixel que caiu no canto removido de volta para o arco, um pixel para
 * dentro. Assim a sangria cresce a partir do canto arredondado, e nao da quina
 * original que foi aparada.
 */
export function pullIntoRoundedRect(
  x: number,
  y: number,
  width: number,
  height: number,
  rx: number,
  ry: number,
): [number, number] {
  const cx = clampIndex(x, width);
  const cy = clampIndex(y, height);
  if (rx <= 0 || ry <= 0) return [cx, cy];
  const px = cx + 0.5;
  const py = cy + 0.5;
  const center = cornerCenter(px, py, width, height, rx, ry);
  if (!center) return [cx, cy];
  const nx = (px - center[0]) / rx;
  const ny = (py - center[1]) / ry;
  const dist = Math.hypot(nx, ny);
  if (dist <= 1) return [cx, cy];
  const scale = Math.max(0, 1 - 1 / Math.max(1, Math.min(rx, ry))) / dist;
  return [
    clampIndex(Math.floor(center[0] + nx * scale * rx), width),
    clampIndex(Math.floor(center[1] + ny * scale * ry), height),
  ];
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
