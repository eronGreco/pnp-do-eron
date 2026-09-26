import type { BleedMode, ComposerConfig, PackingPolicy } from "./types";

export type EffectivePacking = {
  mode: BleedMode;
  gapMm: number;
};

const GUIDED_PACKING: Record<Exclude<PackingPolicy, "personalizado">, EffectivePacking> = {
  seguro: { mode: "completa", gapMm: 0 },
  economico: { mode: "compartilhada", gapMm: 0 },
  colado: { mode: "colada", gapMm: 0 },
};

/** Uma única origem para as medidas que organizam as cartas na folha. */
export function effectivePacking(config: ComposerConfig): EffectivePacking {
  return { mode: config.bleedMode, gapMm: Math.max(0, config.gapMm) };
}

export function packingPatch(
  policy: PackingPolicy,
  current: ComposerConfig,
): Pick<ComposerConfig, "packingPolicy" | "bleedMode" | "gapMm"> {
  if (policy === "personalizado") {
    return {
      packingPolicy: policy,
      bleedMode: current.bleedMode,
      gapMm: current.gapMm,
    };
  }
  const guided = GUIDED_PACKING[policy];
  return {
    packingPolicy: policy,
    bleedMode: guided.mode,
    gapMm: guided.gapMm,
  };
}

export const PACKING_LABEL: Record<PackingPolicy, string> = {
  seguro: "Seguro",
  economico: "Econômico",
  colado: "Cartas coladas",
  personalizado: "Personalizado",
};