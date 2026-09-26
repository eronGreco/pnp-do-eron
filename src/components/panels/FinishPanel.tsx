import { Scan, Scissors, Shapes } from "lucide-react";
import type { Composer } from "@/composer/useComposer";
import type { AssemblyMode } from "@/composer/types";
import { Button } from "@/components/ui/button";
import { HelpButton } from "@/components/HelpButton";
import type { HelpTopicId } from "@/help/helpTopics";

/**
 * Primeira etapa do fluxo: escolher como a folha sera cortada.
 * Os ajustes das marcas ficam em Folha e marcas, quando ja existe carta na tela.
 */
export function FinishPanel({ composer }: { composer: Composer }) {
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
          active={config.finishMode === "cameo"}
          icon={<Scan className="size-4" />}
          title="Silhouette Cameo"
          hint="A máquina lê as marcas do sensor e corta sozinha."
          help="modo-cameo"
          onClick={() => composer.setConfig({ ...config, finishMode: "cameo" })}
        />
        <ModeCard
          active={cricut}
          icon={<Shapes className="size-4" />}
          title="Cricut"
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
        <ModeCard
          active={manual}
          icon={<Scissors className="size-4" />}
          title="Guilhotina"
          hint="A folha sai limpa, com as marcas que você escolher."
          help="modo-guilhotina"
          onClick={() => composer.setConfig({ ...config, finishMode: "manual" })}
        />
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
      </section>
    </div>
  );
}

function setAssembly(composer: Composer, assemblyMode: AssemblyMode) {
  composer.setConfig({ ...composer.config, assemblyMode });
}

function ModeCard({
  active,
  icon,
  title,
  hint,
  help,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  hint: string;
  help: HelpTopicId;
  onClick: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Button
        variant={active ? "default" : "outline"}
        className="h-auto w-full flex-col items-start gap-1 whitespace-normal py-3 text-left"
        onClick={onClick}
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
