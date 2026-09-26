import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBleed } from "@/bleed/useBleed";
import type { BleedConfig } from "@/bleed/types";
import {
  clearComposerState,
  loadComposerState,
  reviveImages,
  saveComposerState,
} from "@/storage/composerStore";
import { downloadBytes } from "@/pdf/generatePrintPdf";
import { extractCricutMarksFromPdf } from "@/cricut/extractMarks";
import {
  cricutMarkCoverage,
  cricutTemplateMatches,
  cricutTemplateStamp as cricutTemplateStampOf,
  releaseCricutMarksTemplate,
  reviveCricutMarksTemplate,
  stripCricutMarksTemplate,
  type CricutMarksTemplate,
} from "@/cricut/markTemplate";
import { buildSheetPdf } from "./buildSheetPdf";
import { buildStampOf } from "./buildStamp";
import { importImages, releaseImages } from "./importImages";
import { gridFor, layoutSheets } from "./layoutSheets";
import { cardsFromImages, cardsFromPairs } from "./pairFrontBack";
import { auditCutSizes } from "./sizeAudit";
import { markCoverage, MIN_SAFE_WHITE_BORDER_MM } from "./markCoverage";
import { orientationAllowed, paperAllowed } from "./paperSizes";
import {
  DEFAULT_COMPOSER_CONFIG,
  type ComposerCard,
  type ComposerConfig,
  type ComposerImage,
} from "./types";
import type { Workspace } from "@/state/useWorkspace";

export type ImportMode = "individual" | "pares";

export type Composer = ReturnType<typeof useComposer>;

export function useComposer(workspace: Workspace) {
  const [images, setImages] = useState<ComposerImage[]>([]);
  const [cards, setCards] = useState<ComposerCard[]>([]);
  const [config, setConfigState] = useState<ComposerConfig>(DEFAULT_COMPOSER_CONFIG);
  const [importMode, setImportModeState] = useState<ImportMode>("individual");
  const [working, setWorking] = useState(false);
  const [previewSheet, setPreviewSheet] = useState(1);
  const [previewSide, setPreviewSide] = useState<"front" | "back">("front");
  const [restored, setRestored] = useState(false);
  const [buildStamp, setBuildStamp] = useState<string | null>(null);
  const [cricutMarks, setCricutMarks] = useState<CricutMarksTemplate | null>(null);
  const hydration = useRef<"loading" | "done" | "aborted">("loading");
  const { addLog } = workspace;

  /** Qualquer acao do usuario cancela a restauracao: a acao dele sempre ganha. */
  const abortHydration = useCallback(() => {
    if (hydration.current === "loading") hydration.current = "aborted";
  }, []);

  const setConfig = useCallback<typeof setConfigState>(
    (value) => {
      abortHydration();
      setConfigState((current) => {
        const next = typeof value === "function" ? value(current) : value;
        if (next.finishMode !== "cameo") return next;

        // Na Cameo, folha diferente de A4 deitada vale so com o aviso aceito.
        const ack = next.cameoCustomSheetAck;
        const paperBad = !paperAllowed(next.paperSize, "cameo", ack);
        const orientationBad = !orientationAllowed(next.orientation, "cameo", ack);
        if (!paperBad && !orientationBad) return next;

        addLog(
          "Na Silhouette Cameo a folha é A4 deitada, do jeito que foi testado na máquina, então voltei para ela.",
          "warn",
        );
        return {
          ...next,
          paperSize: paperBad ? "a4" : next.paperSize,
          orientation: orientationBad ? "paisagem" : next.orientation,
        };
      });
    },
    [abortHydration, addLog],
  );


  const setImportMode = useCallback<typeof setImportModeState>(
    (value) => {
      abortHydration();
      setImportModeState(value);
    },
    [abortHydration],
  );

  // Restaura o trabalho salvo neste navegador (IndexedDB local).
  useEffect(() => {
    let cancelled = false;
    void loadComposerState()
      .then((stored) => {
        if (cancelled || hydration.current !== "loading") return;
        if (!stored || stored.cards.length === 0) return;
        setImages(reviveImages(stored.images));
        setCards(stored.cards);
        setConfigState({
          ...DEFAULT_COMPOSER_CONFIG,
          ...stored.config,
          bleed: { ...DEFAULT_COMPOSER_CONFIG.bleed, ...stored.config.bleed },
          backBleed: { ...DEFAULT_COMPOSER_CONFIG.backBleed, ...(stored.config.backBleed ?? {}) },
          manualMarks: { ...DEFAULT_COMPOSER_CONFIG.manualMarks, ...stored.config.manualMarks },
        });
        setCricutMarks(reviveCricutMarksTemplate(stored.cricutMarks));
        setImportModeState(stored.importMode);
        setRestored(true);
        workspace.addLog(
          `Trabalho anterior restaurado (${stored.cards.length} carta(s)). Fica salvo apenas neste navegador.`,
          "info",
        );
      })
      .catch(() => {
        // Banco ilegivel: comeca vazio sem quebrar.
      })
      .finally(() => {
        if (hydration.current === "loading") hydration.current = "done";
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salvamento automatico (com pequeno atraso) de cada alteracao.
  useEffect(() => {
    if (hydration.current === "loading") return;
    const timer = setTimeout(() => {
      void saveComposerState({
        images: images.map(({ id, name, mime, bytes, widthPx, heightPx }) => ({
          id,
          name,
          mime,
          bytes,
          widthPx,
          heightPx,
        })),
        cards,
        config,
        importMode,
        cricutMarks: stripCricutMarksTemplate(cricutMarks),
      }).catch(() => {
        addLog(
          "Não consegui salvar o trabalho neste navegador (armazenamento cheio ou bloqueado).",
          "warn",
        );
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [images, cards, config, importMode, cricutMarks, addLog]);


  // Assinatura atual x assinatura da ultima montagem: diz se o PDF envelheceu.
  const currentStamp = useMemo(
    () => buildStampOf(cards, config, workspace.settings.radiusMm),
    [cards, config, workspace.settings.radiusMm],
  );
  const outdated = buildStamp !== null && buildStamp !== currentStamp;

  const grid = useMemo(() => gridFor(config), [config]);
  const layouts = useMemo(() => layoutSheets(cards, config), [cards, config]);
  const cricutTemplateStamp = useMemo(
    () => cricutTemplateStampOf(layouts, config, workspace.settings.radiusMm),
    [layouts, config, workspace.settings.radiusMm],
  );
  const sizeAudit = useMemo(() => auditCutSizes(layouts, config), [layouts, config]);
  /** Faixa branca das marcas do sensor conferida contra as cartas. */
  const coverage = useMemo(() => markCoverage(cards, config), [cards, config]);
  const cricutCoverage = useMemo(
    () => cricutMarkCoverage(cards, layouts, config, cricutMarks),
    [cards, layouts, config, cricutMarks],
  );
  const imageById = useMemo(() => new Map(images.map((i) => [i.id, i])), [images]);

  // Sangria criada ao vivo para as artes que chegam sem sangria.
  const bleed = useBleed(images, cards, config);
  /** Arte que a previa e o PDF devem usar para cada carta. */
  const artFor = useCallback(
    (card: ComposerCard, imageId: string, side: "front" | "back" = "front") =>
      bleed.artFor(card, imageId, side) ?? imageById.get(imageId),
    [bleed, imageById],
  );

  /** Ajuste de sangria de uma carta. Null volta para o padrao do trabalho. */
  const setCardBleed = useCallback(
    (cardId: string, patch: Partial<BleedConfig> | null) => {
      abortHydration();
      setCards((current) =>
        current.map((card) => (card.id === cardId ? { ...card, bleed: patch } : card)),
      );
    },
    [abortHydration],
  );

  /** Copia o ajuste de uma carta para outras cartas escolhidas. */
  const copyCardBleed = useCallback(
    (fromCardId: string, toCardIds: string[]) => {
      abortHydration();
      setCards((current) => {
        const source = current.find((card) => card.id === fromCardId);
        if (!source) return current;
        const ids = new Set(toCardIds);
        const patch = source.bleed ? { ...source.bleed } : null;
        return current.map((card) => (ids.has(card.id) ? { ...card, bleed: patch } : card));
      });
    },
    [abortHydration],
  );

  /** Tira todas as excecoes: todas as cartas voltam a seguir o padrao. */
  const clearCardBleedOverrides = useCallback(() => {
    abortHydration();
    setCards((current) => current.map((card) => ({ ...card, bleed: null })));
  }, [abortHydration]);

  const addFiles = useCallback(
    async (files: File[]) => {
      abortHydration();
      const result = await importImages(files);
      setImages((current) => [...current, ...result.images]);

      if (importMode === "pares") {
        const { cards: newCards, leftover } = cardsFromPairs(result.images);
        setCards((current) => [...current, ...newCards]);
        if (leftover) {
          workspace.addLog(
            `A imagem ${leftover.name} ficou sem par, então esta carta está sem verso.`,
            "warn",
          );
        }
      } else {
        setCards((current) => [...current, ...cardsFromImages(result.images)]);
      }

      for (const message of result.rejected) workspace.addLog(message, "warn");
      if (result.images.length > 0) {
        workspace.addLog(`${result.images.length} imagem(ns) adicionada(s).`, "ok");
      }
    },
    [abortHydration, importMode, workspace],
  );

  /** Sobe uma imagem e usa como verso de uma carta especifica. */
  const setCardBackFromFile = useCallback(
    async (cardId: string, file: File) => {
      abortHydration();
      const result = await importImages([file]);
      for (const message of result.rejected) workspace.addLog(message, "warn");
      const image = result.images[0];
      if (!image) return;
      setImages((current) => [...current, image]);
      setCards((current) =>
        current.map((card) => (card.id === cardId ? { ...card, backImageId: image.id } : card)),
      );
    },
    [abortHydration, workspace],
  );

  const clearCardBack = useCallback((cardId: string) => {
    abortHydration();
    setCards((current) =>
      current.map((card) => (card.id === cardId ? { ...card, backImageId: null } : card)),
    );
  }, [abortHydration]);

  const setSharedBackFromFile = useCallback(
    async (file: File) => {
      abortHydration();
      const result = await importImages([file]);
      for (const message of result.rejected) workspace.addLog(message, "warn");
      const image = result.images[0];
      if (!image) return;
      setImages((current) => [...current, image]);
      setConfig((current) => ({ ...current, sharedBackImageId: image.id }));
    },
    [abortHydration, setConfig, workspace],
  );

  const clearSharedBack = useCallback(() => {
    setConfig((current) => ({ ...current, sharedBackImageId: null }));
  }, [setConfig]);

  const removeCard = useCallback((cardId: string) => {
    abortHydration();
    setCards((current) => current.filter((card) => card.id !== cardId));
  }, [abortHydration]);

  const moveCard = useCallback((cardId: string, targetCardId: string, after = false) => {
    if (cardId === targetCardId) return;
    abortHydration();
    setCards((current) => {
      const from = current.findIndex((card) => card.id === cardId);
      const to = current.findIndex((card) => card.id === targetCardId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (!moved) return current;
      // Depois de remover, os índices abaixo do ponto de origem andam uma casa.
      const insertAt = from < to ? (after ? to : to - 1) : after ? to + 1 : to;
      next.splice(insertAt, 0, moved);
      return next;
    });
  }, [abortHydration]);

  const toggleCardSelected = useCallback((cardId: string) => {
    abortHydration();
    setCards((current) =>
      current.map((card) =>
        card.id === cardId ? { ...card, selected: !card.selected } : card,
      ),
    );
    const mountedSheet = workspace.doc?.sheets.find((sheet) =>
      sheet.cards.some((card) => card.id === cardId),
    );
    if (mountedSheet) workspace.toggleCard(mountedSheet.number, cardId);
  }, [abortHydration, workspace]);

  const setAllSelected = useCallback((selected: boolean) => {
    abortHydration();
    setCards((current) => current.map((card) => ({ ...card, selected })));
    for (const sheet of workspace.doc?.sheets ?? []) {
      workspace.setSheetSelection(sheet.number, selected);
    }
  }, [abortHydration, workspace]);

  const setCardsSelected = useCallback((cardIds: string[], selected: boolean) => {
    abortHydration();
    const ids = new Set(cardIds);
    setCards((current) =>
      current.map((card) => (ids.has(card.id) ? { ...card, selected } : card)),
    );
  }, [abortHydration]);

  /** Limpa tudo de verdade: imagens, cartas, folhas montadas e o que estava salvo. */
  const clearAll = useCallback(async () => {
    abortHydration();
    releaseImages(images);
    setImages([]);
    setCards([]);
    setConfigState((current) => ({ ...current, sharedBackImageId: null }));
    setPreviewSheet(1);
    setPreviewSide("front");
    setRestored(false);
    setBuildStamp(null);
    releaseCricutMarksTemplate(cricutMarks);
    setCricutMarks(null);
    workspace.clearDocument();
    await clearComposerState().catch(() => {});
    workspace.addLog("Trabalho e imagens removidos deste navegador.", "info");
  }, [abortHydration, images, cricutMarks, workspace]);

  const importCricutMarks = useCallback(
    async (file: File) => {
      abortHydration();
      if (config.finishMode !== "cricut") {
        workspace.addLog("Escolha Cricut no acabamento antes de importar o PDF de marcas.", "warn");
        return;
      }
      setWorking(true);
      try {
        const template = await extractCricutMarksFromPdf(file, cricutTemplateStamp);
        setCricutMarks((current) => {
          releaseCricutMarksTemplate(current);
          return template;
        });
        setBuildStamp(null);
        workspace.addLog(
          `${template.pages.length} página(s) de marcas da Cricut importada(s). Tudo ficou local no navegador.`,
          "ok",
        );
      } catch (error) {
        workspace.addLog(
          "Não consegui ler as marcas da Cricut nesse PDF.",
          "error",
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setWorking(false);
      }
    },
    [abortHydration, config.finishMode, cricutTemplateStamp, workspace],
  );

  const clearCricutMarks = useCallback(() => {
    abortHydration();
    setCricutMarks((current) => {
      releaseCricutMarksTemplate(current);
      return null;
    });
    setBuildStamp(null);
    workspace.addLog("Molde de marcas da Cricut removido.", "info");
  }, [abortHydration, workspace]);


  const build = useCallback(async (download = true) => {
    if (cards.length === 0) {
      workspace.addLog("Adicione pelo menos uma imagem de carta.", "warn");
      return;
    }
    if (config.finishMode === "cricut") {
      if (!cricutTemplateMatches(cricutMarks, cricutTemplateStamp)) {
        workspace.addLog(
          "Importe o PDF de marcas da Cricut atualizado antes de montar o PDF final.",
          "warn",
        );
        return;
      }
      if (cricutCoverage.content.length > 0) {
        workspace.addLog(
          "As marcas da Cricut estão cobrindo conteúdo de carta. Ajuste a grade antes de montar.",
          "error",
        );
        return;
      }
    }
    setWorking(true);
    try {
      const composed = await buildSheetPdf(
        cards,
        images,
        config,
        workspace.settings,
        bleed.artFor,
        cricutMarks,
      );
      workspace.setDocument({
        origin: "composer",
        fileName: composed.fileName,
        bytes: composed.bytes,
        rotationDeg: 0,
        sheets: composed.sheets,
      });
      setBuildStamp(currentStamp);
      workspace.addLog(
        `${composed.sheets.length} folha(s) montada(s) com ${cards.length} ${config.assemblyMode === "gutterfold" ? "peça(s)" : "carta(s)"}.`,
        "ok",
      );
      for (const warning of composed.warnings) workspace.addLog(warning, "warn");
      for (const error of composed.errors) workspace.addLog(error, "error");

      if (download && composed.errors.length === 0) {
        downloadBytes(new Uint8Array(composed.bytes.slice(0)), composed.fileName);
        workspace.addLog("PDF de impressão salvo no seu computador.", "ok");
      } else if (download) {
        workspace.addLog(
          "Montei as folhas, mas não baixei o PDF por causa do erro acima.",
          "warn",
        );
      }
    } catch (error) {
      workspace.addLog(
        "Não consegui montar as folhas com estas imagens.",
        "error",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setWorking(false);
    }
  }, [cards, config, images, workspace, bleed.artFor, currentStamp, cricutMarks, cricutTemplateStamp, cricutCoverage.content.length]);

  /**
   * Aplica a grade sugerida para tirar as cartas de baixo das marcas.
   * Muda apenas quantas cartas cabem por linha e por coluna: o tamanho da
   * carta nunca muda, e o verso continua espelhando as mesmas posicoes.
   */
  const applyGridSuggestion = useCallback(() => {
    const suggestion = coverage.suggestedGrid;
    if (!suggestion) return;
    setConfig((current) => ({
      ...current,
      gridMode: "manual",
      gridColumns: suggestion.columns,
      gridRows: suggestion.rows,
    }));
    workspace.addLog(
      `Grade ajustada para ${suggestion.columns} por ${suggestion.rows}. O tamanho das cartas continua o mesmo.`,
      "ok",
    );
  }, [coverage.suggestedGrid, setConfig, workspace]);

  /** Reduz a sangria até a medida que resolve, de 1 mm em 1 mm. */
  const reduceBleed = useCallback(() => {
    const target = coverage.suggestedBleedMm;
    if (target === null) return;
    setConfig((current) => ({ ...current, bleedMm: target }));
    workspace.addLog(`Sangria reduzida para ${target} mm.`, "ok");
  }, [coverage.suggestedBleedMm, setConfig, workspace]);

  /** Reduz a faixa branca das marcas, sem descer do mínimo que o sensor lê. */
  const reduceWhiteBorder = useCallback(() => {
    const target = coverage.suggestedWhiteBorderMm;
    if (target === null || target < MIN_SAFE_WHITE_BORDER_MM) return;
    setConfig((current) => ({ ...current, registrationWhiteBorderMm: target }));
    workspace.addLog(`Faixa branca das marcas reduzida para ${target} mm.`, "ok");
  }, [coverage.suggestedWhiteBorderMm, setConfig, workspace]);

  const applyCricutGridSuggestion = useCallback(() => {
    const suggestion = cricutCoverage.suggestedGrid;
    if (!suggestion) return;
    setConfig((current) => ({
      ...current,
      gridMode: "manual",
      gridColumns: suggestion.columns,
      gridRows: suggestion.rows,
    }));
    workspace.addLog(
      `Grade ajustada para ${suggestion.columns} por ${suggestion.rows}. Gere e importe o molde da Cricut outra vez.`,
      "ok",
    );
  }, [cricutCoverage.suggestedGrid, setConfig, workspace]);

  return {
    images,
    cards,
    config,
    setConfig,
    importMode,
    setImportMode,
    restored,

    grid,
    layouts,
    sizeAudit,
    coverage,
    cricutMarks,
    cricutTemplateStamp,
    cricutCoverage,
    applyGridSuggestion,
    applyCricutGridSuggestion,
    reduceBleed,
    reduceWhiteBorder,
    imageById,
    artFor,
    setCardBleed,
    copyCardBleed,
    clearCardBleedOverrides,
    bleed,
    working,
    previewSheet,
    setPreviewSheet,
    previewSide,
    setPreviewSide,
    addFiles,
    setCardBackFromFile,
    clearCardBack,
    setSharedBackFromFile,
    clearSharedBack,
    removeCard,
    moveCard,
    toggleCardSelected,
    setAllSelected,
    setCardsSelected,
    importCricutMarks,
    clearCricutMarks,
    clearAll,
    build,
    outdated,
  };
}
