export type Rect = { x0: number; y0: number; x1: number; y1: number };

export type Card = {
  id: string;
  sheetNumber: number;
  number: number;
  imageRectMm: Rect;
  cutRectMm: Rect;
  /** Area da frente dentro de uma peça gutterfold. Ausente no modo normal. */
  frontRectMm?: Rect;
  /** Area do verso dentro de uma peça gutterfold. Ausente no modo normal. */
  backRectMm?: Rect;
  /** Canaleta de dobra do gutterfold. Nunca entra como corte. */
  foldRectMm?: Rect;
  selected: boolean;
  /** Arte/sangria dentro da area de leitura do sensor: apenas aviso. */
  inSensorSafeZone: boolean;
  /** Linha final de corte atravessando uma registration mark: erro critico. */
  hitsRegistrationMark: boolean;
};

export type Sheet = {
  number: number;
  /** Null quando o PDF foi montado so com versos. */
  frontPageIndex: number | null;
  backPageIndex: number | null;
  /** Modo usado para montar a folha. Ausente em PDFs antigos. */
  assemblyMode?: "normal" | "gutterfold";
  pageWidthMm: number;
  pageHeightMm: number;
  cards: Card[];
  rotated: boolean;
  /** Lado que contém as marcas do sensor e deve ficar para cima no corte. */
  registrationSide?: "front" | "back";
  /** Braco do L das marcas em mm. Ausente = 10 mm validado. */
  registrationArmMm?: number;
};

export type CutSettings = {
  depth: number;
  force: number;
  speed: number;
  passes: number;
  radiusMm: number;
  lineOvercut: boolean;
  lineOvercutMm: number;
};

export type CutJob = {
  sheet: number;
  /** Tamanho da folha em mm. Sem isso, o programa local assume A4 deitada. */
  sheetWidthMm?: number;
  sheetHeightMm?: number;
  /** Braco do L das marcas impressas. Ausente = 10 mm validado (TB51,200). */
  markArmMm?: number;
  cards: Rect[];
  settings: CutSettings;
};

export type DeviceState = "ready" | "moving" | "unloaded" | "unknown";

export type DeviceStatus = {
  connected: boolean;
  state: DeviceState;
  firmware?: string;
  message: string;
};

export type RegistrationResult = {
  ok: boolean;
  elapsedSeconds: number;
  message: string;
};

export type CameoEvent =
  | { type: "log"; message: string }
  | { type: "diagnostic"; message: string }
  | { type: "progress"; card: number; totalCards: number; pass: number; totalPasses: number }
  | { type: "error"; message: string }
  | { type: "done"; message: string };
