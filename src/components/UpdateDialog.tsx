import { WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AppUpdate } from "@/pwa/useAppUpdate";

type Props = {
  update: AppUpdate;
  /** true quando existe trabalho aberto na tela */
  hasWork: boolean;
};

export function UpdateDialog({ update, hasWork }: Props) {
  return (
    <>
      <Dialog open={update.updateReady} onOpenChange={(open) => (!open ? update.dismiss() : undefined)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Existe uma versão nova do PNP do Eron</DialogTitle>
            <DialogDescription>
              {hasWork
                ? "Atualizar recarrega a página. A grade salva volta normalmente depois, mas o PDF aberto agora precisa ser aberto de novo."
                : "A atualização é rápida e a página recarrega sozinha."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="secondary" size="sm" onClick={update.dismiss}>
              Continuar nesta versão
            </Button>
            <Button size="sm" onClick={update.applyUpdate}>
              Atualizar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {update.checkSkipped && !update.updateReady && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-2 text-[11px] text-muted-foreground shadow-lg">
          <WifiOff className="size-3.5" />
          Sem internet, não é possível checar atualizações.
        </div>
      )}
    </>
  );
}
