import { getPdfjs } from "@/pdf/pdfjs";
import type { CricutMarkBounds, CricutMarkPage, CricutMarksTemplate } from "./markTemplate";
import type { PDFPageProxy } from "pdfjs-dist";

type Component = {
  pixels: number[];
  bounds: CricutMarkBounds;
};

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function isDark(data: Uint8ClampedArray, offset: number): boolean {
  const r = data[offset] ?? 255;
  const g = data[offset + 1] ?? 255;
  const b = data[offset + 2] ?? 255;
  const a = data[offset + 3] ?? 255;
  if (a < 160) return false;
  return r * 0.299 + g * 0.587 + b * 0.114 < 120;
}

function inCornerSearchZone(x: number, y: number, width: number, height: number): boolean {
  const left = x < width * 0.24;
  const right = x > width * 0.76;
  const top = y < height * 0.2;
  const bottom = y > height * 0.8;
  return (left || right) && (top || bottom);
}

function nearPageCorner(bounds: CricutMarkBounds, width: number, height: number): boolean {
  const left = bounds.x0Px < width * 0.12;
  const right = bounds.x1Px > width * 0.88;
  const top = bounds.y0Px < height * 0.12;
  const bottom = bounds.y1Px > height * 0.88;
  return (left || right) && (top || bottom);
}

/**
 * As marcas da Cricut sao tracos finos. O Design Space costuma preencher de preto
 * o contorno da carta importada, e esse bloco grande nunca e marca.
 */
function markShaped(bounds: CricutMarkBounds, pixels: number, width: number): boolean {
  const bw = bounds.x1Px - bounds.x0Px;
  const bh = bounds.y1Px - bounds.y0Px;
  const thin = Math.min(bw, bh) <= Math.max(6, width * 0.035);
  const long = Math.max(bw, bh) >= width * 0.015;
  const area = Math.max(1, bw * bh);
  const notBlock = pixels / area < 0.98 || thin;
  return thin && long && notBlock;
}

function selectedComponents(source: ImageData): Component[] {
  const { width, height, data } = source;
  const total = width * height;
  const candidates = new Uint8Array(total);
  const visited = new Uint8Array(total);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (inCornerSearchZone(x, y, width, height) && isDark(data, index * 4)) {
        candidates[index] = 1;
      }
    }
  }

  const components: Component[] = [];
  const stack: number[] = [];

  for (let start = 0; start < total; start += 1) {
    if (!candidates[start] || visited[start]) continue;
    visited[start] = 1;
    stack.push(start);
    const pixels: number[] = [];
    let x0 = width;
    let y0 = height;
    let x1 = 0;
    let y1 = 0;

    while (stack.length > 0) {
      const current = stack.pop();
      if (typeof current !== "number") continue;
      pixels.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x + 1);
      y1 = Math.max(y1, y + 1);

      const neighbors = [current - 1, current + 1, current - width, current + width];
      for (const next of neighbors) {
        if (next < 0 || next >= total || visited[next] || !candidates[next]) continue;
        const nx = next % width;
        if (Math.abs(nx - x) > 1) continue;
        visited[next] = 1;
        stack.push(next);
      }
    }

    const bounds = { x0Px: x0, y0Px: y0, x1Px: x1, y1Px: y1 };
    const bw = x1 - x0;
    const bh = y1 - y0;
    const longEnough = bw > 28 || bh > 28;
    if (
      pixels.length >= 70 &&
      longEnough &&
      nearPageCorner(bounds, width, height) &&
      markShaped(bounds, pixels.length, width)
    ) {
      components.push({ pixels, bounds });
    }
  }

  return components;
}

function rgbaToPngBytes(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Não consegui criar a máscara das marcas da Cricut."));
        return;
      }
      void blob.arrayBuffer().then(resolve, reject);
    }, "image/png");
  });
}

async function extractPage(
  page: PDFPageProxy,
  sheetNumber: number,
): Promise<{ markPage: CricutMarkPage | null; widthMm: number; heightMm: number }> {
  const unit = page.getViewport({ scale: 1 });
  const scale = Math.min(3, Math.max(1, 1500 / unit.width));
  const viewport = page.getViewport({ scale });
  const canvas = makeCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Não consegui preparar a leitura do PDF da Cricut.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;

  const source = context.getImageData(0, 0, canvas.width, canvas.height);
  const components = selectedComponents(source);
  const widthMm = (unit.width * 25.4) / 72;
  const heightMm = (unit.height * 25.4) / 72;
  if (components.length === 0) return { markPage: null, widthMm, heightMm };

  const output = context.createImageData(canvas.width, canvas.height);
  let darkPixels = 0;
  for (const component of components) {
    for (const index of component.pixels) {
      const offset = index * 4;
      output.data[offset] = 0;
      output.data[offset + 1] = 0;
      output.data[offset + 2] = 0;
      output.data[offset + 3] = 255;
      darkPixels += 1;
    }
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.putImageData(output, 0, 0);
  const bytes = await rgbaToPngBytes(canvas);
  const blob = new Blob([bytes.slice(0)], { type: "image/png" });

  return {
    widthMm,
    heightMm,
    markPage: {
      sheetNumber,
      bytes,
      previewUrl: URL.createObjectURL(blob),
      widthPx: canvas.width,
      heightPx: canvas.height,
      darkPixels,
      bounds: components.map((component) => component.bounds),
    },
  };
}

export async function extractCricutMarksFromPdf(
  file: File,
  geometryStamp: string,
): Promise<CricutMarksTemplate> {
  const bytes = await file.arrayBuffer();
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;

  try {
    const pages: CricutMarkPage[] = [];
    let pageWidthMm = 0;
    let pageHeightMm = 0;

    for (let index = 0; index < doc.numPages; index += 1) {
      const pdfPage = await doc.getPage(index + 1);
      const result = await extractPage(pdfPage, pages.length + 1);
      pageWidthMm = pageWidthMm || result.widthMm;
      pageHeightMm = pageHeightMm || result.heightMm;
      if (result.markPage) pages.push(result.markPage);
    }

    if (pages.length === 0) {
      throw new Error("Não encontrei marcas pretas da Cricut nos cantos do PDF.");
    }

    return {
      id: crypto.randomUUID(),
      name: file.name,
      pageWidthMm,
      pageHeightMm,
      pageCount: doc.numPages,
      pages,
      geometryStamp,
      createdAt: Date.now(),
    };
  } finally {
    await doc.cleanup();
  }
}