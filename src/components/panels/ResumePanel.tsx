import { useRef } from "react";
import { RotateCcw } from "lucide-react";
import type { Workspace } from "@/state/useWorkspace";
import { Button } from "@/components/ui/button";

/**
 * Reabre um PDF gerado por este sistema para cortar depois ou repetir um corte.
 * A receita de corte vem dentro do proprio arquivo, sem redeteccao.
 */
export function ResumePanel({ workspace }: { workspace: Workspace }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { doc, busy } = workspace;
  const resumed = doc?.origin === "resumed";

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void workspace.openGeneratedPdf(file);
        }}
      />

      <Button className="w-full" onClick={() => fileRef.current?.click()} disabled={busy}>
        <RotateCcw className="size-4" />
        Abrir PDF gerado aqui
      </Button>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Serve para cortar mais tarde ou repetir um corte que deu errado. As medidas de cada carta
        vêm gravadas dentro do arquivo, então o corte sai igual ao da primeira vez. O arquivo é lido
        no seu computador.
      </p>

      {resumed && (
        <div className="panel-surface bg-secondary/30 p-3 text-[11px]">
          <p className="truncate font-medium text-foreground">{doc.fileName}</p>
          <p className="text-muted-foreground">
            {doc.sheets.length} folha(s) ·{" "}
            {doc.sheets.reduce((sum, sheet) => sum + sheet.cards.length, 0)} carta(s)
          </p>
          <p className="mt-1 text-muted-foreground">
            Escolha a folha em “Folhas” e corte uma por vez.
          </p>
        </div>
      )}
    </div>
  );
}
