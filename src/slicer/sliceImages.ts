import JSZip from "jszip";
import { sliceFileName, sliceRects } from "./sliceGeometry";
import type { SliceConfig, SliceImage } from "./types";
import { fillCardEdges } from "./cornerFill";

const SUPPORTED = ["image/png", "image/jpeg"];

let counter = 0;

/** Carrega as folhas do disco. Os bytes nunca saem do navegador. */
export async function loadSliceImages(files: File[]): Promise<{
  images: SliceImage[];
  rejected: string[];
}> {
  const images: SliceImage[] = [];
  const rejected: string[] = [];

  for (const file of files) {
    if (!SUPPORTED.includes(file.type)) {
      rejected.push(`${file.name}: use imagens PNG ou JPG.`);
      continue;
    }

    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    try {
      const bitmap = await createImageBitmap(blob);
      counter += 1;
      images.push({
        id: `slice-${counter}`,
        name: file.name,
        mime: file.type,
        blob,
        widthPx: bitmap.width,
        heightPx: bitmap.height,
        previewUrl: URL.createObjectURL(blob),
      });
      bitmap.close();
    } catch {
      rejected.push(`${file.name}: não consegui abrir esta imagem.`);
    }
  }

  return { images, rejected };
}

export function releaseSliceImages(images: SliceImage[]) {
  for (const image of images) URL.revokeObjectURL(image.previewUrl);
}

function extensionFor(mime: string): string {
  return mime === "image/jpeg" ? "jpg" : "png";
}

function makeCanvas(width: number, height: number) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function canvasToBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  mime: string,
): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return mime === "image/jpeg"
      ? canvas.convertToBlob({ type: mime, quality: 0.95 })
      : canvas.convertToBlob({ type: mime });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas"))),
      mime,
      mime === "image/jpeg" ? 0.95 : undefined,
    );
  });
}

/**
 * Recorta cada folha nas celulas da grade e devolve um zip.
 * Sem redimensionar: cada recorte sai no tamanho exato em pixels da regiao.
 */
export async function sliceToZip(
  images: SliceImage[],
  config: SliceConfig,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const zip = new JSZip();
  const perImage = config.columns * config.rows;
  const total = images.length * perImage;
  let done = 0;

  for (const image of images) {
    const bitmap = await createImageBitmap(image.blob);
    const rects = sliceRects(bitmap.width, bitmap.height, config);
    const folder = images.length > 1 ? zip.folder(safeFolder(image.name)) : zip;
    const extension = extensionFor(image.mime);

    for (const rect of rects) {
      const canvas = makeCanvas(rect.width, rect.height);
      const ctx = canvas.getContext("2d") as
        | OffscreenCanvasRenderingContext2D
        | CanvasRenderingContext2D
        | null;
      if (!ctx) throw new Error("Não consegui preparar o recorte nesta máquina.");
      if (extension === "jpg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, rect.width, rect.height);
      }
      ctx.drawImage(
        bitmap,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        0,
        0,
        rect.width,
        rect.height,
      );

      if (config.cornerFill) {
        const pixels = ctx.getImageData(0, 0, rect.width, rect.height);
        ctx.putImageData(
          fillCardEdges(pixels, {
            cornerPercent: config.cornerFillCornerPercent,
            edgePercent: config.cornerFillEdgePercent,
          }),
          0,
          0,
        );
      }

      const blob = await canvasToBlob(canvas, image.mime);
      folder?.file(sliceFileName(image.name, rect, extension), blob);
      done += 1;
      onProgress?.(done, total);
    }

    bitmap.close();
  }

  return zip.generateAsync({ type: "blob" });
}

function safeFolder(name: string): string {
  return (name.replace(/\.[^.]+$/, "") || "folha").replace(/[^\w\-. ]+/g, "_");
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
