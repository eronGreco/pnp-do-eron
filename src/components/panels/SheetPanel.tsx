import { AlertTriangle } from "lucide-react";

import type { Composer } from "@/composer/useComposer";
import {
  CUSTOM_MAX_MM,
  CUSTOM_MIN_MM,
  DEFAULT_CUSTOM_HEIGHT_MM,
  DEFAULT_CUSTOM_WIDTH_MM,
  ORIENTATION_LABELS,
  PAPER_LABELS,
  clampCustomMm,
  orientationAllowed,
  pageSizeMm,
  paperAllowed,
  type PaperOrientation,
  type PaperSize,
} from "@/composer/paperSizes";
import { MIN_SAFE_WHITE_BORDER_MM } from "@/composer/markCoverage";
import { Field } from "@/components/panels/Field";
import { GridPanel } from "@/components/panels/GridPanel";
import { MarksPanel } from "@/components/panels/MarksPanel";
import { CricutMarksPanel } from "@/components/panels/CricutMarksPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { HelpButton } from "@/components/HelpButton";
import type { HelpTopicId } from "@/help/helpTopics";
import type { Workspace } from "@/state/useWorkspace";

function SectionLabel({ children, help }: { children: React.ReactNode; help?: HelpTopicId }) {
  return (
    <div className="flex items-center gap-2">
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {children}
      </p>
      {help && <HelpButton topic={help} />}
    </div>
  );
}

/** Folha, orientacao, espaco entre cartas, grade e marcas de corte. */
export function SheetPanel({
  composer,
  workspace,
}: {
  composer: Composer;
  workspace: Workspace;
}) {
  const { config, grid, coverage } = composer;
  const isCameo = config.finishMode === "cameo";
  const isCricut = config.finishMode === "cricut";
  const gutterfold = config.assemblyMode === "gutterfold";
  const ack = config.cameoCustomSheetAck;
  const a3Allowed = paperAllowed("a3", config.finishMode, ack);
  const customAllowed = paperAllowed("custom", config.finishMode, ack);
  const retratoAllowed = orientationAllowed("retrato", config.finishMode, ack);
  const page = pageSizeMm(config);

  return (
    <div className="space-y-6">
      <HelpButton topic="etapa-folha" variant="etapa" />

      {isCameo && (
        <section className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Liberar folha diferente de A4 deitada</Label>
            <Switch
              checked={ack}
              onCheckedChange={(checked) =>
                composer.setConfig({ ...config, cameoCustomSheetAck: checked })
              }
            />
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Experimental. A leitura das marcas foi testada na máquina só em A4 deitada. Em outra
            folha, faça um teste em papel comum antes de usar papel bom.
          </p>
          <HelpButton topic="folha-experimental-cameo" label="entenda o risco" />
        </section>
      )}

      <section className="space-y-2">
        <SectionLabel help="folha-tamanho">Folha</SectionLabel>
        <div className="space-y-2">
          <Select
            value={config.paperSize}
            onValueChange={(value) =>
              composer.setConfig({ ...config, paperSize: value as PaperSize })
            }
          >
            <SelectTrigger className="h-10 gap-2 [&>span]:min-w-0 [&>span]:truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a4">{PAPER_LABELS.a4}</SelectItem>
              <SelectItem value="a3" disabled={!a3Allowed}>
                {PAPER_LABELS.a3}
              </SelectItem>
              <SelectItem value="custom" disabled={!customAllowed}>
                {PAPER_LABELS.custom}
              </SelectItem>
            </SelectContent>
          </Select>

          {config.paperSize === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Largura (mm)"
                min={CUSTOM_MIN_MM}
                max={CUSTOM_MAX_MM}
                value={config.customWidthMm ?? DEFAULT_CUSTOM_WIDTH_MM}
                onChange={(value) =>
                  composer.setConfig({ ...config, customWidthMm: clampCustomMm(value) })
                }
              />
              <Field
                label="Altura (mm)"
                min={CUSTOM_MIN_MM}
                max={CUSTOM_MAX_MM}
                value={config.customHeightMm ?? DEFAULT_CUSTOM_HEIGHT_MM}
                onChange={(value) =>
                  composer.setConfig({ ...config, customHeightMm: clampCustomMm(value) })
                }
              />
            </div>
          )}

          <Select
            value={config.orientation}
            onValueChange={(value) =>
              composer.setConfig({ ...config, orientation: value as PaperOrientation })
            }
          >
            <SelectTrigger className="h-10 gap-2 [&>span]:min-w-0 [&>span]:truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paisagem">{ORIENTATION_LABELS.paisagem}</SelectItem>
              <SelectItem value="retrato" disabled={!retratoAllowed}>
                {ORIENTATION_LABELS.retrato}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Folha em uso: {page.widthMm} por {page.heightMm} mm. Imprima sempre em escala de 100%.
        </p>
        {config.paperSize === "custom" && <HelpButton topic="folha-personalizada" />}
      </section>

      <section className="space-y-2 border-t border-border pt-5">
        <SectionLabel help="espaco-cartas">
          {gutterfold ? "Espaço entre as peças" : "Espaço entre as cartas"}
        </SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Espaço (mm)"
            value={config.gapMm}
            onChange={(value) => composer.setConfig({ ...config, gapMm: value })}
          />
          {gutterfold && (
            <Field
              label="Canaleta (mm)"
              value={config.gutterfoldGapMm}
              min={0}
              max={30}
              onChange={(value) => composer.setConfig({ ...config, gutterfoldGapMm: value })}
            />
          )}
        </div>
        {gutterfold && (
          <div className="space-y-1 rounded-md border border-primary/30 bg-primary/10 p-3">
            <p className="text-[11px] leading-relaxed text-primary">
              A canaleta fica entre frente e verso para dobrar a peça. Ela é impressa como guia,
              mas nunca vira linha de corte.
            </p>
            <HelpButton topic="canaleta-gutterfold" label="entenda a canaleta" />
          </div>
        )}
      </section>

      <section className="space-y-3 border-t border-border pt-5">
        <SectionLabel help="grade">Grade da folha</SectionLabel>
        <GridPanel composer={composer} />
      </section>

      {isCricut ? (
        <section className="space-y-3 border-t border-border pt-5">
          <SectionLabel help="cricut-design-space">Marcas da Cricut</SectionLabel>
          <CricutMarksPanel composer={composer} workspace={workspace} />
        </section>
      ) : (
        <section className="space-y-3 border-t border-border pt-5">
          <SectionLabel help="marcas-tipos">
            {config.finishMode === "manual" ? "Marcas impressas" : "Marcas do sensor"}
          </SectionLabel>
          <MarksPanel composer={composer} />
          {coverage.content.length > 0 && <MarkCoverageNotice composer={composer} />}
        </section>
      )}

      <section className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-4">
        <div>
          <p className="text-[11px] text-muted-foreground">Nesta folha</p>
          <p className="text-sm font-bold text-foreground">
            Cabem {grid.perSheet} {gutterfold ? "peça(s)" : "carta(s)"} por folha
          </p>
        </div>
        <p className="max-w-[150px] text-right text-[10px] leading-snug text-muted-foreground">
          {grid.columns} por linha e {grid.rows} por coluna
        </p>
      </section>
    </div>
  );
}

/**
 * A faixa branca das marcas e obrigatoria. O aviso explica isso e oferece os
 * ajustes que tiram a carta de baixo da marca, sem nunca mudar o tamanho dela.
 */
function MarkCoverageNotice({ composer }: { composer: Composer }) {
  const { coverage, config } = composer;
  const count = coverage.content.length;
  const gutterfold = config.assemblyMode === "gutterfold";
  const unit = gutterfold ? "peça(s)" : "carta(s)";

  return (
    <div className="space-y-2 rounded-lg border border-primary/50 bg-primary/10 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1">
          <p className="text-xs font-bold text-foreground">
            A faixa branca das marcas está cobrindo {count} {unit}
          </p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Essa faixa branca não pode sair: sem ela a Cameo não enxerga as marcas e não corta. O
            que dá para fazer é tirar {gutterfold ? "as peças" : "as cartas"} de baixo dela. Escolha um dos ajustes abaixo.
          </p>
        </div>
      </div>

      {coverage.bleedOnly > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Em outras {coverage.bleedOnly} {unit} a faixa pega só a sangria, que é aparada no corte.
          Isso não é problema.
        </p>
      )}

      <div className="space-y-1.5">
        {coverage.suggestedGrid && (
          <Button
            variant="outline"
            className="h-auto w-full justify-start whitespace-normal py-2 text-left text-[11px]"
            onClick={composer.applyGridSuggestion}
          >
            Usar {coverage.suggestedGrid.columns} por linha e {coverage.suggestedGrid.rows} por
            coluna (recomendado, não muda o tamanho {gutterfold ? "da peça" : "da carta"})
          </Button>
        )}
        {coverage.suggestedBleedMm !== null && (
          <Button
            variant="outline"
            className="h-auto w-full justify-start whitespace-normal py-2 text-left text-[11px]"
            onClick={composer.reduceBleed}
          >
            Reduzir a sangria de {config.bleedMm} para {coverage.suggestedBleedMm} mm
          </Button>
        )}
        {coverage.suggestedWhiteBorderMm !== null && (
          <Button
            variant="outline"
            className="h-auto w-full justify-start whitespace-normal py-2 text-left text-[11px]"
            onClick={composer.reduceWhiteBorder}
          >
            Reduzir a faixa branca de {config.registrationWhiteBorderMm} para{" "}
            {coverage.suggestedWhiteBorderMm} mm (mínimo seguro: {MIN_SAFE_WHITE_BORDER_MM} mm)
          </Button>
        )}
        {!coverage.suggestedGrid &&
          coverage.suggestedBleedMm === null &&
          coverage.suggestedWhiteBorderMm === null && (
            <p className="text-[11px] text-muted-foreground">
              Com esta carta nesta folha não achei um arranjo livre das marcas. Tente uma folha
              maior, ou menos cartas por folha.
            </p>
          )}
      </div>
    </div>
  );
}
