import type { Composer } from "@/composer/useComposer";
import { Field } from "@/components/panels/Field";
import { Button } from "@/components/ui/button";

export function GridPanel({ composer }: { composer: Composer }) {
  const { config, grid, layouts, cards } = composer;
  const manualGrid = config.gridMode === "manual";
  const unit = config.assemblyMode === "gutterfold" ? "peça(s)" : "carta(s)";

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
          <span className="text-xs font-semibold">Eu escolho</span>
          <span className="text-[10px] font-normal opacity-80">
            {config.assemblyMode === "gutterfold" ? "Peças por linha e coluna" : "Cartas por linha e coluna"}
          </span>
        </Button>
      </div>

      {manualGrid && (
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={config.assemblyMode === "gutterfold" ? "Peças por linha" : "Cartas por linha"}
            value={config.gridColumns}
            min={1}
            step={1}
            onChange={(value) => composer.setConfig({ ...config, gridColumns: Math.round(value) })}
          />
          <Field
            label={config.assemblyMode === "gutterfold" ? "Peças por coluna" : "Cartas por coluna"}
            value={config.gridRows}
            min={1}
            step={1}
            onChange={(value) => composer.setConfig({ ...config, gridRows: Math.round(value) })}
          />
        </div>
      )}

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
      </div>
    </div>
  );
}
