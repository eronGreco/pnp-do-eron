import { getPdfjs } from "@/pdf/pdfjs";
import type { CricutMarkPage, CricutMarksTemplate } from "./markTemplate";
import type { PDFPageProxy } from "pdfjs-dist";
import { detectCricutMarks, type Corner } from "./detectMarks";


function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
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
  const { components, corners, design } = detectCricutMarks(source, pxPerMm);
  if (corners.length < 3) {
    return { markPage: null, widthMm, heightMm, corners };
  }

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