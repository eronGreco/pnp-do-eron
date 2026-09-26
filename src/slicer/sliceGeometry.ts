import { DEFAULT_SLICE_CONFIG, type SliceConfig, type SliceRect } from "./types";

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function normalizeSliceConfig(config: Partial<SliceConfig>): SliceConfig {
  const base = { ...DEFAULT_SLICE_CONFIG, ...config };
  const legacyCornerSize = (config as Partial<SliceConfig> & { cornerFillSizePx?: number })
    .cornerFillSizePx;
  return {
    columns: clampInt(base.columns, 1, 20),
    rows: clampInt(base.rows, 1, 20),
    marginTopPx: clampInt(base.marginTopPx, 0, 2000),
    marginBottomPx: clampInt(base.marginBottomPx, 0, 2000),
    marginLeftPx: clampInt(base.marginLeftPx, 0, 2000),
    marginRightPx: clampInt(base.marginRightPx, 0, 2000),
    gutterXPx: clampInt(base.gutterXPx, 0, 2000),
    gutterYPx: clampInt(base.gutterYPx, 0, 2000),
    offsetXPx: clampInt(base.offsetXPx, -500, 500),
    offsetYPx: clampInt(base.offsetYPx, -500, 500),
    overshootPx: clampInt(base.overshootPx, -200, 200),
    cornerFill: Boolean(base.cornerFill),
    cornerFillCornerPercent: Math.min(
      30,
      Math.max(
        0.1,
        Number.isFinite(base.cornerFillCornerPercent)
          ? Math.round(base.cornerFillCornerPercent * 10) / 10
          : legacyCornerSize
            ? 8
            : DEFAULT_SLICE_CONFIG.cornerFillCornerPercent,
      ),
    ),
    cornerFillEdgePercent: Math.min(
      10,
      Math.max(
        0,
        Number.isFinite(base.cornerFillEdgePercent)
          ? Math.round(base.cornerFillEdgePercent * 10) / 10
          : DEFAULT_SLICE_CONFIG.cornerFillEdgePercent,
      ),
    ),
  };
}

export type SliceMetrics = {
  cellWidth: number;
  cellHeight: number;
  stepX: number;
  stepY: number;
  originX: number;
  originY: number;
};

/** Celulas identicas nos dois eixos, derivadas da area util menos os espacamentos. */
export function sliceMetrics(
  imageWidth: number,
  imageHeight: number,
  config: SliceConfig,
): SliceMetrics {
  const usableWidth =
    imageWidth - config.marginLeftPx - config.marginRightPx - config.gutterXPx * (config.columns - 1);
  const usableHeight =
    imageHeight - config.marginTopPx - config.marginBottomPx - config.gutterYPx * (config.rows - 1);

  const cellWidth = Math.max(1, usableWidth / config.columns);
  const cellHeight = Math.max(1, usableHeight / config.rows);

  return {
    cellWidth,
    cellHeight,
    stepX: cellWidth + config.gutterXPx,
    stepY: cellHeight + config.gutterYPx,
    originX: config.marginLeftPx + config.offsetXPx,
    originY: config.marginTopPx + config.offsetYPx,
  };
}

/** Retangulos de recorte, em ordem de leitura: linha por linha, esquerda para direita. */
export function sliceRects(
  imageWidth: number,
  imageHeight: number,
  config: SliceConfig,
): SliceRect[] {
  const m = sliceMetrics(imageWidth, imageHeight, config);
  const rects: SliceRect[] = [];

  for (let row = 0; row < config.rows; row += 1) {
    for (let column = 0; column < config.columns; column += 1) {
      const left = m.originX + column * m.stepX - config.overshootPx;
      const top = m.originY + row * m.stepY - config.overshootPx;
      const right = left + m.cellWidth + config.overshootPx * 2;
      const bottom = top + m.cellHeight + config.overshootPx * 2;

      const x = Math.max(0, Math.round(left));
      const y = Math.max(0, Math.round(top));
      const x1 = Math.min(imageWidth, Math.round(right));
      const y1 = Math.min(imageHeight, Math.round(bottom));

      rects.push({
        row: row + 1,
        column: column + 1,
        x,
        y,
        width: Math.max(1, x1 - x),
        height: Math.max(1, y1 - y),
      });
    }
  }

  return rects;
}

export function sliceFileName(imageName: string, rect: SliceRect, extension: string): string {
  const base = imageName.replace(/\.[^.]+$/, "") || "folha";
  return `${base}_r${rect.row}c${rect.column}.${extension}`;
}
