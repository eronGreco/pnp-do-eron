import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BridgeUnavailableError } from "./CameoTransport";
import { checkBridgeHealth, LocalBridgeTransport } from "./LocalBridgeTransport";
import { REQUIRED_BRIDGE_VERSION, type BridgeHealth } from "./bridgeVersion";
import type { CutJob } from "./types";
import type { Workspace } from "@/state/useWorkspace";

const INSTALL_HINT =
  "Baixe o programa local, extraia a pasta e dê dois cliques em INICIAR_BRIDGE.bat.";

export function useCameo(workspace: Workspace, enabled = true) {
  const transport = useMemo(() => new LocalBridgeTransport(), []);
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const { addLog, dispatchJob, setBusyLabel, doc, setActiveSheet } = workspace;
  const busyRef = useRef(false);
  const warnedRef = useRef(false);

  const refreshBridge = useCallback(async () => {
    setHealth(null);
    if (!enabled) return false;
    const next = await checkBridgeHealth();
    setHealth(next);
    return next.online;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setHealth(null);
      warnedRef.current = false;
      void transport.disconnect();
      return;
    }
    let cancelled = false;
    const check = () => {
      void checkBridgeHealth().then((next) => {
        if (!cancelled) setHealth(next);
      });
    };
    check();
    const timer = window.setInterval(check, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, transport]);

  // Avisa uma unica vez quando o programa local instalado esta mais antigo que o site espera.
  useEffect(() => {
    if (!health?.online) {
      if (health && !health.online) warnedRef.current = false;
      return;
    }
    if (!health.outdated || warnedRef.current) return;
    warnedRef.current = true;
    addLog(
      `O programa local está na versão ${health.version ?? "antiga"} e este site já usa a ${REQUIRED_BRIDGE_VERSION}. Baixe o pacote novo em Máquina para continuar com tudo igual.`,
      "warn",
    );
  }, [health, addLog]);

  useEffect(() => {
    return transport.onEvent((event) => {
      if (event.type === "log") addLog(event.message);
      else if (event.type === "diagnostic") addLog(event.message, "info", event.message);
      else if (event.type === "error") addLog(event.message, "error");
      else if (event.type === "done") addLog(event.message, "ok");
      else if (event.type === "progress") {
        addLog(
          `Cortando carta ${event.card} de ${event.totalCards}, passada ${event.pass} de ${event.totalPasses}.`,
        );
      }
    });
  }, [addLog, transport]);

  const guard = useCallback(
    async (label: string, action: () => Promise<void>) => {
      if (busyRef.current) {
        addLog("Já existe um trabalho em andamento. Aguarde a conclusão.", "warn");
        return;
      }
      busyRef.current = true;
      setBusyLabel(label);
      try {
        await action();
      } catch (error) {
        dispatchJob({ type: "FAIL" });
        if (error instanceof BridgeUnavailableError) {
          addLog("PNP Cameo Bridge não encontrado.", "error", INSTALL_HINT);
          addLog(INSTALL_HINT, "warn");
        } else {
          addLog(
            error instanceof Error ? error.message : "Algo deu errado ao falar com a Cameo.",
            "error",
            error instanceof Error ? error.stack : undefined,
          );
        }
      } finally {
        busyRef.current = false;
        setBusyLabel(null);
      }
    },
    [addLog, dispatchJob, setBusyLabel],
  );

  const testConnection = useCallback(
    () =>
      guard("Testando conexão", async () => {
        if (!enabled) {
          addLog("Escolha Silhouette Cameo no acabamento para usar o programa local.", "warn");
          return;
        }
        dispatchJob({ type: "CONNECT" });
        addLog("Abrindo a Cameo em sessão exclusiva.");
        const status = await transport.testConnection();
        addLog(status.message, status.state === "ready" ? "ok" : "warn", status.firmware);
        if (status.state === "ready") dispatchJob({ type: "DEVICE_READY" });
        else dispatchJob({ type: "FAIL" });
      }),
    [addLog, dispatchJob, enabled, guard, transport],
  );

  const readMarks = useCallback(
    () =>
      guard("Lendo as marcas", async () => {
        if (!enabled) {
          addLog("Escolha Silhouette Cameo no acabamento para ler marcas pelo programa local.", "warn");
          return;
        }
        dispatchJob({ type: "CONNECT" });
        dispatchJob({ type: "DEVICE_READY" });
        dispatchJob({ type: "REGISTER" });
        addLog("Lendo as registration marks da folha carregada.");
        const result = await transport.readRegistrationMarks();
        if (result.ok) {
          addLog(
            `Marcas lidas em ${result.elapsedSeconds.toFixed(1)} s. REGISTRATION OK.`,
            "ok",
            result.message,
          );
          dispatchJob({ type: "REGISTERED" });
        } else {
          addLog("Não foi possível localizar as registration marks.", "error", result.message);
          dispatchJob({ type: "FAIL" });
        }
      }),
    [addLog, dispatchJob, enabled, guard, transport],
  );

  const cut = useCallback(
    (job: CutJob) =>
      guard("Cortando", async () => {
        if (!enabled) {
          addLog("Escolha Silhouette Cameo no acabamento para cortar pelo programa local.", "warn");
          return;
        }
        dispatchJob({ type: "CONNECT" });
        dispatchJob({ type: "DEVICE_READY" });
        dispatchJob({ type: "REGISTER" });
        dispatchJob({ type: "REGISTERED" });
        dispatchJob({ type: "CONFIGURE_BLADE" });
        dispatchJob({ type: "CUT" });
        addLog(
          `Iniciando o corte de ${job.cards.length} contorno(s) da folha ${job.sheet}.`,
        );
        try {
          await transport.cutJob(job);
        } catch (error) {
          addLog(
            "O corte foi interrompido e o estado físico da última carta é desconhecido. Verifique a folha antes de decidir o próximo passo.",
            "error",
            error instanceof Error ? error.message : String(error),
          );
          throw error;
        }
        dispatchJob({ type: "FINALIZE" });
        addLog("Corte concluído. A Cameo voltou para a posição inicial.", "ok");
        dispatchJob({ type: "DONE" });

        // Uma folha por vez: nunca seguimos sozinhos para a proxima.
        const sheets = doc?.sheets ?? [];
        const index = sheets.findIndex((s) => s.number === job.sheet);
        const next = index >= 0 ? sheets[index + 1] : undefined;
        if (next) {
          addLog(
            `Troque a folha na Cameo: carregue a folha ${next.number} de ${sheets.length} (frente = página ${next.frontPageIndex + 1}) e confirme antes de cortar.`,
            "warn",
          );
          setActiveSheet(next.number);
        }
      }),
    [addLog, dispatchJob, enabled, guard, transport, doc, setActiveSheet],
  );

  return {
    bridgeOnline: health === null ? null : health.online,
    bridgeVersion: health?.version ?? null,
    bridgeOutdated: health?.online === true && health.outdated,
    requiredBridgeVersion: REQUIRED_BRIDGE_VERSION,
    testConnection,
    readMarks,
    cut,
    refreshBridge,
    installHint: INSTALL_HINT,
  };
}
