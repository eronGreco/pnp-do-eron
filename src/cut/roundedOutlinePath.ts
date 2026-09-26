import type { Rect } from "@/cameo/types";

/**
 * Caminho SVG do contorno da carta com cantos arredondados, em pontos de PDF
 * e no sistema do SVG (origem no canto superior esquerdo, Y para baixo).
 * No pdf-lib ele e desenhado com drawSvgPath ancorado no topo da pagina.
 */
export function roundedOutlineSvgPath(
  r: Rect,
  radiusMm: number,
  mmToPt: (mm: number) => number,
): string {
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  const rad = Math.max(0, Math.min(radiusMm, w / 2, h / 2));
  const x = mmToPt(r.x0);
  const y = mmToPt(r.y0);
  const width = mmToPt(w);
  const height = mmToPt(h);
  const k = mmToPt(rad);

  if (k <= 0) {
    return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
  }

  return [
    `M ${x + k} ${y}`,
    `H ${x + width - k}`,
    `A ${k} ${k} 0 0 1 ${x + width} ${y + k}`,
    `V ${y + height - k}`,
    `A ${k} ${k} 0 0 1 ${x + width - k} ${y + height}`,
    `H ${x + k}`,
    `A ${k} ${k} 0 0 1 ${x} ${y + height - k}`,
    `V ${y + k}`,
    `A ${k} ${k} 0 0 1 ${x + k} ${y}`,
    "Z",
  ].join(" ");
}
