import { useEffect, useRef, useState } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import type { Slicer } from "@/slicer/useSlicer";
import { Button } from "@/components/ui/button";
import { edgeFillPixels, fillCardEdges } from "@/slicer/cornerFill";

/** Previa da folha com as linhas da grade por cima, para conferir os encontros. */
export function SlicePreview({ slicer }: { slicer: Slicer }) {
  const [zoom, setZoom] = useState<number | null>(null);
  const { active, rects, config } = slicer;
  const sheetPreviewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active || !config.cornerFill || rects.length === 0) return;
    const sheetCanvas = sheetPreviewRef.current;
    if (!sheetCanvas) return;
    let cancelled = false;
    void createImageBitmap(active.blob).then((bitmap) => {
      if (cancelled) {
        bitmap.close();
        return;
      }
      sheetCanvas.width = active.widthPx;
      sheetCanvas.height = active.heightPx;
      const sheetCtx = sheetCanvas.getContext("2d");
      if (!sheetCtx) {
        bitmap.close();
        return;
      }
      sheetCtx.drawImage(bitmap, 0, 0);

      for (const rect of rects) {
        const pixels = sheetCtx.getImageData(rect.x, rect.y, rect.width, rect.height);
        sheetCtx.putImageData(
          fillCardEdges(pixels, {
            cornerPercent: config.cornerFillCornerPercent,
            edgePercent: config.cornerFillEdgePercent,
          }),
          rect.x,
          rect.y,
        );
      }

      bitmap.close();
    });
    return () => {
      cancelled = true;
    };
  }, [
    active,
    config.cornerFill,
    config.cornerFillCornerPercent,
    config.cornerFillEdgePercent,
    rects,
  ]);

  if (!active) {
    return (
      <div className="m-auto max-w-sm text-center">
        <p className="font-display text-sm text-foreground">
          Suba uma folha com várias cartas para fatiar.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Ajuste as linhas até caírem no encontro entre as cartas e baixe o zip.
        </p>
      </div>
    );
  }

  const scale = zoom ?? 1;
  const firstFill = rects[0]
    ? edgeFillPixels(rects[0].width, rects[0].height, {
        cornerPercent: config.cornerFillCornerPercent,
        edgePercent: config.cornerFillEdgePercent,
      })
    : null;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-panel px-2 py-1.5">
        <span className="truncate text-[11px] text-muted-foreground">
          {active.name} · {config.columns} × {config.rows} = {rects.length} cartas
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label="Diminuir zoom"
            onClick={() => setZoom(Math.max(0.2, scale - 0.2))}
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="w-10 text-center text-[11px] text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label="Aumentar zoom"
            onClick={() => setZoom(Math.min(4, scale + 0.2))}
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label="Ajustar"
            onClick={() => setZoom(null)}
          >
            <Maximize className="size-3.5" />
          </Button>
        </div>
      </div>

      <div
        className="relative"
        style={zoom ? { width: `${zoom * 100}%` } : undefined}
      >
        {config.cornerFill && (
          <canvas
            ref={sheetPreviewRef}
            className="block h-auto w-full rounded-md border border-border bg-secondary/30"
            aria-label="Prévia da folha com os cantos preenchidos"
          />
        )}
        <svg
          viewBox={`0 0 ${active.widthPx} ${active.heightPx}`}
          className={config.cornerFill
            ? "pointer-events-none absolute inset-0 h-full w-full"
            : "h-auto w-full rounded-md border border-border bg-secondary/30"}
        >
          {!config.cornerFill && (
            <image
              href={active.previewUrl}
              x={0}
              y={0}
              width={active.widthPx}
              height={active.heightPx}
            />
          )}
          {rects.map((rect) => (
            <g key={`${rect.row}-${rect.column}`}>
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill="none"
                stroke="oklch(0.78 0.16 75)"
                strokeWidth={Math.max(1, active.widthPx / 600)}
              />
              <text
                x={rect.x + rect.width / 2}
                y={rect.y + rect.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(12, active.widthPx / 40)}
                fill="oklch(0.78 0.16 75)"
                opacity={0.7}
              >
                {(rect.row - 1) * config.columns + rect.column}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {config.cornerFill && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="size-2.5 shrink-0 rounded-sm bg-primary" />
          Resultado aplicado · cantos {config.cornerFillCornerPercent}%
          {firstFill ? ` (${firstFill.cornerPx} px)` : ""} · laterais {config.cornerFillEdgePercent}%
          {firstFill ? ` (${firstFill.edgePx} px)` : ""}
        </div>
      )}
    </div>
  );
}
