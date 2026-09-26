import { useEffect, useState } from "react";
import { MonitorX } from "lucide-react";

import { Button } from "@/components/ui/button";

const SESSION_KEY = "pnp-eron:small-screen-ok";
const MIN_WIDTH = 1024;

export function SmallScreenNotice() {
  const [small, setSmall] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem(SESSION_KEY) === "1");
    } catch {
      setDismissed(false);
    }

    const query = window.matchMedia(`(max-width: ${MIN_WIDTH - 1}px)`);
    const sync = () => setSmall(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  if (!small || dismissed) return null;

  const accept = () => {
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Sem storage: o aviso volta a aparecer, sem problema.
    }
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-6">
      <div className="max-w-sm rounded-lg border border-border bg-panel p-5 text-center shadow-xl">
        <MonitorX className="mx-auto size-6 text-warning" />
        <h2 className="mt-3 font-display text-sm text-foreground">
          Esta tela é pequena para o PNP do Eron
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          O PNP do Eron foi feito para tela grande de computador. Você pode continuar mexendo
          aqui, mas a experiência vai ser bem ruim: os painéis, a prévia da folha e o arraste
          das cartas precisam de espaço.
        </p>
        <Button size="sm" className="mt-4 w-full" onClick={accept}>
          Continuar assim
        </Button>
      </div>
    </div>
  );
}
