import { describe, expect, it } from "vitest";
import { pageSizeMm, orientationAllowed, paperAllowed } from "@/composer/paperSizes";
import { guessBleedFromAspect } from "@/bleed/detectBleed";
import { artKey, bleedSignature, cardHasOwnBleed, effectiveCardBleed } from "@/bleed/cardBleed";
import { DEFAULT_BLEED_CONFIG } from "@/bleed/types";
import { DEFAULT_COMPOSER_CONFIG } from "@/composer/types";

describe("folha e orientacao", () => {
  it("A4 deitada continua 297 x 210", () => {
    expect(pageSizeMm({ paperSize: "a4", orientation: "paisagem", finishMode: "cameo" })).toEqual({
      widthMm: 297,
      heightMm: 210,
    });
  });

  it("retrato troca largura e altura no acabamento guilhotina", () => {
    expect(pageSizeMm({ paperSize: "a4", orientation: "retrato", finishMode: "manual" })).toEqual({
      widthMm: 210,
      heightMm: 297,
    });
    expect(pageSizeMm({ paperSize: "a3", orientation: "retrato", finishMode: "manual" })).toEqual({
      widthMm: 297,
      heightMm: 420,
    });
  });

  it("no Cameo a folha fica sempre A4 deitada", () => {
    expect(orientationAllowed("retrato", "cameo")).toBe(false);
    expect(paperAllowed("a3", "cameo")).toBe(false);
    expect(pageSizeMm({ paperSize: "a4", orientation: "retrato", finishMode: "cameo" })).toEqual({
      widthMm: 297,
      heightMm: 210,
    });
  });
});

describe("palpite de sangria", () => {
  const card = { w: 57, h: 89, bleed: 5 };

  it("arte na proporcao da carta parece cortada na linha", () => {
    const result = guessBleedFromAspect(570, 890, card.w, card.h, card.bleed);
    expect(result.guess).toBe("sem-sangria");
  });

  it("arte maior na proporcao com sangria parece ja ter sangria", () => {
    const result = guessBleedFromAspect(670, 990, card.w, card.h, card.bleed);
    expect(result.guess).toBe("com-sangria");
  });

  it("carta quadrada nao permite decidir", () => {
    expect(guessBleedFromAspect(600, 600, 52, 52, 5).guess).toBe("indefinido");
  });
});

describe("sangria por carta", () => {
  const base = DEFAULT_COMPOSER_CONFIG.bleed;

  it("sem ajuste proprio a carta segue o padrao", () => {
    const card = { bleed: null };
    expect(cardHasOwnBleed(card)).toBe(false);
    expect(effectiveCardBleed(card, base)).toEqual(base);
  });

  it("ajuste proprio sobrepoe somente os campos informados", () => {
    const card = { bleed: { enabled: true, trimMm: 1.5 } };
    const effective = effectiveCardBleed(card, base);
    expect(cardHasOwnBleed(card)).toBe(true);
    expect(effective.enabled).toBe(true);
    expect(effective.trimMm).toBe(1.5);
    expect(effective.method).toBe(base.method);
  });

  it("a chave da arte muda quando a configuracao muda", () => {
    const a = artKey("img-1", bleedSignature(DEFAULT_BLEED_CONFIG, DEFAULT_COMPOSER_CONFIG));
    const b = artKey(
      "img-1",
      bleedSignature({ ...DEFAULT_BLEED_CONFIG, enabled: true }, DEFAULT_COMPOSER_CONFIG),
    );
    expect(a).not.toBe(b);
  });
});
