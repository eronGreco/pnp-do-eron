import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  REG_INSET_MM,
  REG_THICKNESS_MM,
  buildCutPath,
  registrationShapesMm,
  registrationSpacingMm,
  registrationTb123,
  registrationTb51,
} from "@/cut/geometry";
import { pageSizeMm } from "@/composer/paperSizes";
import { DEFAULT_COMPOSER_CONFIG, type ComposerCard, type ComposerConfig, type ComposerImage } from "@/composer/types";
import { buildSheetPdf, planPageOrder } from "@/composer/buildSheetPdf";
import { pageImageNames } from "@/composer/exportPageImages";
import { decodeJobManifestString } from "@/pdf/jobManifest";
import { detectCricutMarks, type PixelSource } from "@/cricut/detectMarks";
import type { Sheet } from "@/cameo/types";

describe("Cameo: marca em L de 1 mm (invariantes, sem mudar geometria validada)", () => {
  const shapes = registrationShapesMm(297, 210);
  it("borda externa das marcas fica exatamente no recuo de 10 mm", () => {
    const [square, trH, trV, blH, blV] = shapes;
    expect(square!.x0).toBe(REG_INSET_MM);
    expect(square!.y0).toBe(REG_INSET_MM);
    expect(trH!.x1).toBe(297 - REG_INSET_MM);
    expect(trH!.y0).toBe(REG_INSET_MM);
    expect(trV!.x1).toBe(297 - REG_INSET_MM);
    expect(blH!.y1).toBe(210 - REG_INSET_MM);
    expect(blV!.x0).toBe(REG_INSET_MM);
  });
  it("espessura é 1 mm e cresce para dentro (não centrada na linha)", () => {
    expect(REG_THICKNESS_MM).toBe(1);
    const [, trH, trV] = shapes;
    expect(trH!.y1 - trH!.y0).toBe(1);
    expect(trV!.x1 - trV!.x0).toBe(1);
    expect(trV!.x0).toBe(297 - REG_INSET_MM - 1);
  });
  it("distância TB123 = borda externa a borda externa e protocolo congelado", () => {
    const sp = registrationSpacingMm({ widthMm: 297, heightMm: 210 });
    expect(sp).toEqual({ xMm: shapes[1]!.x1 - shapes[0]!.x0, yMm: shapes[3]!.y1 - shapes[0]!.y0 });
    expect(registrationTb123({ widthMm: 297, heightMm: 210 })).toBe("TB123,3800,5540,118,118");
    expect(registrationTb51()).toBe("TB51,200");
  });
  it("origem do corte é o canto externo da marca superior esquerda (sem 0,5 mm)", () => {
    const path = buildCutPath({ x0: 10, y0: 10, x1: 20, y1: 20 }, { radiusMm: 0 });
    expect(path[0]).toBe("M0,0");
  });
});

describe("Polaseal A4: orientação", () => {
  const base = { ...DEFAULT_COMPOSER_CONFIG, paperSize: "polaseal" as const, finishMode: "manual" as const };
  it("Paisagem = deitada 307 × 220", () => {
    expect(pageSizeMm({ ...base, orientation: "paisagem" })).toEqual({ widthMm: 307, heightMm: 220 });
  });
  it("Retrato = em pé 220 × 307", () => {
    expect(pageSizeMm({ ...base, orientation: "retrato" })).toEqual({ widthMm: 220, heightMm: 307 });
  });
});

function sheet(n: number, f: number, b: number | null): Sheet {
  return { number: n, frontPageIndex: f, backPageIndex: b, pageWidthMm: 297, pageHeightMm: 210, cards: [], rotated: false };
}

describe("Organização das páginas", () => {
  const sheets = [sheet(1, 0, 1), sheet(2, 2, 3), sheet(3, 4, 5)];
  it("intercalado mantém F V F V", () => {
    const p = planPageOrder(sheets, true, "intercalado");
    expect(p.sourceIndexes).toEqual([0, 1, 2, 3, 4, 5]);
    expect(p.sheets.map((s) => [s.frontPageIndex, s.backPageIndex])).toEqual([[0, 1], [2, 3], [4, 5]]);
  });
  it("sem nenhum verso, não cria páginas de verso vazias", () => {
    const p = planPageOrder(sheets, false, "intercalado");
    expect(p.sourceIndexes).toEqual([0, 2, 4]);
    expect(p.sheets.every((s) => s.backPageIndex === null)).toBe(true);
  });
  it("somente frentes / somente versos", () => {
    expect(planPageOrder(sheets, true, "frentes").sourceIndexes).toEqual([0, 2, 4]);
    const v = planPageOrder(sheets, true, "versos");
    expect(v.sourceIndexes).toEqual([1, 3, 5]);
    expect(v.sheets.map((s) => [s.frontPageIndex, s.backPageIndex])).toEqual([[null, 0], [null, 1], [null, 2]]);
  });
  it("somente versos sem verso vira só frentes com aviso", () => {
    const p = planPageOrder(sheets, false, "versos");
    expect(p.sourceIndexes).toEqual([0, 2, 4]);
    expect(p.warnings.length).toBe(1);
  });
  it("frentes primeiro, depois versos", () => {
    const p = planPageOrder(sheets, true, "frentes-depois-versos");
    expect(p.sourceIndexes).toEqual([0, 2, 4, 1, 3, 5]);
    expect(p.sheets.map((s) => [s.frontPageIndex, s.backPageIndex])).toEqual([[0, 3], [1, 4], [2, 5]]);
  });
  it("nomes das imagens dizem folha e lado", () => {
    const p = planPageOrder(sheets, true, "frentes-depois-versos");
    expect(pageImageNames(p.sheets, 6)[3]).toBe("4 - folha 1 - verso.png");
  });
});

// PNG 1x1 branco.
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC"),
  (c) => c.charCodeAt(0),
);
const image = (id: string): ComposerImage =>
  ({ id, name: `${id}.png`, mime: "image/png", bytes: PNG.buffer.slice(0), widthPx: 1, heightPx: 1 }) as unknown as ComposerImage;

describe("buildSheetPdf: páginas reais", () => {
  const config: ComposerConfig = { ...DEFAULT_COMPOSER_CONFIG, finishMode: "manual", cardWidthMm: 63, cardHeightMm: 88 };
  const cards = (n: number, withBack: boolean): ComposerCard[] =>
    Array.from({ length: n }, (_, i) => ({ id: `c${i}`, frontImageId: "f", backImageId: withBack ? "b" : null, selected: true }));
  const pages = async (bytes: ArrayBuffer) => (await PDFDocument.load(bytes)).getPageCount();

  it("sem verso: nenhuma página em branco intercalada", async () => {
    const out = await buildSheetPdf(cards(12, false), [image("f")], config);
    expect(out.sheets.length).toBeGreaterThan(1);
    expect(await pages(out.bytes)).toBe(out.sheets.length);
  });
  it("guilhotina com marcas só no verso mantém a página de verso mesmo sem arte", async () => {
    const out = await buildSheetPdf(cards(12, false), [image("f")], {
      ...config,
      manualMarks: { ...config.manualMarks, sides: "verso" },
    });
    expect(await pages(out.bytes)).toBe(out.sheets.length * 2);
    expect(out.sheets.every((s) => s.backPageIndex !== null)).toBe(true);
  });
  it("verso compartilhado conta como verso efetivo", async () => {
    const out = await buildSheetPdf(cards(4, false), [image("f"), image("b")], { ...config, sharedBackImageId: "b" });
    expect(await pages(out.bytes)).toBe(out.sheets.length * 2);
  });
  it("frentes depois versos: manifest bate com as páginas", async () => {
    const out = await buildSheetPdf(cards(12, true), [image("f"), image("b")], { ...config, pageOrder: "frentes-depois-versos" });
    const n = out.sheets.length;
    expect(await pages(out.bytes)).toBe(n * 2);
    expect(out.sheets.map((s) => s.frontPageIndex)).toEqual(Array.from({ length: n }, (_, i) => i));
    expect(out.sheets.map((s) => s.backPageIndex)).toEqual(Array.from({ length: n }, (_, i) => n + i));
    const doc = await PDFDocument.load(out.bytes);
    const manifest = decodeJobManifestString(doc.getKeywords());
    expect(manifest?.sheets.map((s) => s.backPageIndex)).toEqual(out.sheets.map((s) => s.backPageIndex));
  });
});

/** Página A4 retrato sintética, 4 px/mm. */
function canvas(wMm: number, hMm: number, pxPerMm: number) {
  const width = Math.round(wMm * pxPerMm);
  const height = Math.round(hMm * pxPerMm);
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const fill = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = Math.round(y0 * pxPerMm); y < Math.round(y1 * pxPerMm); y += 1)
      for (let x = Math.round(x0 * pxPerMm); x < Math.round(x1 * pxPerMm); x += 1) {
        const o = (y * width + x) * 4;
        data[o] = 0; data[o + 1] = 0; data[o + 2] = 0;
      }
  };
  return { source: { width, height, data } as PixelSource, fill };
}

function drawL(fill: (a: number, b: number, c: number, d: number) => void, x: number, y: number, corner: "TL" | "TR" | "BL" | "BR", arm = 20, t = 1) {
  const hx = corner === "TL" || corner === "BL" ? x : x - arm;
  const vx = corner === "TL" || corner === "BL" ? x : x - t;
  const hy = corner === "TL" || corner === "TR" ? y : y - t;
  const vy = corner === "TL" || corner === "TR" ? y : y - arm;
  fill(hx, hy, hx + arm, hy + t);
  fill(vx, vy, vx + t, vy + arm);
}

describe("Cricut: marcas internas no A4 retrato", () => {
  it("acha 4 cantos longe dos cantos físicos sem confundir os blocos pretos", () => {
    const px = 4;
    const { source, fill } = canvas(210, 297, px);
    // Retângulo de registro bem para dentro (cantos > 45 mm dos cantos da folha).
    drawL(fill, 50, 50, "TL");
    drawL(fill, 160, 50, "TR");
    drawL(fill, 50, 240, "BL");
    drawL(fill, 160, 240, "BR");
    // Blocos pretos grandes de carta.
    fill(55, 55, 103, 120);
    fill(107, 55, 155, 120);
    fill(55, 125, 103, 190);
    const result = detectCricutMarks(source, px);
    expect(result.corners.sort()).toEqual(["BL", "BR", "TL", "TR"]);
    expect(result.design).not.toBeNull();
    expect(result.design!.x0).toBeCloseTo(55, 0);
    expect(result.design!.y0).toBeCloseTo(55, 0);
    expect(result.design!.x1).toBeCloseTo(155, 0);
    expect(result.design!.y1).toBeCloseTo(190, 0);
  });
  it("continua lendo marcas nos cantos físicos com quadrado cheio", () => {
    const px = 4;
    const { source, fill } = canvas(210, 297, px);
    fill(10, 10, 16, 16);
    drawL(fill, 200, 10, "TR");
    drawL(fill, 10, 287, "BL");
    drawL(fill, 200, 287, "BR");
    fill(30, 30, 180, 260);
    const result = detectCricutMarks(source, px);
    expect(result.corners.length).toBe(4);
    expect(result.design!.x0).toBeCloseTo(30, 0);
  });
});

import { jobHasBackContent, marksPassWarning } from "@/composer/pageOrderChecks";
import { registrationPageIndex } from "@/cameo/registrationPage";

describe("Cricut: padrão medido no PDF real do usuário (A4 retrato, 144 DPI)", () => {
  it("3 L ligados + TL com braços soltos + 6 blocos pretos", () => {
    const px = 144 / 25.4;
    const width = 1191;
    const height = 1684;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    const fill = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = y0; y < y1; y += 1)
        for (let x = x0; x < x1; x += 1) {
          const o = (y * width + x) * 4;
          data[o] = 0; data[o + 1] = 0; data[o + 2] = 0;
        }
    };
    const t = 9;
    // TR ligado: 960..1103 × 84..228
    fill(960, 84, 1103, 84 + t); fill(1103 - t, 84, 1103, 228);
    // BL ligado: 72..216 × 853..997
    fill(72, 997 - t, 216, 997); fill(72, 853, 72 + t, 997);
    // BR ligado: 960..1103 × 853..997
    fill(960, 997 - t, 1103, 997); fill(1103 - t, 853, 1103, 997);
    // TL com braços soltos.
    fill(89, 84, 216, 93);
    fill(72, 101, 81, 228);
    // 6 blocos de carta 233 × 357.
    const xs = [130, 368, 606];
    const ys = [120, 480];
    for (const x of xs) for (const y of ys) fill(x, y, x + 233, y + 357);
    const result = detectCricutMarks({ width, height, data }, px);
    expect(result.corners).toEqual(expect.arrayContaining(["TR", "BL", "BR"]));
    expect(result.corners).toContain("TL");
    // Nenhum bloco de carta virou marca.
    for (const c of result.components) expect((c.bounds.x1Px - c.bounds.x0Px) / px).toBeLessThan(30);
    expect(result.design).not.toBeNull();
    expect(result.design!.x0 * px).toBeCloseTo(130, -1);
    expect(result.design!.y0 * px).toBeCloseTo(120, -1);
    expect(result.design!.x1 * px).toBeCloseTo(839, -1);
    expect(result.design!.y1 * px).toBeCloseTo(837, -1);
  });
});

describe("Verso efetivo e lado das marcas", () => {
  const base: ComposerConfig = { ...DEFAULT_COMPOSER_CONFIG, finishMode: "manual", manualMarks: { ...DEFAULT_COMPOSER_CONFIG.manualMarks, sides: "frente" } };
  const card = (back: string | null, selected = true): ComposerCard => ({ id: "x", frontImageId: "f", backImageId: back, selected });
  it("carta desmarcada continua na montagem e conta verso (seleção é só para cortar)", () => {
    expect(jobHasBackContent([card(null), card("b", false)], base)).toBe(true);
    expect(jobHasBackContent([card(null)], base)).toBe(false);
    // Guilhotina com marcas "ambos" (padrão) e sem arte de verso: sem verso.
    expect(jobHasBackContent([card(null)], { ...base, manualMarks: { ...base.manualMarks, sides: "ambos" } })).toBe(false);
    // Guilhotina com marcas "só no verso" e sem arte de verso: o verso é
    // necessário, pois é o único lado com as marcas pedidas.
    expect(jobHasBackContent([card(null)], { ...base, manualMarks: { ...base.manualMarks, sides: "verso" } })).toBe(true);
    expect(jobHasBackContent([card(null)], { ...base, finishMode: "cameo", cameoRegistrationSide: "back" })).toBe(true);
    expect(jobHasBackContent([card(null)], { ...base, sharedBackImageId: "b" })).toBe(true);
    expect(jobHasBackContent([card("b")], { ...base, assemblyMode: "gutterfold" })).toBe(false);
  });
  it("avisa quando o modo de páginas tira o lado das marcas", () => {
    expect(marksPassWarning({ ...base, finishMode: "cameo", cameoRegistrationSide: "back", pageOrder: "frentes" })).toMatch(/não inclui o verso.*Silhouette/);
    expect(marksPassWarning({ ...base, finishMode: "cameo", cameoRegistrationSide: "front", pageOrder: "frentes" })).toBeNull();
    expect(marksPassWarning({ ...base, pageOrder: "versos" })).toMatch(/não inclui a frente/);
    expect(marksPassWarning({ ...base, manualMarks: { ...base.manualMarks, sides: "ambos" }, pageOrder: "versos" })).toBeNull();
    expect(marksPassWarning({ ...base, finishMode: "cricut", pageOrder: "versos" })).toMatch(/Cricut/);
    expect(marksPassWarning({ ...base, pageOrder: "intercalado" })).toBeNull();
  });
  it("página das marcas para o corte nunca cai no lado errado", () => {
    const s = (f: number | null, b: number | null, side: "front" | "back"): Sheet => ({ ...sheet(1, 0, null), frontPageIndex: f, backPageIndex: b, registrationSide: side });
    expect(registrationPageIndex(s(0, null, "back"))).toBeNull();
    expect(registrationPageIndex(s(null, 0, "front"))).toBeNull();
    expect(registrationPageIndex(s(null, 2, "back"))).toBe(2);
    expect(registrationPageIndex(s(1, 4, "front"))).toBe(1);
  });
});
