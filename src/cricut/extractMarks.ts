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

type Corner = "TL" | "TR" | "BL" | "BR";

const CORNER_BAND_MM = 45;

function cornerOf(b: CricutMarkBounds, width: number, height: number, pxPerMm: number): Corner | null {
  const band = CORNER_BAND_MM * pxPerMm;
  const edge = 2 * pxPerMm;
  const left = b.x1Px < band - edge;
  const right = b.x0Px > width - band + edge;
  const top = b.y1Px < band - edge;
  const bottom = b.y0Px > height - band + edge;
  if (top && left) return "TL";
  if (top && right) return "TR";
  if (bottom && left) return "BL";
  if (bottom && right) return "BR";
  return null;
}

/**
 * Marcas da Cricut: braco fino solto, "L" ligado (caixa quadrada mas quase
 * vazia) ou quadrado preto cheio. Arte de carta e grande e densa demais.
 */
function markShaped(b: CricutMarkBounds, pixels: number, pxPerMm: number): boolean {
  const bw = (b.x1Px - b.x0Px) / pxPerMm;
  const bh = (b.y1Px - b.y0Px) / pxPerMm;
  const long = Math.max(bw, bh);
  const short = Math.min(bw, bh);
  const fill = pixels / Math.max(1, (b.x1Px - b.x0Px) * (b.y1Px - b.y0Px));
  const arm = short <= 3 && long >= 4 && long <= 35;
  const bracket = long >= 6 && long <= 35 && short >= 6 && fill <= 0.35;
  const square = long >= 3 && long <= 12 && short / long >= 0.7 && fill >= 0.8;
  return arm || bracket || square;
}

function selectedComponents(
  source: ImageData,
  pxPerMm: number,
): { components: Component[]; corners: Corner[] } {
  const { width, height, data } = source;
  const total = width * height;
  const band = CORNER_BAND_MM * pxPerMm;
  const candidates = new Uint8Array(total);
  const visited = new Uint8Array(total);

  for (let y = 0; y < height; y += 1) {
    const inY = y < band || y > height - band;
    if (!inY) continue;
    for (let x = 0; x < width; x += 1) {
      if (!(x < band || x > width - band)) continue;
      const index = y * width + x;
      if (isDark(data, index * 4)) candidates[index] = 1;
    }
  }

  const components: Component[] = [];
  const corners = new Set<Corner>();
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
    const corner = cornerOf(bounds, width, height, pxPerMm);
    if (corner && markShaped(bounds, pixels.length, pxPerMm)) {
      components.push({ pixels, bounds });
      corners.add(corner);
    }
  }

  return { components, corners: [...corners] };
}

/**
 * Area do desenho: tudo que nao e branco dentro da caixa das marcas, fora dos
 * pixels das proprias marcas. Sem faixa de folga: no Design Space a primeira
 * coluna de cartas pode comecar na mesma linha do braco do L.
 */
function designRect(
  source: ImageData,
  marks: Component[],
  pxPerMm: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  const { width, height, data } = source;
  const markMask = new Uint8Array(width * height);
  for (const m of marks) {
    for (const index of m.pixels) {
      const x = index % width;
      const y = Math.floor(index / width);
      // 1 px de folga cobre o antisserrilhado da borda da marca.
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) markMask[ny * width + nx] = 1;
        }
      }
    }
  }
  const fx0 = Math.min(...marks.map((m) => m.bounds.x0Px));
  const fy0 = Math.min(...marks.map((m) => m.bounds.y0Px));
  const fx1 = Math.max(...marks.map((m) => m.bounds.x1Px));
  const fy1 = Math.max(...marks.map((m) => m.bounds.y1Px));
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = Math.max(0, fy0); y < Math.min(height, fy1); y += 1) {
    for (let x = Math.max(0, fx0); x < Math.min(width, fx1); x += 1) {
      const i = y * width + x;
      if (markMask[i]) continue;
      const o = i * 4;
      const lum = (data[o] ?? 255) * 0.299 + (data[o + 1] ?? 255) * 0.587 + (data[o + 2] ?? 255) * 0.114;
      if (lum >= 235) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const w = (x1 + 1 - x0) / pxPerMm;
  const h = (y1 + 1 - y0) / pxPerMm;
  if (w < 10 || h < 10) return null;
  return { x0: x0 / pxPerMm, y0: y0 / pxPerMm, x1: (x1 + 1) / pxPerMm, y1: (y1 + 1) / pxPerMm };
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
): Promise<{ markPage: CricutMarkPage | null; widthMm: number; heightMm: number; corners: Corner[] }> {
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
  const widthMm = (unit.width * 25.4) / 72;
  const heightMm = (unit.height * 25.4) / 72;
  const pxPerMm = canvas.width / widthMm;
  const { components, corners } = selectedComponents(source, pxPerMm);
  if (corners.length < 3) {
    return { markPage: null, widthMm, heightMm, corners };
  }
  const design = designRect(source, components, pxPerMm);

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
    corners,
    markPage: {
      corners,
      designRectMm: design,
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
    let bestCorners: Corner[] = [];

    for (let index = 0; index < doc.numPages; index += 1) {
      const pdfPage = await doc.getPage(index + 1);
      const result = await extractPage(pdfPage, pages.length + 1);
      pageWidthMm = pageWidthMm || result.widthMm;
      pageHeightMm = pageHeightMm || result.heightMm;
      if (result.markPage) pages.push(result.markPage);
      else if (result.corners.length > bestCorners.length) bestCorners = result.corners;
    }

    if (pages.length === 0) {
      const names: Record<Corner, string> = {
        TL: "superior esquerdo",
        TR: "superior direito",
        BL: "inferior esquerdo",
        BR: "inferior direito",
      };
      const missing = (Object.keys(names) as Corner[]).filter((c) => !bestCorners.includes(c));
      throw new Error(
        bestCorners.length === 0
          ? "Não encontrei marcas pretas da Cricut nos cantos do PDF."
          : `Encontrei marcas só em ${bestCorners.length} canto(s). Faltou o canto ${missing.map((c) => names[c]).join(", ")}. Salve o PDF do Design Space sem editar as marcas.`,
      );
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