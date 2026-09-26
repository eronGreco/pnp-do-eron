import { useRef } from "react";
import { CheckCircle2, FileDown, FileUp, Info, RotateCcw } from "lucide-react";

import type { Composer } from "@/composer/useComposer";
import { pageSizeMm } from "@/composer/paperSizes";
import { cricutTemplateMatches } from "@/cricut/markTemplate";
import { Button } from "@/components/ui/button";
import { HelpButton } from "@/components/HelpButton";
import { CutExportPanel } from "@/components/panels/CutExportPanel";
import type { Workspace } from "@/state/useWorkspace";

function fmt(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

export function CricutMarksPanel({
  composer,
  workspace,
}: {
  composer: Composer;
  workspace: Workspace;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { config, cricutMarks, cricutTemplateStamp, cricutCoverage } = composer;
  const gutterfold = config.assemblyMode === "gutterfold";
  const unit = gutterfold ? "peça(s)" : "carta(s)";
  const page = pageSizeMm(config);
  const matches = cricutTemplateMatches(cricutMarks, cricutTemplateStamp);
  const pageMismatch =
    cricutMarks &&
    (Math.abs(cricutMarks.pageWidthMm - page.widthMm) > 1 ||
      Math.abs(cricutMarks.pageHeightMm - page.heightMm) > 1);

  if (config.finishMode !== "cricut") return null;

  return (
    <section className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void composer.importCricutMarks(file);
        }}
      />

      <div className="flex items-start gap-2">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="section-label text-primary">Fluxo Cricut</h3>
            <HelpButton topic="modo-cricut" />
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Gere o SVG, abra no Design Space, salve o PDF com marcas e volte aqui para importar.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[24px_1fr] gap-x-2 gap-y-2 text-[11px]">
        <Step n="1" text="Baixe o Pacote Cricut com o SVG de corte." />
        <Step n="2" text="Abra o SVG no Design Space e mantenha o tamanho real." />
        <Step n="3" text="Use Print Then Cut e salve o PDF com as marcas." />
        <Step n="4" text={`Importe esse PDF aqui antes de montar ${gutterfold ? "as peças" : "as cartas"}.`} />
      </div>

      <CutExportPanel composer={composer} workspace={workspace} section="cricut" />

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-9 whitespace-normal px-2 py-2 text-[11px]"
          onClick={() => inputRef.current?.click()}
          disabled={composer.working}
        >
          <FileUp className="mr-1.5 size-3.5 shrink-0" aria-hidden />
          Importar PDF de marcas
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-h-9 whitespace-normal px-2 py-2 text-[11px]"
          onClick={composer.clearCricutMarks}
          disabled={!cricutMarks || composer.working}
        >
          <RotateCcw className="mr-1.5 size-3.5 shrink-0" aria-hidden />
          Trocar molde
        </Button>
      </div>

      {cricutMarks ? (
        <div className="space-y-2 rounded-md border border-border bg-background/70 p-2">
          <div className="flex items-center gap-2 text-[11px] text-foreground">
            <CheckCircle2 className="size-3.5 text-success" aria-hidden />
            <span className="truncate">{cricutMarks.name}</span>
          </div>
          <p className="text-[10px] leading-snug text-muted-foreground">
            {cricutMarks.pages.length} página(s) com marcas detectadas. PDF: {fmt(cricutMarks.pageWidthMm)} por {fmt(cricutMarks.pageHeightMm)} mm.
          </p>
          {!matches && (
            <p className="rounded-md border border-warning/60 bg-warning/10 px-2 py-1.5 text-[10px] leading-snug text-warning">
              {gutterfold ? "As peças" : "As cartas"}, a folha ou o raio mudaram depois desse molde. Gere outro SVG no Design Space e importe o PDF novo.
            </p>
          )}
          {pageMismatch && (
            <p className="rounded-md border border-warning/60 bg-warning/10 px-2 py-1.5 text-[10px] leading-snug text-warning">
              O tamanho do PDF de marcas não bate com a folha atual: {fmt(page.widthMm)} por {fmt(page.heightMm)} mm.
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-md border border-border bg-background/70 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
          Sem o PDF de marcas, o PNP do Eron ainda gera o SVG de corte, mas não monta o PDF final para a Cricut.
        </p>
      )}

      {cricutCoverage.content.length > 0 && (
        <div className="space-y-2 rounded-md border border-warning/60 bg-warning/10 p-2 text-[11px] text-warning">
          <p className="font-semibold">As marcas da Cricut estão sobre {cricutCoverage.content.length} {unit}.</p>
          <p className="leading-snug">
            Gere um novo molde com menos cartas na folha, ou reduza sangria e grade antes de imprimir.
          </p>
          {cricutCoverage.suggestedGrid && (
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full justify-start whitespace-normal py-2 text-left text-[11px]"
              onClick={composer.applyCricutGridSuggestion}
            >
              Usar {cricutCoverage.suggestedGrid.columns} por linha e {cricutCoverage.suggestedGrid.rows} por coluna
            </Button>
          )}
        </div>
      )}

      {cricutMarks?.pages[0] && (
        <img
          src={cricutMarks.pages[0].previewUrl}
          alt="Marcas da Cricut detectadas"
          className="max-h-28 w-full rounded-md border border-border bg-white object-contain"
        />
      )}

      <HelpButton topic="cricut-design-space" label="ver passo a passo da Cricut" />
      <p className="flex items-center gap-1 text-[10px] leading-snug text-muted-foreground">
        <FileDown className="size-3 shrink-0" aria-hidden />
        Só o SVG de corte vai para o Design Space. As imagens das cartas ficam aqui.
      </p>
    </section>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <>
      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
        {n}
      </span>
      <span className="pt-1 leading-snug text-muted-foreground">{text}</span>
    </>
  );
}