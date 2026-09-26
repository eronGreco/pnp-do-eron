/**
 * Fatiador de folhas: recorta uma imagem com varias cartas em arquivos individuais.
 * Todas as medidas ficam em pixels da propria imagem.
 */
export type SliceConfig = {
  columns: number;
  rows: number;
  marginTopPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  marginRightPx: number;
  gutterXPx: number;
  gutterYPx: number;
  offsetXPx: number;
  offsetYPx: number;
  /** Sobra por recorte: positivo pega alem da linha, negativo fica por dentro. */
  overshootPx: number;
  /** Corrige os quatro cantos usando somente pixels internos do proprio recorte. */
  cornerFill: boolean;
  /** Percentuais relativos ao menor lado de cada carta. */
  cornerFillCornerPercent: number;
  cornerFillEdgePercent: number;
  /** Formato dos arquivos de cartas dentro do ZIP. */
  outputFormat: "png" | "jpeg";
  /** 300 preserva os pixels do recorte; outros valores redimensionam proporcionalmente. */
  outputDpi: 150 | 300 | 600;
};

export const DEFAULT_SLICE_CONFIG: SliceConfig = {
  columns: 4,
  rows: 5,
  marginTopPx: 0,
  marginBottomPx: 0,
  marginLeftPx: 0,
  marginRightPx: 0,
  gutterXPx: 0,
  gutterYPx: 0,
  offsetXPx: 0,
  offsetYPx: 0,
  overshootPx: 0,
  cornerFill: false,
  cornerFillCornerPercent: 8,
  cornerFillEdgePercent: 1,
  outputFormat: "png",
  outputDpi: 300,
};

export const MAX_GRID = 20;
export const MAX_MARGIN_PX = 2000;
export const MAX_OFFSET_PX = 500;
export const MAX_OVERSHOOT_PX = 200;
export const MAX_CORNER_FILL_PERCENT = 30;
export const MAX_EDGE_FILL_PERCENT = 10;

export type SliceRect = {
  row: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SliceImage = {
  id: string;
  name: string;
  mime: string;
  blob: Blob;
  widthPx: number;
  heightPx: number;
  previewUrl: string;
};
