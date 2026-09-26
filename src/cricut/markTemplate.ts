import type { Rect } from "@/cameo/types";
import { rect, rectsIntersect } from "@/cut/geometry";
import {
  backFaceRect,
  gridFor,
  isGutterfold,
  layoutSheets,
  type ComposerSheetLayout,
} from "@/composer/layoutSheets";
import { pageSizeMm } from "@/composer/paperSizes";
import type { ComposerCard, ComposerConfig } from "@/composer/types";

export type CricutMarkBounds = {
  x0Px: number;
  y0Px: number;
  x1Px: number;
  y1Px: number;
};

export type CricutMarkPage = {
  sheetNumber: number;
  bytes: ArrayBuffer;
  previewUrl: string;
  widthPx: number;
  heightPx: number;
  darkPixels: number;
  bounds: CricutMarkBounds[];
};

export type StoredCricutMarkPage = Omit<CricutMarkPage, "previewUrl">;

export type CricutMarksTemplate = {
  id: string;
  name: string;
  pageWidthMm: number;
  pageHeightMm: number;
  pageCount: number;
  pages: CricutMarkPage[];
  geometryStamp: string;
  createdAt: number;
};

export type StoredCricutMarksTemplate = Omit<CricutMarksTemplate, "pages"> & {
  pages: StoredCricutMarkPage[];
};

export type CricutCoverage = {
  content: { sheet: number; card: number }[];
  bleedOnly: number;
  suggestedGrid: { columns: number; rows: number } | null;
};

const EMPTY_COVERAGE: CricutCoverage = {
  content: [],
  bleedOnly: 0,
  suggestedGrid: null,
};

function rounded(value: number): number {
  return Number(value.toFixed(3));
}

export function stripCricutMarksTemplate(
  template: CricutMarksTemplate | null,
): StoredCricutMarksTemplate | null {
  if (!template) return null;
  return {
    ...template,
    pages: template.pages.map(({ previewUrl: _previewUrl, ...page }) => page),
  };
}

export function reviveCricutMarksTemplate(
  stored: StoredCricutMarksTemplate | null | undefined,
): CricutMarksTemplate | null {
  if (!stored) return null;
  return {
    ...stored,
    pages: stored.pages.map((page) => ({
      ...page,
      previewUrl: URL.createObjectURL(new Blob([page.bytes.slice(0)], { type: "image/png" })),
    })),
  };
}

export function releaseCricutMarksTemplate(template: CricutMarksTemplate | null | undefined) {
  for (const page of template?.pages ?? []) URL.revokeObjectURL(page.previewUrl);
}

export function cricutTemplateStamp(
  layouts: ComposerSheetLayout[],
  config: ComposerConfig,
  radiusMm: number,
): string {
  const page = pageSizeMm(config);
  return JSON.stringify({
    page: [rounded(page.widthMm), rounded(page.heightMm)],
    card: [rounded(config.cardWidthMm), rounded(config.cardHeightMm)],
    assemblyMode: config.assemblyMode,
    gutterfoldLayout: config.gutterfoldLayout,
    gutterfoldDirection: config.gutterfoldDirection,
    gutterfoldGapMm: rounded(config.gutterfoldGapMm),
    radiusMm: rounded(radiusMm),
    sheets: layouts.map((layout) =>
      layout.placements
        .filter((placement) => placement.card.selected)
        .map((placement) => [
          rounded(placement.cutRectMm.x0),
          rounded(placement.cutRectMm.y0),
          rounded(placement.cutRectMm.x1),
          rounded(placement.cutRectMm.y1),
        ]),
    ),
  });
}

export function cricutTemplateMatches(
  template: CricutMarksTemplate | null,
  stamp: string,
): boolean {
  return Boolean(template && template.geometryStamp === stamp && template.pages.length > 0);
}

export function templatePageForSheet(
  template: CricutMarksTemplate | null | undefined,
  sheetNumber: number,
): CricutMarkPage | null {
  if (!template || template.pages.length === 0) return null;
  const exact = template.pages.find((page) => page.sheetNumber === sheetNumber);
  if (exact) return exact;
  const first = template.pages[0];
  return template.pages.length === 1 && first ? first : null;
}

export function cricutMarkRectsMm(
  page: CricutMarkPage,
  pageWidthMm: number,
  pageHeightMm: number,
): Rect[] {
  const sx = pageWidthMm / page.widthPx;
  const sy = pageHeightMm / page.heightPx;
  return page.bounds.map((b) =>
    rect(b.x0Px * sx, b.y0Px * sy, b.x1Px * sx, b.y1Px * sy),
  );
}

function probeCards(count: number): ComposerCard[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    id: `probe-cricut-${index}`,
    frontImageId: "probe",
    backImageId: null,
    selected: true,
  }));
}

function coveredByTemplate(
  layouts: ComposerSheetLayout[],
  config: ComposerConfig,
  template: CricutMarksTemplate,
): number {
  const page = pageSizeMm(config);
  let count = 0;
  for (const layout of layouts) {
    const markPage = templatePageForSheet(template, layout.number);
    if (!markPage) continue;
    const marks = cricutMarkRectsMm(markPage, page.widthMm, page.heightMm);
    for (const placed of layout.placements) {
      const contentRects = isGutterfold(config)
        ? [placed.frontRectMm ?? placed.cutRectMm, backFaceRect(placed, config)]
        : [placed.cutRectMm];
      if (marks.some((mark) => contentRects.some((content) => rectsIntersect(content, mark)))) count += 1;
    }
  }
  return count;
}

function firstSafeGrid(
  cards: ComposerCard[],
  config: ComposerConfig,
  template: CricutMarksTemplate,
): { columns: number; rows: number } | null {
  const grid = gridFor(config);
  const candidates: { columns: number; rows: number }[] = [];
  for (let columns = Math.max(1, grid.maxColumns); columns >= 1; columns -= 1) {
    for (let rows = Math.max(1, grid.maxRows); rows >= 1; rows -= 1) {
      candidates.push({ columns, rows });
    }
  }
  candidates.sort((a, b) => b.columns * b.rows - a.columns * a.rows);

  for (const candidate of candidates) {
    const probeConfig: ComposerConfig = {
      ...config,
      gridMode: "manual",
      gridColumns: candidate.columns,
      gridRows: candidate.rows,
    };
    const probe = probeCards(Math.min(cards.length, candidate.columns * candidate.rows));
    const layouts = layoutSheets(probe, probeConfig);
    if (gridFor(probeConfig).perSheet > 0 && coveredByTemplate(layouts, probeConfig, template) === 0) {
      return candidate;
    }
  }
  return null;
}

export function cricutMarkCoverage(
  cards: ComposerCard[],
  layouts: ComposerSheetLayout[],
  config: ComposerConfig,
  template: CricutMarksTemplate | null,
): CricutCoverage {
  if (config.finishMode !== "cricut" || cards.length === 0 || !template) return EMPTY_COVERAGE;
  const page = pageSizeMm(config);
  const content: { sheet: number; card: number }[] = [];
  let bleedOnly = 0;

  for (const layout of layouts) {
    const markPage = templatePageForSheet(template, layout.number);
    if (!markPage) continue;
    const marks = cricutMarkRectsMm(markPage, page.widthMm, page.heightMm);
    for (const placed of layout.placements) {
      const contentRects = isGutterfold(config)
        ? [placed.frontRectMm ?? placed.cutRectMm, backFaceRect(placed, config)]
        : [placed.cutRectMm];
      const artRects = isGutterfold(config)
        ? [placed.imageRectMm, placed.backImageRectMm ?? backFaceRect(placed, config)]
        : [placed.imageRectMm];
      const hitsContent = marks.some((mark) =>
        contentRects.some((content) => rectsIntersect(content, mark)),
      );
      if (hitsContent) {
        content.push({ sheet: layout.number, card: placed.number });
      } else if (marks.some((mark) => artRects.some((art) => rectsIntersect(art, mark)))) {
        bleedOnly += 1;
      }
    }
  }

  return {
    content,
    bleedOnly,
    suggestedGrid: content.length > 0 ? firstSafeGrid(cards, config, template) : null,
  };
}