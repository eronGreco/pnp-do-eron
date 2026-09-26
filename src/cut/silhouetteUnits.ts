/**
 * Unidades e conversoes congeladas.
 *
 * 1 Silhouette Unit = 0,05 mm  =>  SU = round(mm * 20)
 */

export const MM_PER_PT = 25.4 / 72;
export const PT_PER_MM = 72 / 25.4;

export function su(mm: number): number {
  return Math.round(mm * 20);
}

export function mmToPt(mm: number): number {
  return mm * PT_PER_MM;
}

export function ptToMm(pt: number): number {
  return pt * MM_PER_PT;
}
