import { useCallback, useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export type PwaInstall = {
  /** o navegador ofereceu instalacao automatica */
  canInstall: boolean;
  /** o app ja esta aberto como aplicativo */
  installed: boolean;
  /** navegador sem instalacao automatica (instrucoes manuais) */
  manualOnly: boolean;
  install: () => Promise<void>;
};

export function usePwaInstall(): PwaInstall {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setPrompt(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!prompt) return;
    await prompt.prompt();
    try {
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      // Usuario fechou a janela do navegador: sem acao.
    }
    setPrompt(null);
  }, [prompt]);

  return {
    canInstall: Boolean(prompt) && !installed,
    installed,
    manualOnly: !prompt && !installed,
    install,
  };
}
