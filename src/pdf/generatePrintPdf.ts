import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
  degrees,
  rgb,
} from "pdf-lib";
import type { CutSettings, Rect, Sheet } from "@/cameo/types";
import { registrationShapesMm, registrationWhiteBackdropsMm } from "@/cut/geometry";
import { mmToPt } from "@/cut/silhouetteUnits";
import { encodeJobManifest } from "./jobManifest";
import { stripCropMarksFromContent } from "./stripCropMarks";

export type PrintPdfResult = {
  bytes: Uint8Array;
  fileName: string;
  removedCropMarks: number;
  notes: string[];
};

const latin1 = {
  decode(bytes: Uint8Array): string {
    let out = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      out += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return out;
  },
  encode(text: string): Uint8Array {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
    return bytes;
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodedContents(page: any): { text: string } | null {
  const contents = page.node.Contents();
  if (!contents) return null;
  const context = page.node.context;

  const streams: PDFRawStream[] = [];
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) {
      const stream = context.lookup(contents.get(i));
      if (stream instanceof PDFRawStream) streams.push(stream);
    }
  } else {
    const stream = contents instanceof PDFRawStream ? contents : context.lookup(contents);
    if (stream instanceof PDFRawStream) streams.push(stream);
  }

  if (streams.length === 0) return null;

  const text = streams
    .map((stream) => latin1.decode(decodePDFRawStream(stream).decode()))
    .join("\n");

  return { text };
}

/**
 * Converte um retangulo em mm do espaco PAISAGEM visivel para o espaco do
 * usuario da pagina (origem inferior esquerda), respeitando a rotacao aplicada.
 */
function markRectToUserSpace(
  r: Rect,
  rotated: boolean,
  viewWidthMm: number,
  pageWidthMm: number,
  pageHeightMm: number,
): { x: number; y: number; width: number; height: number } {
  if (!rotated) {
    return {
      x: mmToPt(r.x0),
      y: mmToPt(pageHeightMm - r.y1),
      width: mmToPt(r.x1 - r.x0),
      height: mmToPt(r.y1 - r.y0),
    };
  }

  // Pagina retrato girada 90 graus: (xv, yv) -> (xu, yu) = (yv, viewWidth - xv).
  const xu0 = r.y0;
  const xu1 = r.y1;
  const yu0 = viewWidthMm - r.x1;
  const yu1 = viewWidthMm - r.x0;

  return {
    x: mmToPt(xu0),
    y: mmToPt(pageHeightMm - yu1),
    width: mmToPt(xu1 - xu0),
    height: mmToPt(yu1 - yu0),
  };
}

/**
 * Gera um PDF NOVO para impressao. O arquivo original nunca e alterado.
 *
 * Frentes: arte e posicionamento preservados, cruzes do PNP removidas e
 * registration marks de 10 mm inseridas.
 * Versos: conteudo preservado integralmente, sem marcas e sem linhas de corte.
 */
export async function generatePrintPdf(
  originalBytes: ArrayBuffer,
  sheets: Sheet[],
  originalFileName: string,
  rotationDeg: 0 | 90,
  registrationWhiteBorderMm: number,
  settings?: CutSettings,
): Promise<PrintPdfResult> {
  const doc = await PDFDocument.load(originalBytes.slice(0), { updateMetadata: false });
  const pages = doc.getPages();
  const notes: string[] = [];
  let removedCropMarks = 0;

  const frontIndexes = new Set(sheets.map((s) => s.frontPageIndex));

  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]!;

    if (rotationDeg === 90) {
      page.setRotation(degrees((page.getRotation().angle + 90) % 360));
    }

    if (!frontIndexes.has(index)) continue;

    const decoded = decodedContents(page);
    if (!decoded) {
      notes.push(
        `Página ${index + 1}: não consegui interpretar o conteúdo para remover as cruzes do PNP. As cruzes originais foram mantidas nesta página.`,
      );
    } else {
      const stripped = stripCropMarksFromContent(decoded.text);
      removedCropMarks += stripped.removed;
      const context = page.node.context;
      page.node.set(
        PDFName.of("Contents"),
        context.register(context.flateStream(latin1.encode(stripped.content))),
      );
    }

    const sheet = sheets.find((s) => s.frontPageIndex === index)!;
    const size = page.getSize();
    const pageWidthMm = (size.width * 25.4) / 72;
    const pageHeightMm = (size.height * 25.4) / 72;

    for (const backdrop of registrationWhiteBackdropsMm(
      sheet.pageWidthMm,
      sheet.pageHeightMm,
      registrationWhiteBorderMm,
    )) {
      const box = markRectToUserSpace(
        backdrop,
        rotationDeg === 90,
        sheet.pageWidthMm,
        pageWidthMm,
        pageHeightMm,
      );
      page.drawRectangle({ ...box, color: rgb(1, 1, 1) });
    }

    for (const shape of registrationShapesMm(sheet.pageWidthMm, sheet.pageHeightMm)) {
      const box = markRectToUserSpace(
        shape,
        rotationDeg === 90,
        sheet.pageWidthMm,
        pageWidthMm,
        pageHeightMm,
      );
      page.drawRectangle({ ...box, color: rgb(0, 0, 0) });
    }
  }

  doc.setKeywords([encodeJobManifest(sheets, settings)]);

  const bytes = await doc.save({ useObjectStreams: false });
  const baseName = originalFileName.replace(/\.pdf$/i, "");

  return {
    bytes,
    fileName: `${baseName} - impressao.pdf`,
    removedCropMarks,
    notes,
  };
}

export function downloadBytes(bytes: Uint8Array, fileName: string) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
