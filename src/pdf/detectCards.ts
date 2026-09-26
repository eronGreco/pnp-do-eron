import type { Rect } from "@/cameo/types";
import { rect, rectHeight, rectWidth } from "@/cut/geometry";
import type { Point } from "./detectCropMarks";

export class PdfDetectionError extends Error {}

/**
 * Escolhe o grupo dominante de imagens de carta.
 * Recursos graficos pequenos ou avulsos sao ignorados.
 */
export function dominantCardImages(rects: Rect[]): Rect[] {
  const candidates = rects.filter((r) => {
    const w = rectWidth(r);
    const h = rectHeight(r);
    return w >= 20 && w <= 120 && h >= 20 && h <= 120 && w * h >= 400;
  });

  if (candidates.length === 0) {
    throw new PdfDetectionError("Não encontrei imagens de cartas na página de frente.");
  }

  const groups = new Map<string, Rect[]>();
  for (const r of candidates) {
    const key = `${rectWidth(r).toFixed(1)}x${rectHeight(r).toFixed(1)}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  let best: Rect[] = [];
  let bestScore = -1;
  for (const list of groups.values()) {
    const first = list[0]!;
    const score = list.length * 1e6 + rectWidth(first) * rectHeight(first);
    if (score > bestScore) {
      bestScore = score;
      best = list;
    }
  }

  // Ordem visual: primeiro por Y, depois por X.
  return [...best].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
}

function hasCorner(centers: Point[], x: number, y: number, tol = 0.25): boolean {
  return centers.some((c) => Math.abs(c.x - x) <= tol && Math.abs(c.y - y) <= tol);
}

/**
 * Area final de corte deduzida das quatro cruzes da carta.
 * Nunca usa sangria fixa.
 */
export function cutRectForImage(imageRect: Rect, centers: Point[]): Rect {
  const inside = centers.filter(
    (c) =>
      c.x >= imageRect.x0 - 0.3 &&
      c.x <= imageRect.x1 + 0.3 &&
      c.y >= imageRect.y0 - 0.3 &&
      c.y <= imageRect.y1 + 0.3,
  );

  if (inside.length < 4) {
    throw new PdfDetectionError("Não encontrei as cruzes de corte desta carta.");
  }

  const xs = [...new Set(inside.map((p) => Number(p.x.toFixed(3))))].sort((a, b) => a - b);
  const ys = [...new Set(inside.map((p) => Number(p.y.toFixed(3))))].sort((a, b) => a - b);
  if (xs.length < 2 || ys.length < 2) {
    throw new PdfDetectionError("Cruzes insuficientes para determinar o corte desta carta.");
  }

  const left = xs[0]!;
  const right = xs[xs.length - 1]!;
  const top = ys[0]!;
  const bottom = ys[ys.length - 1]!;

  for (const [x, y] of [
    [left, top],
    [right, top],
    [left, bottom],
    [right, bottom],
  ] as const) {
    if (!hasCorner(inside, x, y)) {
      throw new PdfDetectionError("As cruzes desta carta não formam um retângulo válido.");
    }
  }

  if (!(imageRect.x0 - 0.4 <= left && left < right && right <= imageRect.x1 + 0.4)) {
    throw new PdfDetectionError("Os limites horizontais do corte ficaram fora da arte.");
  }
  if (!(imageRect.y0 - 0.4 <= top && top < bottom && bottom <= imageRect.y1 + 0.4)) {
    throw new PdfDetectionError("Os limites verticais do corte ficaram fora da arte.");
  }

  return rect(left, top, right, bottom);
}
