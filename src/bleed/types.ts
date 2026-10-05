/**
 * Configuracao do gerador de sangria. Tudo roda no navegador: a arte original
 * nunca e alterada, o resultado e uma copia em memoria.
 */

/** Jeitos de inventar a faixa de sangria ao redor da arte. */
export type BleedMethod = "esticar" | "espelhar" | "cor" | "esticar-desfoque";

export type BleedConfig = {
  enabled: boolean;
  method: BleedMethod;
  /** Cor usada no metodo "cor" quando a cor media esta desligada. */
  color: string;
  /** Usa a cor media da borda da carta em vez da cor escolhida. */
  useAverageColor: boolean;
  /** 1 a 10: quanto o desfoque suaviza a faixa criada. */
  blurStrength: number;
  /** Apara uma faixa da borda da arte antes de criar a sangria. */
  trimEnabled: boolean;
  trimMm: number;
  /** Arredonda os cantos da arte (depois da apara) antes de criar a sangria. */
  trimCornersEnabled: boolean;
  /** Raio do arredondamento dos cantos, em mm. */
  trimCornersMm: number;
};

export const DEFAULT_BLEED_CONFIG: BleedConfig = {
  enabled: false,
  method: "esticar",
  color: "#ffffff",
  useAverageColor: true,
  blurStrength: 4,
  trimEnabled: false,
  trimMm: 1,
  trimCornersEnabled: false,
  trimCornersMm: 3,
};

export const BLEED_METHOD_LABEL: Record<BleedMethod, string> = {
  esticar: "Esticar a bordinha",
  espelhar: "Espelhar a arte",
  cor: "Cor sólida",
  "esticar-desfoque": "Esticar com leve desfoque",
};

export const BLEED_METHOD_HELP: Record<BleedMethod, string> = {
  esticar:
    "Repete a última fileira de cor da arte para fora. Quase invisível em fundos lisos.",
  espelhar:
    "Reflete alguns milímetros da arte para fora. Bom para fundos com textura ou desenho.",
  cor: "Preenche com uma cor só. Ideal quando a borda da carta já é de cor única.",
  "esticar-desfoque":
    "Estica e suaviza, disfarçando a emenda em artes com detalhe perto da borda.",
};
