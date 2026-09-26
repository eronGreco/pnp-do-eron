import type { ComposerCard, ComposerConfig } from "./types";

/**
 * Assinatura do que entra na montagem. Serve apenas para saber se o PDF
 * ja montado continua valendo depois das mexidas do usuario.
 */
export function buildStampOf(
  cards: ComposerCard[],
  config: ComposerConfig,
  cornerRadiusMm: number,
): string {
  const cardPart = cards.map((card) => [
    card.id,
    card.frontImageId,
    card.backImageId ?? "",
    card.selected ? 1 : 0,
    card.bleed ? JSON.stringify(card.bleed) : "",
  ]);
  return JSON.stringify([cardPart, config, cornerRadiusMm]);
}
