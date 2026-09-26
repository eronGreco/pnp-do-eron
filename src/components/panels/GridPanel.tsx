import type { Composer } from "@/composer/useComposer";
import { Field } from "@/components/panels/Field";
import { Button } from "@/components/ui/button";
import { DisabledConfig } from "@/components/panels/DisabledConfig";
import { gridFor } from "@/composer/layoutSheets";
import { PACKING_LABEL, packingPatch } from "@/composer/packingPolicy";
import type { ComposerConfig, PackingPolicy } from "@/composer/types";

/** Procura uma organizacao guiada que aproveite mais espacos sem cair nas marcas. */
function findBetterPacking(config: ComposerConfig, current: number) {
  const options: PackingPolicy[] = ["seguro", "economico", "colado"];
  let best: { policy: PackingPolicy; perSheet: number } | null = null;
  for (const policy of options) {
    if (policy === config.packingPolicy) continue;
    const perSheet = gridFor({ ...config, ...packingPatch(policy, config) }).perSheet;
    if (perSheet > current && (!best || perSheet > best.perSheet)) best = { policy, perSheet };
  }
  return best;
}

export function GridPanel({ composer }: { composer: Composer }) {
  const { config, grid, layouts, cards } = composer;
  const manualGrid = config.gridMode === "manual";
  const wholeSheet = config.assemblyMode === "gutterfold" && config.gutterfoldLayout === "sheet";
  const unit = config.assemblyMode === "gutterfold" && !wholeSheet ? "peça(s)" : "carta(s)";
  const betterPacking = grid.blockedSlots > 0 ? findBetterPacking(config, grid.perSheet) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={manualGrid ? "outline" : "default"}
          className="h-auto flex-col items-start gap-0.5 whitespace-normal py-2 text-left"
          onClick={() => composer.setConfig({ ...config, gridMode: "auto" })}
        >
          <span className="text-xs font-semibold">Automático</span>
          <span className="text-[10px] font-normal opacity-80">Usa tudo que cabe</span>
        </Button>
        <Button
          variant={manualGrid ? "default" : "outline"}
          className="h-auto flex-col items-start gap-0.5 whitespace-normal py-2 text-left"
          onClick={() =>
            composer.setConfig({
              ...config,
              gridMode: "manual",
              gridColumns: Math.max(1, Math.min(grid.maxColumns || 1, grid.columns || 1)),
              gridRows: Math.max(1, Math.min(grid.maxRows || 1, grid.rows || 1)),
            })
          }
        >
          <span className="text-xs font-semibold">Personalizada</span>
          <span className="text-[10px] font-normal opacity-80">
             {config.assemblyMode === "gutterfold" && !wholeSheet ? "Peças por linha e coluna" : "Cartas por linha e coluna"}
          </span>
        </Button>
      </div>

      <DisabledConfig
        disabled={!manualGrid}
        reason="Não é possível editar linhas e colunas porque a grade Automática está ativa."
      >
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={config.assemblyMode === "gutterfold" && !wholeSheet ? "Peças por linha" : "Cartas por linha"}
            value={config.gridColumns}
            min={1}
            step={1}
            disabled={!manualGrid}
            onChange={(value) => composer.setConfig({ ...config, gridColumns: Math.round(value) })}
          />
          <Field
            label={config.assemblyMode === "gutterfold" && !wholeSheet ? "Peças por coluna" : "Cartas por coluna"}
            value={config.gridRows}
            min={1}
            step={1}
            disabled={!manualGrid}
            onChange={(value) => composer.setConfig({ ...config, gridRows: Math.round(value) })}
          />
        </div>
      </DisabledConfig>

      <div className="space-y-1 rounded-md border border-border p-3 text-[11px] text-muted-foreground">
        <p>
          Cabem no máximo {grid.maxColumns} por linha e {grid.maxRows} por coluna neste tamanho.
        </p>
        <p>
          Em uso agora: {grid.columns} × {grid.rows}, ou seja {grid.perSheet} {unit} por folha
          {layouts.length > 0 ? ` · ${layouts.length} folha(s) para ${cards.length} ${unit}` : ""}.
        </p>
        {grid.limited && (
          <p className="text-warning">
            A grade pedida não cabe na folha, então foi reduzida para o que a folha aceita.
          </p>
        )}
        {grid.blockedSlots > 0 && (
          <p>
            {grid.blockedSlots} espaço(s) ficaram de fora porque cairiam sobre as marcas do sensor.
          </p>
        )}
        {grid.blockedSlots > 0 && (
          <div className="space-y-2 rounded-md border border-border bg-background/60 p-2 text-foreground">
            <p className="leading-snug">
              Outra saída é diminuir a borda branca das marcas: ela afasta as cartas das marcas, então uma borda menor pode liberar espaço.
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full whitespace-normal py-2 text-[11px]"
              onClick={() => {
                const target = document.getElementById("campo-borda-branca");
                if (!target) return;
                target.scrollIntoView({ behavior: "smooth", block: "center" });
                target.classList.add("ring-2", "ring-primary");
                window.setTimeout(() => target.classList.remove("ring-2", "ring-primary"), 1600);
              }}
            >
              Ir para a borda branca das marcas
            </Button>
          </div>
        )}
        {grid.blockedSlots > 0 && betterPacking && (
          <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-2 text-foreground">
            <p className="leading-snug">
              Com a organização "{PACKING_LABEL[betterPacking.policy]}" as cartas ficam mais juntas no centro, se afastam das marcas e cabem {betterPacking.perSheet} por folha.
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full whitespace-normal py-2 text-[11px]"
              onClick={() => composer.setConfig({ ...config, ...packingPatch(betterPacking.policy, config) })}
            >
              Usar "{PACKING_LABEL[betterPacking.policy]}" e caber {betterPacking.perSheet}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
