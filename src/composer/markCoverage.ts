import type { Rect } from "@/cameo/types";
import { registrationWhiteBackdropsMm, rectsIntersect } from "@/cut/geometry";
import { backFaceRect, isGutterfold, gridFor, layoutSheets } from "./layoutSheets";
import { pageSizeMm } from "./paperSizes";
import type { ComposerCard, ComposerConfig } from "./types";

/**
 * A faixa branca ao redor de cada marca do sensor e obrigatoria: sem ela a
 * Cameo nao enxerga a marca. O que da para evitar e a faixa cair em cima do
 * conteudo da carta. Se ela cobre apenas sangria, nao ha problema nenhum.
 */
export type MarkCoverage = {
  /** Cartas com conteudo (area final de corte) coberto pela faixa branca. */
  content: { sheet: number; card: number }[];
  /** Cartas em que a faixa branca cobre apenas sangria. */
  bleedOnly: number;
  /** Grade que tira todas as cartas de baixo das marcas, quando existe. */
  suggestedGrid: { columns: number; rows: number } | null;
  /** Sangria menor que resolveria, quando existe. */
  suggestedBleedMm: number | null;
  /** Faixa branca menor que resolveria, sem descer do minimo seguro. */
  suggestedWhiteBorderMm: number | null;
};

export const MIN_SAFE_WHITE_BORDER_MM = 2;

const EMPTY: MarkCoverage = {
  content: [],
  bleedOnly: 0,
  suggestedGrid: null,
  suggestedBleedMm: null,
  suggestedWhiteBorderMm: null,
};

function backdrops(config: ComposerConfig): Rect[] {
  const page = pageSizeMm(config);
  return registrationWhiteBackdropsMm(
    page.widthMm,
    page.heightMm,
    config.registrationWhiteBorderMm,
  );
}

/** Quantas cartas ficariam com conteudo coberto nesta configuracao. */
function coveredCount(cards: ComposerCard[], config: ComposerConfig): number {
  if (config.finishMode !== "cameo") return 0;
  const areas = backdrops(config);
  let count = 0;
  for (const sheet of layoutSheets(cards, config)) {
    for (const placed of sheet.placements) {
      const contentRects = isGutterfold(config)
        ? [placed.frontRectMm ?? placed.cutRectMm, backFaceRect(placed, config)]
        : [placed.cutRectMm];
      if (areas.some((area) => contentRects.some((content) => rectsIntersect(content, area)))) count += 1;
    }
  }
  return count;
}

/** Cartas de teste: uma folha cheia, so para medir a geometria da grade. */
function probeCards(count: number): ComposerCard[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    id: `probe-${index}`,
    frontImageId: "probe",
    backImageId: null,
    selected: true,
  }));
}

function firstSafeGrid(config: ComposerConfig): { columns: number; rows: number } | null {
  const grid = gridFor(config);
  const startColumns = Math.max(1, grid.maxColumns);
  const startRows = Math.max(1, grid.maxRows);

  const candidates: { columns: number; rows: number }[] = [];
  for (let columns = startColumns; columns >= 1; columns -= 1) {
    for (let rows = startRows; rows >= 1; rows -= 1) {
      candidates.push({ columns, rows });
    }
  }
  candidates.sort((a, b) => b.columns * b.rows - a.columns * a.rows);

  for (const candidate of candidates) {
    const probe: ComposerConfig = {
      ...config,
      gridMode: "manual",
      gridColumns: candidate.columns,
      gridRows: candidate.rows,
    };
    const cards = probeCards(candidate.columns * candidate.rows);
    if (coveredCount(cards, probe) === 0 && gridFor(probe).perSheet > 0) return candidate;
  }
  return null;
}

/**
 * Conferencia da faixa branca das marcas contra as cartas ja posicionadas.
 * Nunca muda nada: apenas descreve o que esta acontecendo e o que resolveria.
 */
export function markCoverage(cards: ComposerCard[], config: ComposerConfig): MarkCoverage {
  if (config.finishMode !== "cameo" || cards.length === 0) return EMPTY;

  const areas = backdrops(config);
  const content: { sheet: number; card: number }[] = [];
  let bleedOnly = 0;

  for (const sheet of layoutSheets(cards, config)) {
    for (const placed of sheet.placements) {
      const contentRects = isGutterfold(config)
        ? [placed.frontRectMm ?? placed.cutRectMm, backFaceRect(placed, config)]
        : [placed.cutRectMm];
      const artRects = isGutterfold(config)
        ? [placed.imageRectMm, placed.backImageRectMm ?? backFaceRect(placed, config)]
        : [placed.imageRectMm];
      const hitsContent = areas.some((area) =>
        contentRects.some((content) => rectsIntersect(content, area)),
      );
      if (hitsContent) {
        content.push({ sheet: sheet.number, card: placed.number });
        continue;
      }
      if (areas.some((area) => artRects.some((art) => rectsIntersect(art, area)))) bleedOnly += 1;
    }
  }

  if (content.length === 0) {
    return { ...EMPTY, bleedOnly };
  }

  const suggestedGrid = firstSafeGrid(config);

  let suggestedBleedMm: number | null = null;
  for (let bleedMm = Math.max(0, config.bleedMm - 1); bleedMm >= 0; bleedMm -= 1) {
    if (coveredCount(cards, { ...config, bleedMm }) === 0) {
      suggestedBleedMm = bleedMm;
      break;
    }
  }

  let suggestedWhiteBorderMm: number | null = null;
  for (
    let border = Math.max(MIN_SAFE_WHITE_BORDER_MM, config.registrationWhiteBorderMm - 1);
    border >= MIN_SAFE_WHITE_BORDER_MM;
    border -= 1
  ) {
    if (border >= config.registrationWhiteBorderMm) continue;
    if (coveredCount(cards, { ...config, registrationWhiteBorderMm: border }) === 0) {
      suggestedWhiteBorderMm = border;
      break;
    }
  }

  return { content, bleedOnly, suggestedGrid, suggestedBleedMm, suggestedWhiteBorderMm };
}
