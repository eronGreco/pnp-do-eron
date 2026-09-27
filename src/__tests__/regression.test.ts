import { describe, expect, it } from "vitest";
import { parseRegistrationResponse } from "@/cameo/registrationResponse";
import {
  A4_LANDSCAPE_H_MM,
  A4_LANDSCAPE_W_MM,
  buildCutPath,
  cutRectHitsRegistrationArea,
  cutRectHitsRegistrationMark,
  artInSensorSafeZone,
  rect,
  registrationWhiteBackdropsMm,
} from "@/cut/geometry";
import { su } from "@/cut/silhouetteUnits";
import { crossCentersFromSegments, isCropMarkSegment, type Segment } from "@/pdf/detectCropMarks";
import { cutRectForImage, dominantCardImages } from "@/pdf/detectCards";
import { hasOrphanFront, pairSheets, rotationForPage } from "@/pdf/normalizeOrientation";
import { stripCropMarksFromContent } from "@/pdf/stripCropMarks";
import { gridFor } from "@/composer/layoutSheets";
import { pageSizeMm, paperAllowed } from "@/composer/paperSizes";
import { DEFAULT_COMPOSER_CONFIG } from "@/composer/types";
import { backImageFor } from "@/composer/pairFrontBack";
import { normalizeSliceConfig, scaledSliceSize, sliceFileName, sliceRects } from "@/slicer/sliceGeometry";
import { DEFAULT_SLICE_CONFIG, type SliceConfig } from "@/slicer/types";
import { edgeFillPixels, fillCardEdges } from "@/slicer/cornerFill";

import { auditCutSizes, SIZE_TOLERANCE_MM } from "@/composer/sizeAudit";
import {
  backClipRect,
  backFaceRect,
  backImageRect,
  backRect,
  cutWidthFor,
  effectiveBackExtraBleedMm,
  effectiveBackBleedMm,
  frontFaceRect,
  layoutSheets,
  mirrorRect,
} from "@/composer/layoutSheets";
import { buildStampOf } from "@/composer/buildStamp";
import { DEFAULT_MANUAL_MARKS, manualMarkRectsMm, marksOnSide } from "@/cut/manualMarks";
import { decodeJobManifestString, encodeJobManifest } from "@/pdf/jobManifest";
import { exportSheetsFrom } from "@/export/cutVectors";
import { DEFAULT_PREFERENCES } from "@/storage/settings";
import { clearComposerState, loadComposerState, saveComposerState } from "@/storage/composerStore";
import type { Sheet } from "@/cameo/types";

const A4_W = 297;
const A4_H = 210;

function requireValue<T>(value: T | null | undefined): T {
  expect(value).toBeDefined();
  if (value == null) throw new Error("Valor esperado no teste não existe.");
  return value;
}

/** Cruz do PNP: braco horizontal e vertical de 4 mm centrados no ponto. */
function cross(x: number, y: number): Segment[] {
  return [
    { x1: x - 2, y1: y, x2: x + 2, y2: y },
    { x1: x, y1: y - 2, x2: x, y2: y + 2 },
  ];
}

describe("A/B: paginas para folhas", () => {
  it("2 paginas formam 1 folha", () => {
    const sheets = pairSheets(2);
    expect(sheets).toEqual([{ number: 1, frontPageIndex: 0, backPageIndex: 1 }]);
    expect(hasOrphanFront(2)).toBe(false);
  });

  it("4 paginas formam 2 folhas: 1/2 e 3/4", () => {
    expect(pairSheets(4)).toEqual([
      { number: 1, frontPageIndex: 0, backPageIndex: 1 },
      { number: 2, frontPageIndex: 2, backPageIndex: 3 },
    ]);
  });

  it("ultima frente sem verso e aceita com aviso", () => {
    const sheets = pairSheets(3);
    expect(sheets[2 - 1]?.backPageIndex).toBeNull();
    expect(hasOrphanFront(3)).toBe(true);
  });
});

describe("C: retrato girado sem quebrar os versos", () => {
  it("gira 90 graus e mantem a ordem frente/verso", () => {
    expect(rotationForPage({ widthMm: 210, heightMm: 297 })).toBe(90);
    expect(rotationForPage({ widthMm: 297, heightMm: 210 })).toBe(0);
    expect(pairSheets(4).map((s) => [s.frontPageIndex, s.backPageIndex])).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });
});

describe("D/E: sobrecorte de linha", () => {
  const cut = rect(100, 60, 152, 112);

  it("desligado produz exatamente o mesmo caminho da referencia", () => {
    const a = buildCutPath(cut, { radiusMm: 3, lineOvercut: false });
    const b = buildCutPath(cut, { radiusMm: 3 });
    expect(a).toEqual(b);
  });

  it("ligado adiciona apenas 0,1 mm", () => {
    const off = buildCutPath(cut, { radiusMm: 0, lineOvercut: false });
    const on = buildCutPath(cut, { radiusMm: 0, lineOvercut: true, lineOvercutMm: 0.1 });

    const bounds = (commands: string[]) => {
      const coords = commands.map((c) => c.slice(1).split(",").map(Number));
      const ys = coords.map((c) => c[0]!);
      const xs = coords.map((c) => c[1]!);
      return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
      };
    };

    const a = bounds(off);
    const b = bounds(on);
    expect(a.minX - b.minX).toBe(su(0.1));
    expect(b.maxX - a.maxX).toBe(su(0.1));
    expect(a.minY - b.minY).toBe(su(0.1));
    expect(b.maxY - a.maxY).toBe(su(0.1));
  });

  it("com cantos arredondados estende 0,1 mm alem do fechamento", () => {
    const on = buildCutPath(cut, { radiusMm: 3, lineOvercut: true, lineOvercutMm: 0.1 });
    const pts = on.map((c) => {
      const [y, x] = c.slice(1).split(",").map(Number);
      return { x: x! / 20, y: y! / 20 };
    });
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    // 52x52 (w >= h): fecha na aresta superior, andando para a direita.
    expect(last.y).toBeCloseTo(first.y, 5);
    expect(last.x - first.x).toBeGreaterThan(0.04);
    expect(last.x - first.x).toBeLessThanOrEqual(0.16);
  });
});

describe("S: cantos arredondados iguais nos quatro cantos", () => {
  const cut = rect(100, 60, 152, 112); // 52 x 52 mm

  const toMm = (commands: string[]) =>
    commands.map((c) => {
      const [y, x] = c.slice(1).split(",").map(Number);
      return { x: x! / 20, y: y! / 20 };
    });

  it("o caminho comeca no meio da reta, longe de qualquer canto", () => {
    const pts = toMm(buildCutPath(cut, { radiusMm: 3, lineOvercut: false }));
    const first = pts[0]!;
    const corners = [
      { x: 90, y: 50 },
      { x: 142, y: 50 },
      { x: 142, y: 102 },
      { x: 90, y: 102 },
    ];
    for (const corner of corners) {
      const d = Math.hypot(first.x - corner.x, first.y - corner.y);
      expect(d).toBeGreaterThan(52 / 4);
    }
  });

  it("os quatro cantos ficam geometricamente identicos", () => {
    const pts = toMm(buildCutPath(cut, { radiusMm: 3, lineOvercut: false }));
    const cx = (90 + 142) / 2;
    const cy = (50 + 102) / 2;
    const key = (p: { x: number; y: number }) => `${p.x.toFixed(2)}|${p.y.toFixed(2)}`;
    const r = 3 + 0.06;
    const arcPts = pts.filter((p) =>
      [
        { x: 90, y: 50 },
        { x: 142, y: 50 },
        { x: 142, y: 102 },
        { x: 90, y: 102 },
      ].some((v) => Math.abs(p.x - v.x) <= r && Math.abs(p.y - v.y) <= r),
    );
    const set = new Set(arcPts.map(key));
    expect(arcPts.length).toBeGreaterThan(20);

    for (const p of arcPts) {
      expect(set.has(key({ x: 2 * cx - p.x, y: p.y }))).toBe(true);
      expect(set.has(key({ x: p.x, y: 2 * cy - p.y }))).toBe(true);
    }
  });

  it("carta retangular tambem fecha no meio do lado maior", () => {
    const wide = rect(10, 10, 67, 99);
    const pts = toMm(buildCutPath(wide, { radiusMm: 3, lineOvercut: false }));
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    expect(first.x).toBeCloseTo(0, 5);
    expect(first.y).toBeCloseTo(89 / 2, 5);
    expect(last.x).toBeCloseTo(first.x, 5);
    expect(last.y).toBeCloseTo(first.y, 5);
  });
});

describe("F/G: marcas de registro", () => {
  it("arte na zona do sensor gera apenas aviso", () => {
    expect(artInSensorSafeZone(rect(8, 8, 40, 40), A4_W, A4_H)).toBe(true);
    expect(cutRectHitsRegistrationMark(rect(60, 60, 112, 112), A4_W, A4_H)).toBe(false);
  });

  it("corte atravessando a marca e erro critico", () => {
    expect(cutRectHitsRegistrationMark(rect(8, 8, 40, 40), A4_W, A4_H)).toBe(true);
  });

  it("o fundo branco acompanha os dois bracos de cada marca em L", () => {
    const backdrops = registrationWhiteBackdropsMm(A4_W, A4_H, 2);
    expect(backdrops).toHaveLength(5);
    expect(backdrops[0]).toEqual(rect(8, 8, 17, 17));
    expect(backdrops[1]).toEqual(rect(275, 8, 289, 13));
    expect(backdrops[2]).toEqual(rect(284, 8, 289, 22));
  });

  it("a linha de corte respeita tambem o fundo branco configurado", () => {
    const nearSquare = rect(20, 10, 72, 62);
    expect(cutRectHitsRegistrationMark(nearSquare, A4_W, A4_H)).toBe(false);
    expect(cutRectHitsRegistrationArea(nearSquare, A4_W, A4_H, 6)).toBe(true);
  });
});

describe("N: aproveitamento da folha com sangria compartilhada", () => {
  it("acomoda 8 cartas de 57x89 mm em duas fileiras", () => {
    const grid = gridFor({
      ...DEFAULT_COMPOSER_CONFIG,
      cardWidthMm: 57,
      cardHeightMm: 89,
      bleedMm: 5,
      gapMm: 2,
      bleedMode: "compartilhada",
      registrationWhiteBorderMm: 1,
    });
    expect(grid.columns).toBe(4);
    expect(grid.rows).toBe(2);
    expect(grid.perSheet).toBe(8);
  });

  it("a grade automatica nunca coloca carta dentro da borda branca das marcas", () => {
    const config = {
      ...DEFAULT_COMPOSER_CONFIG,
      cardWidthMm: 57,
      cardHeightMm: 89,
      bleedMm: 5,
      gapMm: 2,
      bleedMode: "compartilhada" as const,
    };
    const cards = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`,
      frontImageId: "x",
      backImageId: null,
      selected: true,
    }));
    const sheet = layoutSheets(cards, config)[0];
    for (const p of sheet?.placements ?? []) {
      expect(
        cutRectHitsRegistrationArea(p.cutRectMm, A4_W, A4_H, config.registrationWhiteBorderMm),
      ).toBe(false);
    }
  });

  it("centraliza uma carta sem reservar os outros sete espaços da grade", () => {
    const config = {
      ...DEFAULT_COMPOSER_CONFIG,
      cardWidthMm: 57,
      cardHeightMm: 89,
      bleedMm: 5,
      gapMm: 0,
      bleedMode: "compartilhada" as const,
    };
    const layouts = layoutSheets([
      { id: "c1", frontImageId: "i1", backImageId: null, selected: true },
    ], config);
    const placed = layouts[0]?.placements[0];
    expect(placed).toBeDefined();
    expect(placed?.cutRectMm.x0).toBeCloseTo((A4_W - config.cardWidthMm) / 2, 6);
    expect(placed?.cutRectMm.y0).toBeCloseTo((A4_H - config.cardHeightMm) / 2, 6);
    expect(cutRectHitsRegistrationMark(placed!.cutRectMm, A4_W, A4_H)).toBe(false);
  });
});

describe("O: frente e verso permanecem vinculados", () => {
  it("resolve o verso individual pela identidade da carta após reordenação", () => {
    const cards = [
      { id: "a", frontImageId: "front-a", backImageId: "back-a", selected: true },
      { id: "b", frontImageId: "front-b", backImageId: "back-b", selected: true },
    ];
    const reordered = [cards[1]!, cards[0]!];
    expect(backImageFor(reordered[0]!, DEFAULT_COMPOSER_CONFIG)).toBe("back-b");
    expect(backImageFor(reordered[1]!, DEFAULT_COMPOSER_CONFIG)).toBe("back-a");
  });
});

describe("H: respostas do registration", () => {
  it("somente quatro espacos, zero e ETX e sucesso", () => {
    expect(parseRegistrationResponse("    0\u0003")).toBe("success");
    expect(parseRegistrationResponse("    1\u0003")).toBe("in-progress");
    expect(parseRegistrationResponse("   -1\u0003")).toBe("failure");
    expect(parseRegistrationResponse("0\u0003")).toBe("protocol-error");
  });
});

describe("I/J: area de corte deduzida das cruzes", () => {
  it("carta 62x62 com cruzes resulta em 52x52", () => {
    const image = rect(100, 60, 162, 122);
    const segments = [...cross(105, 65), ...cross(157, 65), ...cross(105, 117), ...cross(157, 117)];
    const cut = cutRectForImage(image, crossCentersFromSegments(segments));
    expect(cut.x1 - cut.x0).toBeCloseTo(52, 6);
    expect(cut.y1 - cut.y0).toBeCloseTo(52, 6);
  });

  it("carta 52x52 com cruzes resulta em 44x44", () => {
    const image = rect(50, 50, 102, 102);
    const segments = [...cross(54, 54), ...cross(98, 54), ...cross(54, 98), ...cross(98, 98)];
    const cut = cutRectForImage(image, crossCentersFromSegments(segments));
    expect(cut.x1 - cut.x0).toBeCloseTo(44, 6);
    expect(cut.y1 - cut.y0).toBeCloseTo(44, 6);
  });
});

describe("K: agrupamento das imagens de carta", () => {
  it("ordena por Y e depois por X ignorando recursos avulsos", () => {
    const cards = dominantCardImages([
      rect(0, 0, 5, 5), rect(150, 40, 202, 92), rect(60, 40, 112, 92), rect(60, 100, 112, 152),
    ]);
    expect(cards.map((c) => [c.x0, c.y0])).toEqual([[60, 40], [150, 40], [60, 100]]);
  });
});

describe("L: remocao das cruzes do PDF final", () => {
  it("remove os bracos das cruzes e preserva a arte", () => {
    const pt = 72 / 25.4;
    const content = [
      "q", `1 0 0 1 ${(10 * pt).toFixed(3)} ${(10 * pt).toFixed(3)} cm`, "/Im0 Do", "Q",
      `${(100 * pt).toFixed(3)} ${(100 * pt).toFixed(3)} m ${(104 * pt).toFixed(3)} ${(100 * pt).toFixed(3)} l S`,
      `${(50 * pt).toFixed(3)} ${(50 * pt).toFixed(3)} m ${(200 * pt).toFixed(3)} ${(50 * pt).toFixed(3)} l S`,
    ].join("\n");
    const result = stripCropMarksFromContent(content);
    expect(result.removed).toBe(1);
    expect(result.content).toContain("/Im0");
    expect(result.content).toContain("Do");
    expect(result.content).toContain("566.929");
  });

  it("reconhece um braco de cruz de 4 mm", () => {
    expect(isCropMarkSegment({ x1: 10, y1: 10, x2: 14, y2: 10 })).toBe(true);
    expect(isCropMarkSegment({ x1: 10, y1: 10, x2: 30, y2: 10 })).toBe(false);
  });
});

describe("M: caso real validado no hardware", () => {
  it("carta de 52x52 mm com raio 3 mm fecha o caminho na origem das marcas", () => {
    const cut = rect(10, 10, 62, 62);
    const path = buildCutPath(cut, { radiusMm: 3, lineOvercut: false });
    expect(path[0]!.startsWith("M")).toBe(true);
    expect(path.every((command) => /^[MD]\d+,\d+$/.test(command))).toBe(true);
    const coords = path.map((command) => command.slice(1).split(",").map(Number));
    const ys = coords.map((c) => c[0]!);
    const xs = coords.map((c) => c[1]!);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...xs)).toBe(su(52));
    expect(Math.max(...ys)).toBe(su(52));
  });
});

describe("P: detector de tamanho de corte", () => {
  it("aprova quando cada corte sai no tamanho pedido", () => {
    const config = { ...DEFAULT_COMPOSER_CONFIG, cardWidthMm: 52, cardHeightMm: 52 };
    const cards = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, frontImageId: `i${i}`, backImageId: null, selected: true }));
    const audit = auditCutSizes(layoutSheets(cards, config), config);
    expect(audit.ok).toBe(true);
    expect(audit.checked).toBe(8);
    expect(audit.worstDeltaMm).toBeLessThanOrEqual(SIZE_TOLERANCE_MM);
  });

  it("reprova quando o tamanho pedido nao confere com o corte gerado", () => {
    const config = { ...DEFAULT_COMPOSER_CONFIG, cardWidthMm: 57, cardHeightMm: 89 };
    const layouts = layoutSheets([{ id: "c1", frontImageId: "i1", backImageId: null, selected: true }], config);
    const audit = auditCutSizes(layouts, { ...config, cardWidthMm: 60 });
    expect(audit.ok).toBe(false);
    expect(audit.issues.some((issue) => issue.level === "erro")).toBe(true);
  });
});

describe("Q: marcas de corte manual (guilhotina)", () => {
  const cards = Array.from({ length: 4 }, (_, i) => ({ id: `c${i}`, frontImageId: `i${i}`, backImageId: null, selected: true }));
  const manualConfig = { ...DEFAULT_COMPOSER_CONFIG, cardWidthMm: 57, cardHeightMm: 89, finishMode: "manual" as const, manualMarks: { ...DEFAULT_MANUAL_MARKS } };

  it("cada tipo de marca gera geometria dentro da folha", () => {
    const layout = layoutSheets(cards, manualConfig)[0]!;
    const cutRects = layout.placements.map((placed) => placed.cutRectMm);
    for (const type of ["cantos", "cruzes", "guias", "bordas", "contorno"] as const) {
      const marks = manualMarkRectsMm(cutRects, { ...DEFAULT_MANUAL_MARKS, types: [type] }, A4_LANDSCAPE_W_MM, A4_LANDSCAPE_H_MM);
      expect(marks.length).toBeGreaterThan(0);
      for (const mark of marks) {
        expect(mark.x0).toBeGreaterThanOrEqual(0); expect(mark.y0).toBeGreaterThanOrEqual(0);
        expect(mark.x1).toBeLessThanOrEqual(A4_LANDSCAPE_W_MM); expect(mark.y1).toBeLessThanOrEqual(A4_LANDSCAPE_H_MM);
      }
    }
  });

  it("modo Cameo nunca emite marcas manuais", () => {
    const layout = layoutSheets(cards, DEFAULT_COMPOSER_CONFIG)[0]!;
    expect(marksOnSide({ ...DEFAULT_MANUAL_MARKS, types: [] }, "front")).toBe(false);
    expect(DEFAULT_COMPOSER_CONFIG.finishMode).toBe("cameo");
    expect(layout.placements.length).toBeGreaterThan(0);
  });

  it("modo guilhotina aproveita mais espaco da folha", () => {
    const cameo = gridFor({ ...manualConfig, finishMode: "cameo" });
    const manual = gridFor(manualConfig);
    expect(manual.perSheet).toBeGreaterThanOrEqual(cameo.perSheet);
  });

  it("respeita a escolha de frente, verso ou ambos", () => {
    expect(marksOnSide({ ...DEFAULT_MANUAL_MARKS, sides: "frente" }, "back")).toBe(false);
    expect(marksOnSide({ ...DEFAULT_MANUAL_MARKS, sides: "verso" }, "back")).toBe(true);
    expect(marksOnSide({ ...DEFAULT_MANUAL_MARKS, sides: "ambos" }, "front")).toBe(true);
  });

  it("no modo manual a auditoria ignora as marcas do sensor", () => {
    const tight = { ...manualConfig, cardWidthMm: 90, cardHeightMm: 60, bleedMm: 0, gapMm: 0 };
    const audit = auditCutSizes(layoutSheets(cards, tight), tight);
    expect(audit.issues.some((issue) => issue.message.includes("marca do sensor"))).toBe(false);
  });
});

describe("R: receita de corte gravada no PDF gerado aqui", () => {
  const sheets: Sheet[] = [
    { number: 1, frontPageIndex: 0, backPageIndex: 1, pageWidthMm: A4_W, pageHeightMm: A4_H, rotated: false, cards: [{ id: "a", sheetNumber: 1, number: 1, cutRectMm: rect(20, 30, 77, 119), imageRectMm: rect(18.5, 28.5, 78.5, 120.5), selected: true, inSensorSafeZone: false, hitsRegistrationMark: false }] },
    { number: 2, frontPageIndex: 2, backPageIndex: 3, pageWidthMm: A4_W, pageHeightMm: A4_H, rotated: false, cards: [{ id: "b", sheetNumber: 2, number: 1, cutRectMm: rect(20.005, 30, 72.004, 82), imageRectMm: rect(19, 29, 73, 83), selected: true, inSensorSafeZone: true, hitsRegistrationMark: false }] },
  ];

  it("preserva as medidas de corte em 0,01 mm na ida e volta", () => {
    const decoded = decodeJobManifestString(encodeJobManifest(sheets, DEFAULT_PREFERENCES.settings));
    expect(decoded).not.toBeNull(); expect(decoded!.sheets).toHaveLength(2);
    for (const [index, sheet] of decoded!.sheets.entries()) {
      const original = sheets[index]!;
      expect(sheet.frontPageIndex).toBe(original.frontPageIndex); expect(sheet.backPageIndex).toBe(original.backPageIndex);
      for (const [cardIndex, card] of sheet.cards.entries()) {
        const source = original.cards[cardIndex]!;
        for (const key of ["x0", "y0", "x1", "y1"] as const) expect(Math.abs(card.cutRectMm[key] - source.cutRectMm[key])).toBeLessThanOrEqual(0.01);
      }
    }
  });

  it("restaura os parametros de material usados na geracao", () => {
    const decoded = decodeJobManifestString(encodeJobManifest(sheets, DEFAULT_PREFERENCES.settings));
    expect(decoded!.settings).toEqual(DEFAULT_PREFERENCES.settings);
  });

  it("preserva o aviso de area segura de cada carta", () => {
    const decoded = decodeJobManifestString(encodeJobManifest(sheets));
    expect(decoded!.sheets[0]!.cards[0]!.inSensorSafeZone).toBe(false);
    expect(decoded!.sheets[1]!.cards[0]!.inSensorSafeZone).toBe(true);
  });

  it("recusa um PDF sem receita, sem quebrar", () => {
    expect(decodeJobManifestString(null)).toBeNull(); expect(decodeJobManifestString("")).toBeNull();
    expect(decodeJobManifestString("outro programa qualquer")).toBeNull(); expect(decodeJobManifestString("PNPCAMEO1:###")).toBeNull();
  });

  it("preserva a receita gutterfold sem transformar a dobra em corte", () => {
    const sheet: Sheet = { number: 1, frontPageIndex: 0, backPageIndex: null, assemblyMode: "gutterfold", pageWidthMm: A4_W, pageHeightMm: A4_H, rotated: false, cards: [{ id: "g1", sheetNumber: 1, number: 1, cutRectMm: rect(20, 30, 138, 119), imageRectMm: rect(20, 30, 77, 119), frontRectMm: rect(20, 30, 77, 119), backRectMm: rect(81, 30, 138, 119), foldRectMm: rect(77, 30, 81, 119), selected: true, inSensorSafeZone: false, hitsRegistrationMark: false }] };
    const decoded = decodeJobManifestString(encodeJobManifest([sheet])); const restored = decoded!.sheets[0]!;
    expect(restored.assemblyMode).toBe("gutterfold"); expect(restored.backPageIndex).toBeNull();
    expect(restored.cards[0]!.cutRectMm).toEqual(sheet.cards[0]!.cutRectMm); expect(restored.cards[0]!.frontRectMm).toEqual(sheet.cards[0]!.frontRectMm);
    expect(restored.cards[0]!.backRectMm).toEqual(sheet.cards[0]!.backRectMm); expect(restored.cards[0]!.foldRectMm).toEqual(sheet.cards[0]!.foldRectMm);
  });
});

describe("S: trabalho do Montar cartas salvo no navegador", () => {
  it("save -> load restaura cartas, ordem, selecao e config", async () => {
    const config = { ...DEFAULT_COMPOSER_CONFIG, cardWidthMm: 63.5, cardHeightMm: 88, sharedBackImageId: "img-9" };
    const cards = [{ id: "c2", frontImageId: "img-2", backImageId: null, selected: false }, { id: "c1", frontImageId: "img-1", backImageId: "img-3", selected: true }];
    const images = [
      { id: "img-1", name: "a.png", mime: "image/png", bytes: new Uint8Array([1, 2]).buffer, widthPx: 10, heightPx: 10 },
      { id: "img-2", name: "b.png", mime: "image/png", bytes: new Uint8Array([3]).buffer, widthPx: 8, heightPx: 8 },
      { id: "img-3", name: "c.png", mime: "image/png", bytes: new Uint8Array([4]).buffer, widthPx: 8, heightPx: 8 },
      { id: "img-9", name: "verso.png", mime: "image/png", bytes: new Uint8Array([5]).buffer, widthPx: 8, heightPx: 8 },
    ];
    await saveComposerState({ images, cards, config, importMode: "pares" }); const loaded = await loadComposerState();
    expect(loaded).not.toBeNull(); expect(loaded!.cards.map((c) => c.id)).toEqual(["c2", "c1"]); expect(loaded!.cards[0]!.selected).toBe(false);
    expect(loaded!.cards[1]!.backImageId).toBe("img-3"); expect(loaded!.config.cardWidthMm).toBe(63.5); expect(loaded!.config.sharedBackImageId).toBe("img-9");
    expect(loaded!.importMode).toBe("pares"); expect(loaded!.images.map((i) => i.id)).toEqual(["img-1", "img-2", "img-3", "img-9"]); expect(new Uint8Array(loaded!.images[0]!.bytes)[0]).toBe(1);
  });

  it("clear remove o trabalho salvo e load sem dados retorna vazio", async () => { await clearComposerState(); expect(await loadComposerState()).toBeNull(); });
});

describe("T: ajuste de posicao do verso na impressao", () => {
  const cards = [{ id: "c1", frontImageId: "f1", backImageId: "b1", selected: true }, { id: "c2", frontImageId: "f2", backImageId: "b2", selected: true }];

  it("deslocamento zero mantem o verso exatamente espelhado", () => {
    const config = { ...DEFAULT_COMPOSER_CONFIG }; const placed = layoutSheets(cards, config)[0]!.placements[0]!;
    expect(backRect(placed.cutRectMm, config)).toEqual(mirrorRect(placed.cutRectMm));
  });

  it("deslocamento move o verso e nunca a frente nem o corte", () => {
    const base = { ...DEFAULT_COMPOSER_CONFIG }; const moved = { ...base, backOffsetXMm: 2.5, backOffsetYMm: -1.5 };
    const a = layoutSheets(cards, base)[0]!.placements[0]!; const b = layoutSheets(cards, moved)[0]!.placements[0]!;
    expect(b.cutRectMm).toEqual(a.cutRectMm); expect(b.imageRectMm).toEqual(a.imageRectMm);
    const mirrored = mirrorRect(a.cutRectMm); const shifted = backRect(a.cutRectMm, moved);
    expect(shifted.x0).toBeCloseTo(mirrored.x0 + 2.5, 6); expect(shifted.y0).toBeCloseTo(mirrored.y0 - 1.5, 6);
    expect(shifted.x1 - shifted.x0).toBeCloseTo(mirrored.x1 - mirrored.x0, 6); expect(shifted.y1 - shifted.y0).toBeCloseTo(mirrored.y1 - mirrored.y0, 6);
  });

  it("sangria visual do verso muda somente o enquadramento da imagem", () => {
    const base = { ...DEFAULT_COMPOSER_CONFIG, bleedMm: 5 }; const adjusted = { ...base, backBleedMm: 8 };
    const front = layoutSheets(cards, base)[0]!.placements[0]!; const placed = layoutSheets(cards, adjusted)[0]!.placements[0]!;
    const originalBack = backImageRect(placed, base); const adjustedBack = backImageRect(placed, adjusted);
    expect(effectiveBackBleedMm(base)).toBe(5); expect(effectiveBackBleedMm(adjusted)).toBe(8); expect(placed.cutRectMm).toEqual(front.cutRectMm); expect(placed.imageRectMm).toEqual(front.imageRectMm);
    expect(adjustedBack.x1 - adjustedBack.x0).toBeCloseTo(base.cardWidthMm + 16, 6); expect(adjustedBack.y1 - adjustedBack.y0).toBeCloseTo(base.cardHeightMm + 16, 6);
    expect(adjustedBack.x0).toBeCloseTo(originalBack.x0 - 3, 6); expect(adjustedBack.y0).toBeCloseTo(originalBack.y0 - 3, 6);
  });

  it("sangria do verso desligada preserva o clip espelhado antigo", () => {
    const config = { ...DEFAULT_COMPOSER_CONFIG, bleedMm: 0 }; const layout = requireValue(layoutSheets(cards, config)[0]); const placed = requireValue(layout.placements[0]); const backClip = backClipRect(placed, layout.placements, config);
    expect(effectiveBackExtraBleedMm(config)).toBe(0); expect(backClip).toEqual(backRect(placed.clipRectMm, config));
  });

  it("sangria do verso expande só o verso, sem mudar frente, grade ou corte", () => {
    const base = { ...DEFAULT_COMPOSER_CONFIG, bleedMm: 0, gapMm: 0 }; const oneCard = cards.slice(0, 1);
    const adjusted = { ...base, backExtraBleedMm: 3, backBleed: { ...base.backBleed, enabled: true } };
    const before = requireValue(layoutSheets(oneCard, base)[0]); const after = requireValue(layoutSheets(oneCard, adjusted)[0]);
    const beforePlaced = requireValue(before.placements[0]); const afterPlaced = requireValue(after.placements[0]);
    const baseClip = backClipRect(beforePlaced, before.placements, base); const extraClip = backClipRect(afterPlaced, after.placements, adjusted);
    expect(effectiveBackExtraBleedMm(adjusted)).toBe(3); expect(afterPlaced.cutRectMm).toEqual(beforePlaced.cutRectMm); expect(afterPlaced.imageRectMm).toEqual(beforePlaced.imageRectMm); expect(gridFor(adjusted)).toEqual(gridFor(base));
    expect(extraClip.x0).toBeLessThan(baseClip.x0); expect(extraClip.y0).toBeLessThan(baseClip.y0); expect(extraClip.x1).toBeGreaterThan(baseClip.x1); expect(extraClip.y1).toBeGreaterThan(baseClip.y1);
  });

  it("sangria do verso respeita cartas vizinhas e borda da folha", () => {
    const config = { ...DEFAULT_COMPOSER_CONFIG, bleedMm: 0, gapMm: 0, backExtraBleedMm: 6, backBleed: { ...DEFAULT_COMPOSER_CONFIG.backBleed, enabled: true } };
    const layout = requireValue(layoutSheets(cards, config)[0]); const first = requireValue(layout.placements[0]); const second = requireValue(layout.placements[1]);
    const firstClip = backClipRect(first, layout.placements, config); const secondClip = backClipRect(second, layout.placements, config);
    expect(firstClip.x0).toBeGreaterThanOrEqual(0); expect(firstClip.y0).toBeGreaterThanOrEqual(0); expect(firstClip.x1).toBeLessThanOrEqual(297); expect(firstClip.y1).toBeLessThanOrEqual(210); expect(firstClip.x0).toBeGreaterThanOrEqual(secondClip.x1);
  });

  it("assinatura da montagem muda quando a sangria do verso muda", () => { const base = { ...DEFAULT_COMPOSER_CONFIG, backExtraBleedMm: 2 }; const adjusted = { ...base, backExtraBleedMm: 4 }; expect(buildStampOf(cards, base, 3)).not.toBe(buildStampOf(cards, adjusted, 3)); });

  it("ordem, vinculo frente/verso e receita de corte nao mudam", () => {
    const moved = { ...DEFAULT_COMPOSER_CONFIG, backOffsetXMm: 3, backOffsetYMm: 3 }; const layout = layoutSheets(cards, moved)[0]!;
    expect(layout.placements.map((p) => p.card.id)).toEqual(["c1", "c2"]); expect(layout.placements.map((p) => backImageFor(p.card, moved))).toEqual(["b1", "b2"]);
    const sheets: Sheet[] = [{ number: 1, frontPageIndex: 0, backPageIndex: 1, pageWidthMm: 297, pageHeightMm: 210, rotated: false, cards: layout.placements.map((p) => ({ id: `s1-c${p.number}`, sheetNumber: 1, number: p.number, imageRectMm: p.imageRectMm, cutRectMm: p.cutRectMm, selected: true, inSensorSafeZone: false, hitsRegistrationMark: false })) }];
    const decoded = decodeJobManifestString(encodeJobManifest(sheets)); expect(decoded!.sheets[0]!.cards[0]!.cutRectMm).toEqual(layout.placements[0]!.cutRectMm);
  });

  it("avisa quando o ajuste joga o verso fora da folha", () => {
    const config = { ...DEFAULT_COMPOSER_CONFIG, cardWidthMm: 63.5, cardHeightMm: 190, backOffsetXMm: 10, backOffsetYMm: 10 };
    const layouts = layoutSheets(cards, config); const audit = auditCutSizes(layouts, config); expect(audit.ok).toBe(true); expect(audit.issues.some((i) => i.level === "aviso" && i.message.includes("ajuste do verso"))).toBe(true);
  });
});

describe("U: modo guilhotina mantem a grade alinhada", () => {
  const cards = Array.from({ length: 7 }, (_, i) => ({ id: `c${i + 1}`, frontImageId: `f${i + 1}`, backImageId: null, selected: true })); const base = { ...DEFAULT_COMPOSER_CONFIG, cardWidthMm: 52, cardHeightMm: 52 };
  it("colunas ficam alinhadas em X mesmo com a ultima fileira incompleta", () => { const config = { ...base, finishMode: "manual" as const }; const placements = layoutSheets(cards, config)[0]!.placements; const grid = gridFor(config); const xOf = (slot: number) => placements[slot]!.cutRectMm.x0; for (let slot = grid.columns; slot < placements.length; slot += 1) expect(xOf(slot)).toBeCloseTo(xOf(slot % grid.columns), 6); });
  it("no modo Cameo a ultima fileira continua centralizada", () => { const config = { ...base, finishMode: "cameo" as const }; const placements = layoutSheets(cards, config)[0]!.placements; const grid = gridFor(config); if (placements.length % grid.columns !== 0) expect(placements[grid.columns]!.cutRectMm.x0).not.toBeCloseTo(placements[0]!.cutRectMm.x0, 3); });
});

describe("V: cartas coladas descartam a sangria", () => {
  const cards = Array.from({ length: 8 }, (_, i) => ({ id: `c${i + 1}`, frontImageId: `f${i + 1}`, backImageId: null, selected: true })); const base = { ...DEFAULT_COMPOSER_CONFIG, cardWidthMm: 57, cardHeightMm: 89, bleedMm: 5, gapMm: 0 };
  it("as cartas ficam encostadas e no tamanho pedido", () => { const config = { ...base, bleedMode: "colada" as const }; const placements = layoutSheets(cards, config)[0]!.placements; const a = placements[0]!.cutRectMm; const b = placements[1]!.cutRectMm; expect(a.x1 - a.x0).toBeCloseTo(57, 6); expect(a.y1 - a.y0).toBeCloseTo(89, 6); expect(b.x0).toBeCloseTo(a.x1, 6); });
  it("a arte continua com sangria, mas o recorte cai na divisa", () => { const config = { ...base, bleedMode: "colada" as const }; const placed = layoutSheets(cards, config)[0]!.placements[0]!; expect(placed.imageRectMm.x1 - placed.imageRectMm.x0).toBeCloseTo(57 + 10, 6); expect(placed.clipRectMm.x0).toBeCloseTo(placed.cutRectMm.x0, 6); expect(placed.clipRectMm.x1).toBeCloseTo(placed.cutRectMm.x1, 6); });
  it("cabem mais cartas por folha do que na sangria compartilhada", () => { const gc = gridFor({ ...base, bleedMode: "colada" as const }); const gs = gridFor({ ...base, bleedMode: "compartilhada" as const }); expect(gc.columns * gc.rows).toBeGreaterThanOrEqual(gs.columns * gs.rows); });
  it("os outros modos nao mudam", () => { const placed = layoutSheets(cards, { ...base, bleedMode: "completa" as const })[0]!.placements[0]!; expect(placed.cutRectMm.x1 - placed.cutRectMm.x0).toBeCloseTo(57, 6); expect(placed.imageRectMm.x1 - placed.imageRectMm.x0).toBeCloseTo(57 + 10, 6); });
});

describe("W: grade da folha", () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}`, frontImageId: `f${i + 1}`, backImageId: null, selected: true })); const base = { ...DEFAULT_COMPOSER_CONFIG, cardWidthMm: 57, cardHeightMm: 89, bleedMm: 5 };
  it("grade manual e limitada ao que cabe", () => { const grid = gridFor({ ...base, gridMode: "manual", gridColumns: 99, gridRows: 99 }); expect(grid.columns).toBe(grid.maxColumns); expect(grid.rows).toBe(grid.maxRows); expect(grid.limited).toBe(true); });
  it("grade manual menor e respeitada", () => { const grid = gridFor({ ...base, gridMode: "manual", gridColumns: 2, gridRows: 1 }); expect(grid.columns).toBe(2); expect(grid.rows).toBe(1); expect(grid.limited).toBe(false); });
  it("modo Cameo nunca coloca corte sobre marca do sensor", () => { const config = { ...base, bleedMode: "colada" as const, gapMm: 0 }; for (const sheet of layoutSheets(mk(14), config)) for (const placed of sheet.placements) expect(cutRectHitsRegistrationArea(placed.cutRectMm, A4_LANDSCAPE_W_MM, A4_LANDSCAPE_H_MM, config.registrationWhiteBorderMm)).toBe(false); });
  it("modo guilhotina continua sem descartar espacos", () => { const grid = gridFor({ ...base, finishMode: "manual" as const }); expect(grid.blockedSlots).toBe(0); expect(grid.perSheet).toBe(grid.columns * grid.rows); });
});

describe("W. fatiador de folhas", () => {
  const cfg = (patch: Partial<SliceConfig> = {}) => normalizeSliceConfig({ ...DEFAULT_SLICE_CONFIG, columns: 4, rows: 5, ...patch });
  it("4x5 gera 20 recortes de tamanho identico", () => { const rects = sliceRects(800, 1000, cfg()); expect(rects).toHaveLength(20); for (const r of rects) { expect(r.width).toBe(200); expect(r.height).toBe(200); } });
  it("ordem de leitura: linha por linha, esquerda para direita", () => { const rects = sliceRects(800, 1000, cfg()); expect(rects[0]).toMatchObject({ row: 1, column: 1, x: 0, y: 0 }); expect(rects[1]!.x).toBeGreaterThan(rects[0]!.x); expect(rects[4]).toMatchObject({ row: 2, column: 1 }); expect(sliceFileName("folha 1.png", rects[4]!, "png")).toBe("folha 1_r2c1.png"); });
  it("margens assimetricas e espacos fecham exatamente com a imagem", () => { const config = cfg({ marginLeftPx: 10, marginRightPx: 30, marginTopPx: 20, marginBottomPx: 40, gutterXPx: 6, gutterYPx: 8 }); const rects = sliceRects(800, 1000, config); const last = rects[rects.length - 1]!; expect(last.x + last.width).toBe(800 - config.marginRightPx); expect(last.y + last.height).toBe(1000 - config.marginBottomPx); expect(rects[0]!.x).toBe(config.marginLeftPx); expect(rects[0]!.y).toBe(config.marginTopPx); });
  it("recortes nunca saem dos limites da imagem", () => { const config = cfg({ offsetXPx: 300, offsetYPx: -300, overshootPx: 120 }); for (const r of sliceRects(800, 1000, config)) { expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0); expect(r.x + r.width).toBeLessThanOrEqual(800); expect(r.y + r.height).toBeLessThanOrEqual(1000); } });
  it("sobra positiva amplia o recorte e negativa reduz", () => { const plus = sliceRects(800, 1000, cfg({ overshootPx: 5 })); const minus = sliceRects(800, 1000, cfg({ overshootPx: -5 })); expect(plus[5]!.width).toBe(210); expect(minus[5]!.width).toBe(190); });
  it("valores fora do limite sao normalizados", () => { const config = normalizeSliceConfig({ columns: 0, rows: 99, overshootPx: 9999 }); expect(config.columns).toBe(1); expect(config.rows).toBe(20); expect(config.overshootPx).toBe(200); expect(normalizeSliceConfig({ cornerFillCornerPercent: 9999 }).cornerFillCornerPercent).toBe(30); expect(normalizeSliceConfig({ cornerFillEdgePercent: 9999 }).cornerFillEdgePercent).toBe(10); expect(normalizeSliceConfig({ outputDpi: 200 as 300 }).outputDpi).toBe(300); expect(normalizeSliceConfig({ outputFormat: "gif" as "png" }).outputFormat).toBe("png"); });
  it("redimensiona proporcionalmente tomando 300 DPI como referencia", () => { expect(scaledSliceSize(600, 900, 150)).toEqual({ width: 300, height: 450 }); expect(scaledSliceSize(600, 900, 300)).toEqual({ width: 600, height: 900 }); expect(scaledSliceSize(600, 900, 600)).toEqual({ width: 1200, height: 1800 }); });
  it("preenche cantos e laterais apenas com pixels da propria carta", () => {
    const width = 30; const height = 40; const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) { const index = (y * width + x) * 4; const inCorner = (x < 8 || x >= width - 8) && (y < 8 || y >= height - 8); const centerX = x < 8 ? 7 : width - 8; const centerY = y < 8 ? 7 : height - 8; const corner = inCorner && Math.hypot(x - centerX, y - centerY) > 6; data[index] = corner ? 255 : 20; data[index + 1] = corner ? 255 : 80; data[index + 2] = corner ? 255 : 140; data[index + 3] = 255; }
    const original = { data: new Uint8ClampedArray(data), width, height, colorSpace: "srgb" } as ImageData; const result = fillCardEdges(original, { cornerPercent: 26.7, edgePercent: 3.4 }); const pixel = (x: number, y: number) => Array.from(result.data.slice((y * width + x) * 4, (y * width + x) * 4 + 3));
    expect(pixel(0, 0)).not.toEqual([255, 255, 255]); expect(pixel(width - 1, 0)).not.toEqual([255, 255, 255]); expect(pixel(0, height - 1)).not.toEqual([255, 255, 255]); expect(pixel(width - 1, height - 1)).not.toEqual([255, 255, 255]); expect(pixel(0, Math.floor(height / 2))).toEqual([20, 80, 140]); expect(pixel(Math.floor(width / 2), 0)).toEqual([20, 80, 140]); expect(pixel(Math.floor(width / 2), Math.floor(height / 2))).toEqual([20, 80, 140]); expect(Array.from(original.data.slice(0, 3))).toEqual([255, 255, 255]);
  });
  it("converte percentuais conforme o tamanho de cada carta", () => { expect(edgeFillPixels(100, 160, { cornerPercent: 8, edgePercent: 1 })).toEqual({ cornerPx: 8, edgePx: 1 }); expect(edgeFillPixels(1000, 1600, { cornerPercent: 8, edgePercent: 1 })).toEqual({ cornerPx: 80, edgePx: 10 }); });
  it("mantem a mascara dos cantos circular, sem formar um quadrado", () => {
    const width = 40; const height = 40; const data = new Uint8ClampedArray(width * height * 4); const radius = 10;
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) { const index = (y * width + x) * 4; const dx = x < radius ? radius - x : x >= width - radius ? x - (width - radius - 1) : 0; const dy = y < radius ? radius - y : y >= height - radius ? y - (height - radius - 1) : 0; const outsideRoundedCard = dx > 0 && dy > 0 && Math.hypot(dx, dy) > radius; data[index] = outsideRoundedCard ? 255 : 30; data[index + 1] = outsideRoundedCard ? 255 : 90; data[index + 2] = outsideRoundedCard ? 255 : 150; data[index + 3] = 255; }
    const protectedIndex = (9 * width + 9) * 4; data[protectedIndex] = 180; data[protectedIndex + 1] = 20; data[protectedIndex + 2] = 40; const original = { data, width, height, colorSpace: "srgb" } as ImageData; const result = fillCardEdges(original, { cornerPercent: 25, edgePercent: 0 }); const rgb = (x: number, y: number) => Array.from(result.data.slice((y * width + x) * 4, (y * width + x) * 4 + 3)); expect(rgb(0, 0)).not.toEqual([255, 255, 255]); expect(rgb(9, 9)).toEqual([180, 20, 40]); expect(rgb(20, 0)).toEqual([30, 90, 150]);
  });
  it("laterais funcionam mesmo com raio de canto minimo", () => {
    const width = 100; const height = 140; const data = new Uint8ClampedArray(width * height * 4).fill(255); for (let y = 5; y < height - 5; y += 1) for (let x = 5; x < width - 5; x += 1) { const index = (y * width + x) * 4; data[index] = 20; data[index + 1] = 80; data[index + 2] = 140; }
    const original = { data, width, height, colorSpace: "srgb" } as ImageData; const result = fillCardEdges(original, { cornerPercent: 0.1, edgePercent: 5 }); expect(Array.from(result.data.slice((70 * width) * 4, (70 * width) * 4 + 3))).toEqual([20, 80, 140]);
  });
});

describe("X. folha A3", () => {
  const base = { ...DEFAULT_COMPOSER_CONFIG, cardWidthMm: 57, cardHeightMm: 89, finishMode: "manual" as const };
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, frontImageId: `f${i}`, backImageId: null, selected: true }));
  it("A4 continua com o mesmo resultado de sempre", () => { expect(pageSizeMm({ ...base, paperSize: "a4" })).toEqual({ widthMm: 297, heightMm: 210 }); expect(gridFor({ ...base, paperSize: "a4" })).toEqual(gridFor(base)); });
  it("A3 na guilhotina rende mais cartas por folha", () => { const a4 = gridFor({ ...base, paperSize: "a4" }); const a3 = gridFor({ ...base, paperSize: "a3" }); expect(pageSizeMm({ ...base, paperSize: "a3" })).toEqual({ widthMm: 420, heightMm: 297 }); expect(a3.perSheet).toBeGreaterThan(a4.perSheet); });
  it("A3 nao vale na Cameo: cai para A4", () => { const cameo = { ...base, finishMode: "cameo" as const, paperSize: "a3" as const }; expect(paperAllowed("a3", "cameo")).toBe(false); expect(pageSizeMm(cameo)).toEqual({ widthMm: 297, heightMm: 210 }); expect(gridFor(cameo)).toEqual(gridFor({ ...cameo, paperSize: "a4" })); });
  it("cartas em A3 ficam dentro da folha e no tamanho pedido", () => { const config = { ...base, paperSize: "a3" as const }; const layouts = layoutSheets(mk(12), config); expect(layouts.length).toBeGreaterThan(0); for (const sheet of layouts) for (const placed of sheet.placements) { expect(placed.cutRectMm.x0).toBeGreaterThanOrEqual(0); expect(placed.cutRectMm.y0).toBeGreaterThanOrEqual(0); expect(placed.cutRectMm.x1).toBeLessThanOrEqual(420); expect(placed.cutRectMm.y1).toBeLessThanOrEqual(297); expect(placed.cutRectMm.x1 - placed.cutRectMm.x0).toBeCloseTo(57, 6); expect(placed.cutRectMm.y1 - placed.cutRectMm.y0).toBeCloseTo(89, 6); } expect(auditCutSizes(layouts, config).ok).toBe(true); });
});

describe("Y. gutterfold", () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `g${i + 1}`, frontImageId: `f${i + 1}`, backImageId: `b${i + 1}`, selected: true }));
  const base = { ...DEFAULT_COMPOSER_CONFIG, finishMode: "manual" as const, assemblyMode: "gutterfold" as const, cardWidthMm: 57, cardHeightMm: 89, gutterfoldGapMm: 4 };
  it("cada peça aberta tem duas cartas mais a canaleta", () => { const placed = layoutSheets(mk(1), base)[0]!.placements[0]!; expect(cutWidthFor(base)).toBe(118); expect(placed.cutRectMm.x1 - placed.cutRectMm.x0).toBeCloseTo(118, 6); expect(placed.cutRectMm.y1 - placed.cutRectMm.y0).toBeCloseTo(89, 6); expect(frontFaceRect(placed).x1 - frontFaceRect(placed).x0).toBeCloseTo(57, 6); expect(backFaceRect(placed, base).x1 - backFaceRect(placed, base).x0).toBeCloseTo(57, 6); expect(placed.gutterRectMm!.x1 - placed.gutterRectMm!.x0).toBeCloseTo(4, 6); expect(auditCutSizes(layoutSheets(mk(3), base), base).ok).toBe(true); });
  it("funciona em guilhotina, Cameo e Cricut sem mudar o tamanho aberto", () => { for (const finishMode of ["manual", "cameo", "cricut"] as const) { const config = { ...base, finishMode, paperSize: "a4" as const, orientation: finishMode === "cricut" ? "retrato" as const : "paisagem" as const }; const placed = layoutSheets(mk(1), config)[0]!.placements[0]!; expect(placed.cutRectMm.x1 - placed.cutRectMm.x0).toBeCloseTo(cutWidthFor(config), 6); expect(placed.cutRectMm.y1 - placed.cutRectMm.y0).toBeCloseTo(config.cardHeightMm, 6); } });
  it("centraliza as artes nas duas metades sem imprimir sobre a canaleta", () => { const config = { ...base, bleedMm: 6, gapMm: 0, backExtraBleedMm: 8, backBleed: { ...DEFAULT_COMPOSER_CONFIG.backBleed, enabled: true } }; const placed = layoutSheets(mk(1), config)[0]!.placements[0]!; const front = frontFaceRect(placed); const back = backFaceRect(placed, config); const frontImage = placed.imageRectMm; const backImage = backImageRect(placed, config); expect((frontImage.x0 + frontImage.x1) / 2).toBeCloseTo((front.x0 + front.x1) / 2, 6); expect((backImage.x0 + backImage.x1) / 2).toBeCloseTo((back.x0 + back.x1) / 2, 6); expect(placed.clipRectMm.x1).toBeCloseTo(placed.gutterRectMm!.x0, 6); expect(placed.backClipRectMm!.x0).toBeCloseTo(placed.gutterRectMm!.x1, 6); });
  it("mantém as artes centralizadas mesmo com canaleta zero", () => { const config = { ...base, gutterfoldGapMm: 0, bleedMm: 3 }; const placed = layoutSheets(mk(1), config)[0]!.placements[0]!; const front = frontFaceRect(placed); const back = backFaceRect(placed, config); const backImage = backImageRect(placed, config); expect((placed.imageRectMm.x0 + placed.imageRectMm.x1) / 2).toBeCloseTo((front.x0 + front.x1) / 2, 6); expect((backImage.x0 + backImage.x1) / 2).toBeCloseTo((back.x0 + back.x1) / 2, 6); expect(placed.gutterRectMm!.x0).toBeCloseTo(placed.gutterRectMm!.x1, 6); });
  it("o bridge e os exportadores usam só o contorno externo", () => { const layout = layoutSheets(mk(1), base)[0]!; const placed = layout.placements[0]!; const jobRects = layout.placements.map((card) => card.cutRectMm); const exportSheets = exportSheetsFrom([layout], pageSizeMm(base)); expect(jobRects).toEqual([placed.cutRectMm]); expect(exportSheets[0]!.rects).toEqual([placed.cutRectMm]); expect(exportSheets[0]!.rects).not.toContain(placed.gutterRectMm); });
});
