import { getPdfjs } from "./pdfjs";

export type PreviewRender = {
  canvasWidth: number;
  canvasHeight: number;
  pxPerMm: number;
};

/**
 * Renderiza uma pagina no canvas, sempre no espaco paisagem normalizado.
 * Todo o render acontece no navegador.
 */
export async function renderPageToCanvas(
  bytes: ArrayBuffer,
  pageIndex: number,
  extraRotation: 0 | 90,
  canvas: HTMLCanvasElement,
  maxWidthPx = 1100,
): Promise<PreviewRender> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;

  try {
    const page = await doc.getPage(pageIndex + 1);
    const rotation = (page.rotate + extraRotation) % 360;
    const unit = page.getViewport({ scale: 1, rotation });
    const scale = maxWidthPx / unit.width;
    const viewport = page.getViewport({ scale, rotation });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não consegui preparar a área de visualização.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: context, viewport }).promise;

    const widthMm = (unit.width * 25.4) / 72;
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      pxPerMm: canvas.width / widthMm,
    };
  } finally {
    await doc.cleanup();
  }
}
