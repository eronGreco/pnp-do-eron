import {
  PDFDocument,
  clip,
  closePath,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  degrees,
  type PDFPage,
} from "pdf-lib";
import type { Card, CutSettings, Rect, Sheet } from "@/cameo/types";
import { cricutDesignSizeMismatch, cricutMarkOffsetMm, templatePageForSheet, type CricutMarksTemplate } from "@/cricut/markTemplate";
import {
  artInSensorSafeZone,
  cutRectHitsRegistrationArea,
  registrationShapesMm,
  registrationWhiteBackdropsMm,
} from "@/cut/geometry";
import {
  MANUAL_MARK_RGB,
  manualMarkRectsMm,
  marksOnSide,
} from "@/cut/manualMarks";
import { mmToPt } from "@/cut/silhouetteUnits";
import { encodeJobManifest } from "@/pdf/jobManifest";
import { roundedOutlineSvgPath } from "@/cut/roundedOutlinePath";
import {
  backClipRect,
  backFaceRect,
  backImageRect,
  backRect,
  frontFaceRect,
  isGutterfold,
  layoutSheets,
} from "./layoutSheets";
import { pageSizeMm } from "./paperSizes";
import { backImageFor } from "./pairFrontBack";
import type { ComposerCard, ComposerConfig, ComposerImage } from "./types";
import { cameoMarkArmMm } from "./types";

export type ComposedDocument = {
  bytes: ArrayBuffer;
  sheets: Sheet[];
  fileName: string;
  warnings: string[];
  errors: string[];
};

function boxOn(r: Rect, pageHeightMm: number) {
  return {
    x: mmToPt(r.x0),
    y: mmToPt(pageHeightMm - r.y1),
    width: mmToPt(r.x1 - r.x0),
    height: mmToPt(r.y1 - r.y0),
  };
}

function beginClipOn(page: PDFPage, r: Rect, pageHeightMm: number) {
  const x0 = mmToPt(r.x0);
  const x1 = mmToPt(r.x1);
  const y0 = mmToPt(pageHeightMm - r.y1);
  const y1 = mmToPt(pageHeightMm - r.y0);
  page.pushOperators(
    pushGraphicsState(),
    moveTo(x0, y0),
    lineTo(x1, y0),
    lineTo(x1, y1),
    lineTo(x0, y1),
    closePath(),
    clip(),
    endPath(),
  );
}

/**
 * Monta as folhas A4 paisagem (frente com marcas de 10 mm, verso integral)
 * inteiramente no navegador. As imagens sao incorporadas sem recompressao.
 */
export async function buildSheetPdf(
  cards: ComposerCard[],
  images: ComposerImage[],
  config: ComposerConfig,
  settings?: CutSettings,
  /** Arte com sangria criada de cada carta: substitui a original quando existe. */
  resolveArt?: (card: ComposerCard, imageId: string, side?: "front" | "back") => ComposerImage | undefined,
  cricutMarks?: CricutMarksTemplate | null,
): Promise<ComposedDocument> {
  const doc = await PDFDocument.create();
  const sheetSize = pageSizeMm(config);
  const pageW = sheetSize.widthMm;
  const markArm = cameoMarkArmMm(config);
  const pageH = sheetSize.heightMm;
  const box = (r: Rect) => boxOn(r, pageH);
  const beginClip = (page: PDFPage, r: Rect) => beginClipOn(page, r, pageH);
  const layouts = layoutSheets(cards, config);
  const gutterfold = isGutterfold(config);
  const warnings: string[] = [];
  const errors: string[] = [];
  const byId = new Map(images.map((image) => [image.id, image]));
  const embedded = new Map<ComposerImage, Awaited<ReturnType<typeof doc.embedPng>>>();
  const embeddedCricutMarks = new Map<number, Awaited<ReturnType<typeof doc.embedPng>>>();

  const embed = async (card: ComposerCard, imageId: string, side: "front" | "back") => {
    const image = resolveArt?.(card, imageId, side) ?? byId.get(imageId);
    if (!image) return null;
    const cached = embedded.get(image);
    if (cached) return cached;
    const data = image.bytes.slice(0);
    const result =
      image.mime === "image/png" ? await doc.embedPng(data) : await doc.embedJpg(data);
    embedded.set(image, result);
    return result;
  };

  const sheets: Sheet[] = [];

  for (const layout of layouts) {
    const front = doc.addPage([mmToPt(pageW), mmToPt(pageH)]);
    const frontIndex = doc.getPageCount() - 1;

    const sheetCards: Card[] = [];

    for (const placement of layout.placements) {
      const image = await embed(placement.card, placement.card.frontImageId, "front");
      if (image) {
        beginClip(front, placement.clipRectMm);
        front.drawImage(image, box(placement.imageRectMm));
        front.pushOperators(popGraphicsState());
      }

      if (gutterfold) {
        const backImageId = backImageFor(placement.card, config);
        if (backImageId) {
          const backImage = await embed(placement.card, backImageId, "back");
          if (backImage) {
            beginClip(front, backClipRect(placement, layout.placements, config));
            const imageBox = box(backImageRect(placement, config));
            if (placement.backRotationDeg === 180) {
              front.drawImage(backImage, {
                x: imageBox.x + imageBox.width,
                y: imageBox.y + imageBox.height,
                width: imageBox.width,
                height: imageBox.height,
                rotate: degrees(180),
              });
            } else {
              front.drawImage(backImage, imageBox);
            }
            front.pushOperators(popGraphicsState());
          }
        } else {
          warnings.push(
            `Folha ${layout.number}, carta ${placement.number}: esta peça gutterfold ficou sem imagem no verso.`,
          );
        }
      }

      const cameoMode = config.finishMode === "cameo";
      const backClip = gutterfold ? backClipRect(placement, layout.placements, config) : null;
      const cutRectForMarks =
        cameoMode && !gutterfold && config.cameoRegistrationSide === "back"
          ? backRect(placement.cutRectMm, config)
          : placement.cutRectMm;
      const inSafeZone =
        cameoMode &&
        (artInSensorSafeZone(
          !gutterfold && config.cameoRegistrationSide === "back"
            ? backClipRect(placement, layout.placements, config)
            : placement.clipRectMm,
          pageW,
          pageH,
          markArm,
        ) ||
          (backClip ? artInSensorSafeZone(backClip, pageW, pageH, markArm) : false));
      const hitsMark =
        cameoMode &&
        cutRectHitsRegistrationArea(
          cutRectForMarks,
          pageW,
          pageH,
          config.registrationWhiteBorderMm,
          markArm,
        );

      if (inSafeZone) {
        warnings.push(
          gutterfold
            ? `Folha ${layout.number}, peça ${placement.number}: a arte entra na área de segurança do sensor. Você ainda pode continuar.`
            : `Folha ${layout.number}, carta ${placement.number}: a arte entra na área de segurança do sensor. Você ainda pode continuar.`,
        );
      }
      if (hitsMark) {
        errors.push(
          gutterfold
            ? `Folha ${layout.number}, peça ${placement.number}: uma registration mark invade a área final de corte. Reduza o tamanho da peça aberta ou a sangria.`
            : `Folha ${layout.number}, carta ${placement.number}: uma registration mark invade a área final de corte. Reduza o tamanho da carta ou a sangria.`,
        );
      }

      const sheetCard: Card = {
        id: `s${layout.number}-c${placement.number}`,
        sheetNumber: layout.number,
        number: placement.number,
        imageRectMm: placement.imageRectMm,
        cutRectMm: cutRectForMarks,
        selected: placement.card.selected,
        inSensorSafeZone: inSafeZone,
        hitsRegistrationMark: hitsMark,
      };
      if (gutterfold) {
        sheetCard.frontRectMm = frontFaceRect(placement);
        sheetCard.backRectMm = backFaceRect(placement, config);
        if (placement.gutterRectMm) sheetCard.foldRectMm = placement.gutterRectMm;
      }
      sheetCards.push(sheetCard);
    }

    if (gutterfold) {
      const folds = layout.sheetFoldRectMm
        ? [layout.sheetFoldRectMm]
        : layout.placements.flatMap((placement) => placement.gutterRectMm ? [placement.gutterRectMm] : []);
      for (const fold of folds) {
        const horizontal = fold.x1 - fold.x0 > fold.y1 - fold.y0;
        const centerX = (fold.x0 + fold.x1) / 2;
        const centerY = (fold.y0 + fold.y1) / 2;
        front.drawLine({
          start: horizontal
            ? { x: mmToPt(fold.x0), y: mmToPt(pageH - centerY) }
            : { x: mmToPt(centerX), y: mmToPt(pageH - fold.y0) },
          end: horizontal
            ? { x: mmToPt(fold.x1), y: mmToPt(pageH - centerY) }
            : { x: mmToPt(centerX), y: mmToPt(pageH - fold.y1) },
          thickness: mmToPt(0.2),
          color: rgb(0.55, 0.55, 0.55),
          dashArray: [mmToPt(2), mmToPt(1.5)],
          opacity: 0.65,
        });
      }
    }

    if (config.finishMode === "cameo" && (gutterfold || config.cameoRegistrationSide === "front")) {
      for (const backdrop of registrationWhiteBackdropsMm(
        pageW,
        pageH,
        config.registrationWhiteBorderMm,
        markArm,
      )) {
        front.drawRectangle({ ...box(backdrop), color: rgb(1, 1, 1) });
      }

      for (const shape of registrationShapesMm(pageW, pageH, markArm)) {
        front.drawRectangle({ ...box(shape), color: rgb(0, 0, 0) });
      }
    }

    if (config.finishMode === "cricut") {
      const markPage = templatePageForSheet(cricutMarks, layout.number);
      if (!markPage) {
        errors.push(`Folha ${layout.number}: o PDF de marcas da Cricut não tem esta folha.`);
      } else {
        let markImage = embeddedCricutMarks.get(markPage.sheetNumber);
        if (!markImage) {
          markImage = await doc.embedPng(markPage.bytes.slice(0));
          embeddedCricutMarks.set(markPage.sheetNumber, markImage);
        }
        const offset = cricutMarkOffsetMm(markPage, layout, config);
        if (cricutDesignSizeMismatch(markPage, layout, config)) {
          warnings.push(`Folha ${layout.number}: o desenho no PDF da Cricut tem outro tamanho. Confira se o SVG foi redimensionado no Design Space.`);
        }
        if (!markPage.designRectMm) {
          warnings.push(`Folha ${layout.number}: não achei a área do desenho no PDF da Cricut. Confira a primeira impressão.`);
        }
        front.drawImage(markImage, {
          x: mmToPt(offset.dx),
          y: mmToPt(-offset.dy),
          width: mmToPt(pageW),
          height: mmToPt(pageH),
        });
      }
    }

    const cutRects = layout.placements.map((placement) => placement.cutRectMm);
    const [mr, mg, mb] = MANUAL_MARK_RGB[config.manualMarks.color];

    /**
     * Contorno com os cantos arredondados, impresso somente quando o usuario
     * pede. Sem isso o raio existe apenas como guia na previa.
     */
    const drawRoundedOutlines = (page: PDFPage, rects: Rect[], side: "front" | "back") => {
      if (config.finishMode !== "manual" || !config.manualMarks.printRoundedOutline) return;
      const wanted = side === "front" ? "frente" : "verso";
      if (!gutterfold && config.manualMarks.sides !== "ambos" && config.manualMarks.sides !== wanted) return;
      const radiusMm = Math.max(0, settings?.radiusMm ?? 0);
      const borderWidth = mmToPt(Math.max(0.05, config.manualMarks.thicknessMm));
      for (const r of rects) {
        page.drawSvgPath(roundedOutlineSvgPath(r, radiusMm, mmToPt), {
          x: 0,
          y: mmToPt(pageH),
          borderColor: rgb(mr, mg, mb),
          borderWidth,
        });
      }
    };

    if (config.finishMode === "manual" && (gutterfold || marksOnSide(config.manualMarks, "front"))) {
      for (const mark of manualMarkRectsMm(cutRects, config.manualMarks, pageW, pageH)) {
        front.drawRectangle({ ...box(mark), color: rgb(mr, mg, mb) });
      }
    }
    drawRoundedOutlines(front, cutRects, "front");

    if (gutterfold) {
      sheets.push({
        number: layout.number,
        frontPageIndex: frontIndex,
        backPageIndex: null,
        assemblyMode: "gutterfold",
        pageWidthMm: pageW,
        pageHeightMm: pageH,
        cards: sheetCards,
        rotated: false,
        ...(config.finishMode === "cameo" ? { registrationArmMm: markArm } : {}),
      });
      continue;
    }

    const back = doc.addPage([mmToPt(pageW), mmToPt(pageH)]);
    const backIndex = doc.getPageCount() - 1;

    // Correcao digital do desalinhamento da impressora: move so o verso.
    const toBack = (r: Rect) => backRect(r, config);

    for (const placement of layout.placements) {
      const backImageId = backImageFor(placement.card, config);
      if (!backImageId) continue;
      const image = await embed(placement.card, backImageId, "back");
      if (!image) continue;
      beginClip(back, backClipRect(placement, layout.placements, config));
      back.drawImage(image, box(backImageRect(placement, config)));
      back.pushOperators(popGraphicsState());
    }

    if (config.finishMode === "cameo" && config.cameoRegistrationSide === "back") {
      for (const backdrop of registrationWhiteBackdropsMm(
        pageW,
        pageH,
        config.registrationWhiteBorderMm,
        markArm,
      )) {
        back.drawRectangle({ ...box(backdrop), color: rgb(1, 1, 1) });
      }
      for (const shape of registrationShapesMm(pageW, pageH, markArm)) {
        back.drawRectangle({ ...box(shape), color: rgb(0, 0, 0) });
      }
    }

    if (config.finishMode === "manual" && marksOnSide(config.manualMarks, "back")) {
      for (const mark of manualMarkRectsMm(cutRects.map(toBack), config.manualMarks, pageW, pageH)) {
        back.drawRectangle({ ...box(mark), color: rgb(mr, mg, mb) });
      }
    }
    drawRoundedOutlines(back, cutRects.map(toBack), "back");


    sheets.push({
      number: layout.number,
      frontPageIndex: frontIndex,
      backPageIndex: backIndex,
      assemblyMode: "normal",
      pageWidthMm: pageW,
      pageHeightMm: pageH,
      cards: sheetCards,
      rotated: false,
      ...(config.finishMode === "cameo"
        ? { registrationSide: config.cameoRegistrationSide, registrationArmMm: markArm }
        : {}),
    });
  }

  // Receita de corte viaja dentro do PDF: so geometria e parametros.
  doc.setKeywords([encodeJobManifest(sheets, settings)]);

  const saved = await doc.save({ useObjectStreams: false });
  const bytes = new ArrayBuffer(saved.byteLength);
  new Uint8Array(bytes).set(saved);

  return {
    bytes,
    sheets,
    fileName: "cartas montadas - impressao.pdf",
    warnings,
    errors,
  };
}
