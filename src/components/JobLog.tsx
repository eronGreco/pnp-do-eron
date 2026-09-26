import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { LogEntry } from "@/state/useWorkspace";

const LEVEL_CLASS: Record<LogEntry["level"], string> = {
  info: "text-foreground",
  ok: "text-success",
  warn: "text-warning",
  error: "text-destructive",
};

export function JobLog({ entries, onClear }: { entries: LogEntry[]; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const technical = entries.filter((entry) => entry.technical);
  const last = entries[entries.length - 1];

  return (
    <section className="shrink-0 border-t border-border bg-panel">
      <header className="flex h-10 items-center justify-between gap-4 px-4">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="section-label shrink-0">Registro</span>
          <span className="truncate text-xs text-muted-foreground">
            {last ? (
              <>
                <span className="font-mono">{last.at}</span> <span className={LEVEL_CLASS[last.level]}>{last.text}</span>
              </>
            ) : (
              "As mensagens do trabalho aparecem aqui."
            )}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{open ? "▼" : "▲"}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setShowDiagnostics((value) => !value);
              setOpen(true);
            }}
          >
            Diagnóstico
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClear}>
            Limpar
          </Button>
        </div>
      </header>

      {open && (
        <div className="max-h-44 overflow-y-auto border-t border-border px-4 py-2 text-sm">
          {entries.length === 0 ? (
            <p className="text-muted-foreground">As mensagens do trabalho aparecem aqui.</p>
          ) : (
            <ul className="space-y-1">
              {entries.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{entry.at}</span>
                  <span className={LEVEL_CLASS[entry.level]}>{entry.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {open && showDiagnostics && (
        <div className="max-h-36 overflow-y-auto border-t border-border bg-background/60 px-4 py-2 font-mono text-xs text-muted-foreground">
          {technical.length === 0 ? (
            <p>Nenhum detalhe técnico registrado nesta sessão.</p>
          ) : (
            technical.map((entry) => (
              <p key={`tech-${entry.id}`}>
                [{entry.at}] {entry.technical}
              </p>
            ))
          )}
        </div>
      )}
    </section>
  );
}
