import { A4_LANDSCAPE_H_MM, A4_LANDSCAPE_W_MM } from "@/cut/geometry";

/** Tamanhos de folha suportados na montagem. */
export type PaperSize =
  | "a4"
  | "a3"
  | "a5"
  | "carta"
  | "oficio"
  | "polaseal"
  | "custom";

/** Orientacao da folha. Retrato vale apenas no acabamento guilhotina. */
export type PaperOrientation = "paisagem" | "retrato";

export const A3_LANDSCAPE_W_MM = 420;
export const A3_LANDSCAPE_H_MM = 297;

/** Limites da folha personalizada, em mm. */
export const CUSTOM_MIN_MM = 50;
export const CUSTOM_MAX_MM = 1000;

export const DEFAULT_CUSTOM_WIDTH_MM = 297;
export const DEFAULT_CUSTOM_HEIGHT_MM = 210;

export type PageSizeMm = { widthMm: number; heightMm: number };

export const PAPER_SIZES: Record<Exclude<PaperSize, "custom">, PageSizeMm> = {
  a4: { widthMm: A4_LANDSCAPE_W_MM, heightMm: A4_LANDSCAPE_H_MM },
  a3: { widthMm: A3_LANDSCAPE_W_MM, heightMm: A3_LANDSCAPE_H_MM },
  a5: { widthMm: 210, heightMm: 148 },
  carta: { widthMm: 279, heightMm: 216 },
  oficio: { widthMm: 356, heightMm: 216 },
  // Bolsa de plastificacao A4 padrao do mercado brasileiro (Polaseal e
  // equivalentes, 220 x 307 mm), muito usada em PnP para plastificar as
  // folhas antes do corte. Guardada na base deitada, como os demais
  // tamanhos: Paisagem = 307 x 220, Retrato = 220 x 307.
  polaseal: { widthMm: 307, heightMm: 220 },
};

export const PAPER_LABELS: Record<PaperSize, string> = {
  a4: "A4 (297 × 210 mm)",
  a3: "A3 (420 × 297 mm)",
  a5: "A5 (210 × 148 mm)",
  carta: "Carta (279 × 216 mm)",
  oficio: "Ofício (356 × 216 mm)",
  polaseal: "Polaseal A4 (220 × 307 mm)",
  custom: "Personalizada (você escolhe)",
};

export const ORIENTATION_LABELS: Record<PaperOrientation, string> = {
  paisagem: "Paisagem (deitada)",
  retrato: "Retrato (em pé)",
};

export function clampCustomMm(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CUSTOM_WIDTH_MM;
  return Math.min(CUSTOM_MAX_MM, Math.max(CUSTOM_MIN_MM, value));
}

type PaperConfig = {
  paperSize?: PaperSize;
  orientation?: PaperOrientation;
  finishMode: "cameo" | "manual" | "cricut";
  customWidthMm?: number;
  customHeightMm?: number;
  /** O usuario aceitou usar folha diferente de A4 deitada na Cameo. */
  cameoCustomSheetAck?: boolean;
};

/**
 * A3 e Oficio valem apenas na guilhotina e na Cricut: a Cameo 4 corta
 * materiais de ate cerca de 30,5 cm de largura. A5, Carta e Polaseal A4
 * (220 x 307 mm) cabem na Cameo, mas seguem o aviso experimental da folha
 * personalizada.
 *
 * A folha personalizada vale sempre na guilhotina e, na Cameo, somente depois
 * de o usuario aceitar o aviso: as marcas do sensor e a leitura foram
 * validadas fisicamente apenas em A4 deitada.
 */
export function paperAllowed(
  paper: PaperSize,
  finishMode: "cameo" | "manual" | "cricut",
  cameoCustomSheetAck = false,
): boolean {
  if (paper === "a4") return true;
  if (finishMode === "manual" || finishMode === "cricut") return true;
  // Na Cameo, folhas que cabem na largura util da maquina valem com o aviso
  // aceito; A3 e Oficio sao largas demais e seguem bloqueadas.
  if (paper === "a3" || paper === "oficio") return false;
  return cameoCustomSheetAck;
}

/**
 * A folha em pe vale sempre na guilhotina e, na Cameo, somente com o aviso
 * da folha experimental aceito.
 */
export function orientationAllowed(
  orientation: PaperOrientation,
  finishMode: "cameo" | "manual" | "cricut",
  cameoCustomSheetAck = false,
): boolean {
  if (orientation === "paisagem") return true;
  return finishMode === "manual" || finishMode === "cricut" || cameoCustomSheetAck;
}

export function pageSizeMm(config: PaperConfig): PageSizeMm {
  const paper = config.paperSize ?? "a4";
  const ack = config.cameoCustomSheetAck ?? false;
  const effective = paperAllowed(paper, config.finishMode, ack) ? paper : "a4";

  const base: PageSizeMm =
    effective === "custom"
      ? {
          widthMm: clampCustomMm(config.customWidthMm ?? DEFAULT_CUSTOM_WIDTH_MM),
          heightMm: clampCustomMm(config.customHeightMm ?? DEFAULT_CUSTOM_HEIGHT_MM),
        }
      : PAPER_SIZES[effective];

  // Na folha personalizada, largura e altura valem exatamente como digitadas:
  // a orientacao nao troca os valores de lugar.
  if (effective === "custom") return base;

  const orientation = config.orientation ?? "paisagem";
  if (
    orientation === "retrato" &&
    orientationAllowed(orientation, config.finishMode, ack)
  ) {
    return { widthMm: base.heightMm, heightMm: base.widthMm };
  }
  return base;
}

/** True quando a folha em uso e exatamente A4 deitada (o caso validado). */
export function isA4Landscape(page: PageSizeMm): boolean {
  return (
    Math.abs(page.widthMm - A4_LANDSCAPE_W_MM) < 0.01 &&
    Math.abs(page.heightMm - A4_LANDSCAPE_H_MM) < 0.01
  );
}
