import { useMemo, useState } from "react";
import { AlertTriangle, Bot, ClipboardCheck, Loader2, SendHorizontal, Wrench } from "lucide-react";

import type { Composer } from "@/composer/useComposer";
import { cricutTemplateMatches } from "@/cricut/markTemplate";
import { HelpButton } from "@/components/HelpButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { diagnoseCricutAlignment, type CricutDiagnosticResult } from "@/lib/cricutDiagnostics.functions";

type IssueType = "deslocamento" | "rotacao" | "escala" | "marcas" | "frente-verso" | "outro";

const ISSUE_OPTIONS: { value: IssueType; label: string }[] = [
  { value: "deslocamento", label: "Corte deslocado" },
  { value: "rotacao", label: "Corte girado" },
  { value: "escala", label: "Tamanho errado" },
  { value: "marcas", label: "Falha nas marcas" },
  { value: "frente-verso", label: "Frente e verso" },
  { value: "outro", label: "Outro" },
];

export function CricutDiagnosticsPanel({ composer }: { composer: Composer }) {
  const [issueType, setIssueType] = useState<IssueType>("deslocamento");
  const [operatorNote, setOperatorNote] = useState("");
  const [triedAdjustment, setTriedAdjustment] = useState("");
  const [result, setResult] = useState<CricutDiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const currentSettings = useMemo(
    () => ({
      finishMode: composer.config.finishMode,
      assemblyMode: composer.config.assemblyMode,
      paperSize: composer.config.paperSize,
      orientation: composer.config.orientation,
      cardWidthMm: composer.config.cardWidthMm,
      cardHeightMm: composer.config.cardHeightMm,
      bleedMm: composer.config.bleedMm,
      gapMm: composer.config.gapMm,
      bleedMode: composer.config.bleedMode,
      gridMode: composer.config.gridMode,
      gridColumns: composer.grid.columns,
      gridRows: composer.grid.rows,
      backOffsetXMm: composer.config.backOffsetXMm,
      backOffsetYMm: composer.config.backOffsetYMm,
      backExtraBleedMm: composer.config.backExtraBleedMm,
      gutterfoldGapMm: composer.config.gutterfoldGapMm,
      cricutMarksImported: Boolean(composer.cricutMarks),
      cricutTemplateMatches: cricutTemplateMatches(composer.cricutMarks, composer.cricutTemplateStamp),
      cricutPagesDetected: composer.cricutMarks?.pages.length ?? 0,
      cricutContentConflicts: composer.cricutCoverage.content.length,
      cricutBleedConflicts: composer.cricutCoverage.bleedOnly,
      cardsCount: composer.cards.length,
      layoutsCount: composer.layouts.length,
    }),
    [composer],
  );

  const canSend = operatorNote.trim().length >= 12 && !sending;

  async function submitDiagnostic() {
    const note = operatorNote.trim();
    if (note.length < 12) {
      setError("Descreva o problema com um pouco mais de detalhe.");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError(
        "Você está sem internet. O diagnóstico com IA precisa de conexão; todo o resto do sistema continua funcionando offline. Tente de novo quando estiver online.",
      );
      return;
    }

    setSending(true);
    setError(null);
    setResult(null);

    try {
      const response = await diagnoseCricutAlignment({
        data: {
          issueType,
          operatorNote: note,
          triedAdjustment: triedAdjustment.trim(),
          currentSettings,
        },
      });
      setResult(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setError(
          "A conexão caiu durante o envio. O diagnóstico com IA precisa de internet; tente de novo quando estiver online.",
        );
      } else if (/fetch|network|conex|offline|failed/i.test(message)) {
        setError(
          "Não consegui falar com o servidor agora. Confira sua internet e tente novamente; o resto do sistema não depende disso.",
        );
      } else {
        setError(message || "Não consegui gerar o diagnóstico agora.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-warning/50 bg-warning/10 px-2.5 py-3">
      <div className="flex items-start gap-2">
        <Bot className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="section-label text-warning">Diagnóstico Cricut</h3>
            <Badge variant="outline" className="border-warning/50 bg-warning/10 text-[10px] text-warning">
              teste ativo
            </Badge>
            <HelpButton topic="diagnostico-cricut" />
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Descreva o desalinhamento para receber uma hipótese de ajuste e registrar o caso para melhoria do sistema.
          </p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-background/60 p-2 text-[10px] leading-snug text-muted-foreground">
        Só o texto digitado e estes ajustes numéricos são enviados para a IA. PDFs, imagens e prévias continuam no seu computador.
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Tipo de problema</Label>
        <Select value={issueType} onValueChange={(value) => setIssueType(value as IssueType)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ISSUE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cricut-diagnostic-note" className="text-[11px] text-muted-foreground">
          O que aconteceu no corte?
        </Label>
        <Textarea
          id="cricut-diagnostic-note"
          value={operatorNote}
          maxLength={1600}
          rows={5}
          className="min-h-32 resize-y text-xs"
          placeholder="Exemplo: no canto superior esquerdo ficou certo, mas no canto inferior direito o corte entrou 2 mm na arte. Imprimi em A4 retrato e usei Print Then Cut."
          onChange={(event) => setOperatorNote(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cricut-diagnostic-tried" className="text-[11px] text-muted-foreground">
          Algum ajuste já foi tentado?
        </Label>
        <Textarea
          id="cricut-diagnostic-tried"
          value={triedAdjustment}
          maxLength={800}
          rows={3}
          className="min-h-20 resize-y text-xs"
          placeholder="Opcional: conte se recriou o molde, mudou escala, mexeu na grade ou virou a folha."
          onChange={(event) => setTriedAdjustment(event.target.value)}
        />
      </div>

      <Button type="button" className="w-full" onClick={() => void submitDiagnostic()} disabled={!canSend}>
        {sending ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> : <SendHorizontal className="mr-1.5 size-4" aria-hidden />}
        {sending ? "Analisando" : "Gerar diagnóstico de teste"}
      </Button>

      {error && (
        <div className="space-y-1 rounded-md border border-destructive/60 bg-destructive/10 p-3 text-[11px] leading-relaxed text-destructive">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-3.5" aria-hidden />
            Não consegui concluir agora
          </p>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-3 rounded-md border border-border bg-background/80 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-success">
            <ClipboardCheck className="size-3.5" aria-hidden />
            Diagnóstico gerado e relato salvo para os testes
          </p>
          <div className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">{result.diagnosis}</div>
          {result.recommendations.length > 0 && (
            <div className="space-y-1 border-t border-border pt-2">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                <Wrench className="size-3" aria-hidden />
                Pontos guardados
              </p>
              <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">
                {result.recommendations.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
