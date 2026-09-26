import { describe, expect, it } from "vitest";
import { buildStampOf } from "@/composer/buildStamp";
import { DEFAULT_COMPOSER_CONFIG, type ComposerCard } from "@/composer/types";

const cards: ComposerCard[] = [
  { id: "c1", frontImageId: "i1", backImageId: null, selected: true, bleed: null },
];

describe("assinatura da montagem", () => {
  it("as mesmas cartas e configuracoes dao a mesma assinatura", () => {
    expect(buildStampOf(cards, DEFAULT_COMPOSER_CONFIG, 1)).toBe(
      buildStampOf(cards, DEFAULT_COMPOSER_CONFIG, 1),
    );
  });

  it("mexer numa medida muda a assinatura", () => {
    const a = buildStampOf(cards, DEFAULT_COMPOSER_CONFIG, 1);
    const b = buildStampOf(
      cards,
      { ...DEFAULT_COMPOSER_CONFIG, cardWidthMm: DEFAULT_COMPOSER_CONFIG.cardWidthMm + 1 },
      1,
    );
    expect(a).not.toBe(b);
  });

  it("mexer no raio dos cantos muda a assinatura", () => {
    expect(buildStampOf(cards, DEFAULT_COMPOSER_CONFIG, 1)).not.toBe(
      buildStampOf(cards, DEFAULT_COMPOSER_CONFIG, 3),
    );
  });

  it("tirar uma carta muda a assinatura", () => {
    expect(buildStampOf(cards, DEFAULT_COMPOSER_CONFIG, 1)).not.toBe(
      buildStampOf([], DEFAULT_COMPOSER_CONFIG, 1),
    );
  });
});
