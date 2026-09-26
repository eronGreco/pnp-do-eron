import type { ComposerCard, ComposerConfig } from "@/composer/types";
import { DEFAULT_BLEED_CONFIG, type BleedConfig } from "./types";

/**
 * Configuracao de sangria que realmente vale para uma carta: o padrao do
 * trabalho, com as excecoes daquela carta por cima quando existirem.
 */
export function effectiveCardBleed(
  card: Pick<ComposerCard, "bleed"> | null | undefined,
  base: BleedConfig,
): BleedConfig {
  if (!card?.bleed) return { ...DEFAULT_BLEED_CONFIG, ...base };
  return { ...DEFAULT_BLEED_CONFIG, ...base, ...card.bleed };
}

/** Assinatura usada como chave de cache da arte gerada. */
export function bleedSignature(
  bleed: BleedConfig,
  config: Pick<ComposerConfig, "cardWidthMm" | "cardHeightMm" | "bleedMm">,
): string {
  return JSON.stringify([bleed, config.cardWidthMm, config.cardHeightMm, config.bleedMm]);
}

export function artKey(imageId: string, signature: string): string {
  return `${imageId}|${signature}`;
}

/** Verdadeiro quando a carta tem ajuste proprio, diferente do padrao. */
export function cardHasOwnBleed(card: Pick<ComposerCard, "bleed">): boolean {
  return Boolean(card.bleed && Object.keys(card.bleed).length > 0);
}
