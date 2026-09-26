import type { Rect } from "@/cameo/types";
import {
  A4_LANDSCAPE_W_MM,
  rect,
  rectsIntersect,
  registrationShapesMm,
} from "@/cut/geometry";
import { manualMarkMarginMm } from "@/cut/manualMarks";
import { pageSizeMm } from "./paperSizes";
import { effectivePacking } from "./packingPolicy";
import type { ComposerCard, ComposerConfig } from "./types";
import { cameoMarkArmMm } from "./types";

export type PlacedCard = {
  card: ComposerCard;
  number: number;
  /** Contorno que sera enviado para corte. No gutterfold, e a peça aberta inteira. */
  cutRectMm: Rect;
  /** Area onde a arte da frente (com sangria) e desenhada. */
  imageRectMm: Rect;
  /** Area visivel da frente. Menor que imageRectMm quando a sangria e compartilhada. */
  clipRectMm: Rect;
  /** Area final da frente dentro da peça gutterfold. Ausente no modo normal. */
  frontRectMm?: Rect;
  /** Area final do verso dentro da peça gutterfold. Ausente no modo normal. */
  backRectMm?: Rect;
  /** Canaleta central do gutterfold. Ausente no modo normal. */
  gutterRectMm?: Rect;
  /** Area onde a arte do verso gutterfold e desenhada. */
  backImageRectMm?: Rect;
  /** Area visivel da arte do verso gutterfold. */
  backClipRectMm?: Rect;
  /** Rotação visual do verso para que ele alinhe depois de dobrar a folha. */
  backRotationDeg?: 0 | 180;
};

export type ComposerSheetLayout = {
  number: number;
  placements: PlacedCard[];
  /** Dobra única da folha inteira. */
  sheetFoldRectMm?: Rect;
  sheetFoldDirection?: "horizontal" | "vertical";
};

export type GridInfo = {
  columns: number;
  rows: number;
  /** Espacos realmente usaveis por folha (ja descontando marcas do sensor). */
  perSheet: number;
  maxColumns: number;
  maxRows: number;
  /** Espacos descartados porque cairiam sobre uma marca do sensor. */
  blockedSlots: number;
  /** A grade escolhida foi reduzida porque nao caberia na folha. */
  limited: boolean;
};

/**
 * A arte pode ocupar a região de leitura porque o PDF recebe um fundo branco
 * sobre ela ao redor de cada marca. Só o corte final precisa evitar as marcas.
 */
const PAGE_EDGE_MM = 5;
const MIN_GUTTERFOLD_GAP_MM = 0;
const MAX_GUTTERFOLD_GAP_MM = 30;

export function isGutterfold(config: ComposerConfig): boolean {
  return config.assemblyMode === "gutterfold";
}

export function isWholeSheetGutterfold(config: ComposerConfig): boolean {
  return isGutterfold(config) && config.gutterfoldLayout === "sheet";
}

export function gutterfoldGapMm(config: ComposerConfig): number {
  const value = config.gutterfoldGapMm;
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_GUTTERFOLD_GAP_MM, Math.max(MIN_GUTTERFOLD_GAP_MM, value));
}

export function cutWidthFor(config: ComposerConfig): number {
  return isGutterfold(config) && !isWholeSheetGutterfold(config)
    ? config.cardWidthMm * 2 + gutterfoldGapMm(config)
    : config.cardWidthMm;
}

export function cutHeightFor(config: ComposerConfig): number {
  return config.cardHeightMm;
}

/**
 * No modo manual as marcas do sensor nao existem, entao a folha rende mais:
 * a margem passa a ser apenas o que as marcas de guilhotina precisam.
 */
export function pageEdgeMm(config: ComposerConfig): number {
  if (config.finishMode === "manual") return manualMarkMarginMm(config.manualMarks);
  return PAGE_EDGE_MM;
}

type Metrics = {
  cellW: number;
  cellH: number;
  stepX: number;
  stepY: number;
  clipInset: number;
  /** Distancia da borda da celula ate o corte da carta. */
  bleedOffset: number;
};

function spacingMm(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function metrics(config: ComposerConfig): Metrics {
  const cutW = cutWidthFor(config);
  const cutH = cutHeightFor(config);
  const packing = effectivePacking(config);
  // "colada": a sangria deixa de existir, as cartas ficam encostadas e o corte
  // acontece exatamente na divisa entre elas.
  if (packing.mode === "colada") {
    return {
      cellW: cutW,
      cellH: cutH,
      stepX: cutW,
      stepY: cutH,
      clipInset: 0,
      bleedOffset: 0,
    };
  }

  const cellW = cutW + config.bleedMm * 2;
  const cellH = cutH + config.bleedMm * 2;
  const shared = packing.mode === "compartilhada";
  const pitchW = shared ? cutW + config.bleedMm : cellW;
  const pitchH = shared ? cutH + config.bleedMm : cellH;

  return {
    cellW,
    cellH,
    stepX: pitchW + spacingMm(packing.gapMm),
    stepY: pitchH + spacingMm(packing.gapMm),
    clipInset: shared ? config.bleedMm / 2 : config.bleedMm,
    bleedOffset: config.bleedMm,
  };
}

function fit(usable: number, cell: number, step: number): number {
  if (cell <= 0 || step <= 0 || usable < cell) return 0;
  return Math.floor((usable - cell + 1e-7) / step) + 1;
}

/**
 * Areas onde o corte nao pode cair de jeito nenhum: as proprias marcas do
 * sensor, com 1 mm de folga. A borda branca continua podendo cobrir sangria,
 * como sempre; quem avisa sobre isso e a conferencia de tamanho.
 */
const MARK_CLEARANCE_MM = 1;

function blockedAreas(config: ComposerConfig): Rect[] {
  if (config.finishMode !== "cameo") return [];
  const page = pageSizeMm(config);
  return registrationShapesMm(page.widthMm, page.heightMm, cameoMarkArmMm(config)).map((mark) =>
    rect(
      Math.max(0, mark.x0 - MARK_CLEARANCE_MM),
      Math.max(0, mark.y0 - MARK_CLEARANCE_MM),
      Math.min(page.widthMm, mark.x1 + MARK_CLEARANCE_MM),
      Math.min(page.heightMm, mark.y1 + MARK_CLEARANCE_MM),
    ),
  );
}

type SlotGeometry = { x: number; y: number };

/** Posicoes fixas da grade cheia, alinhadas em X e Y e centralizadas na folha. */
function wholeSheetCapacity(config: ComposerConfig, direction: "horizontal" | "vertical") {
  const m = metrics(config);
  const page = pageSizeMm(config);
  const edge = pageEdgeMm(config);
  const gutter = gutterfoldGapMm(config);
  const regionW = direction === "vertical" ? (page.widthMm - gutter) / 2 : page.widthMm;
  const regionH = direction === "horizontal" ? (page.heightMm - gutter) / 2 : page.heightMm;
  // Na direcao da dobra existe borda externa em apenas um lado. A dobra nao
  // deve consumir uma segunda margem, pois as duas faces precisam encostar nela.
  const columns = fit(regionW - edge * (direction === "vertical" ? 1 : 2), m.cellW, m.stepX);
  const rows = fit(regionH - edge * (direction === "horizontal" ? 1 : 2), m.cellH, m.stepY);
  return { columns, rows, count: columns * rows };
}

export function resolvedGutterfoldDirection(config: ComposerConfig): "horizontal" | "vertical" {
  if (config.gutterfoldDirection === "horizontal" || config.gutterfoldDirection === "vertical") {
    return config.gutterfoldDirection;
  }
  const horizontal = wholeSheetCapacity(config, "horizontal");
  const vertical = wholeSheetCapacity(config, "vertical");
  return vertical.count > horizontal.count ? "vertical" : "horizontal";
}

function gridSlots(config: ComposerConfig, columns: number, rows: number): SlotGeometry[] {
  const m = metrics(config);
  const page = pageSizeMm(config);
  const occupiedW = (columns - 1) * m.stepX + m.cellW;
  const occupiedH = (rows - 1) * m.stepY + m.cellH;
  let originX = (page.widthMm - occupiedW) / 2;
  let originY = (page.heightMm - occupiedH) / 2;
  if (isWholeSheetGutterfold(config)) {
    const direction = resolvedGutterfoldDirection(config);
    const gutter = gutterfoldGapMm(config);
    if (direction === "horizontal") {
      const halfH = (page.heightMm - gutter) / 2;
      // A frente termina na dobra. Com canaleta zero, frente e verso se
      // encostam exatamente no centro da folha, sem um vazio artificial.
      originY = halfH - occupiedH;
    } else {
      const halfW = (page.widthMm - gutter) / 2;
      originX = halfW - occupiedW;
    }
  }
  const slots: SlotGeometry[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const placedColumn =
        isWholeSheetGutterfold(config) && resolvedGutterfoldDirection(config) === "vertical"
          ? columns - 1 - column
          : column;
      slots.push({ x: originX + placedColumn * m.stepX, y: originY + row * m.stepY });
    }
  }
  return slots;
}

function slotIsFree(config: ComposerConfig, slot: SlotGeometry, areas: Rect[]): boolean {
  if (areas.length === 0) return true;
  const m = metrics(config);
  const cut = rect(
    slot.x + m.bleedOffset,
    slot.y + m.bleedOffset,
    slot.x + m.bleedOffset + cutWidthFor(config),
    slot.y + m.bleedOffset + cutHeightFor(config),
  );
  return !areas.some((area) => rectsIntersect(cut, area));
}

export function gridFor(config: ComposerConfig): GridInfo {
  const m = metrics(config);
  const edge = pageEdgeMm(config);
  const page = pageSizeMm(config);
  const whole = isWholeSheetGutterfold(config);
  const direction = whole ? resolvedGutterfoldDirection(config) : null;
  const availableW = direction === "vertical" ? (page.widthMm - gutterfoldGapMm(config)) / 2 : page.widthMm;
  const availableH = direction === "horizontal" ? (page.heightMm - gutterfoldGapMm(config)) / 2 : page.heightMm;
  const maxColumns = fit(availableW - edge * (direction === "vertical" ? 1 : 2), m.cellW, m.stepX);
  const maxRows = fit(availableH - edge * (direction === "horizontal" ? 1 : 2), m.cellH, m.stepY);

  const manualGrid = config.gridMode === "manual";
  const columns = manualGrid
    ? Math.max(0, Math.min(maxColumns, Math.round(config.gridColumns)))
    : maxColumns;
  const rows = manualGrid
    ? Math.max(0, Math.min(maxRows, Math.round(config.gridRows)))
    : maxRows;

  const areas = blockedAreas(config);
  const slots = gridSlots(config, columns, rows);
  const free = slots.filter((slot) => slotIsFree(config, slot, areas)).length;

  return {
    columns,
    rows,
    perSheet: free,
    maxColumns,
    maxRows,
    blockedSlots: columns * rows - free,
    limited: manualGrid && (Math.round(config.gridColumns) > maxColumns || Math.round(config.gridRows) > maxRows),
  };
}


/** Distribui as cartas em folhas A4 paisagem, centralizando apenas as cartas presentes. */
export function layoutSheets(
  cards: ComposerCard[],
  config: ComposerConfig,
): ComposerSheetLayout[] {
  const grid = gridFor(config);
  if (grid.perSheet === 0) return [];

  const m = metrics(config);
  const packing = effectivePacking(config);
  const page = pageSizeMm(config);
  const sheets: ComposerSheetLayout[] = [];

  // Espacos livres da grade cheia: no modo Cameo os espacos que cairiam sobre
  // uma marca do sensor sao simplesmente pulados.
  const areas = blockedAreas(config);
  const freeSlots = gridSlots(config, grid.columns, grid.rows).filter((slot) =>
    slotIsFree(config, slot, areas),
  );
  const anyBlocked = grid.blockedSlots > 0;

  if (isWholeSheetGutterfold(config)) {
    const direction = resolvedGutterfoldDirection(config);
    const gutterSize = gutterfoldGapMm(config);
    const fold = direction === "horizontal"
      ? rect(0, (page.heightMm - gutterSize) / 2, page.widthMm, (page.heightMm + gutterSize) / 2)
      : rect((page.widthMm - gutterSize) / 2, 0, (page.widthMm + gutterSize) / 2, page.heightMm);

    for (let i = 0; i < cards.length; i += grid.perSheet) {
      const slice = cards.slice(i, i + grid.perSheet);
      const slots = freeSlots.slice(0, slice.length);
      const frontCuts = slots.map(({ x, y }) =>
        rect(
          x + m.bleedOffset,
          y + m.bleedOffset,
          x + m.bleedOffset + config.cardWidthMm,
          y + m.bleedOffset + config.cardHeightMm,
        ),
      );
      const backCuts = frontCuts.map((front) =>
        direction === "horizontal"
          ? rect(front.x0, page.heightMm - front.y1, front.x1, page.heightMm - front.y0)
          : rect(page.widthMm - front.x1, front.y0, page.widthMm - front.x0, front.y1),
      );
      // Frente e verso dividem a mesma folha. Todos os recortes visiveis sao
      // calculados contra todas as faces, nao apenas contra as do mesmo lado da
      // dobra. Assim nenhuma sangria consegue ocupar a area de outra carta.
      const allFaceCuts = [...frontCuts, ...backCuts];
      const placements: PlacedCard[] = [];
      for (let slot = 0; slot < slice.length; slot += 1) {
        const card = slice[slot];
        const frontCut = frontCuts[slot];
        const backCut = backCuts[slot];
        if (!card || !frontCut || !backCut) continue;
        const bleed = packing.mode === "colada" ? 0 : Math.max(0, config.bleedMm);
        const sideBleed = packing.mode === "compartilhada" ? bleed / 2 : bleed;
        const backBleed = Math.max(gutterfoldBackSideBleed(config), effectiveBackExtraBleedMm(config));
        const backArtBleed = backBleed - effectiveBackInsetMm(config);
        const frontLimits = bleedLimitsAround(
          frontCut,
          [...allFaceCuts.filter((face) => face !== frontCut), fold],
          page.widthMm,
          page.heightMm,
          sideBleed,
        );
        const backLimits = bleedLimitsAround(
          backCut,
          [...allFaceCuts.filter((face) => face !== backCut), fold],
          page.widthMm,
          page.heightMm,
          backBleed,
        );
        placements.push({
          card,
          number: slot + 1,
          cutRectMm: frontCut,
          frontRectMm: frontCut,
          backRectMm: backCut,
          gutterRectMm: fold,
          imageRectMm: rect(frontCut.x0 - sideBleed, frontCut.y0 - sideBleed, frontCut.x1 + sideBleed, frontCut.y1 + sideBleed),
          clipRectMm: rect(frontCut.x0 - frontLimits.left, frontCut.y0 - frontLimits.top, frontCut.x1 + frontLimits.right, frontCut.y1 + frontLimits.bottom),
          backImageRectMm: rect(backCut.x0 - backArtBleed, backCut.y0 - backArtBleed, backCut.x1 + backArtBleed, backCut.y1 + backArtBleed),
          backClipRectMm: rect(backCut.x0 - backLimits.left, backCut.y0 - backLimits.top, backCut.x1 + backLimits.right, backCut.y1 + backLimits.bottom),
          backRotationDeg: direction === "horizontal" ? 180 : 0,
        });
      }
      sheets.push({ number: sheets.length + 1, placements, sheetFoldRectMm: fold, sheetFoldDirection: direction });
    }
    return sheets;
  }

  for (let i = 0; i < cards.length; i += grid.perSheet) {
    const slice = cards.slice(i, i + grid.perSheet);
    const usedRows = Math.ceil(slice.length / grid.columns);
    const occupiedH = (usedRows - 1) * m.stepY + m.cellH;
    const originY = (page.heightMm - occupiedH) / 2;

    // No modo guilhotina as colunas precisam ficar alinhadas em X e Y, senao
    // as linhas de guia de uma fileira atravessariam as cartas da outra.
    const alignedGrid = config.finishMode === "manual";
    const fullRowW = (grid.columns - 1) * m.stepX + m.cellW;
    const gridOriginX = (page.widthMm - fullRowW) / 2;

    // Quando uma marca bloqueia uma celula, mantenha a quantidade segura de
    // cartas naquela fileira, mas centralize o conjunto que realmente sera
    // usado. Isso evita uma fileira curta presa a esquerda, com aparencia torta.
    const centeredSafeSlots: SlotGeometry[] = [];
    if (anyBlocked) {
      let remaining = slice.length;
      const rows = new Map<number, SlotGeometry[]>();
      for (const slot of freeSlots) {
        const key = Math.round(slot.y * 1_000_000);
        const rowSlots = rows.get(key) ?? [];
        rowSlots.push(slot);
        rows.set(key, rowSlots);
      }

      for (const rowSlots of rows.values()) {
        if (remaining <= 0) break;
        const count = Math.min(rowSlots.length, remaining);
        const occupiedW = (count - 1) * m.stepX + m.cellW;
        const centeredX = (page.widthMm - occupiedW) / 2;
        const candidates = Array.from({ length: count }, (_, column) => ({
          x: centeredX + column * m.stepX,
          y: rowSlots[0]?.y ?? 0,
        }));
        const safe = candidates.every((slot) => slotIsFree(config, slot, areas));
        centeredSafeSlots.push(...(safe ? candidates : rowSlots.slice(0, count)));
        remaining -= count;
      }
    }

    const placementSlots = slice.map((_, slot) => {
      const row = Math.floor(slot / grid.columns);
      const firstSlotInRow = row * grid.columns;
      const cardsInRow = Math.min(grid.columns, slice.length - firstSlotInRow);
      const column = slot - firstSlotInRow;
      const occupiedW = (cardsInRow - 1) * m.stepX + m.cellW;
      const rowOriginX = alignedGrid ? gridOriginX : (page.widthMm - occupiedW) / 2;
      const free = centeredSafeSlots[slot] ?? freeSlots[slot];
      const x = anyBlocked && free ? free.x : rowOriginX + column * m.stepX;
      const y = anyBlocked && free ? free.y : originY + row * m.stepY;

      return { x, y };
    });

    const cutRects = placementSlots.map(({ x, y }) =>
      rect(
        x + m.bleedOffset,
        y + m.bleedOffset,
        x + m.bleedOffset + cutWidthFor(config),
        y + m.bleedOffset + cutHeightFor(config),
      ),
    );

    const placements: PlacedCard[] = slice.map((card, slot) => {
      const { x, y } = placementSlots[slot]!;
      const cutRect = cutRects[slot]!;

      // Colada: a arte continua desenhada com a sangria inteira, mas o recorte
      // acontece na divisa, entao a sangria da vizinha simplesmente desaparece.
      const artBleed = packing.mode === "colada" ? config.bleedMm : 0;

      if (!isGutterfold(config)) {
        return {
          card,
          number: slot + 1,
          imageRectMm: rect(
            x - artBleed,
            y - artBleed,
            x + m.cellW + artBleed,
            y + m.cellH + artBleed,
          ),
          clipRectMm: rect(
            x + m.bleedOffset - m.clipInset,
            y + m.bleedOffset - m.clipInset,
            x + m.bleedOffset + config.cardWidthMm + m.clipInset,
            y + m.bleedOffset + config.cardHeightMm + m.clipInset,
          ),
          cutRectMm: cutRect,
        };
      }

      const bleed = Math.max(0, config.bleedMm);
      const sideBleed =
        packing.mode === "colada"
          ? 0
          : packing.mode === "compartilhada"
            ? bleed / 2
            : bleed;
      const extraBack = effectiveBackExtraBleedMm(config);
      const frontCut = rect(cutRect.x0, cutRect.y0, cutRect.x0 + config.cardWidthMm, cutRect.y1);
      const gutter = rect(frontCut.x1, cutRect.y0, frontCut.x1 + gutterfoldGapMm(config), cutRect.y1);
      const backCut = rect(gutter.x1, cutRect.y0, cutRect.x1, cutRect.y1);
      const backBleed = Math.max(gutterfoldBackSideBleed(config), extraBack);
      const backArtBleed = backBleed - effectiveBackInsetMm(config);
      const otherCuts = cutRects.filter((_, index) => index !== slot);
      const frontBleedLimits = bleedLimitsAround(
        frontCut,
        [...otherCuts, backCut],
        page.widthMm,
        page.heightMm,
        sideBleed,
      );
      const backBleedLimits = bleedLimitsAround(
        backCut,
        [...otherCuts, frontCut],
        page.widthMm,
        page.heightMm,
        backBleed,
      );

      return {
        card,
        number: slot + 1,
        cutRectMm: cutRect,
        frontRectMm: frontCut,
        backRectMm: backCut,
        gutterRectMm: gutter,
        imageRectMm: rect(
          frontCut.x0 - sideBleed,
          frontCut.y0 - sideBleed,
          frontCut.x1 + sideBleed,
          frontCut.y1 + sideBleed,
        ),
        clipRectMm: rect(
          frontCut.x0 - frontBleedLimits.left,
          frontCut.y0 - frontBleedLimits.top,
          frontCut.x1,
          frontCut.y1 + frontBleedLimits.bottom,
        ),
        backImageRectMm: rect(
          backCut.x0 - backArtBleed,
          backCut.y0 - backArtBleed,
          backCut.x1 + backArtBleed,
          backCut.y1 + backArtBleed,
        ),
          backClipRectMm: rect(
          backCut.x0,
          backCut.y0 - backBleedLimits.top,
          backCut.x1 + backBleedLimits.right,
          backCut.y1 + backBleedLimits.bottom,
        ),
      };
    });

    sheets.push({ number: sheets.length + 1, placements });
  }

  return sheets;
}

/** Espelho esquerda/direita: posicao correspondente da mesma carta no verso. */
export function mirrorRect(r: Rect, pageWidthMm = A4_LANDSCAPE_W_MM): Rect {
  return rect(pageWidthMm - r.x1, r.y0, pageWidthMm - r.x0, r.y1);
}

/** Desloca um retangulo. Usado para corrigir o verso na impressao. */
export function offsetRect(r: Rect, dx: number, dy: number): Rect {
  if (!dx && !dy) return r;
  return rect(r.x0 + dx, r.y0 + dy, r.x1 + dx, r.y1 + dy);
}

function rectsTouchOnY(a: Rect, b: Rect): boolean {
  return a.y0 < b.y1 && b.y0 < a.y1;
}

function rectsTouchOnX(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1;
}

function clampRectToPage(r: Rect, pageWidthMm: number, pageHeightMm: number): Rect {
  return rect(
    Math.max(0, r.x0),
    Math.max(0, r.y0),
    Math.min(pageWidthMm, r.x1),
    Math.min(pageHeightMm, r.y1),
  );
}

function bleedLimitsAround(
  base: Rect,
  blockers: Rect[],
  pageWidthMm: number,
  pageHeightMm: number,
  desiredMm: number,
): { left: number; right: number; top: number; bottom: number } {
  let left = Math.min(desiredMm, base.x0);
  let right = Math.min(desiredMm, pageWidthMm - base.x1);
  let top = Math.min(desiredMm, base.y0);
  let bottom = Math.min(desiredMm, pageHeightMm - base.y1);

  for (const other of blockers) {
    if (other === base) continue;
    if (rectsTouchOnY(base, other)) {
      if (other.x1 <= base.x0) left = Math.min(left, Math.max(0, (base.x0 - other.x1) / 2));
      if (other.x0 >= base.x1) right = Math.min(right, Math.max(0, (other.x0 - base.x1) / 2));
    }
    if (rectsTouchOnX(base, other)) {
      if (other.y1 <= base.y0) top = Math.min(top, Math.max(0, (base.y0 - other.y1) / 2));
      if (other.y0 >= base.y1) bottom = Math.min(bottom, Math.max(0, (other.y0 - base.y1) / 2));
    }
  }

  return { left, right, top, bottom };
}

/** Posicao final da mesma carta no verso, com a correcao de impressao. */
export function backRect(r: Rect, config: ComposerConfig): Rect {
  return offsetRect(
    mirrorRect(r, pageSizeMm(config).widthMm),
    config.backOffsetXMm ?? 0,
    config.backOffsetYMm ?? 0,
  );
}

/** Area final da frente. No modo normal e igual ao corte da carta. */
export function frontFaceRect(placement: PlacedCard): Rect {
  return placement.frontRectMm ?? placement.cutRectMm;
}

/** Area final do verso. No gutterfold fica na mesma pagina; no normal fica espelhada. */
export function backFaceRect(placement: PlacedCard, config: ComposerConfig): Rect {
  return placement.backRectMm ?? backRect(placement.cutRectMm, config);
}

/** Sangria usada no enquadramento da arte do verso, sem alterar o corte. */
export function effectiveBackBleedMm(config: ComposerConfig): number {
  return Math.max(0, config.backBleedMm ?? config.bleedMm);
}

/**
 * Margem do verso no gutterfold. Segue a mesma política da frente: compartilhada
 * divide ao meio e coladas corta na divisa. Sem valor próprio, repete a frente.
 */
function gutterfoldBackSideBleed(config: ComposerConfig): number {
  const mode = effectivePacking(config).mode;
  if (mode === "colada") return 0;
  const back = effectiveBackBleedMm(config);
  return mode === "compartilhada" ? back / 2 : back;
}

/** Sangria impressa extra do verso. Nao muda grade, frente, corte ou Cameo. */
export function effectiveBackExtraBleedMm(config: ComposerConfig): number {
  if (!config.backBleed.enabled) return 0;
  return Math.max(0, config.backExtraBleedMm);
}

/** Reducao da arte do verso. Nao muda grade, frente, corte ou Cameo. */
export function effectiveBackInsetMm(config: ComposerConfig): number {
  return Math.max(0, config.backInsetMm ?? 0);
}

/**
 * Area onde o verso pode imprimir a sangria fake. A expansao para quando encontra
 * outra carta, entao gap zero nao faz um verso cobrir o outro.
 */
export function backBleedSourceRect(
  placement: PlacedCard,
  placements: PlacedCard[],
  config: ComposerConfig,
): Rect {
  const extra = effectiveBackExtraBleedMm(config);
  if (extra <= 0) return placement.clipRectMm;

  const cut = placement.cutRectMm;
  const page = pageSizeMm(config);
  let left = Math.min(extra, cut.x0);
  let right = Math.min(extra, page.widthMm - cut.x1);
  let top = Math.min(extra, cut.y0);
  let bottom = Math.min(extra, page.heightMm - cut.y1);

  for (const otherPlacement of placements) {
    if (otherPlacement.card.id === placement.card.id) continue;
    const other = otherPlacement.cutRectMm;
    if (rectsTouchOnY(cut, other)) {
      if (other.x1 <= cut.x0) left = Math.min(left, Math.max(0, (cut.x0 - other.x1) / 2));
      if (other.x0 >= cut.x1) right = Math.min(right, Math.max(0, (other.x0 - cut.x1) / 2));
    }
    if (rectsTouchOnX(cut, other)) {
      if (other.y1 <= cut.y0) top = Math.min(top, Math.max(0, (cut.y0 - other.y1) / 2));
      if (other.y0 >= cut.y1) bottom = Math.min(bottom, Math.max(0, (other.y0 - cut.y1) / 2));
    }
  }

  return rect(cut.x0 - left, cut.y0 - top, cut.x1 + right, cut.y1 + bottom);
}

export function backClipRect(
  placement: PlacedCard,
  placements: PlacedCard[],
  config: ComposerConfig,
): Rect {
  if (isGutterfold(config) && placement.backClipRectMm) return placement.backClipRectMm;
  const page = pageSizeMm(config);
  const source = backBleedSourceRect(placement, placements, config);
  return clampRectToPage(backRect(source, config), page.widthMm, page.heightMm);
}

/**
 * Enquadramento independente da arte do verso. O retangulo de corte continua
 * exatamente igual; apenas a imagem e ampliada ou reduzida ao redor dele.
 */
export function backImageRect(placement: PlacedCard, config: ComposerConfig): Rect {
  if (isGutterfold(config) && placement.backImageRectMm) return placement.backImageRectMm;
  const cut = placement.cutRectMm;
  const bleed =
    Math.max(effectiveBackBleedMm(config), effectiveBackExtraBleedMm(config)) -
    effectiveBackInsetMm(config);
  return backRect(
    rect(cut.x0 - bleed, cut.y0 - bleed, cut.x1 + bleed, cut.y1 + bleed),
    config,
  );
}
