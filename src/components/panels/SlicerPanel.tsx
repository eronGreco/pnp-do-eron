import { useRef } from "react";
import { ImagePlus, Package, Trash2 } from "lucide-react";
import type { Slicer } from "@/slicer/useSlicer";
import { SlicerSliderField } from "@/components/panels/SlicerSliderField";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { HelpButton } from "@/components/HelpButton";

export function SlicerPanel({ slicer }: { slicer: Slicer }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { config, images, active, progress } = slicer;
  const total = images.length * config.columns * config.rows;

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) void slicer.addFiles(files);
        }}
      />

      <div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => inputRef.current?.click()}>
            <ImagePlus />
            Adicionar folhas
          </Button>
          <Button variant="ghost" onClick={slicer.clearAll} disabled={images.length === 0}>
            Limpar
          </Button>
        </div>
        <div className="mt-1.5">
          <HelpButton topic="etapa-fatiar" variant="etapa" />
        </div>
      </div>

      {images.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="section-label">Folhas</h3>
          {images.map((image) => (
            <div
              key={image.id}
              className={`flex items-center gap-2 rounded-md border p-1.5 ${
                active?.id === image.id ? "border-primary/60 bg-primary/10" : "border-border"
              }`}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => slicer.setActiveId(image.id)}
              >
                <img
                  src={image.previewUrl}
                  alt=""
                  className="size-8 rounded object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{image.name}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {image.widthPx} × {image.heightPx} px
                  </span>
                </span>
              </button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label="Remover folha"
                onClick={() => slicer.removeImage(image.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="section-label">Quantas cartas na folha</h3>
        <div className="space-y-3">
          <SlicerSliderField
            label="Colunas"
            value={config.columns}
            step={1}
            min={1}
            max={20}
            onChange={(columns) => slicer.setConfig({ columns })}
          />
          <SlicerSliderField
            label="Linhas"
            value={config.rows}
            step={1}
            min={1}
            max={20}
            onChange={(rows) => slicer.setConfig({ rows })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="section-label">Margens (px)</h3>
          <HelpButton topic="fatiar-recorte" />
        </div>
        <div className="space-y-3">
          <SlicerSliderField
            label="Cima"
            value={config.marginTopPx}
            step={1}
            min={0}
            max={2000}
            onChange={(marginTopPx) => slicer.setConfig({ marginTopPx })}
          />
          <SlicerSliderField
            label="Baixo"
            value={config.marginBottomPx}
            step={1}
            min={0}
            max={2000}
            onChange={(marginBottomPx) => slicer.setConfig({ marginBottomPx })}
          />
          <SlicerSliderField
            label="Esquerda"
            value={config.marginLeftPx}
            step={1}
            min={0}
            max={2000}
            onChange={(marginLeftPx) => slicer.setConfig({ marginLeftPx })}
          />
          <SlicerSliderField
            label="Direita"
            value={config.marginRightPx}
            step={1}
            min={0}
            max={2000}
            onChange={(marginRightPx) => slicer.setConfig({ marginRightPx })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="section-label">Espaço entre as cartas (px)</h3>
        <div className="space-y-3">
          <SlicerSliderField
            label="Entre colunas"
            value={config.gutterXPx}
            step={1}
            min={0}
            max={2000}
            onChange={(gutterXPx) => slicer.setConfig({ gutterXPx })}
          />
          <SlicerSliderField
            label="Entre linhas"
            value={config.gutterYPx}
            step={1}
            min={0}
            max={2000}
            onChange={(gutterYPx) => slicer.setConfig({ gutterYPx })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="section-label">Ajuste fino</h3>
        <div className="space-y-3">
          <SlicerSliderField
            label="Mover na horizontal"
            value={config.offsetXPx}
            step={1}
            min={-500}
            max={500}
            onChange={(offsetXPx) => slicer.setConfig({ offsetXPx })}
          />
          <SlicerSliderField
            label="Mover na vertical"
            value={config.offsetYPx}
            step={1}
            min={-500}
            max={500}
            onChange={(offsetYPx) => slicer.setConfig({ offsetYPx })}
          />
          <SlicerSliderField
            label="Sobra por carta"
            value={config.overshootPx}
            step={1}
            min={-200}
            max={200}
            onChange={(overshootPx) => slicer.setConfig({ overshootPx })}
          />
        </div>
        <HelpButton topic="fatiar-sobra" label="entenda a sobra por carta" />
      </div>

      <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-foreground">Preencher bordas automaticamente</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Completa cantos e laterais com cores da própria carta.
            </p>
          </div>
          <Switch
            checked={config.cornerFill}
            onCheckedChange={(cornerFill) => slicer.setConfig({ cornerFill })}
            aria-label="Preencher bordas automaticamente"
          />
        </div>
        {config.cornerFill && (
          <div className="space-y-3">
            <SlicerSliderField
              label="Raio dos cantos (%)"
              value={config.cornerFillCornerPercent}
              step={0.1}
              min={0.1}
              max={30}
              onChange={(cornerFillCornerPercent) =>
                slicer.setConfig({ cornerFillCornerPercent })
              }
            />
            <SlicerSliderField
              label="Largura das laterais (%)"
              value={config.cornerFillEdgePercent}
              step={0.1}
              min={0}
              max={10}
              onChange={(cornerFillEdgePercent) => slicer.setConfig({ cornerFillEdgePercent })}
            />
            <HelpButton topic="fatiar-cantos" label="entenda o preenchimento das bordas" />
          </div>
        )}
      </div>

      {active && (
        <p className="text-[11px] text-muted-foreground">
          Cada carta sai com cerca de{" "}
          {Math.round(
            (active.widthPx -
              config.marginLeftPx -
              config.marginRightPx -
              config.gutterXPx * (config.columns - 1)) /
              config.columns,
          )}{" "}
          ×{" "}
          {Math.round(
            (active.heightPx -
              config.marginTopPx -
              config.marginBottomPx -
              config.gutterYPx * (config.rows - 1)) /
              config.rows,
          )}{" "}
          px.
        </p>
      )}

      <Button
        className="w-full"
        onClick={() => void slicer.sliceAndDownload()}
        disabled={images.length === 0 || progress !== null}
      >
        <Package />
        {progress
          ? `Recortando ${progress.done}/${progress.total}...`
          : `Cortar e baixar zip (${total} carta${total === 1 ? "" : "s"})`}
      </Button>
    </div>
  );
}
