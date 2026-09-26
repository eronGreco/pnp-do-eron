export type CardSizePreset = {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
};

/** Tamanhos mais usados no mercado de jogos de tabuleiro. */
export const CARD_SIZE_PRESETS: CardSizePreset[] = [
  { id: "mini-usa", name: "Mini USA", widthMm: 41, heightMm: 63 },
  { id: "mini-euro", name: "Mini Euro", widthMm: 45, heightMm: 68 },
  { id: "standard-usa", name: "Standard USA", widthMm: 56, heightMm: 87 },
  { id: "standard-american", name: "Standard American", widthMm: 57, heightMm: 89 },
  { id: "bridge", name: "Bridge", widthMm: 57, heightMm: 89 },
  { id: "euro-poker", name: "Euro / Poker", widthMm: 63.5, heightMm: 88 },
  { id: "magnum-space", name: "Magnum Space", widthMm: 61, heightMm: 103 },
  { id: "tarot", name: "Tarot", widthMm: 70, heightMm: 120 },
  { id: "quadrada-52", name: "Quadrada pequena", widthMm: 52, heightMm: 52 },
  { id: "quadrada-70", name: "Quadrada grande", widthMm: 70, heightMm: 70 },
];

export const CUSTOM_SIZE_ID = "personalizado";

export function sizeLabel(preset: CardSizePreset): string {
  return `${preset.name} (${format(preset.widthMm)} × ${format(preset.heightMm)} mm)`;
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

export function matchCardSize(widthMm: number, heightMm: number): string {
  const found = CARD_SIZE_PRESETS.find(
    (preset) =>
      Math.abs(preset.widthMm - widthMm) < 0.05 && Math.abs(preset.heightMm - heightMm) < 0.05,
  );
  return found?.id ?? CUSTOM_SIZE_ID;
}
