import type { Composer } from "@/composer/useComposer";
import type { Workspace } from "@/state/useWorkspace";
import { BACK_OFFSET_LIMIT_MM } from "@/composer/types";
import { cutWidthFor } from "@/composer/layoutSheets";
import { backImageFor } from "@/composer/pairFrontBack";
import { Field } from "@/components/panels/Field";
import { Button } from "@/components/ui/button";
import { HelpButton } from "@/components/HelpButton";
import { Download, Hammer } from "lucide-react";
import { CutExportPanel } from "@/components/panels/CutExportPanel";
import { cricutTemplateMatches } from "@/cricut/markTemplate";

export function BuildPanel({
  composer,
  workspace,
}: {
  composer: Composer;
  workspace: Workspace;
}) {
  const { cards, grid, layouts } = composer;
  const cricutMode = composer.config.finishMode === "cricut";
  const gutterfold = composer.config.assemblyMode === "gutterfold";
  const unit = gutterfold ? "peça(s)" : "carta(s)";
  const missingBacks = gutterfold
    ? cards.filter((card) => backImageFor(card, composer.config) === null).length
    : 0;
  const cricutReady = cricutTemplateMatches(composer.cricutMarks, composer.cricutTemplateStamp);
  const cricutBlocked = cricutMode && (!cricutReady || composer.cricutCoverage.content.length > 0);

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
        {gutterfold && cards.length > 0 && (
          <p>
            Gutterfold: cada peça aberta mede {cutWidthFor(composer.config).toFixed(1).replace(".", ",")} ×{" "}
            {composer.config.cardHeightMm.toFixed(1).replace(".", ",")} mm e corta só por fora.
          </p>
        )}
        {missingBacks > 0 && (
          <p className="text-warning">
            {missingBacks} peça(s) gutterfold estão sem imagem de verso. Elas serão montadas com o lado do verso em branco.
          </p>
        )}
      </div>

      <section className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <h3 className="section-label">Ajuste da impressão do verso</h3>
          <HelpButton topic="ajuste-verso" />
        </div>
        {gutterfold ? (
          <p className="rounded-md border border-primary/30 bg-primary/10 p-3 text-[11px] leading-relaxed text-primary">
            No gutterfold não existe página separada de verso: frente e verso ficam lado a lado na mesma folha. Por isso o ajuste de virada da impressora não se aplica aqui.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Horizontal (mm)"
                value={composer.config.backOffsetXMm}
                step={0.1}
                min={-BACK_OFFSET_LIMIT_MM}
                max={BACK_OFFSET_LIMIT_MM}
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
                onChange={(value) =>
                  composer.setConfig({ ...composer.config, backOffsetYMm: value })
                }
              />
            </div>
            {(composer.config.backOffsetXMm !== 0 || composer.config.backOffsetYMm !== 0) && (
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
          </>
        )}
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
          onClick={() => void composer.build()}
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
    </div>
  );
}
