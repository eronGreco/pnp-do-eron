import { describe, expect, it } from "vitest";

import {
  clampCustomMm,
  orientationAllowed,
  pageSizeMm,
  paperAllowed,
} from "@/composer/paperSizes";
import { registrationSpacingMm, registrationTb123 } from "@/cut/geometry";
import { backRect, cutWidthFor, gridFor, layoutSheets, resolvedGutterfoldDirection } from "@/composer/layoutSheets";
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

  it("mantém as marcas da Cameo na frente por padrão", () => {
    expect(DEFAULT_COMPOSER_CONFIG.cameoRegistrationSide).toBe("front");
  });

  it("espelha a geometria do corte quando as marcas ficam no verso", () => {
    const config: ComposerConfig = { ...base, cameoRegistrationSide: "back" };
    const placed = layoutSheets(cards(1), config)[0]!.placements[0]!;
    expect(backRect(placed.cutRectMm, config).x0).toBeCloseTo(
      pageSizeMm(config).widthMm - placed.cutRectMm.x1,
      6,
    );
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

describe("gutterfold de folha inteira", () => {
  const whole: ComposerConfig = {
    ...base,
    finishMode: "manual",
    assemblyMode: "gutterfold",
    gutterfoldLayout: "sheet",
    gutterfoldDirection: "horizontal",
    paperSize: "a4",
    orientation: "paisagem",
    cardWidthMm: 52,
    cardHeightMm: 52,
    bleedMm: 0,
    gapMm: 0,
    gutterfoldGapMm: 0,
  };

  it("espelha cada verso na metade oposta e o gira na dobra horizontal", () => {
    const layout = layoutSheets(cards(4), whole)[0]!;
    expect(layout.sheetFoldDirection).toBe("horizontal");
    expect(layout.sheetFoldRectMm?.y0).toBeCloseTo(105, 6);
    for (const placed of layout.placements) {
      expect(placed.backRectMm?.x0).toBeCloseTo(placed.frontRectMm!.x0, 6);
      expect(placed.backRectMm?.y0).toBeCloseTo(210 - placed.frontRectMm!.y1, 6);
      expect(placed.backRotationDeg).toBe(180);
      expect(placed.cutRectMm.x1 - placed.cutRectMm.x0).toBeCloseTo(52, 6);
      expect(placed.cutRectMm.y1 - placed.cutRectMm.y0).toBeCloseTo(52, 6);
    }
  });

  it("encosta frente e verso na dobra quando a canaleta é zero", () => {
    const config = { ...whole, cardWidthMm: 63.5, cardHeightMm: 88 };
    const layout = layoutSheets(cards(4), config)[0]!;
    expect(layout.placements).toHaveLength(4);
    for (const placed of layout.placements) {
      expect(placed.frontRectMm?.y1).toBeCloseTo(105, 6);
      expect(placed.backRectMm?.y0).toBeCloseTo(105, 6);
    }
  });

  it("usa somente a canaleta como distância entre frente e verso", () => {
    const config = { ...whole, cardWidthMm: 63.5, cardHeightMm: 88, gutterfoldGapMm: 4 };
    const placed = layoutSheets(cards(1), config)[0]?.placements[0];
    expect(placed?.frontRectMm?.y1).toBeCloseTo(103, 6);
    expect(placed?.backRectMm?.y0).toBeCloseTo(107, 6);
    expect((placed?.backRectMm?.y0 ?? 0) - (placed?.frontRectMm?.y1 ?? 0)).toBeCloseTo(4, 6);
  });

  it("isola a sangria de cada face mesmo com canaleta e espaço zerados", () => {
    const config: ComposerConfig = {
      ...whole,
      cardWidthMm: 63.5,
      cardHeightMm: 88,
      bleedMm: 3,
      bleedMode: "completa",
      backBleed: { ...whole.backBleed, enabled: true },
      backExtraBleedMm: 18,
    };
    const layout = layoutSheets(cards(4), config)[0]!;
    const interiorOverlap = (a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }) =>
      Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1e-7 &&
      Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 1e-7;
    const clips = layout.placements.flatMap((placed) => [placed.clipRectMm, placed.backClipRectMm!]);

    for (let first = 0; first < clips.length; first += 1) {
      for (let second = first + 1; second < clips.length; second += 1) {
        expect(interiorOverlap(clips[first]!, clips[second]!)).toBe(false);
      }
    }
  });

  it("aproveita quatro cartas MTG na A4 deitada com marcas Cameo", () => {
    const config = {
      ...whole,
      finishMode: "cameo" as const,
      cardWidthMm: 63.5,
      cardHeightMm: 88,
      bleedMode: "colada" as const,
    };
    const grid = gridFor(config);
    const layout = layoutSheets(cards(4), config)[0]!;
    expect(grid.perSheet).toBe(4);
    expect(layout.placements).toHaveLength(4);
  });

  it("espelha os versos lateralmente na dobra vertical", () => {
    const config = { ...whole, gutterfoldDirection: "vertical" as const };
    const placed = layoutSheets(cards(1), config)[0]!.placements[0]!;
    expect(placed.backRectMm?.x0).toBeCloseTo(297 - placed.frontRectMm!.x1, 6);
    expect(placed.backRectMm?.y0).toBeCloseTo(placed.frontRectMm!.y0, 6);
    expect(placed.backRotationDeg).toBe(0);
    expect(placed.frontRectMm?.x1).toBeCloseTo(148.5, 6);
    expect(placed.backRectMm?.x0).toBeCloseTo(148.5, 6);
  });

  it("automática escolhe a direção com maior rendimento", () => {
    const auto = { ...whole, gutterfoldDirection: "auto" as const, cardWidthMm: 63.5, cardHeightMm: 88 };
    const horizontal = layoutSheets(cards(30), { ...auto, gutterfoldDirection: "horizontal" }).length;
    const vertical = layoutSheets(cards(30), { ...auto, gutterfoldDirection: "vertical" }).length;
    const chosen = resolvedGutterfoldDirection(auto);
    expect(chosen).toBe(horizontal <= vertical ? "horizontal" : "vertical");
  });

  it("DXF e SVG levam uma linha de corte por carta, nunca a dobra", () => {
    const layout = layoutSheets(cards(4), whole)[0]!;
    const sheets = exportSheetsFrom([layout], pageSizeMm(whole));
    expect(sheets[0]!.rects).toHaveLength(4);
    expect(toSvg(sheets[0]!, 3)).not.toContain("dobra");
  });

  it.each(["manual", "cameo", "cricut"] as const)(
    "ativa a folha inteira no acabamento %s",
    (finishMode) => {
      const config = { ...whole, finishMode };
      const layout = layoutSheets(cards(1), config)[0]!;
      const placed = layout.placements[0]!;
      expect(cutWidthFor(config)).toBeCloseTo(config.cardWidthMm, 6);
      expect(layout.sheetFoldRectMm).toBeDefined();
      expect(placed.frontRectMm?.y1).toBeLessThanOrEqual(105);
      expect(placed.backRectMm?.y0).toBeGreaterThanOrEqual(105);
      expect(placed.backRotationDeg).toBe(180);
    },
  );
});

describe("organização guiada", () => {
  it("começa segura, sem distância adicional e com canaleta zero", () => {
    expect(DEFAULT_COMPOSER_CONFIG.packingPolicy).toBe("seguro");
    expect(DEFAULT_COMPOSER_CONFIG.bleedMode).toBe("completa");
    expect(DEFAULT_COMPOSER_CONFIG.gapMm).toBe(0);
    expect(DEFAULT_COMPOSER_CONFIG.gutterfoldGapMm).toBe(0);
  });
});

describe("gutterfold carta por carta", () => {
  it("não deixa a sangria do verso atravessar a frente nem outra peça", () => {
    const config: ComposerConfig = {
      ...base,
      finishMode: "manual",
      assemblyMode: "gutterfold",
      gutterfoldLayout: "piece",
      cardWidthMm: 52,
      cardHeightMm: 52,
      bleedMm: 6,
      gapMm: 0,
      gutterfoldGapMm: 0,
      backBleed: { ...base.backBleed, enabled: true },
      backExtraBleedMm: 20,
    };
    const layout = layoutSheets(cards(4), config)[0]!;

    for (const placed of layout.placements) {
      expect(placed.clipRectMm.x1).toBeLessThanOrEqual(placed.backClipRectMm!.x0);
    }
  });
});
