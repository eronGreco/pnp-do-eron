import type { Sheet } from "./types";

/**
 * Pagina do PDF que contem as marcas do sensor desta folha. Null quando o
 * PDF foi montado sem esse lado (por exemplo "Somente frentes" com marcas no
 * verso). Nunca cai para o outro lado: isso apontaria a pagina errada.
 */
export function registrationPageIndex(sheet: Sheet): number | null {
  if (sheet.assemblyMode === "gutterfold") return sheet.frontPageIndex;
  return sheet.registrationSide === "back" ? sheet.backPageIndex : sheet.frontPageIndex;
}
