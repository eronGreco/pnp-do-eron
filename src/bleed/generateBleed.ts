import {
  clampIndex,
  insideRoundedRect,
  pullIntoRoundedRect,
  reflectIndex,
  type BleedGeometry,
} from "./bleedGeometry";
import type { BleedConfig } from "./types";

/** Bloco de pixels independente de navegador, para poder ser testado sozinho. */
export type Pixels = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export function createPixels(width: number, height: number): Pixels {
  return { data: new Uint8ClampedArray(width * height * 4), width, height };
}

function parseColor(hex: string): [number, number, number] {
  const clean = hex.trim().replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean;
  const value = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(value)) return [255, 255, 255];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Cor media da bordinha da carta: usada quando o metodo e cor solida automatica. */
export function averageEdgeColor(card: Pixels, rx = 0, ry = 0): [number, number, number] {
  const ring = Math.max(1, Math.round(Math.min(card.width, card.height) * 0.02));
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (let y = 0; y < card.height; y += 1) {
    for (let x = 0; x < card.width; x += 1) {
      const nearEdge =
        x < ring || y < ring || x >= card.width - ring || y >= card.height - ring;
      if (!nearEdge) continue;
      // Os cantos removidos nao fazem parte da carta e nao entram na media.
      if (!insideRoundedRect(x, y, card.width, card.height, rx, ry)) continue;
      const index = (y * card.width + x) * 4;
      red += card.data[index] ?? 0;
      green += card.data[index + 1] ?? 0;
      blue += card.data[index + 2] ?? 0;
      count += 1;
    }
  }

  if (count === 0) return [255, 255, 255];
  return [Math.round(red / count), Math.round(green / count), Math.round(blue / count)];
}

function boxBlur(source: Pixels, radius: number): Pixels {
  if (radius < 1) return source;
  const { width, height } = source;
  const pass = createPixels(width, height);
  const out = createPixels(width, height);

  // Horizontal
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let count = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        const sx = clampIndex(x + offset, width);
        const index = (y * width + sx) * 4;
        red += source.data[index] ?? 0;
        green += source.data[index + 1] ?? 0;
        blue += source.data[index + 2] ?? 0;
        alpha += source.data[index + 3] ?? 255;
        count += 1;
      }
      const target = (y * width + x) * 4;
      pass.data[target] = red / count;
      pass.data[target + 1] = green / count;
      pass.data[target + 2] = blue / count;
      pass.data[target + 3] = alpha / count;
    }
  }

  // Vertical
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let count = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        const sy = clampIndex(y + offset, height);
        const index = (sy * width + x) * 4;
        red += pass.data[index] ?? 0;
        green += pass.data[index + 1] ?? 0;
        blue += pass.data[index + 2] ?? 0;
        alpha += pass.data[index + 3] ?? 255;
        count += 1;
      }
      const target = (y * width + x) * 4;
      out.data[target] = red / count;
      out.data[target + 1] = green / count;
      out.data[target + 2] = blue / count;
      out.data[target + 3] = alpha / count;
    }
  }

  return out;
}

/**
 * Desenha a arte da carta no centro e inventa a faixa de sangria ao redor.
 * A area da carta sai identica a arte original: nada de dentro e alterado.
 */
export function paintBleed(card: Pixels, geometry: BleedGeometry, config: BleedConfig): Pixels {
  const { bandX, bandY, outW, outH, cornerRx, cornerRy } = geometry;
  const out = createPixels(outW, outH);
  const solid =
    config.method === "cor"
      ? config.useAverageColor
        ? averageEdgeColor(card, cornerRx, cornerRy)
        : parseColor(config.color)
      : null;
  const isCard = (cardX: number, cardY: number) =>
    insideRoundedRect(cardX, cardY, card.width, card.height, cornerRx, cornerRy);

  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const target = (y * outW + x) * 4;
      const cardX = x - bandX;
      const cardY = y - bandY;
      const inside = isCard(cardX, cardY);

      if (inside) {
        const source = (cardY * card.width + cardX) * 4;
        out.data[target] = card.data[source] ?? 0;
        out.data[target + 1] = card.data[source + 1] ?? 0;
        out.data[target + 2] = card.data[source + 2] ?? 0;
        out.data[target + 3] = card.data[source + 3] ?? 255;
        continue;
      }

      if (solid) {
        out.data[target] = solid[0];
        out.data[target + 1] = solid[1];
        out.data[target + 2] = solid[2];
        out.data[target + 3] = 255;
        continue;
      }

      const reflectedX =
        config.method === "espelhar"
          ? reflectIndex(cardX, card.width)
          : clampIndex(cardX, card.width);
      const reflectedY =
        config.method === "espelhar"
          ? reflectIndex(cardY, card.height)
          : clampIndex(cardY, card.height);
      const [sx, sy] = pullIntoRoundedRect(
        reflectedX,
        reflectedY,
        card.width,
        card.height,
        cornerRx,
        cornerRy,
      );
      const source = (sy * card.width + sx) * 4;
      out.data[target] = card.data[source] ?? 0;
      out.data[target + 1] = card.data[source + 1] ?? 0;
      out.data[target + 2] = card.data[source + 2] ?? 0;
      out.data[target + 3] = card.data[source + 3] ?? 255;
    }
  }

  if (config.method !== "esticar-desfoque") return out;

  const radius = Math.max(
    1,
    Math.round((Math.max(bandX, bandY) * Math.max(1, Math.min(10, config.blurStrength))) / 20),
  );
  const blurred = boxBlur(out, radius);

  // O desfoque vale so para a faixa criada: a carta continua nitida.
  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const cardX = x - bandX;
      const cardY = y - bandY;
      if (isCard(cardX, cardY)) continue;
      const index = (y * outW + x) * 4;
      out.data[index] = blurred.data[index] ?? 0;
      out.data[index + 1] = blurred.data[index + 1] ?? 0;
      out.data[index + 2] = blurred.data[index + 2] ?? 0;
      out.data[index + 3] = blurred.data[index + 3] ?? 255;
    }
  }

  return out;
}
