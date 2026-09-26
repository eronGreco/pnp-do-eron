import { describe, expect, it } from "vitest";
import { layoutSheets } from "@/composer/layoutSheets";
import { DEFAULT_COMPOSER_CONFIG, type ComposerCard, type ComposerConfig } from "@/composer/types";
import {
  cricutDesignSizeMismatch,
  cricutMarkOffsetMm,
  cricutMarkRectsMm,
  sheetDesignRectMm,
  type CricutMarkPage,
} from "@/cricut/markTemplate";

const config: ComposerConfig = { ...DEFAULT_COMPOSER_CONFIG, finishMode: "cricut" };
const cards: ComposerCard[] = Array.from({ length: 4 }, (_, i) => ({
  id: `c${i}`,
  frontImageId: "x",
  backImageId: null,
  selected: true,
}));

function page(design: { x0: number; y0: number; x1: number; y1: number } | null): CricutMarkPage {
  return {
    sheetNumber: 1,
    bytes: new ArrayBuffer(0),
    previewUrl: "",
    widthPx: 210,
    heightPx: 297,
    darkPixels: 1,
    bounds: [{ x0Px: 10, y0Px: 10, x1Px: 20, y1Px: 20 }],
    corners: ["TL", "TR", "BL", "BR"],
    designRectMm: design,
  };
}

describe("alinhamento Cricut", () => {
  const layout = layoutSheets(cards, config)[0];
  const here = layout ? sheetDesignRectMm(layout, config) : null;

  it("desloca as marcas junto com a area do desenho", () => {
    expect(here).not.toBeNull();
    if (!here || !layout) return;
    const w = here.x1 - here.x0;
    const h = here.y1 - here.y0;
    const design = { x0: 15, y0: 15, x1: 15 + w, y1: 15 + h };
    const offset = cricutMarkOffsetMm(page(design), layout, config);
    expect(offset.dx).toBeCloseTo(here.x0 - 15);
    expect(offset.dy).toBeCloseTo(here.y0 - 15);
    const [mark] = cricutMarkRectsMm(page(design), 210, 297, offset);
    expect(mark?.x0).toBeCloseTo(10 + offset.dx);
    expect(cricutDesignSizeMismatch(page(design), layout, config)).toBeNull();
  });

  it("avisa quando o tamanho do desenho mudou", () => {
    if (!layout) return;
    expect(cricutDesignSizeMismatch(page({ x0: 10, y0: 10, x1: 50, y1: 50 }), layout, config)).not.toBeNull();
  });

  it("sem area lida, mantem as marcas no lugar", () => {
    expect(cricutMarkOffsetMm(page(null), layout, config)).toEqual({ dx: 0, dy: 0 });
  });
});
