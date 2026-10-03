import JSZip from "jszip";
import type { Sheet } from "@/cameo/types";
import { renderPdfPagesToPng } from "@/slicer/sliceImages";

/** Nome de cada pagina exportada, dizendo a folha e o lado. */
export function pageImageNames(sheets: Sheet[], pageCount: number): string[] {
  const digits = String(Math.max(1, pageCount)).length;
  const names: string[] = [];
  for (let index = 0; index < pageCount; index += 1) {
    const sheet = sheets.find((s) => s.frontPageIndex === index || s.backPageIndex === index);
    const side = sheet ? (sheet.frontPageIndex === index ? "frente" : "verso") : "pagina";
    const label = sheet ? `folha ${sheet.number} - ${side}` : "pagina";
    names.push(`${String(index + 1).padStart(digits, "0")} - ${label}.png`);
  }
  return names;
}

/**
 * Salva as paginas montadas como PNG a 300 DPI (mesma regra do Fatiar folha).
 * Uma pagina vira um PNG solto; varias viram um ZIP para evitar varios downloads.
 */
export async function composedPagesToImages(
  bytes: ArrayBuffer,
  sheets: Sheet[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ blob: Blob; fileName: string; pages: number; failed: number[] }> {
  const pages: { pageNumber: number; blob: Blob }[] = [];
  const failed: number[] = [];
  let total = 0;
  total = await renderPdfPagesToPng(
    bytes,
    ({ pageNumber, pageCount, blob }) => {
      pages.push({ pageNumber, blob });
      onProgress?.(pages.length, pageCount);
    },
    (pageNumber) => failed.push(pageNumber),
  );
  const names = pageImageNames(sheets, total);
  if (pages.length === 1 && total === 1) {
    return { blob: pages[0]!.blob, fileName: `cartas montadas - ${names[0]}`, pages: 1, failed };
  }
  const zip = new JSZip();
  for (const page of pages) zip.file(names[page.pageNumber - 1]!, page.blob);
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, fileName: "cartas montadas - imagens PNG.zip", pages: pages.length, failed };
}
