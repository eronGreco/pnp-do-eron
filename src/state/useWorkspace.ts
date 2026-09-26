import { useCallback, useEffect, useMemo, useState } from "react";
import type { Card, CutSettings, Sheet } from "@/cameo/types";
import { loadPnpPdf } from "@/pdf/loadPdf";
import { downloadBytes, generatePrintPdf } from "@/pdf/generatePrintPdf";
import { readJobManifest } from "@/pdf/jobManifest";
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
} from "@/storage/settings";
import { matchPreset, presetById, PRESETS, type PresetId } from "@/storage/presets";
import { isJobBusy, nextJobState, type JobEvent, type JobState } from "@/state/jobMachine";

export type LogEntry = {
  id: number;
  at: string;
  text: string;
  level: "info" | "ok" | "warn" | "error";
  technical?: string | undefined;
};

export type WorkspaceDocument = {
  origin: "pdf" | "composer" | "resumed";
  fileName: string;
  bytes: ArrayBuffer;
  rotationDeg: 0 | 90;
  sheets: Sheet[];
};

let logCounter = 0;

export function useWorkspace() {
  const [doc, setDoc] = useState<WorkspaceDocument | null>(null);
  const [activeSheet, setActiveSheet] = useState(1);
  const [side, setSide] = useState<"front" | "back">("front");
  const [settings, setSettings] = useState<CutSettings>(DEFAULT_PREFERENCES.settings);
  const [presetId, setPresetId] = useState<PresetId>(DEFAULT_PREFERENCES.presetId);
  const [registrationWhiteBorderMm, setRegistrationWhiteBorderMmState] = useState(
    DEFAULT_PREFERENCES.registrationWhiteBorderMm,
  );
  const [jobState, setJobState] = useState<JobState>("idle");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);

  // Preferencias vivem no navegador: lidas apenas depois da hidratacao.
  useEffect(() => {
    const stored = loadPreferences();
    setSettings(stored.settings);
    setPresetId(stored.presetId);
    setRegistrationWhiteBorderMmState(stored.registrationWhiteBorderMm);
  }, []);

  const busy = isJobBusy(jobState) || busyLabel !== null;

  const addLog = useCallback(
    (text: string, level: LogEntry["level"] = "info", technical?: string) => {
      logCounter += 1;
      const entry: LogEntry = {
        id: logCounter,
        at: new Date().toLocaleTimeString("pt-BR"),
        text,
        level,
        technical,
      };
      setLog((entries) => [...entries, entry]);
    },
    [],
  );

  const clearLog = useCallback(() => setLog([]), []);

  const dispatchJob = useCallback((event: JobEvent) => {
    setJobState((state) => nextJobState(state, event));
  }, []);

  const applySettings = useCallback((next: CutSettings) => {
    const matched = matchPreset(next);
    setSettings(next);
    setPresetId(matched);
    savePreferences({
      ...loadPreferences(),
      settings: next,
      presetId: matched,
      registrationWhiteBorderMm,
    });
  }, [registrationWhiteBorderMm]);

  const applyPreset = useCallback((id: PresetId) => {
    const preset = presetById(id);
    setPresetId(id);
    setSettings(preset.settings);
    savePreferences({
      ...loadPreferences(),
      settings: preset.settings,
      presetId: id,
      registrationWhiteBorderMm,
    });
  }, [registrationWhiteBorderMm]);

  const setRegistrationWhiteBorderMm = useCallback((value: number) => {
    const next = Math.min(10, Math.max(0, value));
    setRegistrationWhiteBorderMmState(next);
    const stored = loadPreferences();
    savePreferences({ ...stored, registrationWhiteBorderMm: next });
  }, []);

  const setDocument = useCallback(
    (next: WorkspaceDocument) => {
      setDoc(next);
      setActiveSheet(1);
      setSide("front");
      setJobState((state) => nextJobState(nextJobState(state, { type: "PDF_LOAD" }), { type: "PDF_LOADED" }));
    },
    [],
  );

  /** Descarta as folhas montadas e volta a area de trabalho ao estado vazio. */
  const clearDocument = useCallback(() => {
    setDoc(null);
    setActiveSheet(1);
    setSide("front");
    setBusyLabel(null);
    setJobState("idle");
  }, []);


  const openPdf = useCallback(
    async (file: File) => {
      dispatchJob({ type: "PDF_LOAD" });
      setBusyLabel("Lendo o PDF");
      addLog(`Abrindo ${file.name}. O arquivo é processado no seu computador.`);
      try {
        const loaded = await loadPnpPdf(file);
        setDoc({
          origin: "pdf",
          fileName: loaded.fileName,
          bytes: loaded.bytes,
          rotationDeg: loaded.rotationDeg,
          sheets: loaded.sheets,
        });
        setActiveSheet(1);
        setSide("front");
        dispatchJob({ type: "PDF_LOADED" });

        const totalCards = loaded.sheets.reduce((sum, s) => sum + s.cards.length, 0);
        addLog(`${loaded.sheets.length} folha(s) e ${totalCards} carta(s) reconhecidas.`, "ok");
        if (loaded.rotationDeg === 90) {
          addLog("O PDF estava em retrato. Girei todas as páginas para paisagem.");
        }
        for (const warning of loaded.warnings) addLog(warning, "warn");
        for (const error of loaded.errors) addLog(error, "error");
      } catch (error) {
        dispatchJob({ type: "PDF_FAILED" });
        addLog(
          "Não consegui interpretar este PDF.",
          "error",
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setBusyLabel(null);
      }
    },
    [addLog, dispatchJob],
  );

  /** Reabre um PDF gerado aqui usando a receita de corte gravada no arquivo. */
  const openGeneratedPdf = useCallback(
    async (file: File) => {
      dispatchJob({ type: "PDF_LOAD" });
      setBusyLabel("Lendo o PDF");
      addLog(`Abrindo ${file.name}. O arquivo é processado no seu computador.`);
      try {
        const bytes = await file.arrayBuffer();
        const manifest = await readJobManifest(bytes);
        if (!manifest || manifest.sheets.length === 0) {
          dispatchJob({ type: "PDF_FAILED" });
          addLog(
            "Este PDF não foi gerado aqui, então não tenho as medidas de corte dele.",
            "error",
          );
          return;
        }
        setDoc({
          origin: "resumed",
          fileName: file.name,
          bytes,
          rotationDeg: 0,
          sheets: manifest.sheets,
        });
        setActiveSheet(manifest.sheets[0]!.number);
        setSide("front");
        dispatchJob({ type: "PDF_LOADED" });

        if (manifest.settings) {
          setSettings(manifest.settings);
          setPresetId(matchPreset(manifest.settings));
        }

        const totalCards = manifest.sheets.reduce(
          (sum: number, s) => sum + s.cards.length,
          0,
        );
        addLog(
          `${manifest.sheets.length} folha(s) e ${totalCards} carta(s) recuperadas do arquivo.`,
          "ok",
        );
        addLog("Escolha a folha que está carregada na Cameo antes de cortar.");
      } catch (error) {
        dispatchJob({ type: "PDF_FAILED" });
        addLog(
          "Não consegui ler este PDF.",
          "error",
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setBusyLabel(null);
      }
    },
    [addLog, dispatchJob],
  );

  const toggleCard = useCallback((sheetNumber: number, cardId: string) => {
    setDoc((current) => {
      if (!current) return current;
      return {
        ...current,
        sheets: current.sheets.map((sheet) =>
          sheet.number !== sheetNumber
            ? sheet
            : {
                ...sheet,
                cards: sheet.cards.map((card) =>
                  card.id === cardId ? { ...card, selected: !card.selected } : card,
                ),
              },
        ),
      };
    });
  }, []);

  const setSheetSelection = useCallback((sheetNumber: number, selected: boolean) => {
    setDoc((current) => {
      if (!current) return current;
      return {
        ...current,
        sheets: current.sheets.map((sheet) =>
          sheet.number !== sheetNumber
            ? sheet
            : { ...sheet, cards: sheet.cards.map((card) => ({ ...card, selected })) },
        ),
      };
    });
  }, []);

  const sheet: Sheet | null = useMemo(
    () => doc?.sheets.find((s) => s.number === activeSheet) ?? null,
    [doc, activeSheet],
  );

  const selectedCards: Card[] = useMemo(
    () => sheet?.cards.filter((card) => card.selected) ?? [],
    [sheet],
  );

  const generatePrint = useCallback(async () => {
    if (!doc) return;
    setBusyLabel("Gerando o PDF de impressão");
    try {
      if (doc.origin === "composer") {
        downloadBytes(new Uint8Array(doc.bytes.slice(0)), doc.fileName);
        addLog("PDF de impressão salvo no seu computador.", "ok");
        return;
      }
      const result = await generatePrintPdf(
        doc.bytes,
        doc.sheets,
        doc.fileName,
        doc.rotationDeg,
        registrationWhiteBorderMm,
      );
      downloadBytes(result.bytes, result.fileName);
      addLog(
        `PDF de impressão salvo: ${result.fileName}. O arquivo original não foi alterado.`,
        "ok",
        `Cruzes removidas: ${result.removedCropMarks}`,
      );
      for (const note of result.notes) addLog(note, "warn");
    } catch (error) {
      addLog(
        "Não consegui gerar o PDF de impressão.",
        "error",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setBusyLabel(null);
    }
  }, [addLog, doc, registrationWhiteBorderMm]);

  return {
    doc,
    sheet,
    selectedCards,
    activeSheet,
    setActiveSheet,
    side,
    setSide,
    settings,
    registrationWhiteBorderMm,
    setRegistrationWhiteBorderMm,
    applySettings,
    presetId,
    applyPreset,
    presets: PRESETS,
    jobState,
    dispatchJob,
    setJobState,
    log,
    addLog,
    clearLog,
    busy,
    busyLabel,
    setBusyLabel,
    openPdf,
    openGeneratedPdf,
    setDocument,
    clearDocument,

    toggleCard,
    setSheetSelection,
    generatePrint,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
