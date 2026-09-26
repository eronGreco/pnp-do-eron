import { describe, expect, it } from "vitest";

import {
  clampCustomMm,
  orientationAllowed,
  pageSizeMm,
  paperAllowed,
} from "@/composer/paperSizes";
import { registrationSpacingMm, registrationTb123 } from "@/cut/geometry";
import { cutWidthFor, layoutSheets } from "@/composer/layoutSheets";
import { markCoverage } from "@/composer/markCoverage";
import { DEFAULT_COMPOSER_CONFIG, type ComposerCard, type ComposerConfig } from "@/composer/types";
import { cutExportFiles, exportSheetsFrom, toDxf, toSvg } from "@/export/cutVectors";

function cards(count: number): ComposerCard[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `c${index}`,
    frontImageId: "img",
    backImageId: null,
    selected: true,
  }));
}

const base: ComposerConfig = { ...DEFAULT_COMPOSER_CONFIG };

describe("folha personalizada", () => {
  it("limita a folha entre 50 e 1000 mm", () => {
    expect(clampCustomMm(10)).toBe(50);
    expect(clampCustomMm(5000)).toBe(1000);
    expect(clampCustomMm(330)).toBe(330);
  });

  it("libera na guilhotina e só com aviso aceito na Cameo", () => {
    expect(paperAllowed("custom", "manual")).toBe(true);
    expect(paperAllowed("a3", "manual")).toBe(true);
    expect(paperAllowed("custom", "cameo")).toBe(false);
    expect(paperAllowed("custom", "cameo", true)).toBe(true);
    expect(orientationAllowed("retrato", "cameo")).toBe(false);
  });

  it("usa a medida escolhida e cabe mais carta em folha grande", () => {
    const custom: ComposerConfig = {
      ...base,
      finishMode: "manual",
      paperSize: "custom",
      customWidthMm: 420,
      customHeightMm: 594,
    };
    expect(pageSizeMm(custom)).toEqual({ widthMm: 420, heightMm: 594 });
    expect(layoutSheets(cards(30), custom).length).toBeLessThan(layoutSheets(cards(30), { ...base, finishMode: "manual" }).length);
  });
});

describe("marcas do sensor", () => {
  it("em A4 deitada o comando de leitura é o congelado", () => {
    expect(registrationSpacingMm({ widthMm: 297, heightMm: 210 })).toEqual({
      xMm: 277,
      yMm: 190,
    });
    expect(registrationTb123({ widthMm: 297, heightMm: 210 })).toBe(
      "TB123,3800,5540,118,118",
    );
  });

  it("folha diferente gera outra distância entre marcas", () => {
    expect(registrationTb123({ widthMm: 330, heightMm: 480 })).toBe(
      "TB123,9200,6200,118,118",
    );
  });

  it("nenhuma sugestão muda o tamanho da carta", () => {
    const config: ComposerConfig = { ...base, registrationWhiteBorderMm: 10, bleedMm: 3 };
    const list = cards(9);
    const coverage = markCoverage(list, config);
    if (coverage.suggestedGrid) {
      const applied: ComposerConfig = {
        ...config,
        gridMode: "manual",
        gridColumns: coverage.suggestedGrid.columns,
        gridRows: coverage.suggestedGrid.rows,
      };
      const before = layoutSheets(list, config)[0]?.placements[0];
      const after = layoutSheets(list, applied)[0]?.placements[0];
      expect(before).toBeDefined();
      expect(after).toBeDefined();
      const size = (r: { x0: number; y0: number; x1: number; y1: number }) => [
        Number((r.x1 - r.x0).toFixed(3)),
        Number((r.y1 - r.y0).toFixed(3)),
      ];
      expect(size(after!.cutRectMm)).toEqual(size(before!.cutRectMm));
      expect(markCoverage(list, applied).content).toHaveLength(0);
    }
  });

  it("na guilhotina não existe faixa branca para avisar", () => {
    expect(markCoverage(cards(9), { ...base, finishMode: "manual" }).content).toHaveLength(0);
  });
});

describe("exportar linhas de corte", () => {
  const sheet = {
    number: 1,
    widthMm: 297,
    heightMm: 210,
    rects: [{ x0: 10, y0: 10, x1: 73.5, y1: 98 }],
  };

  it("DXF sai em R12, em milímetros e com o Y invertido", () => {
    const dxf = toDxf(sheet, 3);
    expect(dxf).toContain("AC1009");
    expect(dxf).toContain("POLYLINE");
    expect(dxf).toContain("SEQEND");
    expect(dxf).toContain("CORTE");
    // A borda de cima (y = 10 mm) vira 200 mm no DXF.
    expect(dxf).toContain("\r\n200\r\n");
  });

  it("SVG sai no tamanho exato da folha", () => {
    const svg = toSvg(sheet, 3);
    expect(svg).toContain('width="297mm"');
    expect(svg).toContain('height="210mm"');
    expect(svg).toContain('viewBox="0 0 297 210"');
    expect((svg.match(/<path /g) ?? []).length).toBe(1);
  });

  it("gera um arquivo por folha e só com carta marcada", () => {
    const list = cards(12);
    const only = list.map((card, index) => ({ ...card, selected: index < 5 }));
    const config: ComposerConfig = { ...base, finishMode: "manual" };
    const sheets = exportSheetsFrom(layoutSheets(only, config), pageSizeMm(config));
    const total = sheets.reduce((sum, item) => sum + item.rects.length, 0);
    expect(total).toBe(5);
    const files = cutExportFiles(sheets, "dxf", 3);
    expect(files.length).toBe(sheets.length);
    expect(files[0]?.name).toBe("corte-folha-01.dxf");
  });

  it("no gutterfold exporta só um contorno externo por peça", () => {
    const config: ComposerConfig = {
      ...base,
      finishMode: "manual",
      assemblyMode: "gutterfold",
      cardWidthMm: 57,
      cardHeightMm: 89,
      gutterfoldGapMm: 4,
    };
    const layout = layoutSheets(cards(1), config)[0]!;
    const placed = layout.placements[0]!;
    expect(placed.frontRectMm).toBeDefined();
    expect(placed.backRectMm).toBeDefined();
    expect(placed.gutterRectMm).toBeDefined();
    expect(placed.cutRectMm.x1 - placed.cutRectMm.x0).toBeCloseTo(cutWidthFor(config), 6);

    const sheets = exportSheetsFrom([layout], pageSizeMm(config));
    expect(sheets[0]!.rects).toHaveLength(1);
    expect(sheets[0]!.rects[0]).toEqual(placed.cutRectMm);
    const svg = toSvg(sheets[0]!, 3);
    expect((svg.match(/<path /g) ?? []).length).toBe(1);
    expect(svg).not.toContain("fold");
  });
});
