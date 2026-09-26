import {
  DEFAULT_MANUAL_MARKS,
  type FinishMode,
  type ManualMarksConfig,
} from "@/cut/manualMarks";
import { DEFAULT_BLEED_CONFIG, type BleedConfig } from "@/bleed/types";
import type { PaperOrientation, PaperSize } from "./paperSizes";

export type ComposerImage = {
  id: string;
  name: string;
  mime: string;
  bytes: ArrayBuffer;
  /** URL local (blob) usada apenas para miniatura no navegador. */
  previewUrl: string;
  widthPx: number;
  heightPx: number;
};

export type ComposerCard = {
  id: string;
  frontImageId: string;
  backImageId: string | null;
  /** Cartas marcadas entram no corte. Todas comecam marcadas. */
  selected: boolean;
  /**
   * Excecao de sangria desta carta. Null ou ausente = segue o padrao do
   * trabalho. Guarda apenas os campos diferentes do padrao.
   */
  bleed?: Partial<BleedConfig> | null;
};

/**
 * "completa" mantem a sangria inteira de cada carta.
 * "compartilhada" faz cartas vizinhas dividirem a mesma sangria,
 * cortando o excesso para ocupar menos espaco na folha.
 * "colada" descarta a sangria e encosta as cartas uma na outra.
 */
export type BleedMode = "completa" | "compartilhada" | "colada";

/** "auto" usa o maximo que cabe. "manual" usa a grade escolhida pelo usuario. */
export type GridMode = "auto" | "manual";

/** "normal" imprime frente e verso separados. "gutterfold" monta uma peça dobrável. */
export type AssemblyMode = "normal" | "gutterfold";

export type ComposerConfig = {
  /** Folha de impressao. A3 vale apenas no acabamento guilhotina. */
  paperSize: PaperSize;
  /** Orientacao da folha. Retrato vale apenas no acabamento guilhotina. */
  orientation: PaperOrientation;
  /** Largura da folha personalizada, em mm. */
  customWidthMm: number;
  /** Altura da folha personalizada, em mm. */
  customHeightMm: number;
  /**
   * O usuario aceitou o aviso de folha experimental na Cameo. Sem isso a Cameo
   * segue travada em A4 deitada, o unico tamanho validado no equipamento.
   */
  cameoCustomSheetAck: boolean;
  cardWidthMm: number;
  cardHeightMm: number;
  bleedMm: number;
  gapMm: number;
  bleedMode: BleedMode;
  gridMode: GridMode;
  /** Cartas por linha e por coluna quando a grade e manual. */
  gridColumns: number;
  gridRows: number;
  /** Fundo branco adicional ao redor das marcas para a leitura do sensor. */
  registrationWhiteBorderMm: number;
  /** Forma de montar cada carta na folha. */
  assemblyMode: AssemblyMode;
  /** Espaço central de dobra no gutterfold, em mm. */
  gutterfoldGapMm: number;
  /** Verso unico aplicado a todas as cartas sem verso proprio. */
  sharedBackImageId: string | null;
  /** "cameo" usa as marcas do sensor. "manual" gera marcas de guilhotina. */
  finishMode: FinishMode;
  manualMarks: ManualMarksConfig;
  /**
   * Correcao do desalinhamento da impressora ao virar a folha.
   * Aplicada apenas ao conteudo das paginas de verso.
   * Positivo move para a direita / para baixo.
   */
  backOffsetXMm: number;
  backOffsetYMm: number;
  /** Sangria visual do verso. Null acompanha automaticamente a sangria da frente. */
  backBleedMm: number | null;
  /** Gerador de sangria para artes que chegam sem sangria. */
  bleed: BleedConfig;
  /** Gerador de sangria fake aplicada somente nas imagens de verso. */
  backBleed: BleedConfig;
  /** Quanto a sangria fake do verso pode passar da linha de corte. */
  backExtraBleedMm: number;
  /**
   * Reduz a arte do verso ao redor do proprio centro, sem mexer no corte.
   * Serve para deixar a borda solida do verso mais exposta dentro da carta.
   */
  backInsetMm: number;
};

export const BACK_OFFSET_LIMIT_MM = 10;

export const DEFAULT_COMPOSER_CONFIG: ComposerConfig = {
  paperSize: "a4",
  orientation: "paisagem",
  customWidthMm: 297,
  customHeightMm: 210,
  cameoCustomSheetAck: false,
  cardWidthMm: 52,
  cardHeightMm: 52,
  bleedMm: 5,
  gapMm: 2,
  bleedMode: "completa",
  gridMode: "auto",
  gridColumns: 4,
  gridRows: 2,
  registrationWhiteBorderMm: 6,
  assemblyMode: "normal",
  gutterfoldGapMm: 4,
  sharedBackImageId: null,
  finishMode: "cameo",
  manualMarks: DEFAULT_MANUAL_MARKS,
  backOffsetXMm: 0,
  backOffsetYMm: 0,
  backBleedMm: null,
  bleed: DEFAULT_BLEED_CONFIG,
  backBleed: DEFAULT_BLEED_CONFIG,
  backExtraBleedMm: 2,
  backInsetMm: 0,
};
