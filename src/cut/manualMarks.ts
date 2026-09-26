import type { Rect } from "@/cameo/types";
import { rect } from "./geometry";

/** Como a folha sera acabada. */
export type FinishMode = "cameo" | "manual" | "cricut";

/** Tipos de marca para corte manual (guilhotina / refiladora). */
export type ManualMarkType = "cantos" | "cruzes" | "guias" | "bordas" | "contorno";

export type ManualMarkColor = "preto" | "cinza" | "ciano";

/** Em qual lado da folha as marcas sao impressas. */
export type ManualMarkSides = "frente" | "verso" | "ambos";

export type ManualMarksConfig = {
  types: ManualMarkType[];
  /** Cruzes tambem batem nas bordas da folha. */
  crossToEdges: boolean;
  thicknessMm: number;
  lengthMm: number;
  offsetMm: number;
  color: ManualMarkColor;
  sides: ManualMarkSides;
  /**
   * Imprime o contorno da carta com o raio dos cantos configurado.
   * Desligado: o raio aparece somente na previa, como guia visual.
   */
  printRoundedOutline: boolean;
};

export const DEFAULT_MANUAL_MARKS: ManualMarksConfig = {
  types: ["cantos"],
  crossToEdges: false,
  thicknessMm: 0.25,
  lengthMm: 4,
  offsetMm: 1.5,
  color: "preto",
  sides: "ambos",
  printRoundedOutline: false,
};

export const MANUAL_MARK_LABELS: Record<ManualMarkType, string> = {
  cantos: "Cantos (crop marks)",
  cruzes: "Cruzes nos encontros",
  guias: "Linhas de guia na folha inteira",
  bordas: "Marcas só nas bordas da folha",
  contorno: "Contorno completo da carta",
};

export const MANUAL_MARK_HINTS: Record<ManualMarkType, string> = {
  cantos: "Quatro pares de traços curtos fora de cada canto da carta.",
  cruzes: "Cruz completa no encontro das cartas, para alinhar a régua.",
  guias: "Linhas finas atravessando a folha inteira, alinhadas com cada corte.",
  bordas: "Traços apenas nas margens da folha.",
  contorno: "Retângulo no tamanho final de cada carta.",
};

/** Cor de impressao em RGB 0..1, usada pelo PDF. */
export const MANUAL_MARK_RGB: Record<ManualMarkColor, [number, number, number]> = {
  preto: [0, 0, 0],
  cinza: [0.55, 0.55, 0.55],
  ciano: [0, 0.68, 0.94],
};

/** Mesma cor em CSS, usada pela previa. */
export function manualMarkCss(color: ManualMarkColor): string {
  const [r, g, b] = MANUAL_MARK_RGB[color];
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

export function marksOnSide(config: ManualMarksConfig, side: "front" | "back"): boolean {
  if (config.types.length === 0) return false;
  if (config.sides === "ambos") return true;
  return config.sides === (side === "front" ? "frente" : "verso");
}

function clampRect(r: Rect, pageWidthMm: number, pageHeightMm: number): Rect | null {
  const x0 = Math.max(0, Math.min(pageWidthMm, r.x0));
  const x1 = Math.max(0, Math.min(pageWidthMm, r.x1));
  const y0 = Math.max(0, Math.min(pageHeightMm, r.y0));
  const y1 = Math.max(0, Math.min(pageHeightMm, r.y1));
  if (x1 - x0 <= 1e-6 || y1 - y0 <= 1e-6) return null;
  return rect(x0, y0, x1, y1);
}

function hSeg(xa: number, xb: number, y: number, t: number): Rect {
  const half = t / 2;
  return rect(Math.min(xa, xb), y - half, Math.max(xa, xb), y + half);
}

function vSeg(x: number, ya: number, yb: number, t: number): Rect {
  const half = t / 2;
  return rect(x - half, Math.min(ya, yb), x + half, Math.max(ya, yb));
}

function uniqueLines(values: number[]): number[] {
  const out: number[] = [];
  for (const value of values) {
    if (!out.some((existing) => Math.abs(existing - value) < 0.01)) out.push(value);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Todas as marcas de corte manual como retangulos finos em mm
 * (origem topo-esquerda da folha). O mesmo resultado alimenta o PDF e a previa,
 * garantindo que o usuario ve exatamente o que sera impresso.
 */
export function manualMarkRectsMm(
  cutRects: Rect[],
  config: ManualMarksConfig,
  pageWidthMm: number,
  pageHeightMm: number,
): Rect[] {
  if (cutRects.length === 0 || config.types.length === 0) return [];

  const t = Math.max(0.05, config.thicknessMm);
  const len = Math.max(0.5, config.lengthMm);
  const off = Math.max(0, config.offsetMm);
  const types = new Set(config.types);
  const raw: Rect[] = [];

  const xLines = uniqueLines(cutRects.flatMap((r) => [r.x0, r.x1]));
  const yLines = uniqueLines(cutRects.flatMap((r) => [r.y0, r.y1]));

  if (types.has("contorno")) {
    for (const r of cutRects) {
      raw.push(hSeg(r.x0, r.x1, r.y0, t));
      raw.push(hSeg(r.x0, r.x1, r.y1, t));
      raw.push(vSeg(r.x0, r.y0, r.y1, t));
      raw.push(vSeg(r.x1, r.y0, r.y1, t));
    }
  }

  if (types.has("cantos")) {
    for (const r of cutRects) {
      for (const [x, dirX] of [
        [r.x0, -1],
        [r.x1, 1],
      ] as const) {
        for (const [y, dirY] of [
          [r.y0, -1],
          [r.y1, 1],
        ] as const) {
          raw.push(hSeg(x + dirX * off, x + dirX * (off + len), y, t));
          raw.push(vSeg(x, y + dirY * off, y + dirY * (off + len), t));
        }
      }
    }
  }

  if (types.has("cruzes")) {
    for (const r of cutRects) {
      for (const x of [r.x0, r.x1]) {
        for (const y of [r.y0, r.y1]) {
          raw.push(hSeg(x - len, x + len, y, t));
          raw.push(vSeg(x, y - len, y + len, t));
        }
      }
    }
  }

  if (types.has("guias")) {
    for (const x of xLines) raw.push(vSeg(x, 0, pageHeightMm, t));
    for (const y of yLines) raw.push(hSeg(0, pageWidthMm, y, t));
  }

  if (types.has("bordas") || (types.has("cruzes") && config.crossToEdges)) {
    for (const x of xLines) {
      raw.push(vSeg(x, 0, len, t));
      raw.push(vSeg(x, pageHeightMm - len, pageHeightMm, t));
    }
    for (const y of yLines) {
      raw.push(hSeg(0, len, y, t));
      raw.push(hSeg(pageWidthMm - len, pageWidthMm, y, t));
    }
  }

  const out: Rect[] = [];
  for (const r of raw) {
    const clamped = clampRect(r, pageWidthMm, pageHeightMm);
    if (clamped) out.push(clamped);
  }
  return out;
}

/**
 * Margem da folha no modo manual. Nunca maior que a margem do modo Cameo,
 * para o corte manual nunca render menos cartas por folha.
 */
export function manualMarkMarginMm(config: ManualMarksConfig): number {
  if (config.types.length === 0) return 2;
  const reach = Math.max(0, config.offsetMm) + Math.max(0.5, config.lengthMm);
  const needsReach = config.types.includes("cantos") || config.types.includes("cruzes");
  return Math.min(5, Math.max(2, needsReach ? reach : 2));
}
