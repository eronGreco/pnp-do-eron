import type { CutSettings } from "@/cameo/types";
import { DEFAULT_SLICE_CONFIG, type SliceConfig } from "@/slicer/types";
import { presetById, type PresetId } from "./presets";

const KEY = "pnp-cameo:settings";

export type StoredPreferences = {
  presetId: PresetId;
  settings: CutSettings;
  diagnosticsOpen: boolean;
  registrationWhiteBorderMm: number;
  sliceConfig: SliceConfig;
};

export const DEFAULT_PREFERENCES: StoredPreferences = {
  presetId: "glossy",
  settings: presetById("glossy").settings,
  diagnosticsOpen: false,
  registrationWhiteBorderMm: 6,
  sliceConfig: DEFAULT_SLICE_CONFIG,
};

/** Somente preferencias. PDFs e imagens nunca sao persistidos. */
export function loadPreferences(): StoredPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<StoredPreferences>;
    return {
      presetId: parsed.presetId ?? DEFAULT_PREFERENCES.presetId,
      settings: { ...DEFAULT_PREFERENCES.settings, ...(parsed.settings ?? {}) },
      diagnosticsOpen: parsed.diagnosticsOpen ?? false,
      registrationWhiteBorderMm:
        typeof parsed.registrationWhiteBorderMm === "number"
          ? Math.min(10, Math.max(0, parsed.registrationWhiteBorderMm))
          : DEFAULT_PREFERENCES.registrationWhiteBorderMm,
      sliceConfig: { ...DEFAULT_SLICE_CONFIG, ...(parsed.sliceConfig ?? {}) },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: StoredPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Preferencias sao opcionais; falha de storage nunca quebra o app.
  }
}
