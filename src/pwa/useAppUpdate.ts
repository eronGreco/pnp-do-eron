import { useCallback, useEffect, useState } from "react";

import { registerServiceWorker, serviceWorkerEnabled } from "./registerServiceWorker";

const SESSION_KEY = "pnp-eron:update-asked";

function alreadyAsked(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markAsked(): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Sessao sem storage: perguntamos de novo, sem problema.
  }
}

export type AppUpdate = {
  /** existe versao nova instalada e esperando autorizacao */
  updateReady: boolean;
  /** navegador sem internet agora */
  offline: boolean;
  /** true quando nao foi possivel checar por falta de internet */
  checkSkipped: boolean;
  /** o app esta funcionando como aplicativo com suporte offline */
  offlineReady: boolean;
  applyUpdate: () => void;
  dismiss: () => void;
};

export function useAppUpdate(): AppUpdate {
  const [updateReady, setUpdateReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [checkSkipped, setCheckSkipped] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!serviceWorkerEnabled()) return;
    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;
    setAsked(alreadyAsked());

    const watch = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const check = () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          if (!cancelled) setUpdateReady(true);
        }
      };
      check();
      worker.addEventListener("statechange", check);
    };

    const check = async () => {
      if (!navigator.onLine) {
        setCheckSkipped(true);
        return;
      }
      setCheckSkipped(false);
      try {
        await registration?.update();
      } catch {
        setCheckSkipped(true);
      }
    };

    void (async () => {
      const ok = await registerServiceWorker();
      if (cancelled || !ok) return;
      registration = (await navigator.serviceWorker.getRegistration("/")) ?? null;
      if (cancelled || !registration) return;
      setOfflineReady(Boolean(registration.active));
      watch(registration.waiting);
      registration.addEventListener("updatefound", () => watch(registration?.installing ?? null));
      await check();
    })();

    const onOnline = () => void check();
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    markAsked();
    void (async () => {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const waiting = registration?.waiting;
      if (!waiting) {
        window.location.reload();
        return;
      }
      let reloaded = false;
      const reload = () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", reload);
      waiting.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(reload, 2500);
    })();
  }, []);

  const dismiss = useCallback(() => {
    markAsked();
    setAsked(true);
  }, []);

  return {
    updateReady: updateReady && !asked,
    offline,
    checkSkipped: checkSkipped && offline,
    offlineReady,
    applyUpdate,
    dismiss,
  };
}
