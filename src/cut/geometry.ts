import type { Rect } from "@/cameo/types";
import { overcutSegments } from "./overcut";
import { roundedRectPoints } from "./roundedRect";
import { su } from "./silhouetteUnits";

/** GEOMETRIA CONGELADA / VALIDADA NO HARDWARE. Nao alterar. */
export const REG_INSET_MM = 10;
export const REG_SQUARE_MM = 5;
export const REG_ARM_MM = 10;
/** Faixa aceita para o braco do L em modo experimental (nao validado). */
export const REG_ARM_MIN_MM = 10;
export const REG_ARM_MAX_MM = 20;

/** Braco do L efetivo: padrao validado de 10 mm, ou valor experimental limitado. */
export function clampRegArmMm(value: number | undefined | null): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return REG_ARM_MM;
  return Math.min(REG_ARM_MAX_MM, Math.max(REG_ARM_MIN_MM, Math.round(value * 2) / 2));
}
export const REG_THICKNESS_MM = 1;
export const REG_SPACING_X_MM = 277;
export const REG_SPACING_Y_MM = 190;

export const A4_LANDSCAPE_W_MM = 297;
export const A4_LANDSCAPE_H_MM = 210;

export function rect(x0: number, y0: number, x1: number, y1: number): Rect {
  return { x0, y0, x1, y1 };
}

export function rectWidth(r: Rect): number {
  return r.x1 - r.x0;
}

export function rectHeight(r: Rect): number {
  return r.y1 - r.y0;
}

export function rectsIntersect(a: Rect, b: Rect, eps = 1e-6): boolean {
  return a.x0 < b.x1 - eps && b.x0 < a.x1 - eps && a.y0 < b.y1 - eps && b.y0 < a.y1 - eps;
}

/**
 * Formas pretas das registration marks (coordenadas mm, origem topo-esquerda).
 * Quadrado 5x5 no topo esquerdo, L de 10 mm no topo direito e no rodape esquerdo,
 * espessura 1 mm, inset 10 mm.
 */
export function registrationShapesMm(
  pageWidthMm: number,
  pageHeightMm: number,
  armMm: number = REG_ARM_MM,
): Rect[] {
  const i = REG_INSET_MM;
  const t = REG_THICKNESS_MM;
  const arm = clampRegArmMm(armMm);

  const trX = pageWidthMm - i;
  const blY = pageHeightMm - i;

  return [
    // Topo esquerdo: quadrado preenchido.
    rect(i, i, i + REG_SQUARE_MM, i + REG_SQUARE_MM),
    // Topo direito: L (braco horizontal para a esquerda, vertical para baixo).
    rect(trX - arm, i, trX, i + t),
    rect(trX - t, i, trX, i + arm),
    // Rodape esquerdo: L (braco horizontal para a direita, vertical para cima).
    rect(i, blY - t, i + arm, blY),
    rect(i, blY - arm, i + t, blY),
  ];
}

/** Fundos brancos que isolam as tres marcas da arte impressa. */
export function registrationWhiteBackdropsMm(
  pageWidthMm: number,
  pageHeightMm: number,
  borderMm: number,
  armMm: number = REG_ARM_MM,
): Rect[] {
  const arm = clampRegArmMm(armMm);
  const border = Math.max(0, borderMm);
  const expanded = (shape: Rect): Rect =>
    rect(
      Math.max(0, shape.x0 - border),
      Math.max(0, shape.y0 - border),
      Math.min(pageWidthMm, shape.x1 + border),
      Math.min(pageHeightMm, shape.y1 + border),
    );

  const shapes = registrationShapesMm(pageWidthMm, pageHeightMm, arm);

  // Todas as marcas (quadrado e bracos dos L) recebem exatamente a borda
  // escolhida em volta do proprio desenho. Com borda 0, nao ha fundo extra.
  return shapes.map(expanded);
}

/**
 * Area em que o sensor procura cada marca. Invadir isso e apenas AVISO.
 */
export function sensorSafeZonesMm(
  pageWidthMm: number,
  pageHeightMm: number,
  armMm: number = REG_ARM_MM,
): Rect[] {
  const pad = 6;
  const i = REG_INSET_MM;
  const arm = clampRegArmMm(armMm);

  return [
    rect(i - pad, i - pad, i + arm + pad, i + arm + pad),
    rect(pageWidthMm - i - arm - pad, i - pad, pageWidthMm - i + pad, i + arm + pad),
    rect(i - pad, pageHeightMm - i - arm - pad, i + arm + pad, pageHeightMm - i + pad),
  ];
}

export function artInSensorSafeZone(
  artRect: Rect,
  pageWidthMm: number,
  pageHeightMm: number,
  armMm: number = REG_ARM_MM,
): boolean {
  return sensorSafeZonesMm(pageWidthMm, pageHeightMm, armMm).some((z) => rectsIntersect(artRect, z));
}

/**
 * Caso B: a area FINAL de corte atravessa fisicamente uma registration mark.
 * Isso e erro critico, nao aviso.
 */
export function cutRectHitsRegistrationMark(
  cutRect: Rect,
  pageWidthMm: number,
  pageHeightMm: number,
  armMm: number = REG_ARM_MM,
): boolean {
  return registrationShapesMm(pageWidthMm, pageHeightMm, armMm).some((m) =>
    rectsIntersect(cutRect, m),
  );
}

/**
 * Area reservada completa da marca, incluindo o fundo branco configurado.
 * A arte pode passar por essa area, mas a linha de corte nao pode atravessa-la.
 */
export function cutRectHitsRegistrationArea(
  cutRect: Rect,
  pageWidthMm: number,
  pageHeightMm: number,
  whiteBorderMm: number,
  armMm: number = REG_ARM_MM,
): boolean {
  return registrationWhiteBackdropsMm(pageWidthMm, pageHeightMm, whiteBorderMm, armMm).some((area) =>
    rectsIntersect(cutRect, area),
  );
}

export type CutPathOptions = {
  radiusMm: number;
  lineOvercut?: boolean;
  lineOvercutMm?: number;
};

/**
 * Comandos M/D de UMA carta.
 *
 * Origem logica depois do registration = marca superior esquerda (10,10) mm.
 * Comandos Cameo usam ordem Y,X.
 */
export function buildCutPath(cutRectMm: Rect, options: CutPathOptions): string[] {
  const { radiusMm } = options;
  const lineOvercut = options.lineOvercut ?? false;
  const ext = lineOvercut ? Math.max(0, options.lineOvercutMm ?? 0.1) : 0;

  const w = rectWidth(cutRectMm);
  const h = rectHeight(cutRectMm);
  const x = cutRectMm.x0 - REG_INSET_MM;
  const y = cutRectMm.y0 - REG_INSET_MM;

  // Cantos retos com sobrecorte: cada lado avanca ext mm nos dois vertices.
  if (ext > 0 && radiusMm <= 1e-9) {
    const out: string[] = [];
    for (const [a, b] of overcutSegments(x, y, w, h, ext)) {
      out.push(`M${su(a.y)},${su(a.x)}`);
      out.push(`D${su(b.y)},${su(b.x)}`);
    }
    return out;
  }

  // Cantos arredondados: caminho comeca no meio do lado maior, para a lamina
  // se alinhar num trecho reto antes do primeiro arco. Com sobrecorte ligado,
  // o fechamento avanca ext mm alem do ponto inicial, na direcao da reta.
  const pts = roundedRectPoints(x, y, w, h, radiusMm, {
    startMidSide: true,
    overcutMm: ext,
  });
  const first = pts[0]!;
  const out: string[] = [`M${su(first.y)},${su(first.x)}`];
  for (const p of pts.slice(1)) {
    out.push(`D${su(p.y)},${su(p.x)}`);
  }

  return out;
}

/** Bytes reais enviados ao hardware (cada comando termina em ETX). */
export function cutPathBytes(cutRectMm: Rect, options: CutPathOptions): string {
  return buildCutPath(cutRectMm, options)
    .map((c) => `${c}\u0003`)
    .join("");
}

/**
 * Distancia de marca a marca, calculada a partir do tamanho da folha e do
 * recuo congelado de 10 mm. Em A4 deitada resulta exatamente em 277 × 190 mm,
 * os valores validados fisicamente.
 */
export function registrationSpacingMm(page: {
  widthMm: number;
  heightMm: number;
}): { xMm: number; yMm: number } {
  return {
    xMm: page.widthMm - REG_INSET_MM * 2,
    yMm: page.heightMm - REG_INSET_MM * 2,
  };
}

/**
 * Comando de leitura das marcas. A ordem e Y,X, igual ao resto do protocolo.
 * Em A4 deitada o resultado e "TB123,3800,5540,118,118", byte por byte igual
 * ao comando congelado.
 */
export function registrationTb123(page: { widthMm: number; heightMm: number }): string {
  const spacing = registrationSpacingMm(page);
  return `TB123,${su(spacing.yMm)},${su(spacing.xMm)},118,118`;
}

/**
 * Comando TB51 (comprimento do braco da marca, em unidades da maquina).
 * Com o padrao de 10 mm resulta em "TB51,200", identico ao protocolo congelado.
 */
export function registrationTb51(armMm: number = REG_ARM_MM): string {
  return `TB51,${su(clampRegArmMm(armMm))}`;
}
