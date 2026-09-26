import type { Rect } from "@/cameo/types";
import {
  cutRectHitsRegistrationArea,
  rectHeight,
  rectWidth,
} from "@/cut/geometry";
import { manualMarkRectsMm } from "@/cut/manualMarks";
import {
  backClipRect,
  backFaceRect,
  backImageRect,
  cutHeightFor,
  cutWidthFor,
  frontFaceRect,
  gridFor,
  isGutterfold,
  type ComposerSheetLayout,
} from "./layoutSheets";
import { pageSizeMm } from "./paperSizes";
import type { ComposerConfig } from "./types";
import { cameoMarkArmMm } from "./types";

/** Diferenca aceita entre o tamanho pedido e o tamanho real do corte. */
export const SIZE_TOLERANCE_MM = 0.05;

export type SizeIssue = {
  level: "erro" | "aviso";
  message: string;
};

export type SizeAudit = {
  ok: boolean;
  checked: number;
  /** Maior diferenca encontrada em mm. */
  worstDeltaMm: number;
  issues: SizeIssue[];
};

function fmt(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function offPage(r: Rect, pageWidthMm: number, pageHeightMm: number): boolean {
  return (
    r.x0 < -SIZE_TOLERANCE_MM ||
    r.y0 < -SIZE_TOLERANCE_MM ||
    r.x1 > pageWidthMm + SIZE_TOLERANCE_MM ||
    r.y1 > pageHeightMm + SIZE_TOLERANCE_MM
  );
}

/**
 * Confere, folha por folha, se cada area de corte realmente tem o tamanho
 * pedido pelo usuario e se ela cabe na folha sem tocar as marcas do sensor.
 */
export function auditCutSizes(
  layouts: ComposerSheetLayout[],
  config: ComposerConfig,
): SizeAudit {
  const issues: SizeIssue[] = [];
  const page = pageSizeMm(config);
  let checked = 0;
  let worstDeltaMm = 0;

  if (config.cardWidthMm <= 0 || config.cardHeightMm <= 0) {
    issues.push({ level: "erro", message: "Largura e altura da carta precisam ser maiores que zero." });
  }

  if (config.gridMode === "manual" && layouts.length > 0) {
    const grid = gridFor(config);
    if (grid.limited) {
      issues.push({
        level: "aviso",
        message: `A grade pedida não cabe na folha, então está valendo ${grid.columns} por linha e ${grid.rows} por coluna.`,
      });
    }
  }

  for (const sheet of layouts) {
    for (const placed of sheet.placements) {
      checked += 1;
      const w = rectWidth(placed.cutRectMm);
      const h = rectHeight(placed.cutRectMm);
      const expectedW = cutWidthFor(config);
      const expectedH = cutHeightFor(config);
      const dw = Math.abs(w - expectedW);
      const dh = Math.abs(h - expectedH);
      worstDeltaMm = Math.max(worstDeltaMm, dw, dh);

      if (dw > SIZE_TOLERANCE_MM || dh > SIZE_TOLERANCE_MM) {
        issues.push({
          level: "erro",
          message: isGutterfold(config)
            ? `Folha ${sheet.number}, peça ${placed.number} sairia com ${fmt(w)} × ${fmt(h)} mm em vez de ${fmt(expectedW)} × ${fmt(expectedH)} mm aberta.`
            : `Folha ${sheet.number}, carta ${placed.number} sairia com ${fmt(w)} × ${fmt(h)} mm em vez de ${fmt(expectedW)} × ${fmt(expectedH)} mm.`,
        });
      }

      if (isGutterfold(config)) {
        const front = frontFaceRect(placed);
        const back = backFaceRect(placed, config);
        const frontDw = Math.abs(rectWidth(front) - config.cardWidthMm);
        const frontDh = Math.abs(rectHeight(front) - config.cardHeightMm);
        const backDw = Math.abs(rectWidth(back) - config.cardWidthMm);
        const backDh = Math.abs(rectHeight(back) - config.cardHeightMm);
        worstDeltaMm = Math.max(worstDeltaMm, frontDw, frontDh, backDw, backDh);
        if (
          frontDw > SIZE_TOLERANCE_MM ||
          frontDh > SIZE_TOLERANCE_MM ||
          backDw > SIZE_TOLERANCE_MM ||
          backDh > SIZE_TOLERANCE_MM
        ) {
          issues.push({
            level: "erro",
            message: `Folha ${sheet.number}, peça ${placed.number}: frente ou verso não ficou com ${fmt(config.cardWidthMm)} × ${fmt(config.cardHeightMm)} mm.`,
          });
        }
      }

      if (offPage(placed.cutRectMm, page.widthMm, page.heightMm)) {
        issues.push({
          level: "erro",
          message: isGutterfold(config)
            ? `Folha ${sheet.number}, peça ${placed.number} passa da borda da folha.`
            : `Folha ${sheet.number}, carta ${placed.number} passa da borda da folha.`,
        });
      }

      if (
        config.finishMode === "cameo" &&
        cutRectHitsRegistrationArea(
          placed.cutRectMm,
          page.widthMm,
          page.heightMm,
          config.registrationWhiteBorderMm,
          cameoMarkArmMm(config),
        )
      ) {
        issues.push({
          level: "erro",
          message: isGutterfold(config)
            ? `Folha ${sheet.number}, peça ${placed.number} encosta em uma marca do sensor.`
            : `Folha ${sheet.number}, carta ${placed.number} encosta em uma marca do sensor.`,
        });
      }
    }

    if (
      !isGutterfold(config) &&
      (config.backOffsetXMm !== 0 ||
        config.backOffsetYMm !== 0 ||
        config.backBleedMm != null ||
        config.backBleed.enabled)
    ) {
      const off = sheet.placements.filter((placed) =>
        offPage(backImageRect(placed, config), page.widthMm, page.heightMm) ||
        offPage(backClipRect(placed, sheet.placements, config), page.widthMm, page.heightMm),
      );
      if (off.length > 0) {
        issues.push({
          level: "aviso",
          message: `Folha ${sheet.number}: o ajuste do verso empurra ${off.length} carta(s) para fora da borda da folha.`,
        });
      }
    }

    if (config.finishMode === "manual" && config.manualMarks.types.length > 0) {
      const marks = manualMarkRectsMm(
        sheet.placements.map((placed) => placed.cutRectMm),
        config.manualMarks,
        page.widthMm,
        page.heightMm,
      );
      if (marks.length === 0) {
        issues.push({
          level: "aviso",
          message: `Folha ${sheet.number}: as marcas escolhidas ficariam fora da folha e não seriam impressas.`,
        });
      }
    }
  }

  if (checked > 0 && issues.length === 0 && worstDeltaMm > 0) {
    issues.push({
      level: "aviso",
      message: `Diferença mínima de ${fmt(worstDeltaMm)} mm por arredondamento, dentro do aceitável.`,
    });
  }

  return {
    ok: !issues.some((issue) => issue.level === "erro"),
    checked,
    worstDeltaMm,
    issues,
  };
}
