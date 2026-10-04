import { describe, expect, it } from "vitest";
import { DEFAULT_COMPOSER_CONFIG } from "@/composer/types";
import { cricutPrintThenCutLimitMm, gridFor, layoutSheets } from "@/composer/layoutSheets";
import { pageSizeMm } from "@/composer/paperSizes";
import { cricutExportFiles, exportSheetsFrom, toDxf, toSvg } from "@/export/cutVectors";

const mk = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, frontImageId: `f${i}`, backImageId: null, selected: true }));

describe("cartas coladas: sangria só no contorno externo", () => {
  const config = { ...DEFAULT_COMPOSER_CONFIG, finishMode: "manual" as const, cardWidthMm: 63, cardHeightMm: 88, bleedMm: 3, bleedMode: "colada" as const, gapMm: 0 };
  it("divisas internas 0 mm, perímetro com bleedMm", () => {
    const p = layoutSheets(mk(2), config)[0]!.placements;
    const [a, b] = [p[0]!, p[1]!];
    expect(b.cutRectMm.x0).toBeCloseTo(a.cutRectMm.x1, 6);
    expect(a.clipRectMm.x1).toBeCloseTo(a.cutRectMm.x1, 6);
    expect(b.clipRectMm.x0).toBeCloseTo(b.cutRectMm.x0, 6);
    expect(a.cutRectMm.x0 - a.clipRectMm.x0).toBeCloseTo(3, 6);
    expect(b.clipRectMm.x1 - b.cutRectMm.x1).toBeCloseTo(3, 6);
    expect(a.cutRectMm.y0 - a.clipRectMm.y0).toBeCloseTo(3, 6);
    expect(a.clipRectMm.y1 - a.cutRectMm.y1).toBeCloseTo(3, 6);
  });
});

describe("gutterfold carta por carta: direção", () => {
  const base = { ...DEFAULT_COMPOSER_CONFIG, finishMode: "manual" as const, assemblyMode: "gutterfold" as const, gutterfoldLayout: "piece" as const, cardWidthMm: 57, cardHeightMm: 89, gutterfoldGapMm: 0, bleedMm: 2 };
  it("vertical: lado a lado, gap 0 encostado", () => {
    const p = layoutSheets(mk(1), { ...base, gutterfoldDirection: "vertical" })[0]!.placements[0]!;
    expect(p.frontRectMm!.x1).toBeCloseTo(p.backRectMm!.x0, 6);
    expect(p.cutRectMm.x1 - p.cutRectMm.x0).toBeCloseTo(114, 6);
    expect(p.backRotationDeg).toBe(0);
    expect(p.clipRectMm.x1).toBeCloseTo(p.frontRectMm!.x1, 6);
  });
  it("horizontal: empilhado, verso 180°, gap 0 encostado", () => {
    const p = layoutSheets(mk(1), { ...base, gutterfoldDirection: "horizontal" })[0]!.placements[0]!;
    expect(p.frontRectMm!.y1).toBeCloseTo(p.backRectMm!.y0, 6);
    expect(p.cutRectMm.y1 - p.cutRectMm.y0).toBeCloseTo(178, 6);
    expect(p.backRotationDeg).toBe(180);
    expect(p.foldDirection).toBe("horizontal");
    expect(p.clipRectMm.y1).toBeCloseTo(p.frontRectMm!.y1, 6);
    expect(p.backClipRectMm!.y0).toBeCloseTo(p.backRectMm!.y0, 6);
  });
  it("horizontal com canaleta 4 mm", () => {
    const p = layoutSheets(mk(1), { ...base, gutterfoldGapMm: 4, gutterfoldDirection: "horizontal" })[0]!.placements[0]!;
    expect(p.backRectMm!.y0 - p.frontRectMm!.y1).toBeCloseTo(4, 6);
  });
  it("automática escolhe a que cabe mais, empate fica vertical", () => {
    const auto = gridFor({ ...base, gutterfoldDirection: "auto" }).perSheet;
    const v = gridFor({ ...base, gutterfoldDirection: "vertical" }).perSheet;
    const h = gridFor({ ...base, gutterfoldDirection: "horizontal" }).perSheet;
    expect(auto).toBe(Math.max(v, h));
  });
  it("SVG/DXF genéricos têm VINCO separado; Cricut não", () => {
    for (const dir of ["vertical", "horizontal"] as const) {
      const cfg = { ...base, gutterfoldDirection: dir };
      const sheets = exportSheetsFrom(layoutSheets(mk(2), cfg), pageSizeMm(cfg));
      expect(sheets[0]!.folds).toHaveLength(2);
      expect(toSvg(sheets[0]!, 0)).toContain('id="VINCO"');
      expect(toSvg(sheets[0]!, 0)).toContain('id="CORTE"');
      expect(toDxf(sheets[0]!, 0)).toContain("VINCO");
      expect(cricutExportFiles(sheets, 0)[0]!.text).not.toContain("VINCO");
    }
  });
  it("folha inteira exporta uma dobra única", () => {
    const cfg = { ...base, gutterfoldLayout: "sheet" as const, gutterfoldDirection: "horizontal" as const };
    const sheets = exportSheetsFrom(layoutSheets(mk(3), cfg), pageSizeMm(cfg));
    expect(sheets[0]!.folds).toHaveLength(1);
  });
});

describe("Cricut: limite do Print Then Cut", () => {
  const poker = { ...DEFAULT_COMPOSER_CONFIG, finishMode: "cricut" as const, paperSize: "a4" as const, orientation: "retrato" as const, cardWidthMm: 63.5, cardHeightMm: 88.9, bleedMode: "colada" as const, packingPolicy: "colado" as const, gapMm: 0 };
  it("poker A4 retrato: no máximo 2x3", () => {
    const g = gridFor(poker);
    expect(g.columns).toBe(2);
    expect(g.rows).toBe(3);
    expect(g.perSheet).toBe(6);
    expect(g.cricutCapped).toBe(true);
  });
  it("8 cartas viram 6 + 2", () => {
    expect(layoutSheets(mk(8), poker).map((s) => s.placements.length)).toEqual([6, 2]);
  });
  it("A4 paisagem NÃO troca os eixos: horizontal nunca passa de 183 mm", () => {
    const paisagem = { ...poker, orientation: "paisagem" as const };
    expect(cricutPrintThenCutLimitMm(paisagem)).toEqual({ widthMm: 183, heightMm: 269.8 });
    const g = gridFor(paisagem);
    // 3 colunas de poker coladas dariam ~190,5 mm na horizontal: deve ser recusado.
    expect(g.columns).toBeLessThanOrEqual(2);
    expect(g.cricutCapped).toBe(true);
  });
  it("SVG Cricut mantém a âncora com nome explícito", () => {
    const sheets = exportSheetsFrom(layoutSheets(mk(1), poker), pageSizeMm(poker));
    const svg = cricutExportFiles(sheets, 3)[0]!.text;
    expect(svg).toContain('id="APAGAR-ANTES-DO-PRINT-THEN-CUT"');
    expect(svg).toMatch(/id="folha-referencia-tamanho"[^>]*fill="none" stroke="none"/);
    expect(svg).not.toContain("viewBox");
  });
});
