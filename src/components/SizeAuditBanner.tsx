import { CheckCircle2, AlertTriangle, Ruler } from "lucide-react";
import type { SizeAudit } from "@/composer/sizeAudit";

export function SizeAuditBanner({ audit }: { audit: SizeAudit }) {
  if (audit.checked === 0) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
        <Ruler className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Suba as imagens para eu conferir o tamanho de corte ao vivo.</span>
      </div>
    );
  }

  const errors = audit.issues.filter((issue) => issue.level === "erro");
  const warnings = audit.issues.filter((issue) => issue.level === "aviso");

  if (audit.ok) {
    return (
      <div className="space-y-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
        <div className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Tamanho conferido: {audit.checked} item(ns) sairão exatamente no tamanho pedido.
          </span>
        </div>
        {warnings.map((issue, index) => (
          <p key={index} className="pl-6 text-emerald-300/80">
            {issue.message}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive-foreground">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>O corte pode sair errado. Você pode ajustar ou continuar e confirmar o download.</span>
      </div>
      <ul className="space-y-0.5 pl-6">
        {errors.slice(0, 6).map((issue, index) => (
          <li key={index}>{issue.message}</li>
        ))}
      </ul>
      {errors.length > 6 && (
        <p className="pl-6 opacity-80">e mais {errors.length - 6} item(ns) na mesma situação.</p>
      )}
    </div>
  );
}
