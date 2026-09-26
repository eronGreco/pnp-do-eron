import { useState } from "react";
import { Download, MonitorSmartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/pwa/usePwaInstall";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function InstallAppButton() {
  const { canInstall, installed, manualOnly, install } = usePwaInstall();
  const [open, setOpen] = useState(false);

  if (installed) return null;

  if (canInstall) {
    return (
      <Button size="sm" variant="secondary" className="h-7 gap-1.5 px-2 text-xs" onClick={() => void install()}>
        <Download className="size-3.5" />
        Instalar no computador
      </Button>
    );
  }

  if (!manualOnly) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs">
          <MonitorSmartphone className="size-3.5" />
          Instalar no computador
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 text-xs leading-relaxed">
        <p className="font-display text-xs text-foreground">Instalar pelo navegador</p>
        <p className="mt-2 text-muted-foreground">
          Seu navegador não ofereceu a instalação automática. Abra o menu do navegador e
          escolha a opção de instalar ou adicionar este site como aplicativo. Depois de
          instalado, o PNP do Eron abre em janela própria e funciona sem internet.
        </p>
      </PopoverContent>
    </Popover>
  );
}
