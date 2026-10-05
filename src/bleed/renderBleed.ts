import type { ComposerImage } from "@/composer/types";
import { bleedGeometry } from "./bleedGeometry";
import { paintBleed, type Pixels } from "./generateBleed";
import type { BleedConfig } from "./types";

function makeCanvas(width: number, height: number) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: OffscreenCanvas | HTMLCanvasElement) {
  return canvas.getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
}

async function toBlob(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/png" });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas"))), "image/png");
  });
}

/**
 * Gera a versao da arte com sangria inventada ao redor. Roda inteiro no
 * navegador; a arte original fica intacta na fila de cartas.
 */
export async function renderBleedImage(
  image: ComposerImage,
  bleed: BleedConfig,
  cardWidthMm: number,
  cardHeightMm: number,
  bleedMm: number,
): Promise<ComposerImage | null> {
  const geometry = bleedGeometry(
    image.widthPx,
    image.heightPx,
    cardWidthMm,
    cardHeightMm,
    bleedMm,
    bleed.trimEnabled ? bleed.trimMm : 0,
    bleed.trimCornersEnabled ? bleed.trimCornersMm : 0,
  );
  if (
    geometry.bandX === 0 &&
    geometry.bandY === 0 &&
    geometry.trimX === 0 &&
    geometry.trimY === 0 &&
    geometry.cornerRx === 0 &&
    geometry.cornerRy === 0
  ) {
    return null;
  }

  const blob = new Blob([image.bytes.slice(0)], { type: image.mime });
  const bitmap = await createImageBitmap(blob);

  try {
    const cropCanvas = makeCanvas(geometry.cropW, geometry.cropH);
    const cropCtx = context2d(cropCanvas);
    if (!cropCtx) return null;
    cropCtx.drawImage(
      bitmap,
      geometry.trimX,
      geometry.trimY,
      geometry.cropW,
      geometry.cropH,
      0,
      0,
      geometry.cropW,
      geometry.cropH,
    );
    const card = cropCtx.getImageData(0, 0, geometry.cropW, geometry.cropH) as unknown as Pixels;

    const painted = paintBleed(card, geometry, bleed);

    const outCanvas = makeCanvas(geometry.outW, geometry.outH);
    const outCtx = context2d(outCanvas);
    if (!outCtx) return null;
    const output = outCtx.createImageData(painted.width, painted.height);
    output.data.set(painted.data);
    outCtx.putImageData(output, 0, 0);

    const outBlob = await toBlob(outCanvas);
    const bytes = await outBlob.arrayBuffer();

    return {
      id: image.id,
      name: image.name,
      mime: "image/png",
      bytes,
      previewUrl: URL.createObjectURL(outBlob),
      widthPx: geometry.outW,
      heightPx: geometry.outH,
    };
  } finally {
    bitmap.close();
  }
}
