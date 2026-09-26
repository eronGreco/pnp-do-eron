import { A4_LANDSCAPE_H_MM, A4_LANDSCAPE_W_MM } from "@/cut/geometry";

export type PageSizeMm = { widthMm: number; heightMm: number };

export type SheetPairing = {
  number: number;
  frontPageIndex: number;
  backPageIndex: number | null;
};

const TOLERANCE_MM = 3;

export function isLandscapeA4(size: PageSizeMm): boolean {
  return (
    Math.abs(size.widthMm - A4_LANDSCAPE_W_MM) <= TOLERANCE_MM &&
    Math.abs(size.heightMm - A4_LANDSCAPE_H_MM) <= TOLERANCE_MM
  );
}

export function isPortraitA4(size: PageSizeMm): boolean {
  return (
    Math.abs(size.widthMm - A4_LANDSCAPE_H_MM) <= TOLERANCE_MM &&
    Math.abs(size.heightMm - A4_LANDSCAPE_W_MM) <= TOLERANCE_MM
  );
}

/**
 * Retrato vira paisagem. A rotacao e a MESMA para todas as paginas,
 * frente e verso, e nunca altera a ordem das paginas.
 */
export function rotationForPage(size: PageSizeMm): 0 | 90 {
  if (isPortraitA4(size) && !isLandscapeA4(size)) return 90;
  return 0;
}

export function normalizedSize(size: PageSizeMm, rotation: 0 | 90): PageSizeMm {
  return rotation === 90
    ? { widthMm: size.heightMm, heightMm: size.widthMm }
    : size;
}

/**
 * Regra ABSOLUTA: paginas humanas impares (1,3,5...) sao FRENTE,
 * pares (2,4,6...) sao VERSO. Nunca reorganizar.
 */
export function pairSheets(pageCount: number): SheetPairing[] {
  const sheets: SheetPairing[] = [];
  for (let i = 0; i < pageCount; i += 2) {
    sheets.push({
      number: sheets.length + 1,
      frontPageIndex: i,
      backPageIndex: i + 1 < pageCount ? i + 1 : null,
    });
  }
  return sheets;
}

export function hasOrphanFront(pageCount: number): boolean {
  return pageCount % 2 === 1;
}
