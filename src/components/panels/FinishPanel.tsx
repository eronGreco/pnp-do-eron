import { BookOpen, LayoutGrid, Scan, Scissors, Shapes } from "lucide-react";
import type { Composer } from "@/composer/useComposer";
import type { AssemblyMode } from "@/composer/types";
import { Button } from "@/components/ui/button";
import { HelpButton } from "@/components/HelpButton";
import type { HelpTopicId } from "@/help/helpTopics";

/**
 * Primeira etapa do fluxo: escolher como a folha sera cortada.
 * Os ajustes das marcas ficam em Folha e marcas, quando ja existe carta na tela.
 */
export function FinishPanel({ composer }: { composer: Pick<Composer, "config" | "setConfig"> }) {
  const { config } = composer;
  const manual = config.finishMode === "manual";
  const cricut = config.finishMode === "cricut";

  return (
    <div className="space-y-4">
      <HelpButton topic="etapa-acabamento" variant="etapa" />

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Comece escolhendo como as cartas vão ser cortadas.
      </p>

      <div className="space-y-2">
        <ModeCard
          active={manual}
          icon={<Scissors className="size-4" />}
          title="GUILHOTINA"
          hint="A folha sai limpa, com as marcas que você escolher."
          help="modo-guilhotina"
          onClick={() => composer.setConfig({ ...config, finishMode: "manual" })}
        />
        <ModeCard
          active={!manual}
          icon={<Scan className="size-4" />}
          title="SILHOUETTE"
          hint="Corte por máquina: escolha Cameo ou Cricut abaixo."
          help="modo-silhouette"
          onClick={() => {
            if (manual) composer.setConfig({ ...config, finishMode: "cameo" });
          }}
        />
        {!manual && (
          <fieldset className="ml-2 space-y-2 border-l border-primary/40 pl-3">
            <legend className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">
              SILHOUETTE: máquina
            </legend>
            <ModeCard
              active={config.finishMode === "cameo"}
              icon={<Scan className="size-4" />}
              title="CAMEO"
              hint="A máquina lê as marcas do sensor e corta sozinha."
              help="modo-cameo"
              onClick={() => composer.setConfig({ ...config, finishMode: "cameo" })}
            />
            <ModeCard
              active={cricut}
              icon={<Shapes className="size-4" />}
              title="CRICUT"
              hint="Gera SVG para o Design Space e usa o PDF de marcas dele."
              help="modo-cricut"
              onClick={() =>
                composer.setConfig({
                  ...config,
                  finishMode: "cricut",
                  paperSize: "a4",
                  orientation: "retrato",
                })
              }
            />
          </fieldset>
        )}
      </div>

      <section className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Modo de montagem
          </p>
          <HelpButton topic="modo-montagem" />
        </div>
        <ModeCard
          active={config.assemblyMode === "normal"}
          icon={<span className="font-mono text-xs">1</span>}
          title="Normal"
          hint="Frente e verso ficam em páginas separadas, como sempre."
          help="modo-montagem-normal"
          onClick={() => setAssembly(composer, "normal")}
        />
        <ModeCard
          active={config.assemblyMode === "gutterfold"}
          icon={<span className="font-mono text-xs">G</span>}
          title="Gutterfold"
          hint="Frente e verso lado a lado para dobrar uma peça única."
          help="modo-gutterfold"
          onClick={() => setAssembly(composer, "gutterfold")}
        />
        {config.assemblyMode === "gutterfold" && (
          <div className="ml-2 space-y-2 border-l border-border pl-3">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Formato da dobra</p>
            <ModeCard
              active={config.gutterfoldLayout === "piece"}
              icon={<LayoutGrid className="size-4" />}
              title="Carta por carta"
              hint="Cada carta vira uma peça aberta com frente e verso."
              help="modo-gutterfold"
              onClick={() => composer.setConfig({ ...config, gutterfoldLayout: "piece" })}
            />
            <ModeCard
              active={config.gutterfoldLayout === "sheet"}
              icon={<BookOpen className="size-4" />}
              title="Dobrar a folha inteira"
              hint="Frentes em uma metade, versos invertidos na outra e uma dobra central."
              help="modo-gutterfold-folha"
              onClick={() => composer.setConfig({ ...config, gutterfoldLayout: "sheet" })}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function setAssembly(composer: Pick<Composer, "config" | "setConfig">, assemblyMode: AssemblyMode) {
  composer.setConfig({ ...composer.config, assemblyMode });
}

function ModeCard({
  active,
  icon,
  title,
  hint,
  help,
  onClick,
  disabled = false,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  hint: string;
  help: HelpTopicId;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Button
        variant={active ? "default" : "outline"}
        className="h-auto w-full flex-col items-start gap-1 whitespace-normal py-3 text-left"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={active}
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </span>
        <span className="text-[11px] font-normal leading-relaxed opacity-80">{hint}</span>
      </Button>
      <HelpButton topic={help} label={`entenda ${title}`} className="ml-0.5" />
    </div>
  );
}
