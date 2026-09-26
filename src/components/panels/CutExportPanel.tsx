import { useState } from "react";
import JSZip from "jszip";
import { FileDown, Scissors } from "lucide-react";

import type { Composer } from "@/composer/useComposer";
import { pageSizeMm } from "@/composer/paperSizes";
import { cricutExportFiles, cricutReadmeText, cutExportFiles, exportSheetsFrom } from "@/export/cutVectors";
import { downloadBytes } from "@/pdf/generatePrintPdf";
import { Button } from "@/components/ui/button";
import { HelpButton } from "@/components/HelpButton";
import type { Workspace } from "@/state/useWorkspace";

function textBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Exporta apenas as linhas de corte, sem nenhuma imagem. */
export function CutExportPanel({
  composer,
  workspace,
  section = "all",
}: {
  composer: Composer;
  workspace: Workspace;
  /** "cricut" mostra só o Pacote Cricut; "vectors" só DXF/SVG. */
  section?: "all" | "cricut" | "vectors";
}) {
  const [busy, setBusy] = useState<"dxf" | "svg" | "cricut" | null>(null);
  const sheets = exportSheetsFrom(composer.layouts, pageSizeMm(composer.config));
  const total = sheets.reduce((sum, sheet) => sum + sheet.rects.length, 0);
  const gutterfold = composer.config.assemblyMode === "gutterfold";
  const wholeSheet = gutterfold && composer.config.gutterfoldLayout === "sheet";
  const unit = gutterfold && !wholeSheet ? "peça(s)" : "carta(s)";

  const run = async (format: "dxf" | "svg") => {
    if (sheets.length === 0) {
      workspace.addLog("Marque pelo menos uma carta para exportar as linhas de corte.", "warn");
      return;
    }
    setBusy(format);
    try {
      const files = cutExportFiles(sheets, format, workspace.settings.radiusMm);
      if (files.length === 1 && files[0]) {
        downloadBytes(textBytes(files[0].text), files[0].name);
      } else {
        const zip = new JSZip();
        for (const file of files) zip.file(file.name, file.text);
        const blob = await zip.generateAsync({ type: "uint8array" });
        downloadBytes(blob, `linhas-de-corte-${format}.zip`);
      }
      workspace.addLog(
        `Linhas de corte salvas em ${format.toUpperCase()}: ${total} ${unit} em ${files.length} folha(s).`,
        "ok",
      );
    } catch (error) {
      workspace.addLog(
        "Não consegui gerar o arquivo com as linhas de corte.",
        "error",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setBusy(null);
    }
  };

  const runCricut = async () => {
    if (sheets.length === 0) {
      workspace.addLog("Marque pelo menos uma carta para gerar o Pacote Cricut.", "warn");
      return;
    }
    setBusy("cricut");
    try {
      const files = cricutExportFiles(sheets, workspace.settings.radiusMm);
      const zip = new JSZip();
      for (const file of files) zip.file(file.name, file.text);
      zip.file("LEIA-ME-CRICUT.txt", cricutReadmeText());
      const blob = await zip.generateAsync({ type: "uint8array" });
      downloadBytes(blob, "pacote-cricut-pnp-do-eron.zip");
      workspace.addLog(
        `Pacote Cricut salvo: ${total} ${unit} em ${files.length} SVG(s), sem imagens.`,
        "ok",
      );
    } catch (error) {
      workspace.addLog(
        "Não consegui gerar o Pacote Cricut.",
        "error",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setBusy(null);
    }
  };

  const cricutBlock = composer.config.finishMode === "cricut" && (
    <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-center gap-2">
        <h4 className="section-label text-primary">Pacote Cricut</h4>
        <HelpButton topic="cricut-design-space" />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Baixa um ZIP com SVGs em tamanho real para o Design Space gerar as marcas de Print Then Cut.
      </p>
      <Button
        className="w-full"
        disabled={busy !== null || sheets.length === 0}
        onClick={() => void runCricut()}
      >
        <Scissors className="mr-1.5 size-3.5" aria-hidden />
        {busy === "cricut" ? "Gerando" : "Baixar Pacote Cricut"}
      </Button>
      <p className="text-[10px] text-muted-foreground">
        {sheets.length === 0
          ? `Nenhuma ${gutterfold ? "peça" : "carta"} marcada para corte ainda.`
          : `${total} ${unit} marcada(s) em ${sheets.length} folha(s).`}
      </p>
    </div>
  );

  if (section === "cricut") return <>{cricutBlock}</>;

  return (
    <section className="space-y-2 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <h3 className="section-label">Exportar linhas de corte</h3>
        <HelpButton topic="exportar-corte" />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {wholeSheet
          ? "Arquivo com o contorno final das cartas na metade usada como referência depois da dobra. A dobra central não é exportada como corte."
          : gutterfold
          ? "Arquivo só com o contorno externo das peças, sem imagem. A dobra central não é exportada como corte."
          : "Arquivo só com o contorno das cartas, sem imagem. Serve para cortar em outro programa."}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-9"
          disabled={busy !== null || sheets.length === 0}
          onClick={() => void run("dxf")}
        >
          <FileDown className="mr-1.5 size-3.5" aria-hidden />
          {busy === "dxf" ? "Gerando" : "DXF"}
        </Button>
        <Button
          variant="outline"
          className="h-9"
          disabled={busy !== null || sheets.length === 0}
          onClick={() => void run("svg")}
        >
          <FileDown className="mr-1.5 size-3.5" aria-hidden />
          {busy === "svg" ? "Gerando" : "SVG"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {sheets.length === 0
          ? `Nenhuma ${gutterfold && !wholeSheet ? "peça" : "carta"} marcada para corte ainda.`
          : `${total} ${unit} marcada(s) em ${sheets.length} folha(s). Com mais de uma folha, sai um .zip.`}
      </p>
      {section === "all" && cricutBlock}
    </section>
  );
}
