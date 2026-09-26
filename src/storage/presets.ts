import type { CutSettings } from "@/cameo/types";

export type PresetId = "papel-comum" | "glossy" | "glossy-bopp" | "personalizado";

export type Preset = {
  id: PresetId;
  name: string;
  note: string;
  settings: CutSettings;
};

const base = {
  lineOvercut: false,
  lineOvercutMm: 0.1,
} as const;

export const PRESETS: Preset[] = [
  {
    id: "papel-comum",
    name: "Papel comum",
    note: "Ponto de partida para papel sulfite.",
    settings: { depth: 1, force: 10, speed: 5, passes: 1, radiusMm: 3, ...base },
  },
  {
    id: "glossy",
    name: "Fotográfico glossy",
    note: "Ponto de partida para papel fotográfico brilhante.",
    settings: { depth: 3, force: 20, speed: 3, passes: 1, radiusMm: 3, ...base },
  },
  {
    id: "glossy-bopp",
    name: "Fotográfico glossy + BOPP linho frente e verso",
    note: "Ponto de partida para papel plastificado nas duas faces.",
    settings: { depth: 5, force: 28, speed: 2, passes: 2, radiusMm: 3, ...base },
  },
  {
    id: "personalizado",
    name: "Personalizado",
    note: "Valores ajustados manualmente por você.",
    settings: { depth: 3, force: 20, speed: 3, passes: 1, radiusMm: 3, ...base },
  },
];

export function presetById(id: PresetId): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[1]!;
}

export const SETTINGS_RANGES = {
  depth: { min: 1, max: 10, step: 1 },
  force: { min: 1, max: 33, step: 1 },
  speed: { min: 1, max: 10, step: 1 },
  passes: { min: 1, max: 5, step: 1 },
  radiusMm: { min: 0, max: 10, step: 0.5 },
} as const;

export function sameSettings(a: CutSettings, b: CutSettings): boolean {
  return (
    a.depth === b.depth &&
    a.force === b.force &&
    a.speed === b.speed &&
    a.passes === b.passes &&
    Math.abs(a.radiusMm - b.radiusMm) < 1e-9 &&
    a.lineOvercut === b.lineOvercut
  );
}

export function matchPreset(settings: CutSettings): PresetId {
  const found = PRESETS.find((p) => p.id !== "personalizado" && sameSettings(p.settings, settings));
  return found?.id ?? "personalizado";
}
