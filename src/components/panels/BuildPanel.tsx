import { useState } from "react";
import type { Composer } from "@/composer/useComposer";
import type { Workspace } from "@/state/useWorkspace";
import { BACK_OFFSET_LIMIT_MM } from "@/composer/types";
import { cutWidthFor } from "@/composer/layoutSheets";
import { backImageFor } from "@/composer/pairFrontBack";
import { Field } from "@/components/panels/Field";
import { Button } from "@/components/ui/button";
import { HelpButton } from "@/components/HelpButton";
import { AlertTriangle, Download, Hammer } from "lucide-react";
import { CutExportPanel } from "@/components/panels/CutExportPanel";
import { cricutTemplateMatches } from "@/cricut/markTemplate";
import { DisabledConfig } from "@/components/panels/DisabledConfig";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function BuildPanel({
  composer,
  workspace,
}: {
  composer: Composer;
  workspace: Workspace;
}) {
  const [confirmRiskyDownload, setConfirmRiskyDownload] = useState(false);
  const { cards, grid, layouts } = composer;
  const cricutMode = composer.config.finishMode === "cricut";
  const gutterfold = composer.config.assemblyMode === "gutterfold";
  const wholeSheet = gutterfold && composer.config.gutterfoldLayout === "sheet";
  const unit = gutterfold && !wholeSheet ? "peça(s)" : "carta(s)";
  const missingBacks = gutterfold
    ? cards.filter((card) => backImageFor(card, composer.config) === null).length
    : 0;
  const cricutReady = cricutTemplateMatches(composer.cricutMarks, composer.cricutTemplateStamp);
  const cricutBlocked = cricutMode && !cricutReady;
  const riskyIssues = [
    ...composer.sizeAudit.issues
      .filter((issue) => issue.level === "erro")
      .map((issue) => issue.message),
    ...(cricutMode && composer.cricutCoverage.content.length > 0
      ? [`As marcas da Cricut cobrem conteúdo de ${composer.cricutCoverage.content.length} carta(s).`]
      : []),
  ];

  const requestBuild = () => {
    if (riskyIssues.length > 0) {
      setConfirmRiskyDownload(true);
      return;
    }
    void composer.build();
  };

  const confirmBuild = () => {
    setConfirmRiskyDownload(false);
    void composer.build({ allowRiskyDownload: true });
  };

  return (
    <div className="space-y-4">
      <HelpButton topic="etapa-montar" variant="etapa" />

      <div className="space-y-1 rounded-md border border-border p-3 text-[11px] text-muted-foreground">
        <p>
          {cards.length > 0
            ? `${cards.length} ${unit} na fila · ${grid.perSheet} por folha`
            : "Nenhuma carta na fila ainda. Volte na etapa Cartas."}
        </p>
        {layouts.length > 0 && <p>Montagem atual: {layouts.length} folha(s).</p>}
        {gutterfold && !wholeSheet && cards.length > 0 && (
          <p>
            Gutterfold: cada peça aberta mede {cutWidthFor(composer.config).toFixed(1).replace(".", ",")} ×{" "}
            {composer.config.cardHeightMm.toFixed(1).replace(".", ",")} mm e corta só por fora.
          </p>
        )}
        {wholeSheet && cards.length > 0 && (
          <p>
            Gutterfold de folha inteira: dobra {layouts[0]?.sheetFoldDirection === "horizontal" ? "horizontal" : "vertical"}. Imprima, dobre a folha e corte as cartas depois.
          </p>
        )}
        {missingBacks > 0 && (
          <p className="text-warning">
            {missingBacks} carta(s) gutterfold estão sem imagem de verso. Elas serão montadas com o lado do verso em branco.
          </p>
        )}
      </div>

      <section className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <h3 className="section-label">Ajuste da impressão do verso</h3>
          <HelpButton topic="ajuste-verso" />
        </div>
        <DisabledConfig
          disabled={gutterfold}
          reason="Não é possível ajustar a virada porque, no gutterfold, frente e verso ficam na mesma página."
        >
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Horizontal (mm)"
                value={composer.config.backOffsetXMm}
                step={0.1}
                min={-BACK_OFFSET_LIMIT_MM}
                max={BACK_OFFSET_LIMIT_MM}
                disabled={gutterfold}
                onChange={(value) =>
                  composer.setConfig({ ...composer.config, backOffsetXMm: value })
                }
              />
              <Field
                label="Vertical (mm)"
                value={composer.config.backOffsetYMm}
                step={0.1}
                min={-BACK_OFFSET_LIMIT_MM}
                max={BACK_OFFSET_LIMIT_MM}
                disabled={gutterfold}
                onChange={(value) =>
                  composer.setConfig({ ...composer.config, backOffsetYMm: value })
                }
              />
            </div>
            {!gutterfold && (composer.config.backOffsetXMm !== 0 || composer.config.backOffsetYMm !== 0) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-full text-xs"
                onClick={() =>
                  composer.setConfig({
                    ...composer.config,
                    backOffsetXMm: 0,
                    backOffsetYMm: 0,
                  })
                }
              >
                Zerar ajuste
              </Button>
            )}
        </DisabledConfig>
      </section>

      {cricutMode && (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
          {cricutReady
            ? "Molde da Cricut pronto. O PDF final será montado com as mesmas marcas do Design Space."
            : "Antes de montar o PDF final, baixe o Pacote Cricut, gere o PDF de marcas no Design Space e importe esse PDF na etapa Folha e marcas."}
        </div>
      )}

      <div className="space-y-1.5">
        <Button
          className="w-full"
          onClick={requestBuild}
          disabled={composer.working || cards.length === 0 || cricutBlocked}
        >
          <Hammer className="mr-1.5 size-4" aria-hidden />
          {composer.working ? "Montando as folhas" : "Montar e baixar o PDF"}
        </Button>

        {composer.outdated && (
          <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-[11px] leading-relaxed text-primary">
            As configurações mudaram depois da montagem. Monte e baixe outra vez para o PDF sair
            com os ajustes novos.
          </p>
        )}

        {!composer.outdated && workspace.doc?.origin === "composer" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={() => void workspace.generatePrint()}
            disabled={composer.working}
          >
            <Download className="mr-1.5 size-3.5" aria-hidden />
            Baixar novamente
          </Button>
        )}

        <HelpButton topic="montar-folhas" label="entenda o montar folhas" />
      </div>

      <CutExportPanel composer={composer} workspace={workspace} section="vectors" />

      <AlertDialog open={confirmRiskyDownload} onOpenChange={setConfirmRiskyDownload}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5 shrink-0" aria-hidden />
              <AlertDialogTitle>Baixar mesmo com estes problemas?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              O arquivo pode sair com tamanho incorreto, ultrapassar a folha ou atingir uma marca do
              sensor. Você decidiu continuar sem corrigir os ajustes abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ul className="max-h-52 list-disc space-y-1 overflow-y-auto rounded-md border border-destructive/50 bg-destructive/10 p-3 pl-8 text-xs text-destructive-foreground">
            {riskyIssues.slice(0, 8).map((issue, index) => (
              <li key={`${index}-${issue}`}>{issue}</li>
            ))}
            {riskyIssues.length > 8 && <li>Mais {riskyIssues.length - 8} problema(s).</li>}
          </ul>

          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e ajustar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBuild}>Baixar mesmo assim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
