/**
 * Palpite sobre a arte ja ter sangria ou nao, feito pela proporcao da imagem.
 * Arte cortada na linha tem a proporcao da carta. Arte com sangria tem a
 * proporcao da carta mais a faixa de sangria dos dois lados.
 * E apenas um aviso: nunca bloqueia nada.
 */

export type BleedGuess = "com-sangria" | "sem-sangria" | "indefinido";

export type BleedGuessResult = {
  guess: BleedGuess;
  imageRatio: number;
  cardRatio: number;
  bleedRatio: number;
};

export function guessBleedFromAspect(
  widthPx: number,
  heightPx: number,
  cardWidthMm: number,
  cardHeightMm: number,
  bleedMm: number,
): BleedGuessResult {
  const imageRatio = heightPx > 0 ? widthPx / heightPx : 0;
  const cardRatio = cardHeightMm > 0 ? cardWidthMm / cardHeightMm : 0;
  const bleedRatio =
    cardHeightMm + bleedMm * 2 > 0
      ? (cardWidthMm + bleedMm * 2) / (cardHeightMm + bleedMm * 2)
      : 0;

  if (!imageRatio || !cardRatio || !bleedRatio) {
    return { guess: "indefinido", imageRatio, cardRatio, bleedRatio };
  }

  const toCard = Math.abs(imageRatio - cardRatio);
  const toBleed = Math.abs(imageRatio - bleedRatio);
  const separation = Math.abs(cardRatio - bleedRatio);

  // Carta quadrada: as duas proporcoes coincidem e nao da para decidir.
  if (separation < 0.01) return { guess: "indefinido", imageRatio, cardRatio, bleedRatio };

  // Muito longe das duas proporcoes: a arte nao parece ser desta carta.
  if (Math.min(toCard, toBleed) > separation * 2) {
    return { guess: "indefinido", imageRatio, cardRatio, bleedRatio };
  }

  return {
    guess: toCard <= toBleed ? "sem-sangria" : "com-sangria",
    imageRatio,
    cardRatio,
    bleedRatio,
  };
}

export const BLEED_GUESS_LABEL: Record<BleedGuess, string> = {
  "com-sangria": "Parece já ter sangria",
  "sem-sangria": "Parece cortada na linha",
  indefinido: "Não consegui dizer",
};
