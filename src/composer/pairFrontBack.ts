import type { ComposerCard, ComposerConfig, ComposerImage } from "./types";

let counter = 0;

/** Uma imagem por carta, sem verso proprio. */
export function cardsFromImages(images: ComposerImage[]): ComposerCard[] {
  return images.map((image) => {
    counter += 1;
    return { id: `card-${counter}`, frontImageId: image.id, backImageId: null, selected: true };
  });
}

/** Imagens em pares: a primeira e a frente, a segunda e o verso daquela carta. */
export function cardsFromPairs(images: ComposerImage[]): {
  cards: ComposerCard[];
  leftover: ComposerImage | null;
} {
  const cards: ComposerCard[] = [];
  let leftover: ComposerImage | null = null;

  for (let i = 0; i < images.length; i += 2) {
    const front = images[i]!;
    const back = images[i + 1];
    if (!back) {
      leftover = front;
      counter += 1;
      cards.push({
        id: `card-${counter}`,
        frontImageId: front.id,
        backImageId: null,
        selected: true,
      });
      break;
    }
    counter += 1;
    cards.push({
      id: `card-${counter}`,
      frontImageId: front.id,
      backImageId: back.id,
      selected: true,
    });
  }

  return { cards, leftover };
}

export function newCardId(): string {
  counter += 1;
  return `card-${counter}`;
}

/** Verso efetivo de uma carta: individual quando definido, senao o verso comum. */
export function backImageFor(
  card: ComposerCard,
  config: ComposerConfig,
): string | null {
  return card.backImageId ?? config.sharedBackImageId;
}

export function anyBackDefined(cards: ComposerCard[], config: ComposerConfig): boolean {
  return cards.some((card) => backImageFor(card, config) !== null);
}
