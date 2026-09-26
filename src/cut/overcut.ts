import type { Point } from "./roundedRect";

export const LINE_OVERCUT_MM = 0.1;

/**
 * Sobrecorte de linha para cantos RETOS (raio 0).
 * Cada lado avanca `ext` mm antes e depois do vertice.
 * Retorna pares (inicio, fim) que serao emitidos como M/D.
 */
export function overcutSegments(
  x: number,
  y: number,
  w: number,
  h: number,
  ext: number,
): Array<[Point, Point]> {
  const corners: Point[] = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];

  const out: Array<[Point, Point]> = [];
  const e = Math.max(0, ext);

  for (let i = 0; i < 4; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % 4]!;
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len = Math.hypot(vx, vy);
    if (len <= 1e-9) continue;
    const ux = vx / len;
    const uy = vy / len;
    out.push([
      { x: a.x - ux * e, y: a.y - uy * e },
      { x: b.x + ux * e, y: b.y + uy * e },
    ]);
  }

  return out;
}

/**
 * Sobrecorte no FECHAMENTO de um caminho com cantos arredondados:
 * apos voltar ao ponto inicial, avanca `ext` mm no inicio do tracado.
 * Nao altera nenhum ponto existente.
 */
export function closingOvercutPoint(pts: Point[], ext: number): Point | null {
  const e = Math.max(0, ext);
  if (e <= 0 || pts.length < 3) return null;

  const p0 = pts[0]!;
  const p1 = pts[1]!;
  const vx = p1.x - p0.x;
  const vy = p1.y - p0.y;
  const len = Math.hypot(vx, vy);
  if (len <= 1e-9) return null;

  const ratio = Math.min(1, e / len);
  return { x: p0.x + vx * ratio, y: p0.y + vy * ratio };
}
