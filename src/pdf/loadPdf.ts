import type { Card, Rect, Sheet } from "@/cameo/types";
import {
  artInSensorSafeZone,
  cutRectHitsRegistrationMark,
  rect,
} from "@/cut/geometry";
import { MM_PER_PT } from "@/cut/silhouetteUnits";
import { cutRectForImage, dominantCardImages, PdfDetectionError } from "./detectCards";
import { crossCentersFromSegments, type Point, type Segment } from "./detectCropMarks";
import {
  hasOrphanFront,
  pairSheets,
  rotationForPage,
  type PageSizeMm,
} from "./normalizeOrientation";
import { applyMatrix, getPdfjs, multiply, type Matrix } from "./pdfjs";

export type LoadedPdf = {
  fileName: string;
  bytes: ArrayBuffer;
  pageCount: number;
  rotationDeg: 0 | 90;
  sheets: Sheet[];
  warnings: string[];
  errors: string[];
};

export type PageGeometry = {
  sizeMm: PageSizeMm;
  segments: Segment[];
  imageRects: Rect[];
};

/** Le a geometria vetorial de uma pagina, sempre em mm no espaco paisagem. */
export async function pageGeometry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  extraRotation: 0 | 90,
): Promise<PageGeometry> {
  const pdfjs = await getPdfjs();
  const OPS = pdfjs.OPS as Record<string, number>;

  const viewport = page.getViewport({
    scale: MM_PER_PT,
    rotation: (page.rotate + extraRotation) % 360,
  });
  const base = viewport.transform as Matrix;

  const opList = await page.getOperatorList();
  const segments: Segment[] = [];
  const imageRects: Rect[] = [];

  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];

  const toMm = (x: number, y: number) => applyMatrix(multiply(base, ctm), x, y);

  const pushSegment = (a: Point, b: Point) => {
    segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  };

  const pushRectangle = (x: number, y: number, w: number, h: number) => {
    const p0 = toMm(x, y);
    const p1 = toMm(x + w, y + h);
    const x0 = Math.min(p0.x, p1.x);
    const x1 = Math.max(p0.x, p1.x);
    const y0 = Math.min(p0.y, p1.y);
    const y1 = Math.max(p0.y, p1.y);
    const thin = Math.min(x1 - x0, y1 - y0);

    if (thin <= 0.35) {
      // Retangulo fino: tratado como um braco de linha pelo seu eixo central.
      if (x1 - x0 >= y1 - y0) {
        pushSegment({ x: x0, y: (y0 + y1) / 2 }, { x: x1, y: (y0 + y1) / 2 });
      } else {
        pushSegment({ x: (x0 + x1) / 2, y: y0 }, { x: (x0 + x1) / 2, y: y1 });
      }
      return;
    }

    pushSegment({ x: x0, y: y0 }, { x: x1, y: y0 });
    pushSegment({ x: x1, y: y0 }, { x: x1, y: y1 });
    pushSegment({ x: x1, y: y1 }, { x: x0, y: y1 });
    pushSegment({ x: x0, y: y1 }, { x: x0, y: y0 });
  };

  const imageOps = new Set(
    [
      OPS["paintImageXObject"],
      OPS["paintImageXObjectRepeat"],
      OPS["paintJpegXObject"],
      OPS["paintInlineImageXObject"],
      OPS["paintImageMaskXObject"],
    ].filter((v) => typeof v === "number"),
  );

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i] as number;
    const args = opList.argsArray[i];

    if (fn === OPS["save"]) {
      stack.push(ctm);
      continue;
    }
    if (fn === OPS["restore"]) {
      ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
      continue;
    }
    if (fn === OPS["transform"]) {
      ctm = multiply(ctm, args as Matrix);
      continue;
    }

    if (imageOps.has(fn)) {
      const corners = [
        toMm(0, 0),
        toMm(1, 0),
        toMm(1, 1),
        toMm(0, 1),
      ];
      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      imageRects.push(
        rect(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)),
      );
      continue;
    }

    if (fn === OPS["constructPath"]) {
      const pathOps = (args[0] ?? []) as number[];
      const coords = (args[1] ?? []) as ArrayLike<number>;
      let c = 0;
      let current: Point | null = null;
      let start: Point | null = null;

      for (const op of pathOps) {
        if (op === OPS["moveTo"]) {
          current = toMm(coords[c]!, coords[c + 1]!);
          start = current;
          c += 2;
        } else if (op === OPS["lineTo"]) {
          const next = toMm(coords[c]!, coords[c + 1]!);
          c += 2;
          if (current) pushSegment(current, next);
          current = next;
        } else if (op === OPS["curveTo"]) {
          const next = toMm(coords[c + 4]!, coords[c + 5]!);
          c += 6;
          current = next;
        } else if (op === OPS["curveTo2"] || op === OPS["curveTo3"]) {
          const next = toMm(coords[c + 2]!, coords[c + 3]!);
          c += 4;
          current = next;
        } else if (op === OPS["closePath"]) {
          if (current && start) pushSegment(current, start);
          current = start;
        } else if (op === OPS["rectangle"]) {
          pushRectangle(coords[c]!, coords[c + 1]!, coords[c + 2]!, coords[c + 3]!);
          c += 4;
        }
      }
    }
  }

  return {
    sizeMm: { widthMm: viewport.width, heightMm: viewport.height },
    segments,
    imageRects,
  };
}

function cardsForPage(
  sheetNumber: number,
  geometry: PageGeometry,
): { cards: Card[]; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const centers: Point[] = crossCentersFromSegments(geometry.segments);
  const images = dominantCardImages(geometry.imageRects);
  const cards: Card[] = [];

  images.forEach((imageRect, index) => {
    let cutRect: Rect;
    try {
      cutRect = cutRectForImage(imageRect, centers);
    } catch (error) {
      const message =
        error instanceof PdfDetectionError
          ? error.message
          : "Não encontrei as cruzes de corte de uma das cartas.";
      errors.push(`Folha ${sheetNumber}, carta ${index + 1}: ${message}`);
      return;
    }

    const inSafeZone = artInSensorSafeZone(
      imageRect,
      geometry.sizeMm.widthMm,
      geometry.sizeMm.heightMm,
    );
    const hitsMark = cutRectHitsRegistrationMark(
      cutRect,
      geometry.sizeMm.widthMm,
      geometry.sizeMm.heightMm,
    );

    if (inSafeZone) {
      warnings.push(
        `Folha ${sheetNumber}, carta ${index + 1}: a arte entra na área de segurança do sensor. A leitura das marcas pode ficar mais sensível.`,
      );
    }
    if (hitsMark) {
      errors.push(
        `Folha ${sheetNumber}, carta ${index + 1}: uma registration mark invade a área final de corte. Corrija o layout antes de continuar.`,
      );
    }

    cards.push({
      id: `s${sheetNumber}-c${index + 1}`,
      sheetNumber,
      number: index + 1,
      imageRectMm: imageRect,
      cutRectMm: cutRect,
      selected: true,
      inSensorSafeZone: inSafeZone,
      hitsRegistrationMark: hitsMark,
    });
  });

  return { cards, warnings, errors };
}

/** Abre o PDF do PNP inteiramente no navegador. Nada sai do computador. */
export async function loadPnpPdf(file: File): Promise<LoadedPdf> {
  const pdfjs = await getPdfjs();
  const bytes = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;

  const firstPage = await doc.getPage(1);
  const rawViewport = firstPage.getViewport({ scale: MM_PER_PT });
  const rotationDeg = rotationForPage({
    widthMm: rawViewport.width,
    heightMm: rawViewport.height,
  });

  const pairings = pairSheets(doc.numPages);
  const sheets: Sheet[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  if (hasOrphanFront(doc.numPages)) {
    warnings.push("A última frente não possui página de verso.");
  }

  for (const pairing of pairings) {
    const page = await doc.getPage(pairing.frontPageIndex + 1);
    const geometry = await pageGeometry(page, rotationDeg);
    let result: { cards: Card[]; warnings: string[]; errors: string[] };

    try {
      result = cardsForPage(pairing.number, geometry);
    } catch (error) {
      result = {
        cards: [],
        warnings: [],
        errors: [
          `Folha ${pairing.number}: ${
            error instanceof Error ? error.message : "não consegui analisar esta folha."
          }`,
        ],
      };
    }

    warnings.push(...result.warnings);
    errors.push(...result.errors);

    sheets.push({
      number: pairing.number,
      frontPageIndex: pairing.frontPageIndex,
      backPageIndex: pairing.backPageIndex,
      pageWidthMm: geometry.sizeMm.widthMm,
      pageHeightMm: geometry.sizeMm.heightMm,
      cards: result.cards,
      rotated: rotationDeg === 90,
    });
  }

  await doc.cleanup();

  return {
    fileName: file.name,
    bytes,
    pageCount: pairings.length * 2,
    rotationDeg,
    sheets,
    warnings,
    errors,
  };
}
