import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComposerCard, ComposerConfig, ComposerImage } from "@/composer/types";
import { backImageFor } from "@/composer/pairFrontBack";
import { artKey, bleedSignature, effectiveCardBleed } from "./cardBleed";
import { bleedGeometry } from "./bleedGeometry";
import { renderBleedImage } from "./renderBleed";

type ArtSide = "front" | "back";
type Job = {
  imageId: string;
  signature: string;
  bleed: ReturnType<typeof effectiveCardBleed>;
  bleedMm: number;
};

/**
 * Mantem as artes com sangria criada, sempre em sincronia com os controles.
 * Cada carta pode ter o seu proprio ajuste, entao a arte e guardada por
 * (imagem + configuracao). Nada e enviado para fora: o desenho acontece no
 * canvas do navegador.
 */
export function useBleed(
  images: ComposerImage[],
  cards: ComposerCard[],
  config: ComposerConfig,
) {
  const [generated, setGenerated] = useState<Map<string, ComposerImage>>(new Map());
  const [working, setWorking] = useState(false);
  const cacheRef = useRef(new Map<string, ComposerImage>());

  const jobs = useMemo<Job[]>(() => {
    const byKey = new Map<string, Job>();
    for (const card of cards) {
      const frontBleed = effectiveCardBleed(card, config.bleed);
      if (frontBleed.enabled) {
        const signature = bleedSignature(frontBleed, config);
        byKey.set(artKey(card.frontImageId, signature), {
          imageId: card.frontImageId,
          signature,
          bleed: frontBleed,
          bleedMm: config.bleedMm,
        });
      }

      const backImageId = backImageFor(card, config);
      if (backImageId && config.backBleed.enabled && config.backExtraBleedMm > 0) {
        const backConfig = { ...config, bleedMm: config.backExtraBleedMm };
        const signature = bleedSignature(config.backBleed, backConfig);
        byKey.set(artKey(backImageId, signature), {
          imageId: backImageId,
          signature,
          bleed: config.backBleed,
          bleedMm: config.backExtraBleedMm,
        });
      } else if (backImageId && !config.backBleed.enabled && config.bleed.enabled && config.bleedMm > 0) {
        // Sem sangria propria no verso, ele recebe a mesma sangria criada da
        // frente; senao a arte original seria esticada na area com margem.
        const signature = bleedSignature(config.bleed, config);
        byKey.set(artKey(backImageId, signature), {
          imageId: backImageId,
          signature,
          bleed: config.bleed,
          bleedMm: config.bleedMm,
        });
      }
    }
    return [...byKey.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cards,
    config.bleed,
    config.sharedBackImageId,
    config.cardWidthMm,
    config.cardHeightMm,
    config.bleedMm,
    config.backBleed,
    config.backExtraBleedMm,
  ]);

  const jobsKey = useMemo(
    () => jobs.map((job) => artKey(job.imageId, job.signature)).join("§"),
    [jobs],
  );

  useEffect(() => {
    if (jobs.length === 0 || images.length === 0) {
      setGenerated(new Map());
      setWorking(false);
      return;
    }

    let cancelled = false;
    setWorking(true);
    const timer = setTimeout(() => {
      void (async () => {
        const byId = new Map(images.map((image) => [image.id, image]));
        const next = new Map<string, ComposerImage>();
        for (const job of jobs) {
          if (cancelled) return;
          const key = artKey(job.imageId, job.signature);
          const cached = cacheRef.current.get(key);
          if (cached) {
            next.set(key, cached);
            continue;
          }
          const image = byId.get(job.imageId);
          if (!image) continue;
          try {
            const result = await renderBleedImage(
              image,
              job.bleed,
              config.cardWidthMm,
              config.cardHeightMm,
              job.bleedMm,
            );
            if (!result) continue;
            cacheRef.current.set(key, result);
            next.set(key, result);
          } catch {
            // Arte que o navegador nao consegue redesenhar continua como veio.
          }
        }
        if (cancelled) return;
        setGenerated(next);
        setWorking(false);
      })();
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, jobsKey]);

  // Limpa as artes antigas guardadas em memoria quando o cache cresce demais.
  useEffect(() => {
    const cache = cacheRef.current;
    if (cache.size <= images.length * 4 + 8) return;
    const live = new Set(generated.keys());
    for (const [key, image] of cache) {
      if (live.has(key)) continue;
      URL.revokeObjectURL(image.previewUrl);
      cache.delete(key);
    }
  }, [images.length, generated]);

  /** Arte que deve ser usada para uma carta: a gerada quando existir. */
  const artFor = useCallback(
    (card: ComposerCard, imageId: string, side: ArtSide = "front"): ComposerImage | undefined => {
      const backOwn = side === "back" && config.backBleed.enabled;
      const bleed = backOwn
        ? config.backBleed
        : side === "back"
          ? config.bleed
          : effectiveCardBleed(card, config.bleed);
      if (!bleed.enabled) return undefined;
      const bleedMm = backOwn ? config.backExtraBleedMm : config.bleedMm;
      if (bleedMm <= 0) return undefined;
      return generated.get(artKey(imageId, bleedSignature(bleed, { ...config, bleedMm })));
    },
    [generated, config],
  );

  const geometry = useMemo(() => {
    const first = images[0];
    if (!first) return null;
    const bleed = config.bleed;
    return bleedGeometry(
      first.widthPx,
      first.heightPx,
      config.cardWidthMm,
      config.cardHeightMm,
      config.bleedMm,
      bleed.trimEnabled ? bleed.trimMm : 0,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, config.bleed, config.cardWidthMm, config.cardHeightMm, config.bleedMm]);

  return { generated, working, geometry, artFor };
}

export type Bleed = ReturnType<typeof useBleed>;
