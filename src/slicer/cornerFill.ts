/**
 * Preenche toda a faixa externa da carta projetando para fora as cores de uma
 * linha interna segura. A operacao e local: nenhum pixel de outra celula da
 * folha participa do resultado.
 */
export type EdgeFillAmount = {
  cornerPercent: number;
  edgePercent: number;
};

export function edgeFillPixels(
  width: number,
  height: number,
  amount: EdgeFillAmount,
): { cornerPx: number; edgePx: number } {
  const reference = Math.min(width, height);
  const cornerPx = Math.max(
    1,
    Math.min(Math.round((reference * amount.cornerPercent) / 100), Math.floor(reference / 3)),
  );
  const edgePx = Math.max(
    0,
    Math.min(Math.round((reference * amount.edgePercent) / 100), Math.floor(reference / 3)),
  );
  return { cornerPx, edgePx };
}

export function fillCardEdges(image: ImageData, amount: EdgeFillAmount): ImageData {
  const { width, height } = image;
  const { cornerPx, edgePx } = edgeFillPixels(width, height, amount);
  if (cornerPx < 2 && edgePx < 1) return image;

  const copied = new Uint8ClampedArray(image.data);
  const output =
    typeof ImageData === "undefined"
      ? ({ data: copied, width, height, colorSpace: "srgb" } as ImageData)
      : new ImageData(copied, width, height);
  const source = image.data;
  const target = output.data;
  const innerLeft = edgePx;
  const innerTop = edgePx;
  const innerRight = width - edgePx - 1;
  const innerBottom = height - edgePx - 1;
  const edgeFade = Math.max(1, Math.round(edgePx * 0.3));

  const averageAt = (centerX: number, centerY: number, tangentX: number, tangentY: number) => {
    let count = 0;
    let red = 0;
    let green = 0;
    let blue = 0;
    let alpha = 0;
    for (let offset = -1; offset <= 1; offset += 1) {
      const sx = Math.max(0, Math.min(width - 1, Math.round(centerX + tangentX * offset)));
      const sy = Math.max(0, Math.min(height - 1, Math.round(centerY + tangentY * offset)));
      const index = (sy * width + sx) * 4;
      red += source[index] ?? 0;
      green += source[index + 1] ?? 0;
      blue += source[index + 2] ?? 0;
      alpha += source[index + 3] ?? 255;
      count += 1;
    }
    return [red / count, green / count, blue / count, alpha / count] as const;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = Math.min(x, width - 1 - x);
      const dy = Math.min(y, height - 1 - y);
      const cornerVectorX = cornerPx - dx;
      const cornerVectorY = cornerPx - dy;
      const cornerDistance = Math.hypot(cornerVectorX, cornerVectorY);
      const inRoundedCorner =
        dx < cornerPx && dy < cornerPx && cornerDistance > cornerPx;
      const inStraightEdge = !inRoundedCorner && Math.min(dx, dy) < edgePx;
      if (!inRoundedCorner && !inStraightEdge) continue;

      const targetIndex = (y * width + x) * 4;
      let sampled: readonly [number, number, number, number];
      let blend = 1;

      if (inRoundedCorner) {
        const left = x < width / 2;
        const top = y < height / 2;
        const centerX = left ? cornerPx : width - cornerPx - 1;
        const centerY = top ? cornerPx : height - cornerPx - 1;
        const vectorX = x - centerX;
        const vectorY = y - centerY;
        const length = Math.max(1, Math.hypot(vectorX, vectorY));
        const unitX = vectorX / length;
        const unitY = vectorY / length;
        const safeRadius = Math.max(1, cornerPx - Math.max(2, Math.round(cornerPx * 0.15)));
        sampled = averageAt(
          centerX + unitX * safeRadius,
          centerY + unitY * safeRadius,
          -unitY,
          unitX,
        );
      } else {
        const verticalEdge = dx <= dy;
        const sampleX = verticalEdge
          ? x < width / 2
            ? innerLeft
            : innerRight
          : x;
        const sampleY = verticalEdge
          ? y
          : y < height / 2
            ? innerTop
            : innerBottom;
        sampled = averageAt(sampleX, sampleY, verticalEdge ? 0 : 1, verticalEdge ? 1 : 0);
        const edgeDistance = Math.min(dx, dy);
        blend = edgeDistance < edgePx - edgeFade
          ? 1
          : Math.max(0, (edgePx - edgeDistance) / edgeFade);
      }

      target[targetIndex] = Math.round((target[targetIndex] ?? 0) * (1 - blend) + sampled[0] * blend);
      target[targetIndex + 1] = Math.round((target[targetIndex + 1] ?? 0) * (1 - blend) + sampled[1] * blend);
      target[targetIndex + 2] = Math.round((target[targetIndex + 2] ?? 0) * (1 - blend) + sampled[2] * blend);
      target[targetIndex + 3] = Math.round((target[targetIndex + 3] ?? 255) * (1 - blend) + sampled[3] * blend);
    }
  }

  return output;
}
