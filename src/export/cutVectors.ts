import type { Rect } from "@/cameo/types";
import { roundedRectPoints, type Point } from "@/cut/roundedRect";
import type { ComposerSheetLayout } from "@/composer/layoutSheets";

export type CutExportSheet = {
  number: number;
  /** Tamanho da folha em mm. */
  widthMm: number;
  heightMm: number;
  /** Areas finais de corte, em mm, origem no topo esquerdo da folha. */
  rects: Rect[];
};

export type CutExportFile = { name: string; text: string };

function nf(value: number): string {
  return Number(value.toFixed(4)).toString();
}

/** Polilinha fechada de uma carta, em mm, com Y crescendo para baixo. */
function cardPoints(r: Rect, radiusMm: number): Point[] {
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  if (radiusMm <= 0.0001) {
    return [
      { x: r.x0, y: r.y0 },
      { x: r.x1, y: r.y0 },
      { x: r.x1, y: r.y1 },
      { x: r.x0, y: r.y1 },
    ];
  }
  const pts = roundedRectPoints(r.x0, r.y0, w, h, radiusMm, { arcSteps: 12 });
  // roundedRectPoints fecha repetindo o primeiro ponto; o DXF fecha sozinho.
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first && last && Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6) {
    return pts.slice(0, -1);
  }
  return pts;
}

/**
 * DXF no formato legado R12 (POLYLINE + VERTEX + SEQEND), o mais compativel:
 * abre na versao gratuita do Silhouette Studio e em qualquer CAD.
 * O DXF tem Y crescendo para cima, por isso a inversao pela altura da folha.
 */
export function toDxf(sheet: CutExportSheet, radiusMm: number): string {
  const out: string[] = [];
  const pair = (code: number | string, value: string | number) => {
    out.push(String(code));
    out.push(String(value));
  };

  pair(0, "SECTION");
  pair(2, "HEADER");
  pair(9, "$ACADVER");
  pair(1, "AC1009");
  pair(9, "$INSUNITS");
  pair(70, 4); // 4 = milimetros
  pair(9, "$EXTMIN");
  pair(10, 0);
  pair(20, 0);
  pair(9, "$EXTMAX");
  pair(10, nf(sheet.widthMm));
  pair(20, nf(sheet.heightMm));
  pair(0, "ENDSEC");

  pair(0, "SECTION");
  pair(2, "ENTITIES");

  for (const rect of sheet.rects) {
    const points = cardPoints(rect, radiusMm);
    pair(0, "POLYLINE");
    pair(8, "CORTE");
    pair(66, 1);
    pair(70, 1); // fechada
    pair(10, 0);
    pair(20, 0);
    pair(30, 0);
    for (const point of points) {
      pair(0, "VERTEX");
      pair(8, "CORTE");
      pair(10, nf(point.x));
      pair(20, nf(sheet.heightMm - point.y));
      pair(30, 0);
    }
    pair(0, "SEQEND");
    pair(8, "CORTE");
  }

  pair(0, "ENDSEC");
  pair(0, "EOF");

  return `${out.join("\r\n")}\r\n`;
}

/** SVG em milimetros, tamanho exato da folha, uma linha fina por carta. */
export function toSvg(sheet: CutExportSheet, radiusMm: number): string {
  const paths = sheet.rects
    .map((rect) => {
      const points = cardPoints(rect, radiusMm);
      const d = points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${nf(point.x)} ${nf(point.y)}`)
        .join(" ");
      return `  <path d="${d} Z" fill="none" stroke="#000000" stroke-width="0.1" />`;
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${nf(sheet.widthMm)}mm" height="${nf(
      sheet.heightMm,
    )}mm" viewBox="0 0 ${nf(sheet.widthMm)} ${nf(sheet.heightMm)}">`,
    `  <title>Linhas de corte da folha ${sheet.number}</title>`,
    paths,
    "</svg>",
    "",
  ].join("\n");
}

/** SVG especifico para abrir no Cricut Design Space, somente com cortes. */
export function toCricutSvg(sheet: CutExportSheet, radiusMm: number): string {
  const paths = sheet.rects
    .map((rect, index) => {
      const points = cardPoints(rect, radiusMm);
      const d = points
        .map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${nf(point.x)} ${nf(point.y)}`)
        .join(" ");
      return `    <path id="carta-${index + 1}" d="${d} Z" fill="none" stroke="#000000" stroke-width="0.1" vector-effect="non-scaling-stroke" />`;
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${nf(sheet.widthMm)}mm" height="${nf(
      sheet.heightMm,
    )}mm" viewBox="0 0 ${nf(sheet.widthMm)} ${nf(sheet.heightMm)}">`,
    `  <title>PNP do Eron Cricut folha ${sheet.number}</title>`,
    `  <desc>Arquivo sem imagens. Use no Cricut Design Space em tamanho real para gerar as marcas de Print Then Cut.</desc>`,
    `  <g id="linhas-de-corte" fill="none" stroke="#000000">`,
    paths,
    "  </g>",
    "</svg>",
    "",
  ].join("\n");
}

/** Folhas prontas para exportar: somente as cartas marcadas para corte. */
export function exportSheetsFrom(
  layouts: ComposerSheetLayout[],
  page: { widthMm: number; heightMm: number },
): CutExportSheet[] {
  return layouts
    .map((layout) => ({
      number: layout.number,
      widthMm: page.widthMm,
      heightMm: page.heightMm,
      rects: layout.placements
        .filter((placement) => placement.card.selected)
        .map((placement) => placement.cutRectMm),
    }))
    .filter((sheet) => sheet.rects.length > 0);
}

export function cutExportFiles(
  sheets: CutExportSheet[],
  format: "dxf" | "svg",
  radiusMm: number,
): CutExportFile[] {
  return sheets.map((sheet) => ({
    name: `corte-folha-${String(sheet.number).padStart(2, "0")}.${format}`,
    text: format === "dxf" ? toDxf(sheet, radiusMm) : toSvg(sheet, radiusMm),
  }));
}

export function cricutExportFiles(sheets: CutExportSheet[], radiusMm: number): CutExportFile[] {
  return sheets.map((sheet) => ({
    name: `cricut-folha-${String(sheet.number).padStart(2, "0")}.svg`,
    text: toCricutSvg(sheet, radiusMm),
  }));
}

export function cricutReadmeText(): string {
  return [
    "PNP do Eron - Pacote Cricut",
    "",
    "1. Abra cada SVG no Cricut Design Space.",
    "2. Confira se o tamanho ficou em milímetros e em escala real.",
    "3. Use Print Then Cut e salve o PDF que o Design Space gera com marcas.",
    "4. Volte ao PNP do Eron e importe esse PDF de marcas.",
    "5. Monte o PDF final das cartas e imprima sempre em 100% de escala.",
    "",
    "Os SVGs têm apenas linhas de corte. Nenhuma imagem de carta sai do seu computador.",
    "No modo gutterfold, o SVG leva só o contorno externo da peça aberta. A dobra central não é corte.",
    "Se mudar carta, folha, grade, sangria ou raio dos cantos, gere este pacote novamente.",
    "",
  ].join("\n");
}
