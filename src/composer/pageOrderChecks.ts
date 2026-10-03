import { backImageFor } from "./pairFrontBack";
import { isGutterfold } from "./layoutSheets";
import type { ComposerCard, ComposerConfig } from "./types";

/**
 * O trabalho tem algum verso util? Conta a arte de verso (propria ou o verso
 * comum do baralho) e marcas impressas no verso. Todas as cartas da fila
 * entram na montagem: a selecao serve apenas para escolher o que cortar.
 */
export function jobHasBackContent(cards: ComposerCard[], config: ComposerConfig): boolean {
  if (isGutterfold(config)) return false;
  if (cards.some((card) => backImageFor(card, config) !== null)) return true;
  // Marcas da Silhouette no verso sao lidas pelo sensor: o verso e necessario.
  if (config.finishMode === "cameo") return config.cameoRegistrationSide === "back";
  // Guilhotina: marcas "so no verso" foram escolha deliberada, entao o verso
  // e necessario. "ambos" ou "frente" nao criam verso so por causa de marcas.
  if (config.finishMode === "manual") return config.manualMarks.sides === "verso";
  return false;
}

/**
 * Aviso quando a organizacao de paginas deixa de fora o lado que recebe as
 * marcas de corte. Nao bloqueia: pode ser a primeira passada de impressao.
 */
export function marksPassWarning(config: ComposerConfig): string | null {
  if (isGutterfold(config)) return null;
  const order = config.pageOrder ?? "intercalado";
  if (order !== "frentes" && order !== "versos") return null;
  const missing = order === "frentes" ? "o verso" : "a frente";
  const missingSide = order === "frentes" ? "back" : "front";
  if (config.finishMode === "cameo") {
    if (config.cameoRegistrationSide !== missingSide) return null;
    return `Este PDF não inclui ${missing}, mas as marcas da Silhouette estão configuradas ${missingSide === "back" ? "no verso" : "na frente"}. Ele serve para a primeira passada de impressão; para cortar, imprima também a passada que contém as marcas.`;
  }
  if (config.finishMode === "cricut") {
    if (missingSide !== "front") return null;
    return "Este PDF não inclui a frente, onde ficam as marcas da Cricut. Ele serve para a passada do verso; para cortar, use a folha impressa com a frente.";
  }
  const side = config.manualMarks.sides;
  const wanted = missingSide === "back" ? "verso" : "frente";
  if (side !== wanted) return null;
  return `Este PDF não inclui ${missing}, mas as marcas de corte estão configuradas só ${wanted === "verso" ? "no verso" : "na frente"}. Ele serve para a primeira passada de impressão; para cortar, imprima também a passada que contém as marcas.`;
}
