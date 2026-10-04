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
  /**
   * Linhas de dobra (vinco), em mm. Saem só no DXF/SVG genéricos, em camada
   * VINCO separada do CORTE. Nunca vão para o Pacote Cricut nem para a Cameo.
   */
  folds?: FoldLine[];
};

export type FoldLine = { x0: number; y0: number; x1: number; y1: number };

function foldLineFrom(r: Rect, direction?: "horizontal" | "vertical"): FoldLine {
  const horizontal = direction ? direction === "horizontal" : r.x1 - r.x0 > r.y1 - r.y0;
  if (horizontal) {
    const y = (r.y0 + r.y1) / 2;
    return { x0: r.x0, y0: y, x1: r.x1, y1: y };
  }
  const x = (r.x0 + r.x1) / 2;
  return { x0: x, y0: r.y0, x1: x, y1: r.y1 };
}

export type CutExportFile = { name: string; text: string };

function nf(value: number): string {
  return Number(value.toFixed(4)).toString();
}

const MM_PER_IN = 25.4;
const CRICUT_SVG_DPI = 72;

/** Converte mm para px assumindo 72 DPI, a leitura que o Design Space faz de um SVG sem unidade. */
function mmToCricutPx(mm: number): number {
  return (mm / MM_PER_IN) * CRICUT_SVG_DPI;
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

  for (const fold of sheet.folds ?? []) {
    pair(0, "LINE");
    pair(8, "VINCO");
    pair(10, nf(fold.x0));
    pair(20, nf(sheet.heightMm - fold.y0));
    pair(30, 0);
    pair(11, nf(fold.x1));
    pair(21, nf(sheet.heightMm - fold.y1));
    pair(31, 0);
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
    '  <g id="CORTE">',
    paths,
    "  </g>",
    ...((sheet.folds ?? []).length > 0
      ? [
          '  <g id="VINCO">',
          ...(sheet.folds ?? []).map(
            (fold) =>
              `  <line x1="${nf(fold.x0)}" y1="${nf(fold.y0)}" x2="${nf(fold.x1)}" y2="${nf(fold.y1)}" stroke="#0000ff" stroke-width="0.1" stroke-dasharray="2 1.5" />`,
          ),
          "  </g>",
        ]
      : []),
    "</svg>",
    "",
  ].join("\n");
}

/** Um unico "d" com um subcaminho fechado por carta, igual ao Affinity: mantem as cartas juntas como uma peca so, sem o usuario precisar selecionar e unir cada corte no Design Space. */
function cricutCutPathData(sheet: CutExportSheet, radiusMm: number): string {
  return sheet.rects
    .map((rect) => {
      const points = cardPoints(rect, radiusMm);
      const d = points
        .map(
          (point, pointIndex) =>
            `${pointIndex === 0 ? "M" : "L"} ${nf(mmToCricutPx(point.x))} ${nf(mmToCricutPx(point.y))}`,
        )
        .join(" ");
      return `${d} Z`;
    })
    .join(" ");
}

/**
 * SVG especifico para abrir no Cricut Design Space, somente com cortes.
 * Design Space nao usa o width/height/viewBox do <svg> para calcular o
 * tamanho real do desenho importado: ele mede a caixa delimitadora do que
 * esta desenhado. Sem um retangulo invisivel do tamanho exato da folha (sem
 * preenchimento nem traco), uma folha com poucas cartas marcadas fica com
 * uma caixa delimitadora bem menor que a folha inteira, e o Design Space
 * importa nesse tamanho errado. E tambem nao basta declarar "mm" com um
 * viewBox: ja testamos width/height em mm (igual ao toSvg) com o mesmo
 * retangulo-ancora e voltou a importar gigante. A unica combinacao
 * confirmada por teste real no Design Space e: "px" explicito no width e no
 * height (sem viewBox), com os numeros ja convertidos a 72 DPI
 * (1 mm = 72/25.4 px) tanto na folha quanto nas cartas, mais o
 * retangulo-ancora do tamanho da folha inteira. Nao trocar de unidade de novo
 * sem testar no Design Space primeiro.
 */
export function toCricutSvg(sheet: CutExportSheet, radiusMm: number): string {
  const widthPx = mmToCricutPx(sheet.widthMm);
  const heightPx = mmToCricutPx(sheet.heightMm);
  const d = cricutCutPathData(sheet, radiusMm);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${nf(widthPx)}px" height="${nf(heightPx)}px">`,
    `  <title>PNP do Eron Cricut folha ${sheet.number}</title>`,
    `  <desc>Arquivo sem imagens. Use no Cricut Design Space em tamanho real para gerar as marcas de Print Then Cut.</desc>`,
    // Âncora de escala: só serve para o Design Space importar no tamanho real.
    // Deve ser apagada/ocultada antes do Print Then Cut. Sem fill nem stroke.
    `  <g id="APAGAR-ANTES-DO-PRINT-THEN-CUT">`,
    `    <rect id="folha-referencia-tamanho" x="0" y="0" width="${nf(widthPx)}" height="${nf(heightPx)}" fill="none" stroke="none" />`,
    `  </g>`,
    `  <path id="linhas-de-corte" d="${d}" fill="none" stroke="#000000" stroke-width="0.3" vector-effect="non-scaling-stroke" />`,
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
      folds: (() => {
        const selected = layout.placements.filter((placement) => placement.card.selected);
        if (selected.length === 0) return [];
        if (layout.sheetFoldRectMm) {
          return [foldLineFrom(layout.sheetFoldRectMm, layout.sheetFoldDirection)];
        }
        return selected.flatMap((placement) =>
          placement.gutterRectMm ? [foldLineFrom(placement.gutterRectMm, placement.foldDirection)] : [],
        );
      })(),
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
    "2. Confira se o tamanho ficou em escala real antes de continuar. Não mude tamanho nem posição.",
    "3. Use Print Then Cut e salve o PDF que o Design Space gera com marcas.",
    "   IMPORTANTE: a camada APAGAR-ANTES-DO-PRINT-THEN-CUT (retângulo folha-referencia-tamanho)",
    "   serve SÓ para o Design Space importar na escala certa. Apague ou oculte essa camada antes de",
    "   anexar/transformar em Print Then Cut. Os contornos das cartas ficam.",
    "4. Volte ao PNP do Eron e importe esse PDF de marcas.",
    "5. Monte o PDF final das cartas e imprima sempre em 100% de escala.",
    "",
    "Os SVGs têm apenas linhas de corte. Nenhuma imagem de carta sai do seu computador.",
    "No modo gutterfold, o SVG leva só o contorno externo da peça aberta. A dobra não entra neste pacote.",
    "Os limites de Print Then Cut usados no PNP do Eron eliminam só excessos óbvios: a área real da Cricut",
    "não é um retângulo completo, e o Design Space ainda pode pedir menos cartas por causa dos cantos e marcas.",
    "Se mudar carta, folha, grade, sangria ou raio dos cantos, gere este pacote novamente.",
    "",
  ].join("\n");
}
