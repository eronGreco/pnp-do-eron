import { useCallback, useMemo, useState } from "react";
import { loadPreferences, savePreferences } from "@/storage/settings";
import { normalizeSliceConfig, sliceRects } from "./sliceGeometry";
import { downloadBlob, loadSliceImages, releaseSliceImages, sliceToZip } from "./sliceImages";
import type { SliceConfig, SliceImage } from "./types";

export type Slicer = ReturnType<typeof useSlicer>;

export function useSlicer(addLog: (message: string, kind?: "info" | "warn" | "error") => void) {
  const [images, setImages] = useState<SliceImage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [config, setConfigState] = useState<SliceConfig>(() =>
    normalizeSliceConfig(loadPreferences().sliceConfig),
  );
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const importing = progress?.total === 0;

  const setConfig = useCallback((patch: Partial<SliceConfig>) => {
    setConfigState((current) => {
      const next = normalizeSliceConfig({ ...current, ...patch });
      const prefs = loadPreferences();
      savePreferences({ ...prefs, sliceConfig: next });
      return next;
    });
  }, []);

  const active = useMemo(
    () => images.find((image) => image.id === activeId) ?? images[0] ?? null,
    [images, activeId],
  );

  const rects = useMemo(
    () => (active ? sliceRects(active.widthPx, active.heightPx, config) : []),
    [active, config],
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      setProgress({ done: 0, total: 0 });
      try {
        const { images: loaded, rejected } = await loadSliceImages(files);
        for (const message of rejected) addLog(message, "warn");
        const firstLoaded = loaded[0];
        if (!firstLoaded) return;
        setImages((current) => [...current, ...loaded]);
        setActiveId((current) => current ?? firstLoaded.id);
        addLog(`${loaded.length} folha(s) carregada(s) para fatiar.`);
      } finally {
        setProgress(null);
      }
    },
    [addLog],
  );

  const removeImage = useCallback((id: string) => {
    setImages((current) => {
      const target = current.find((image) => image.id === id);
      if (target) releaseSliceImages([target]);
      return current.filter((image) => image.id !== id);
    });
    setActiveId((current) => (current === id ? null : current));
  }, []);

  const clearAll = useCallback(() => {
    setImages((current) => {
      releaseSliceImages(current);
      return [];
    });
    setActiveId(null);
  }, []);

  const sliceAndDownload = useCallback(async () => {
    if (images.length === 0) return;
    setProgress({ done: 0, total: images.length * config.columns * config.rows });
    try {
      const zip = await sliceToZip(images, config, (done, total) => setProgress({ done, total }));
      downloadBlob(zip, "cartas-recortadas.zip");
      addLog(
        `${images.length * config.columns * config.rows} carta(s) exportada(s) em ${config.outputFormat === "png" ? "PNG" : "JPG"}, ${config.outputDpi} DPI.`,
      );
    } catch {
      addLog("Não consegui recortar estas folhas. Tente com imagens menores.", "error");
    } finally {
      setProgress(null);
    }
  }, [images, config, addLog]);

  return {
    images,
    active,
    activeId: active?.id ?? null,
    setActiveId,
    config,
    setConfig,
    rects,
    progress,
    importing,
    addFiles,
    removeImage,
    clearAll,
    sliceAndDownload,
  };
}
