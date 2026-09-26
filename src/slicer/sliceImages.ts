import JSZip from "jszip";
import { getPdfjs } from "@/pdf/pdfjs";
import { scaledSliceSize, sliceFileName, sliceRects } from "./sliceGeometry";
import type { SliceConfig, SliceImage } from "./types";
import { fillCardEdges } from "./cornerFill";

const SUPPORTED_IMAGES = ["image/png", "image/jpeg"];
const PDF_MIME = "application/pdf";
const PDF_RENDER_SCALE = 300 / 72;

let counter = 0;

function isPdf(file: File): boolean {
  return file.type === PDF_MIME || file.name.toLocaleLowerCase().endsWith(".pdf");
}

function pdfPageName(fileName: string, pageNumber: number, pageCount: number): string {
  const baseName = fileName.replace(/\.pdf$/i, "") || "PDF";
  const digits = String(pageCount).length;
  return `${baseName} - página ${String(pageNumber).padStart(digits, "0")}.png`;
}

async function loadPdfPages(file: File): Promise<{ images: SliceImage[]; rejected: string[] }> {
  const images: SliceImage[] = [];
  const rejected: string[] = [];
  const pdfjs = await getPdfjs();
  const bytes = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;

  try {
    if (doc.numPages === 0) return { images, rejected: [`${file.name}: o PDF não tem páginas.`] };

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      try {
        const page = await doc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("canvas");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        const blob = await canvasToBlob(canvas, "image/png");
        counter += 1;
        images.push({
          id: `slice-${counter}`,
          name: pdfPageName(file.name, pageNumber, doc.numPages),
          mime: "image/png",
          blob,
          widthPx: canvas.width,
          heightPx: canvas.height,
          previewUrl: URL.createObjectURL(blob),
        });
        page.cleanup();
      } catch {
        rejected.push(`${file.name}, página ${pageNumber}: não consegui abrir esta página.`);
      }
    }
  } finally {
    await doc.cleanup();
  }

  return { images, rejected };
}

/** Carrega as folhas do disco. Os bytes nunca saem do navegador. */
export async function loadSliceImages(files: File[]): Promise<{
  images: SliceImage[];
  rejected: string[];
}> {
  const images: SliceImage[] = [];
  const rejected: string[] = [];

  for (const file of files) {
    if (isPdf(file)) {
      try {
        const loaded = await loadPdfPages(file);
        images.push(...loaded.images);
        rejected.push(...loaded.rejected);
      } catch {
        rejected.push(`${file.name}: não consegui abrir este PDF. Confira se ele é válido e não está protegido por senha.`);
      }
      continue;
    }

    if (!SUPPORTED_IMAGES.includes(file.type)) {
      rejected.push(`${file.name}: use PDF, PNG ou JPG.`);
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

function outputType(config: SliceConfig): { extension: "png" | "jpg"; mime: "image/png" | "image/jpeg" } {
  return config.outputFormat === "jpeg"
    ? { extension: "jpg", mime: "image/jpeg" }
    : { extension: "png", mime: "image/png" };
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
    const { extension, mime } = outputType(config);

    for (const rect of rects) {
      const output = scaledSliceSize(rect.width, rect.height, config.outputDpi);
      const canvas = makeCanvas(output.width, output.height);
      const ctx = canvas.getContext("2d") as
        | OffscreenCanvasRenderingContext2D
        | CanvasRenderingContext2D
        | null;
      if (!ctx) throw new Error("Não consegui preparar o recorte nesta máquina.");
      if (extension === "jpg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, output.width, output.height);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        bitmap,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        0,
        0,
        output.width,
        output.height,
      );

      if (config.cornerFill) {
        const pixels = ctx.getImageData(0, 0, output.width, output.height);
        ctx.putImageData(
          fillCardEdges(pixels, {
            cornerPercent: config.cornerFillCornerPercent,
            edgePercent: config.cornerFillEdgePercent,
          }),
          0,
          0,
        );
      }

      const blob = await canvasToBlob(canvas, mime);
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
