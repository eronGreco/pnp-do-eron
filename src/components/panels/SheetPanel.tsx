import { AlertTriangle, ArrowDownUp, ArrowLeftRight, Sparkles } from "lucide-react";

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
import { DisabledConfig } from "@/components/panels/DisabledConfig";
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
import { AdvancedSection } from "@/components/panels/AdvancedSection";
import { effectivePacking, packingPatch, PACKING_LABEL } from "@/composer/packingPolicy";
import type { BleedMode } from "@/composer/types";

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
  const wholeSheet = gutterfold && config.gutterfoldLayout === "sheet";
  const packing = effectivePacking(config);
  const ack = config.cameoCustomSheetAck;
  const a3Allowed = paperAllowed("a3", config.finishMode, ack);
  const a5Allowed = paperAllowed("a5", config.finishMode, ack);
  const cartaAllowed = paperAllowed("carta", config.finishMode, ack);
  const polasealAllowed = paperAllowed("polaseal", config.finishMode, ack);
  const oficioAllowed = paperAllowed("oficio", config.finishMode, ack);
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
              <SelectItem value="a5" disabled={!a5Allowed}>
                {PAPER_LABELS.a5}
              </SelectItem>
              <SelectItem value="carta" disabled={!cartaAllowed}>
                {PAPER_LABELS.carta}
              </SelectItem>
              <SelectItem value="polaseal" disabled={!polasealAllowed}>
                {PAPER_LABELS.polaseal}
              </SelectItem>
              <SelectItem value="oficio" disabled={!oficioAllowed}>
                {PAPER_LABELS.oficio}
              </SelectItem>
              <SelectItem value="custom" disabled={!customAllowed}>
                {PAPER_LABELS.custom}
              </SelectItem>
            </SelectContent>
          </Select>

          <DisabledConfig
            disabled={config.paperSize !== "custom"}
            reason="Não é possível editar largura e altura porque a folha Personalizada não está selecionada."
          >
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Largura (mm)"
                min={CUSTOM_MIN_MM}
                max={CUSTOM_MAX_MM}
                value={config.customWidthMm ?? DEFAULT_CUSTOM_WIDTH_MM}
                disabled={config.paperSize !== "custom"}
                onChange={(value) =>
                  composer.setConfig({ ...config, customWidthMm: clampCustomMm(value) })
                }
              />
              <Field
                label="Altura (mm)"
                min={CUSTOM_MIN_MM}
                max={CUSTOM_MAX_MM}
                value={config.customHeightMm ?? DEFAULT_CUSTOM_HEIGHT_MM}
                disabled={config.paperSize !== "custom"}
                onChange={(value) =>
                  composer.setConfig({ ...config, customHeightMm: clampCustomMm(value) })
                }
              />
            </div>
          </DisabledConfig>

          {config.paperSize !== "custom" && (
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
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Folha em uso: {page.widthMm} por {page.heightMm} mm. Imprima sempre em escala de 100%.
        </p>
        {isCameo && !ack && (
          <p className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground" role="note">
            A3, Personalizada e Retrato estão desativados porque “Liberar folha diferente de A4 deitada” está desligado.
          </p>
        )}
        {config.paperSize === "custom" && <HelpButton topic="folha-personalizada" />}
      </section>

      <section className="space-y-2 border-t border-border pt-5">
        <SectionLabel help="espaco-cartas">
          Espaçamentos
        </SectionLabel>
        <div className="rounded-md border border-border bg-secondary/20 p-3">
          <p className="text-xs font-semibold text-foreground">{PACKING_LABEL[config.packingPolicy]}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Distância adicional entre {gutterfold ? "peças" : "cartas"}: {packing.gapMm} mm.
            {config.packingPolicy === "personalizado"
              ? " Você controla esta medida abaixo."
              : " O sistema mantém esta medida compatível com a escolha feita em Sangria."}
          </p>
        </div>
        {gutterfold && (
          <div className="space-y-2 rounded-md border border-primary/30 bg-primary/10 p-3">
            <Field
              label="Canaleta da dobra (mm)"
              value={config.gutterfoldGapMm}
              min={0}
              max={30}
              onChange={(value) => composer.setConfig({ ...config, gutterfoldGapMm: value })}
            />
            <p className="text-[11px] leading-relaxed text-primary">
              Em 0 mm, frente e verso encostam exatamente na dobra. A canaleta nunca vira linha de corte.
            </p>
            <HelpButton topic="canaleta-gutterfold" label="entenda a canaleta" />
          </div>
        )}
        {gutterfold && (
          <div className="space-y-2 pt-2">
            <SectionLabel help="direcao-gutterfold">Direção da dobra</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["auto", "Automática", Sparkles],
                ["horizontal", "Horizontal", ArrowDownUp],
                ["vertical", "Vertical", ArrowLeftRight],
              ] as const).map(([value, label, Icon]) => (
                <Button
                  key={value}
                  variant={config.gutterfoldDirection === value ? "default" : "outline"}
                  className="h-auto min-w-0 flex-col gap-1 px-1.5 py-2 text-[10px]"
                  onClick={() => composer.setConfig({ ...config, gutterfoldDirection: value })}
                >
                  <Icon className="size-4" />
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {wholeSheet
                ? "Em Automática, o sistema usa a direção que comporta mais cartas. A prévia mostra a escolha."
                : "Carta por carta: Vertical deixa frente e verso lado a lado; Horizontal empilha a frente em cima e o verso embaixo, de cabeça para baixo. Em Automática vale a que cabe mais peças; no empate, fica a Vertical."}
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3 border-t border-border pt-5">
        <AdvancedSection
          title="Ajustes avançados da folha"
          summary="Distância manual, compartilhamento e grade"
          defaultOpen={config.packingPolicy === "personalizado" || config.gridMode === "manual"}
        >
          <div className="space-y-2">
            <SectionLabel help="espaco-cartas">Organização personalizada</SectionLabel>
            <Button
              type="button"
              variant={config.packingPolicy === "personalizado" ? "default" : "outline"}
              className="h-auto w-full justify-start whitespace-normal py-2 text-left text-xs"
              onClick={() => composer.setConfig({ ...config, ...packingPatch("personalizado", config) })}
            >
              Editar as medidas manualmente
            </Button>
            <DisabledConfig
              disabled={config.packingPolicy !== "personalizado"}
              reason={`Não é possível editar estas medidas porque a organização ${PACKING_LABEL[config.packingPolicy]} está ativa em Sangria.`}
            >
              <div className="space-y-3">
                <Select
                  disabled={config.packingPolicy !== "personalizado"}
                  value={config.bleedMode}
                  onValueChange={(bleedMode) => composer.setConfig({ ...config, bleedMode: bleedMode as BleedMode })}
                >
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completa">Margem completa por carta</SelectItem>
                    <SelectItem value="compartilhada">Margem compartilhada</SelectItem>
                    <SelectItem value="colada">Cartas coladas</SelectItem>
                  </SelectContent>
                </Select>
                <DisabledConfig
                  disabled={config.packingPolicy !== "personalizado" || config.bleedMode === "colada"}
                  reason={config.bleedMode === "colada"
                    ? "Não é possível acrescentar distância porque Cartas coladas corta na divisa."
                    : "Não é possível editar a distância porque a organização guiada está ativa."}
                >
                  <Field
                    label={`Distância adicional entre ${gutterfold ? "peças" : "cartas"} (mm)`}
                    value={config.gapMm}
                    disabled={config.packingPolicy !== "personalizado" || config.bleedMode === "colada"}
                    onChange={(gapMm) => composer.setConfig({ ...config, gapMm })}
                  />
                </DisabledConfig>
              </div>
            </DisabledConfig>
            {config.packingPolicy === "personalizado" && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-full text-xs"
                onClick={() => composer.setConfig({ ...config, ...packingPatch("seguro", config) })}
              >
                Voltar ao cálculo automático Seguro
              </Button>
            )}
          </div>
          <div className="border-t border-border pt-3">
            <SectionLabel help="grade">Grade da folha</SectionLabel>
            <div className="mt-3"><GridPanel composer={composer} /></div>
          </div>
        </AdvancedSection>
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
            Cabem {grid.perSheet} {gutterfold && !wholeSheet ? "peça(s)" : "carta(s)"} por folha
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
