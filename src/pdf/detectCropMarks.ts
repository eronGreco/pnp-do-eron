export type Segment = { x1: number; y1: number; x2: number; y2: number };
export type Point = { x: number; y: number };

/** Tolerancia de deduplicacao/alinhamento usada na versao desktop. */
export const CROSS_TOLERANCE_MM = 0.12;

const ARM_MIN_MM = 3.2;
const ARM_MAX_MM = 4.8;
const THICKNESS_MM = 0.08;

export function dedupePoints(points: Point[], tol = CROSS_TOLERANCE_MM): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    if (!out.some((q) => Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Centros das cruzes vetoriais do PNP: um braco horizontal e um vertical
 * (de aproximadamente 4 mm) com centros coincidentes.
 */
export function crossCentersFromSegments(segments: Segment[]): Point[] {
  const horizontal: Point[] = [];
  const vertical: Point[] = [];

  for (const s of segments) {
    const dx = Math.abs(s.x2 - s.x1);
    const dy = Math.abs(s.y2 - s.y1);
    const center = { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 };

    if (dy <= THICKNESS_MM && dx >= ARM_MIN_MM && dx <= ARM_MAX_MM) {
      horizontal.push(center);
    } else if (dx <= THICKNESS_MM && dy >= ARM_MIN_MM && dy <= ARM_MAX_MM) {
      vertical.push(center);
    }
  }

  const h = dedupePoints(horizontal);
  const v = dedupePoints(vertical);
  const centers: Point[] = [];

  for (const a of h) {
    for (const b of v) {
      if (
        Math.abs(a.x - b.x) <= CROSS_TOLERANCE_MM &&
        Math.abs(a.y - b.y) <= CROSS_TOLERANCE_MM
      ) {
        centers.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
    }
  }

  return dedupePoints(centers);
}

/** Um braco de cruz do PNP (usado para remover as cruzes do PDF final). */
export function isCropMarkSegment(s: Segment): boolean {
  const dx = Math.abs(s.x2 - s.x1);
  const dy = Math.abs(s.y2 - s.y1);
  const horizontal = dy <= THICKNESS_MM && dx >= ARM_MIN_MM && dx <= ARM_MAX_MM;
  const vertical = dx <= THICKNESS_MM && dy >= ARM_MIN_MM && dy <= ARM_MAX_MM;
  return horizontal || vertical;
}
