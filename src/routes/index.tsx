import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useCameo } from "@/cameo/useCameo";
import { CameoControls } from "@/components/CameoControls";
import { StudioSidebar } from "@/components/StudioSidebar";
import { CutConfirmDialog } from "@/components/CutConfirmDialog";
import { JobLog } from "@/components/JobLog";
import { PreviewCanvas } from "@/components/PreviewCanvas";
import { LayoutPreview } from "@/components/LayoutPreview";
import { SlicePreview } from "@/components/SlicePreview";
import { pageSizeMm } from "@/composer/paperSizes";
import { useComposer } from "@/composer/useComposer";
import { useSlicer } from "@/slicer/useSlicer";
import type { PanelId } from "@/components/StudioSidebar";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/state/useWorkspace";
import { cutRectHitsRegistrationArea } from "@/cut/geometry";
import { InstallAppButton } from "@/components/InstallAppButton";
import { SmallScreenNotice } from "@/components/SmallScreenNotice";
import { UpdateDialog } from "@/components/UpdateDialog";
import { useAppUpdate } from "@/pwa/useAppUpdate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PNP do Eron | Cartas do Print and Play direto na Silhouette Cameo 4" },
      {
        name: "description",
        content:
          "Monte as cartas, gere o PDF de impressão e corte na Silhouette Cameo 4. Seus arquivos ficam sempre no seu computador.",
      },
      {
        property: "og:title",
        content: "PNP do Eron | Cartas do Print and Play na Cameo 4",
      },
      {
        property: "og:description",
        content:
          "Monte as cartas, gere o PDF de impressão e corte na Silhouette Cameo 4, sem enviar nada para a internet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return ready ? <Studio /> : <Loading />;
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Preparando a área de trabalho...
    </div>
  );
}

function Studio() {
  const workspace = useWorkspace();
  const composer = useComposer(workspace);
  const cameo = useCameo(workspace, composer.config.finishMode === "cameo");
  const slicer = useSlicer(workspace.addLog);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showLayout, setShowLayout] = useState(false);
  const [panel, setPanel] = useState<PanelId>("acabamento");
  const slicing = panel === "fatiar";
  const update = useAppUpdate();

  // Mudou acabamento ou marcas: a prévia da montagem aparece na hora.
  const marksKey = `${composer.config.finishMode}|${composer.config.assemblyMode}|${composer.config.gutterfoldLayout}|${composer.config.gutterfoldDirection}|${composer.config.gutterfoldGapMm}|${composer.config.cameoRegistrationSide}|${composer.config.cameoMarkArmCustom}|${composer.config.cameoMarkArmMm}|${JSON.stringify(composer.config.manualMarks)}`;
  const firstMarksKey = useRef(marksKey);
  useEffect(() => {
    if (marksKey === firstMarksKey.current) return;
    setShowLayout(true);
  }, [marksKey]);

  // Limpou tudo: a prévia volta ao estado vazio.
  const emptyWorkspace = composer.cards.length === 0 && !workspace.doc;
  useEffect(() => {
    if (emptyWorkspace) setShowLayout(false);
  }, [emptyWorkspace]);


  const { doc, sheet, selectedCards, settings, presetId, busy } = workspace;
  const blocked =
    composer.config.finishMode === "cricut" ||
    selectedCards.some((card) =>
      doc?.origin === "pdf"
        ? cutRectHitsRegistrationArea(
            card.cutRectMm,
            sheet?.pageWidthMm ?? 297,
            sheet?.pageHeightMm ?? 210,
            workspace.registrationWhiteBorderMm,
            sheet?.registrationArmMm,
          )
        : card.hitsRegistrationMark,
    );
  const showingLayout = composer.layouts.length > 0 && (showLayout || !doc || !sheet);

  const startCut = () => {
    if (composer.config.finishMode === "cricut") {
      workspace.addLog(
        "No modo Cricut, o corte é feito pelo Design Space. Use o Pacote Cricut em vez do programa local.",
        "warn",
      );
      return;
    }
    if (!sheet) return;
    if (blocked) {
      workspace.addLog(
        "Uma registration mark invade a área final de corte. Corrija o layout antes de continuar.",
        "error",
      );
      return;
    }
    setConfirmOpen(true);
  };

  const confirmCut = () => {
    if (!sheet || composer.config.finishMode !== "cameo") return;
    setConfirmOpen(false);
    // Folhas montadas aqui podem ter tamanho personalizado; PDF aberto de fora
    // segue A4 deitada, que e o padrao do programa local.
    const page =
      workspace.doc?.origin === "composer" ? pageSizeMm(composer.config) : null;
    void cameo.cut({
      sheet: sheet.number,
      ...(page ? { sheetWidthMm: page.widthMm, sheetHeightMm: page.heightMm } : {}),
      ...(sheet.registrationArmMm ? { markArmMm: sheet.registrationArmMm } : {}),
      cards: selectedCards.map((card) => card.cutRectMm),
      settings,
    });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <StudioSidebar
        composer={composer}
        workspace={workspace}
        slicer={slicer}
        panel={panel}
        onPanel={setPanel}
        bridgeOnline={cameo.bridgeOnline}
        footer={
          <CameoControls
            bridgeOnline={cameo.bridgeOnline}
            bridgeVersion={cameo.bridgeVersion}
            bridgeOutdated={cameo.bridgeOutdated}
            requiredBridgeVersion={cameo.requiredBridgeVersion}
            busy={busy}
            canCut={
              composer.config.finishMode === "cameo" &&
              Boolean(sheet) &&
              selectedCards.length > 0 &&
              workspace.side === (sheet?.registrationSide ?? "front") &&
              !showingLayout
            }
            installHint={cameo.installHint}
            onTest={cameo.testConnection}
            onReadMarks={cameo.readMarks}
            onCut={startCut}
            onRefreshBridge={() => void cameo.refreshBridge()}
          />
        }
      />

      {/* Área central */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        {workspace.busyLabel && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-panel px-4 py-3 shadow-lg">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span className="text-xs text-foreground">{workspace.busyLabel}...</span>
            </div>
          </div>
        )}
        {slicing ? null : (
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-panel pr-3">
            <div id="preview-toolbar" className="flex h-10 min-w-0 flex-1 items-center" />
            {!showingLayout && composer.layouts.length > 0 && doc && sheet && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setShowLayout((value) => !value)}
              >
                Ver prévia do ajuste
              </Button>
            )}
            <InstallAppButton />
          </div>
        )}

        <div className="workbench-grid flex flex-1 overflow-auto p-8">
          <div className="m-auto flex w-full max-w-[1200px] flex-col self-center">
          {slicing ? (
            <SlicePreview slicer={slicer} />
          ) : doc && sheet && !showingLayout ? (
            <PreviewCanvas
              bytes={doc.bytes}
              sheet={sheet}
              side={workspace.side}
              rotationDeg={doc.rotationDeg}
              finishMode={doc.origin === "composer" ? composer.config.finishMode : "cameo"}
              registrationWhiteBorderMm={workspace.registrationWhiteBorderMm}
              onToggleCard={(cardId) => workspace.toggleCard(sheet.number, cardId)}
            />
          ) : composer.layouts.length > 0 ? (
            <LayoutPreview composer={composer} cornerRadiusMm={workspace.settings.radiusMm} />
          ) : (
            <div className="m-auto max-w-sm text-center">
              <p className="font-display text-sm text-foreground">
                Abra um PDF do PNP ou monte as cartas a partir das suas imagens.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                As folhas aparecem aqui em tamanho grande, com as cartas numeradas.
              </p>
            </div>
          )}
          </div>
        </div>

        <JobLog entries={workspace.log} onClear={workspace.clearLog} />
      </main>

      {sheet && (
        <CutConfirmDialog
          open={confirmOpen}
          sheet={sheet}
          cards={selectedCards}
          settings={settings}
          presetId={presetId}
          totalSheets={doc?.sheets.length ?? 1}
          onOpenChange={setConfirmOpen}
          onConfirm={confirmCut}
        />
      )}

      <UpdateDialog
        update={update}
        hasWork={Boolean(workspace.doc) || composer.cards.length > 0}
      />
      <SmallScreenNotice />
    </div>
  );
}
