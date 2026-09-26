import { useRef, useState } from "react";
import {
  ArrowRight,
  Cpu,
  Crop,
  Sparkles,
  FileText,
  FolderOpen,
  Hammer,
  Images,
  LayoutPanelTop,
  Ruler,
  RotateCcw,
  Scissors,
  SlidersHorizontal,
  Send,
} from "lucide-react";
import type { Composer } from "@/composer/useComposer";
import type { Slicer } from "@/slicer/useSlicer";
import type { useWorkspace } from "@/state/useWorkspace";
import { SlicerPanel } from "@/components/panels/SlicerPanel";
import { MaterialSettings } from "@/components/MaterialSettings";
import { ProtectedParams } from "@/components/ProtectedParams";
import { SheetSelector } from "@/components/SheetSelector";
import { SizeAuditBanner } from "@/components/SizeAuditBanner";
import { BackPanel } from "@/components/panels/BackPanel";
import { BuildPanel } from "@/components/panels/BuildPanel";
import { ResumePanel } from "@/components/panels/ResumePanel";
import { ImagesPanel } from "@/components/panels/ImagesPanel";
import { FinishPanel } from "@/components/panels/FinishPanel";
import { SheetPanel } from "@/components/panels/SheetPanel";
import { SizePanel } from "@/components/panels/SizePanel";
import { BleedPanel } from "@/components/panels/BleedPanel";
import { BLEED_METHOD_LABEL } from "@/bleed/types";
import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/panels/Field";
import { HelpButton } from "@/components/HelpButton";

type Workspace = ReturnType<typeof useWorkspace>;

type SidebarCategory = {
  id: "montar" | "fatiar" | "cameo" | "arquivos";
  label: string;
  icon: React.ReactNode;
  panels: PanelId[];
};

export type PanelId =
  | "acabamento"
  | "cartas"
  | "tamanho"
  | "sangria"
  | "folha"
  | "montar"
  | "fatiar"
  | "maquina"
  | "retomar"
  | "pdf";

/** Leitura de PDF do PNP fica oculta por enquanto; o codigo continua inteiro. */
const SHOW_PNP_PDF_PANEL = false;

export function StudioSidebar({
  composer,
  workspace,
  slicer,
  bridgeOnline,
  footer,
  panel,
  onPanel,
}: {
  composer: Composer;
  workspace: Workspace;
  slicer: Slicer;
  bridgeOnline: boolean | null;
  footer: React.ReactNode;
  panel: PanelId;
  onPanel: (panel: PanelId) => void;
}) {
  const setPanel = onPanel;
  const fileRef = useRef<HTMLInputElement>(null);

  const { config, cards, grid, layouts } = composer;
  const { doc, sheet, selectedCards, busy } = workspace;
  const manual = config.finishMode === "manual";
  const cricut = config.finishMode === "cricut";
  const gutterfold = config.assemblyMode === "gutterfold";
  const auditAlert = cards.length > 0 && !composer.sizeAudit.ok;
  const bleedSummary = config.bleed.enabled
    ? `${fmt(config.bleedMm)} mm · ${BLEED_METHOD_LABEL[config.bleed.method]}`
    : `${fmt(config.bleedMm)} mm · usa a arte como veio`;
  const backBleedSummary = config.backBleed.enabled
    ? ` · verso +${fmt(config.backExtraBleedMm)} mm`
    : "";

  const items: {
    id: PanelId;
    label: string;
    icon: React.ReactNode;
    summary: string;
    badge?: string | undefined;
    alert?: boolean | undefined;
  }[] = [
    {
      id: "acabamento",
      label: "1. Acabamento",
      icon: <Scissors className="size-4" />,
      summary: cricut
        ? gutterfold
          ? "Cricut · gutterfold"
          : "Cricut · Design Space"
        : manual
          ? gutterfold
            ? "Guilhotina · gutterfold"
            : "Guilhotina · corte na mão"
          : gutterfold
            ? "Silhouette Cameo · gutterfold"
            : "Silhouette Cameo · corte automático",
    },
    {
      id: "cartas",
      label: "2. Cartas",
      icon: <Images className="size-4" />,
      summary:
        cards.length > 0
          ? `${cards.length} carta(s) · ${composer.importMode === "pares" ? "versos diferentes" : config.sharedBackImageId ? "mesmo verso" : "aguardando verso"}`
          : "Escolha o tipo de verso e adicione as imagens",
      badge: cards.length > 0 ? String(cards.length) : undefined,
    },
    {
      id: "tamanho",
      label: "3. Tamanho da carta",
      icon: <Ruler className="size-4" />,
      summary: `${fmt(config.cardWidthMm)} × ${fmt(config.cardHeightMm)} mm · raio ${fmt(workspace.settings.radiusMm)} mm`,
      alert: auditAlert,
    },
    {
      id: "sangria",
      label: "4. Sangria",
      icon: <Sparkles className="size-4" />,
      summary: gutterfold ? `${bleedSummary}${backBleedSummary} · não atravessa a dobra` : `${bleedSummary}${backBleedSummary}`,
    },
    {
      id: "folha",
      label: "5. Folha e marcas",
      icon: <LayoutPanelTop className="size-4" />,
      summary: `${config.paperSize.toUpperCase()} ${config.orientation} · ${grid.columns} × ${grid.rows} ${gutterfold ? "peças" : "cartas"}`,
    },
    {
      id: "montar",
      label: "6. Montar folhas",
      icon: <Hammer className="size-4" />,
      summary:
        cards.length > 0
          ? layouts.length > 0
            ? `${layouts.length} folha(s) montada(s)`
            : "Pronto para montar"
          : "Nenhuma carta na fila",
    },
    {
      id: "fatiar",
      label: "Fatiar folha",
      icon: <Crop className="size-4" />,
      summary:
        slicer.images.length > 0
          ? `${slicer.images.length} folha(s) · ${slicer.config.columns} × ${slicer.config.rows}`
          : "Recortar uma folha em cartas separadas",
      badge: slicer.images.length > 0 ? String(slicer.images.length) : undefined,
    },
    ...(cricut
      ? []
      : [
          {
            id: "maquina" as const,
            label: "Máquina",
            icon: <Cpu className="size-4" />,
            summary:
              bridgeOnline === null
                ? "Procurando o programa local"
                : bridgeOnline
                  ? "Programa local conectado"
                  : "Programa local desconectado",
          },
        ]),
    {
      id: "retomar",
      label: "Retomar corte",
      icon: <RotateCcw className="size-4" />,
      summary:
        doc?.origin === "resumed" ? doc.fileName : "Abrir um PDF que você gerou aqui",
    },
    {
      id: "pdf",
      label: "PDF do PNP",
      icon: <FileText className="size-4" />,
      summary: doc?.origin === "pdf" ? doc.fileName : "Abrir um PDF já pronto",
    },
  ];

  const visibleItems = items.filter((item) => item.id !== "pdf" || SHOW_PNP_PDF_PANEL);
  const categories: SidebarCategory[] = [
    {
      id: "montar",
      label: "Montar cartas",
      icon: <LayoutPanelTop className="size-5" />,
      panels: ["acabamento", "cartas", "tamanho", "sangria", "folha", "montar"],
    },
    {
      id: "fatiar",
      label: "Fatiar folha",
      icon: <Crop className="size-5" />,
      panels: ["fatiar"],
    },
  ];
  if (!cricut) {
    categories.push({
      id: "cameo",
      label: "Cameo",
      icon: <Cpu className="size-5" />,
      panels: ["maquina"],
    });
  }
  categories.push({
    id: "arquivos",
    label: "Arquivos",
    icon: <FolderOpen className="size-5" />,
    panels: SHOW_PNP_PDF_PANEL ? ["retomar", "pdf"] : ["retomar"],
  });
  const active = visibleItems.find((item) => item.id === panel) ?? visibleItems[0];
  // Ordem do fluxo de montagem: o botao Continuar leva para a etapa seguinte.
  const flow: PanelId[] = ["acabamento", "cartas", "tamanho", "sangria", "folha", "montar"];
  const flowIndex = flow.indexOf(panel);
  const nextId = flowIndex >= 0 ? flow[flowIndex + 1] : undefined;
  const nextStep = nextId ? visibleItems.find((item) => item.id === nextId) : undefined;

  const activeCategory =
    categories.find((category) => category.panels.includes(panel)) ?? categories[0];
  const submenuItems = activeCategory
    ? visibleItems.filter((item) => activeCategory.panels.includes(item.id))
    : [];

  if (!active || !activeCategory) return null;

  return (
    <aside className="flex w-[480px] shrink-0 border-r border-border bg-panel">
      {/* Menu unico: categorias com submenus abrindo por baixo */}
      <nav className="flex w-44 shrink-0 flex-col border-r border-border bg-panel/70 px-2 py-3">
        <div className="mb-3 flex items-center gap-2 px-2">
          <img src="/favicon.png" alt="PNP do Eron" className="size-6" />
          <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
            PNP do Eron
          </span>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto">
          {categories.map((category) => {
            const selected = category.id === activeCategory.id;
            const categoryBadge =
              category.id === "montar" && cards.length > 0
                ? String(cards.length)
                : category.id === "fatiar" && slicer.images.length > 0
                  ? String(slicer.images.length)
                  : undefined;

            return (
              <div key={category.id}>
                <Button
                  type="button"
                  variant="ghost"
                  aria-expanded={selected}
                  aria-current={selected ? "page" : undefined}
                  onClick={() => {
                    const firstPanel = category.panels[0];
                    if (firstPanel) setPanel(firstPanel);
                  }}
                  className={`relative h-8 w-full justify-start gap-2 px-2 text-[11px] ${
                    selected
                      ? "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {category.icon}
                  <span className="truncate">{category.label}</span>
                  {categoryBadge && (
                    <span className="ml-auto rounded-full bg-primary/15 px-1.5 text-[9px] font-bold text-primary">
                      {categoryBadge}
                    </span>
                  )}
                  {category.id === "montar" && auditAlert && (
                    <span className="ml-auto size-1.5 rounded-full bg-warning" aria-hidden />
                  )}
                  {category.id === "cameo" && (
                    <span
                      className={`ml-auto size-1.5 rounded-full ${
                        bridgeOnline ? "bg-success" : "bg-muted-foreground"
                      }`}
                      aria-hidden
                    />
                  )}
                </Button>

                {selected && (
                  <div className="ml-4 space-y-0.5 border-l border-border pb-1 pl-2 pt-0.5">
                    {submenuItems.map((item) => (
                      <Button
                        key={item.id}
                        type="button"
                        variant="ghost"
                        aria-current={item.id === panel ? "page" : undefined}
                        onClick={() => setPanel(item.id)}
                        className={`relative h-7 w-full justify-start gap-1.5 px-2 text-[10px] ${
                          item.id === panel
                            ? "bg-secondary text-foreground hover:bg-secondary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className={`shrink-0 ${item.id === panel ? "text-primary" : ""}`}>
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span className="ml-auto rounded-full bg-primary/15 px-1.5 text-[9px] font-bold text-primary">
                            {item.badge}
                          </span>
                        )}
                        {item.alert && (
                          <span className="ml-auto size-1.5 rounded-full bg-warning" aria-hidden />
                        )}
                        {item.id === "maquina" && (
                          <span
                            className={`ml-auto size-1.5 rounded-full ${
                              bridgeOnline ? "bg-success" : "bg-muted-foreground"
                            }`}
                            aria-hidden
                          />
                        )}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border pt-2">
          <a
            href="https://t.me/+j7WU0xCg2K85M2Yx"
            target="_blank"
            rel="noopener noreferrer"
            className="group mb-2 flex items-center gap-2.5 rounded-md border border-primary/60 bg-primary/15 px-2.5 py-2 transition-colors hover:bg-primary/25"
          >
            <Send className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
            <span className="min-w-0">
              <span className="block text-[11px] font-bold text-primary">
                Grupo no Telegram
              </span>
              <span className="block text-[9px] leading-tight text-muted-foreground">
                Reporte bugs e converse com a galera lá
              </span>
            </span>
          </a>
          <p className="px-2 text-[10px] leading-relaxed text-muted-foreground">
            {active.summary}
          </p>
        </div>
      </nav>

      {/* Painel ativo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border px-4 py-3">
          <h2 className="font-display text-sm font-bold">{active.label}</h2>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{active.summary}</p>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {panel === "cartas" && (
            <div className="space-y-6">
              <section className="space-y-3">
                <BackPanel composer={composer} />
              </section>
              <section className="space-y-3 border-t border-border pt-5">
                <h3 className="section-label">
                  {composer.importMode === "pares" ? "Frentes e versos em pares" : "Frentes das cartas"}
                </h3>
                <ImagesPanel composer={composer} />
              </section>
            </div>
          )}
          {panel === "tamanho" && <SizePanel composer={composer} workspace={workspace} />}
          {panel === "sangria" && <BleedPanel composer={composer} />}
          {panel === "folha" && <SheetPanel composer={composer} workspace={workspace} />}
          {panel === "acabamento" && <FinishPanel composer={composer} />}
          {panel === "montar" && <BuildPanel composer={composer} workspace={workspace} />}
          {panel === "retomar" && <ResumePanel workspace={workspace} />}
          {panel === "fatiar" && <SlicerPanel slicer={slicer} />}

          {nextStep && (
            <Button
              variant="secondary"
              className="mt-6 w-full"
              onClick={() => setPanel(nextStep.id)}
            >
              Continuar para {nextStep.label.replace(/^\d+\.\s*/, "")}
              <ArrowRight className="ml-1.5 size-4" aria-hidden />
            </Button>
          )}


          {panel === "montar" && (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              {doc && sheet ? (
                <div className="space-y-3 border-t border-border pt-4">
                  <p className="truncate text-[11px] text-muted-foreground">{doc.fileName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {sheet.assemblyMode === "gutterfold"
                      ? `Folha ${workspace.activeSheet} de ${doc.sheets.length} · gutterfold em página ${sheet.frontPageIndex + 1}`
                      : `Folha ${workspace.activeSheet} de ${doc.sheets.length} · frente = página ${sheet.frontPageIndex + 1}`}
                  </p>
                  <SheetSelector
                    sheets={doc.sheets}
                    activeSheet={workspace.activeSheet}
                    side={workspace.side}
                    onSheet={(sheetNumber) => {
                      workspace.setActiveSheet(sheetNumber);
                      composer.setPreviewSheet(sheetNumber);
                    }}
                    onSide={(side) => {
                      workspace.setSide(side);
                      composer.setPreviewSide(side);
                    }}
                  />
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        {sheet.assemblyMode === "gutterfold" ? "Peças para cortar" : "Cartas para cortar"}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {sheet.assemblyMode === "gutterfold"
                          ? "Clique em cada peça na prévia para incluir ou retirar do corte. A dobra central não será cortada."
                          : "Clique em cada carta na prévia para incluir ou retirar do corte."}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedCards.length} de {sheet.cards.length} {sheet.assemblyMode === "gutterfold" ? "peças" : "cartas"} selecionadas nesta folha
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 px-2 text-[11px]"
                        onClick={() => {
                          workspace.setSheetSelection(sheet.number, true);
                          composer.setCardsSelected(
                            sheet.cards.map((card) => card.id),
                            true,
                          );
                        }}
                      >
                        Selecionar todas
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 px-2 text-[11px]"
                        onClick={() => {
                          workspace.setSheetSelection(sheet.number, false);
                          composer.setCardsSelected(
                            sheet.cards.map((card) => card.id),
                            false,
                          );
                        }}
                      >
                        Desmarcar todas
                      </Button>
                    </div>
                  </div>
                  {composer.outdated && (
                    <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-[11px] leading-relaxed text-primary">
                      As configurações mudaram depois da montagem. Monte e baixe outra vez antes
                      de imprimir ou cortar.
                    </p>
                  )}
                  {doc.origin !== "composer" && (
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => void workspace.generatePrint()}
                      disabled={busy}
                    >
                      Gerar PDF para impressão
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Monte as folhas para liberar o PDF.
                </p>
              )}
            </div>
          )}

          {panel === "pdf" && SHOW_PNP_PDF_PANEL && (
            <div className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void workspace.openPdf(file);
                }}
              />
              <Button className="w-full" onClick={() => fileRef.current?.click()} disabled={busy}>
                Abrir PDF do PNP
              </Button>
              <HelpButton topic="etapa-retomar" label="entenda o PDF do PNP e o retomar corte" />
              <label className="block space-y-1.5 text-[11px] text-muted-foreground">
                <span>Borda branca das marcas (mm)</span>
                <NumberStepper
                  min={0}
                  max={10}
                  step={0.5}
                  value={workspace.registrationWhiteBorderMm}
                  ariaLabel="Borda branca das marcas"
                  onChange={(value) => workspace.setRegistrationWhiteBorderMm(value)}
                  disabled={busy}
                />
              </label>
            </div>
          )}

          {panel === "maquina" && (
            <div className="space-y-4">
              {doc && sheet ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="section-label">Material e corte</h3>
                    <HelpButton topic="material-corte" />
                  </div>
                  <div className="panel-surface bg-secondary/30 p-3">
                    <MaterialSettings
                      settings={workspace.settings}
                      presetId={workspace.presetId}
                      disabled={busy}
                      onPreset={workspace.applyPreset}
                      onChange={workspace.applySettings}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Monte as folhas para liberar os ajustes de material e corte.
                </p>
              )}
              <ProtectedParams />
              <HelpButton topic="programa-local" label="entenda o programa local (PNP Cameo Bridge)" />
              {manual ? (
                <p className="rounded-md border border-border bg-secondary/30 p-3 text-[11px] text-muted-foreground">
                  <SlidersHorizontal className="mr-1 inline size-3.5" />
                  Modo guilhotina: esta folha é para corte manual, então os comandos da Cameo ficam
                  desligados.
                </p>
              ) : (
                footer
              )}
            </div>
          )}
        </div>

        {cards.length > 0 && panel !== "fatiar" && (
          <div className="border-t border-border px-4 py-3">
            <SizeAuditBanner audit={composer.sizeAudit} />
          </div>
        )}

        {panel === "fatiar" && (
          <div className="border-t border-border p-4">
            <p className="rounded-md border border-border bg-secondary/30 p-3 text-[11px] text-muted-foreground">
              Aqui você só recorta as folhas em cartas separadas. O zip fica salvo no seu
              computador, e nada é enviado para a internet.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

function fmt(value: number): string {
  return String(value).replace(".", ",");
}
