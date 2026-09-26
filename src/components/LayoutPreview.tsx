import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, Maximize, Minus, Plus, Square, SquareCheckBig } from "lucide-react";
import type { Composer } from "@/composer/useComposer";
import {
  backClipRect,
  backFaceRect,
  backImageRect,
  backRect,
  effectiveBackBleedMm,
  effectiveBackExtraBleedMm,
  frontFaceRect,
  isGutterfold,
} from "@/composer/layoutSheets";
import { pageSizeMm } from "@/composer/paperSizes";
import { backImageFor } from "@/composer/pairFrontBack";
import {
  registrationShapesMm,
  registrationWhiteBackdropsMm,
} from "@/cut/geometry";
import { sensorSafeZonesMm } from "@/cut/geometry";
import { manualMarkCss, manualMarkRectsMm, marksOnSide } from "@/cut/manualMarks";
import { cricutMarkRectsMm, templatePageForSheet } from "@/cricut/markTemplate";
import { Button } from "@/components/ui/button";
import type { Rect } from "@/cameo/types";

const GAP_MM = 9;
const DRAG_THRESHOLD_PX = 5;

type DragState = {
  cardId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  started: boolean;
  pointerMm: { x: number; y: number };
  grabOffsetMm: { x: number; y: number };
  insertion: { targetCardId: string; after: boolean } | null;
};

export function LayoutPreview({
  composer,
  cornerRadiusMm = 0,
}: {
  composer: Composer;
  cornerRadiusMm?: number;
}) {
  const { layouts, previewSheet, previewSide, imageById, artFor, config } = composer;
  const [drag, setDrag] = useState<DragState | null>(null);
  const [zoom, setZoom] = useState<number | null>(null); // null = ajustado à largura
  const [showCutLines, setShowCutLines] = useState(true);
  const [loadedUrls, setLoadedUrls] = useState<ReadonlySet<string>>(new Set());
  const markLoaded = (url: string) =>
    setLoadedUrls((previous) => {
      if (previous.has(url)) return previous;
      const next = new Set(previous);
      next.add(url);
      return next;
    });
  const [toolbarTarget, setToolbarTarget] = useState<HTMLElement | null>(null);
  const sheetBoxRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const layout = layouts.find((item) => item.number === previewSheet) ?? layouts[0];
  const page = pageSizeMm(config);
  const pageW = page.widthMm;
  const pageH = page.heightMm;

  const applyZoom = (next: number | null) => setZoom(next);

  const zoomBy = (factor: number) => {
    setZoom((current) => {
      const base = current ?? 1;
      return Math.min(4, Math.max(0.2, base * factor));
    });
  };

  // Zoom com Ctrl + roda do mouse, mantendo o ponto sob o cursor parado.
  useEffect(() => {
    const el = sheetBoxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const scroller = el.closest<HTMLElement>(".workbench-grid");
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const factor = Math.exp(-dy * 0.002);
      const before = el.getBoundingClientRect();
      zoomBy(factor);
      if (scroller) {
        requestAnimationFrame(() => {
          const after = el.getBoundingClientRect();
          scroller.scrollLeft += after.left - before.left;
          scroller.scrollTop += after.top - before.top;
        });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const connectToolbar = () => {
      const target = document.getElementById("preview-toolbar");
      if (target) setToolbarTarget(target);
    };

    connectToolbar();
    const frame = requestAnimationFrame(connectToolbar);
    const observer = new MutationObserver(connectToolbar);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  if (!layout) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        <p>Adicione imagens para ver a prévia das folhas.</p>
      </div>
    );
  }

  const gutterfold = isGutterfold(config);
  const side = gutterfold ? "front" : previewSide;
  const cameoMode = config.finishMode === "cameo";
  const cricutMarkPage =
    config.finishMode === "cricut" && side === "front"
      ? templatePageForSheet(composer.cricutMarks, layout.number)
      : null;
  const cricutMarks = cricutMarkPage ? cricutMarkRectsMm(cricutMarkPage, pageW, pageH) : [];
  const manualMarks =
    config.finishMode === "manual" && (gutterfold || marksOnSide(config.manualMarks, side))
      ? manualMarkRectsMm(
          layout.placements.map((placement) =>
            side === "front" ? placement.cutRectMm : backRect(placement.cutRectMm, config),
          ),
          config.manualMarks,
          pageW,
          pageH,
        )
      : [];
  const total = composer.cards.length;
  const selectedCount = composer.cards.filter((card) => card.selected).length;

  type PlacedCard = (typeof layout.placements)[number];
  const cutRectOf = (placement: PlacedCard): Rect =>
    side === "front" ? placement.cutRectMm : backRect(placement.cutRectMm, config);

  // Cartas cuja imagem ainda está sendo decodificada pelo navegador.
  const pendingImages = layout.placements.filter((placement) => {
    if (gutterfold) {
      const frontImage = artFor(placement.card, placement.card.frontImageId, "front");
      const backImageId = backImageFor(placement.card, config);
      const backImage = backImageId ? artFor(placement.card, backImageId, "back") : undefined;
      return Boolean(
        (frontImage && !loadedUrls.has(frontImage.previewUrl)) ||
          (backImage && !loadedUrls.has(backImage.previewUrl)),
      );
    }
    const imageId =
      side === "front" ? placement.card.frontImageId : backImageFor(placement.card, config);
    const image = imageId ? artFor(placement.card, imageId, side) : undefined;
    return image ? !loadedUrls.has(image.previewUrl) : false;
  }).length;

  const pointerToMm = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * pageW,
      y: ((clientY - rect.top) / rect.height) * pageH,
    };
  };

  // Linha da carta: agrupa por posição vertical do retângulo de corte.
  const rowOf = (placement: (typeof layout.placements)[number]) =>
    Math.round(cutRectOf(placement).y0 * 2) / 2;

  const insertionFor = (mm: { x: number; y: number }, draggingId: string) => {
    for (const placement of layout.placements) {
      if (placement.card.id === draggingId) continue;
      const rect = cutRectOf(placement);
      if (mm.x >= rect.x0 && mm.x <= rect.x1 && mm.y >= rect.y0 && mm.y <= rect.y1) {
        const after = mm.x > (rect.x0 + rect.x1) / 2;
        return { targetCardId: placement.card.id, after };
      }
    }
    return null;
  };

  const onCardPointerDown = (e: React.PointerEvent, placementIndex: number) => {
    if (e.button !== 0) return;
    const placement = layout.placements[placementIndex];
    if (!placement) return;
    const rect = cutRectOf(placement);
    const mm = pointerToMm(e.clientX, e.clientY);
    setDrag({
      cardId: placement.card.id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      started: false,
      pointerMm: mm,
      grabOffsetMm: { x: mm.x - rect.x0, y: mm.y - rect.y0 },
      insertion: null,
    });
  };

  const onSvgPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const mm = pointerToMm(e.clientX, e.clientY);
    const dist = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
    const started = drag.started || dist > DRAG_THRESHOLD_PX;
    setDrag({
      ...drag,
      started,
      pointerMm: mm,
      insertion: started ? insertionFor(mm, drag.cardId) : null,
    });
  };

  const onSvgPointerUp = () => {
    if (!drag) return;
    if (!drag.started) {
      composer.toggleCardSelected(drag.cardId);
    } else if (drag.insertion) {
      composer.moveCard(drag.cardId, drag.insertion.targetCardId, drag.insertion.after);
    }
    setDrag(null);
  };

  // Índice de inserção em coordenadas de prévia: posição do alvo (+1 se for depois).
  const insertionIndex = (() => {
    if (!drag?.started || !drag.insertion) return null;
    const targetIdx = layout.placements.findIndex(
      (p) => p.card.id === drag.insertion?.targetCardId,
    );
    if (targetIdx < 0) return null;
    return drag.insertion.after ? targetIdx + 1 : targetIdx;
  })();

  const insertionRow =
    insertionIndex === null
      ? null
      : (() => {
          const anchor =
            layout.placements[Math.min(insertionIndex, layout.placements.length - 1)];
          return anchor ? rowOf(anchor) : null;
        })();

  // Posição visual do indicador: borda esquerda da carta no índice de inserção,
  // ou borda direita da última carta da mesma linha quando insere no fim da linha.
  const insertionLine = (() => {
    if (insertionIndex === null || insertionRow === null) return null;
    const rowPlacements = layout.placements
      .map((placement, index) => ({ placement, index }))
      .filter(({ placement }) => rowOf(placement) === insertionRow);
    const inRow = rowPlacements.filter(({ placement }) => placement.card.id !== drag?.cardId);
    if (inRow.length === 0) return null;
    const nextInRow = rowPlacements.find(({ index }) => index >= insertionIndex);
    if (nextInRow) {
      const rect = cutRectOf(nextInRow.placement);
      return { x: rect.x0 - GAP_MM / 2, y0: rect.y0, y1: rect.y1 };
    }
    const last = inRow[inRow.length - 1];
    if (!last) return null;
    const rect = cutRectOf(last.placement);
    return { x: rect.x1 + GAP_MM / 2, y0: rect.y0, y1: rect.y1 };
  })();

  const shiftFor = (placementIndex: number): number => {
    if (insertionIndex === null || insertionRow === null) return 0;
    const placement = layout.placements[placementIndex];
    if (!placement || placement.card.id === drag?.cardId) return 0;
    if (rowOf(placement) !== insertionRow) return 0;
    return placementIndex >= insertionIndex ? GAP_MM : 0;
  };

  const dragPlacementIndex = drag
    ? layout.placements.findIndex((p) => p.card.id === drag.cardId)
    : -1;
  const dragPlacement = dragPlacementIndex >= 0 ? layout.placements[dragPlacementIndex] : null;

  const sheetIndex = layouts.findIndex((item) => item.number === layout.number);
  const goSheet = (delta: number) => {
    const next = layouts[Math.min(layouts.length - 1, Math.max(0, sheetIndex + delta))];
    if (next) composer.setPreviewSheet(next.number);
  };
  const thumbs = layouts.slice(0, 4);
  const toolbar = (
    <div className="flex h-full min-w-0 flex-1 items-center gap-2 overflow-x-auto px-3">
      <Button
        size="icon"
        variant="ghost"
        className="size-6 shrink-0"
        disabled={sheetIndex <= 0}
        onClick={() => goSheet(-1)}
        aria-label="Folha anterior"
      >
        <ChevronLeft className="size-3.5" />
      </Button>
      <span className="shrink-0 text-center font-mono text-[11px] text-foreground">
        Folha {layout.number}/{layouts.length}
      </span>
      <Button
        size="icon"
        variant="ghost"
        className="size-6 shrink-0"
        disabled={sheetIndex >= layouts.length - 1}
        onClick={() => goSheet(1)}
        aria-label="Próxima folha"
      >
        <ChevronRight className="size-3.5" />
      </Button>

      <div className="flex shrink-0 items-center gap-1">
        {thumbs.map((item) => (
          <button
            key={item.number}
            type="button"
            onClick={() => composer.setPreviewSheet(item.number)}
            className={`rounded border p-px transition ${
              item.number === layout.number
                ? "border-primary ring-1 ring-primary"
                : "border-border hover:border-muted-foreground"
            }`}
            aria-label={`Ver folha ${item.number}`}
          >
            <svg
              viewBox={`0 0 ${pageW} ${pageH}`}
              className="h-5 w-8 rounded-[2px] bg-white"
            >
              {item.placements.map((placement) => {
                if (gutterfold) {
                  const frontImage = artFor(placement.card, placement.card.frontImageId, "front");
                  const backImageId = backImageFor(placement.card, config);
                  const backImage = backImageId ? artFor(placement.card, backImageId, "back") : undefined;
                  const frontR = frontFaceRect(placement);
                  const backR = backFaceRect(placement, config);
                  return (
                    <g key={placement.number}>
                      {frontImage ? (
                        <image
                          href={frontImage.previewUrl}
                          preserveAspectRatio="none"
                          opacity={placement.card.selected ? 1 : 0.4}
                          x={frontR.x0}
                          y={frontR.y0}
                          width={frontR.x1 - frontR.x0}
                          height={frontR.y1 - frontR.y0}
                        />
                      ) : (
                        <rect
                          fill="oklch(0.85 0.01 250)"
                          x={frontR.x0}
                          y={frontR.y0}
                          width={frontR.x1 - frontR.x0}
                          height={frontR.y1 - frontR.y0}
                        />
                      )}
                      {backImage ? (
                        <image
                          href={backImage.previewUrl}
                          preserveAspectRatio="none"
                          opacity={placement.card.selected ? 1 : 0.4}
                          x={backR.x0}
                          y={backR.y0}
                          width={backR.x1 - backR.x0}
                          height={backR.y1 - backR.y0}
                        />
                      ) : (
                        <rect
                          fill="oklch(0.96 0.01 90)"
                          x={backR.x0}
                          y={backR.y0}
                          width={backR.x1 - backR.x0}
                          height={backR.y1 - backR.y0}
                        />
                      )}
                    </g>
                  );
                }
                const imageId =
                  side === "front"
                    ? placement.card.frontImageId
                    : backImageFor(placement.card, config);
                const image = imageId ? artFor(placement.card, imageId, side) : undefined;
                const r = side === "front" ? placement.cutRectMm : backRect(placement.cutRectMm, config);
                const common = {
                  x: r.x0,
                  y: r.y0,
                  width: r.x1 - r.x0,
                  height: r.y1 - r.y0,
                };
                return image ? (
                  <image
                    key={placement.number}
                    href={image.previewUrl}
                    preserveAspectRatio="none"
                    opacity={placement.card.selected ? 1 : 0.4}
                    {...common}
                  />
                ) : (
                  <rect key={placement.number} fill="oklch(0.85 0.01 250)" {...common} />
                );
              })}
            </svg>
          </button>
        ))}
        {layouts.length > thumbs.length && (
          <span className="text-[10px] text-muted-foreground">+{layouts.length - thumbs.length}</span>
        )}
      </div>

      {!gutterfold && (
        <div className="flex shrink-0 items-center rounded-md border border-border text-[11px]">
          <button
            type="button"
            onClick={() => composer.setPreviewSide("front")}
            className={`rounded-l-md px-2 py-1 transition ${
              side === "front" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Frente
          </button>
          <button
            type="button"
            onClick={() => composer.setPreviewSide("back")}
            className={`rounded-r-md px-2 py-1 transition ${
              side === "back" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Verso
          </button>
        </div>
      )}

      <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {selectedCount}/{total} para corte
      </span>
      <Button size="icon" variant="ghost" className="size-6 shrink-0" onClick={() => composer.setAllSelected(true)} aria-label="Marcar todas" title="Marcar todas">
        <SquareCheckBig className="size-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="size-6 shrink-0" onClick={() => composer.setAllSelected(false)} aria-label="Desmarcar todas" title="Desmarcar todas">
        <Square className="size-3.5" />
      </Button>

      <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
      <Button
        size="icon"
        variant={showCutLines ? "secondary" : "ghost"}
        className="size-6 shrink-0"
        onClick={() => setShowCutLines((visible) => !visible)}
        aria-label={showCutLines ? "Esconder linhas de corte" : "Mostrar linhas de corte"}
        aria-pressed={showCutLines}
        title={showCutLines ? "Esconder linhas de corte" : "Mostrar linhas de corte"}
      >
        {showCutLines ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      </Button>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button size="icon" variant="ghost" className="size-6" onClick={() => zoomBy(1 / 1.25)} aria-label="Diminuir zoom" title="Diminuir zoom">
          <Minus className="size-3.5" />
        </Button>
        <span className="w-9 text-center text-[11px] tabular-nums text-foreground">
          {Math.round((zoom ?? 1) * 100)}%
        </span>
        <Button size="icon" variant="ghost" className="size-6" onClick={() => zoomBy(1.25)} aria-label="Aumentar zoom" title="Aumentar zoom">
          <Plus className="size-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="size-6" onClick={() => applyZoom(null)} aria-label="Ajustar a folha à tela" title="Ajustar a folha à tela">
          <Maximize className="size-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      {toolbarTarget ? createPortal(toolbar, toolbarTarget) : null}

      <div
        ref={sheetBoxRef}
        className="relative mx-auto w-full max-w-[1100px]"
        style={zoom === null ? undefined : { width: `${zoom * 100}%`, maxWidth: "none" }}
        title="Use Ctrl + roda do mouse para ampliar"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${pageW} ${pageH}`}
          className="w-full select-none rounded-lg bg-white shadow-lg"
          style={{ touchAction: "none" }}
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
          onPointerCancel={() => setDrag(null)}
          onPointerLeave={() => {
            if (drag && !drag.started) setDrag(null);
          }}
        >
          <defs>
            <filter id="card-lift" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow
                dx="0"
                dy="2.5"
                stdDeviation="2.5"
                floodColor="#000"
                floodOpacity="0.35"
              />
            </filter>
            {layout.placements.map((placement) => {
              const clipR = side === "front" ? placement.clipRectMm : backClipRect(placement, layout.placements, config);
              return (
                <g key={placement.number}>
                  <clipPath id={`clip-${layout.number}-${placement.number}`}>
                    <rect
                      x={clipR.x0}
                      y={clipR.y0}
                      width={clipR.x1 - clipR.x0}
                      height={clipR.y1 - clipR.y0}
                    />
                  </clipPath>
                  {gutterfold && (
                    <clipPath id={`clip-back-${layout.number}-${placement.number}`}>
                      {(() => {
                        const backClip = backClipRect(placement, layout.placements, config);
                        return (
                          <rect
                            x={backClip.x0}
                            y={backClip.y0}
                            width={backClip.x1 - backClip.x0}
                            height={backClip.y1 - backClip.y0}
                          />
                        );
                      })()}
                    </clipPath>
                  )}
                </g>
              );
            })}
          </defs>

          {layout.placements.map((placement, placementIndex) => {
            if (drag?.started && placement.card.id === drag.cardId) return null;
            const imageId =
              side === "front"
                ? placement.card.frontImageId
                : backImageFor(placement.card, config);
            const image = imageId ? artFor(placement.card, imageId, side) : undefined;
            const gutterBackImageId = gutterfold ? backImageFor(placement.card, config) : null;
            const gutterBackImage = gutterBackImageId
              ? artFor(placement.card, gutterBackImageId, "back")
              : undefined;
            const imgR =
              side === "front" ? placement.imageRectMm : backImageRect(placement, config);
            const cutR = cutRectOf(placement);
            const frontR = frontFaceRect(placement);
            const backR = backFaceRect(placement, config);

            const selected = placement.card.selected;
            const shift = shiftFor(placementIndex);
            // No Cameo o contorno mostrado e o proprio caminho da lamina. Na
            // guilhotina ele e um guia para escolher o raio, impresso somente
            // quando o usuario pede.
            const cornerRx = Math.min(
              Math.max(0, cornerRadiusMm),
              (cutR.x1 - cutR.x0) / 2,
              (cutR.y1 - cutR.y0) / 2,
            );

            return (
              <g
                key={placement.number}
                style={{
                  cursor: "grab",
                  transform: shift ? `translate(${shift}px, 0)` : undefined,
                  transition: "transform 180ms ease",
                }}
                onPointerDown={(e) => onCardPointerDown(e, placementIndex)}
              >
                {image ? (
                  <image
                    href={image.previewUrl}
                    x={imgR.x0}
                    y={imgR.y0}
                    width={imgR.x1 - imgR.x0}
                    height={imgR.y1 - imgR.y0}
                    preserveAspectRatio="none"
                    clipPath={`url(#clip-${layout.number}-${placement.number})`}
                    onLoad={() => markLoaded(image.previewUrl)}
                  />
                ) : (
                  <rect
                    x={cutR.x0}
                    y={cutR.y0}
                    width={cutR.x1 - cutR.x0}
                    height={cutR.y1 - cutR.y0}
                    rx={cornerRx}
                    fill="oklch(0.92 0.01 250)"
                  />
                )}
                {gutterfold && gutterBackImage && (
                  <image
                    href={gutterBackImage.previewUrl}
                    x={backImageRect(placement, config).x0}
                    y={backImageRect(placement, config).y0}
                    width={backImageRect(placement, config).x1 - backImageRect(placement, config).x0}
                    height={backImageRect(placement, config).y1 - backImageRect(placement, config).y0}
                    preserveAspectRatio="none"
                    clipPath={`url(#clip-back-${layout.number}-${placement.number})`}
                    onLoad={() => markLoaded(gutterBackImage.previewUrl)}
                  />
                )}
                {gutterfold && !gutterBackImage && (
                  <rect
                    x={backR.x0}
                    y={backR.y0}
                    width={backR.x1 - backR.x0}
                    height={backR.y1 - backR.y0}
                    fill="oklch(0.96 0.01 90)"
                  />
                )}
                {gutterfold && (
                  <>
                    <rect
                      x={frontR.x0}
                      y={frontR.y0}
                      width={frontR.x1 - frontR.x0}
                      height={frontR.y1 - frontR.y0}
                      fill="none"
                      stroke="oklch(0.2 0.02 250 / 0.35)"
                      strokeWidth={0.25}
                    />
                    <rect
                      x={backR.x0}
                      y={backR.y0}
                      width={backR.x1 - backR.x0}
                      height={backR.y1 - backR.y0}
                      fill="none"
                      stroke="oklch(0.2 0.02 250 / 0.35)"
                      strokeWidth={0.25}
                    />
                    {placement.gutterRectMm && (
                      <line
                        x1={(placement.gutterRectMm.x0 + placement.gutterRectMm.x1) / 2}
                        y1={placement.gutterRectMm.y0}
                        x2={(placement.gutterRectMm.x0 + placement.gutterRectMm.x1) / 2}
                        y2={placement.gutterRectMm.y1}
                        stroke="oklch(0.45 0.03 250)"
                        strokeWidth={0.35}
                        strokeDasharray="2 1.5"
                        pointerEvents="none"
                      />
                    )}
                  </>
                )}
                {showCutLines && (
                  <rect
                    x={cutR.x0}
                    y={cutR.y0}
                    width={cutR.x1 - cutR.x0}
                    height={cutR.y1 - cutR.y0}
                    rx={cornerRx}
                    fill="none"
                    stroke={selected ? "oklch(0.55 0.19 145)" : "oklch(0.65 0 0)"}
                    strokeWidth={selected ? 0.6 : 0.4}
                    strokeDasharray={selected ? undefined : "2 1.5"}
                  />
                )}
                {!selected && (
                  <rect
                    x={cutR.x0}
                    y={cutR.y0}
                    width={cutR.x1 - cutR.x0}
                    height={cutR.y1 - cutR.y0}
                    rx={cornerRx}
                    fill="white"
                    opacity={0.55}
                    pointerEvents="none"
                  />
                )}
                <text
                  x={cutR.x0 + 3}
                  y={cutR.y0 + 5}
                  fontSize={4}
                  fill="oklch(0.35 0.02 250)"
                  fontFamily="monospace"
                >
                  {placement.number}
                </text>
              </g>
            );
          })}

          {/* Espaço que abre entre as cartas durante o arraste */}
          {insertionLine && (
            <g pointerEvents="none">
              <rect
                x={insertionLine.x - GAP_MM / 2 + 0.8}
                y={insertionLine.y0}
                width={GAP_MM - 1.6}
                height={insertionLine.y1 - insertionLine.y0}
                rx={1}
                fill="oklch(0.75 0.16 85)"
                opacity={0.18}
              />
              <rect
                x={insertionLine.x - 0.6}
                y={insertionLine.y0}
                width={1.2}
                height={insertionLine.y1 - insertionLine.y0}
                rx={0.6}
                fill="oklch(0.7 0.17 80)"
              />
            </g>
          )}

          {/* Lugar de origem da carta arrastada */}
          {drag?.started && dragPlacement && (
            <rect
              x={cutRectOf(dragPlacement).x0}
              y={cutRectOf(dragPlacement).y0}
              width={cutRectOf(dragPlacement).x1 - cutRectOf(dragPlacement).x0}
              height={cutRectOf(dragPlacement).y1 - cutRectOf(dragPlacement).y0}
              fill="oklch(0.75 0.16 85)"
              opacity={0.12}
              stroke="oklch(0.7 0.17 80)"
              strokeWidth={0.5}
              strokeDasharray="2 2"
              pointerEvents="none"
            />
          )}

          {/* Carta arrastada: levantada, inclinada e seguindo o cursor */}
          {drag?.started &&
            dragPlacement &&
            (() => {
              const rect = cutRectOf(dragPlacement);
              const w = rect.x1 - rect.x0;
              const h = rect.y1 - rect.y0;
              const rx = Math.min(Math.max(0, cornerRadiusMm), w / 2, h / 2);
              const x = drag.pointerMm.x - drag.grabOffsetMm.x;
              const y = drag.pointerMm.y - drag.grabOffsetMm.y;
              const imageId =
                side === "front"
                  ? dragPlacement.card.frontImageId
                  : backImageFor(dragPlacement.card, config);
              const image = imageId ? artFor(dragPlacement.card, imageId, side) : undefined;
              return (
                <g
                  pointerEvents="none"
                  filter="url(#card-lift)"
                  transform={`translate(${x} ${y}) translate(${w / 2} ${h / 2}) rotate(2) scale(1.04) translate(${-w / 2} ${-h / 2})`}
                >
                  <rect
                    x={0}
                    y={0}
                    width={w}
                    height={h}
                    rx={rx}
                    fill="white"
                  />
                  {image && (
                    <image
                      href={image.previewUrl}
                      x={0}
                      y={0}
                      width={w}
                      height={h}
                      preserveAspectRatio="none"
                    />
                  )}
                  <rect
                    x={0}
                    y={0}
                    width={w}
                    height={h}
                    rx={rx}
                    fill="none"
                    stroke="oklch(0.7 0.17 80)"
                    strokeWidth={0.7}
                  />
                </g>
              );
            })()}

          {manualMarks.map((mark, index) => (
            <rect
              key={`manual-${index}`}
              x={mark.x0}
              y={mark.y0}
              width={mark.x1 - mark.x0}
              height={mark.y1 - mark.y0}
              fill={manualMarkCss(config.manualMarks.color)}
              pointerEvents="none"
            />
          ))}

          {cameoMode &&
            sensorSafeZonesMm(page.widthMm, page.heightMm).map((zone, index) => (
              <rect
                key={`zone-${index}`}
                x={zone.x0}
                y={zone.y0}
                width={zone.x1 - zone.x0}
                height={zone.y1 - zone.y0}
                fill="none"
                stroke="oklch(0.75 0.16 85)"
                strokeWidth={0.3}
                strokeDasharray="2 1.5"
              />
            ))}

          {cameoMode &&
            side === "front" &&
            registrationWhiteBackdropsMm(
              page.widthMm,
              page.heightMm,
              config.registrationWhiteBorderMm,
            ).map((backdrop, index) => (
              <rect
                key={`backdrop-${index}`}
                x={backdrop.x0}
                y={backdrop.y0}
                width={backdrop.x1 - backdrop.x0}
                height={backdrop.y1 - backdrop.y0}
                fill="white"
              />
            ))}

          {cameoMode &&
            side === "front" &&
            registrationShapesMm(page.widthMm, page.heightMm).map((mark, index) => (
              <rect
                key={`mark-${index}`}
                x={mark.x0}
                y={mark.y0}
                width={mark.x1 - mark.x0}
                height={mark.y1 - mark.y0}
                fill="black"
              />
            ))}

          {cricutMarks.map((mark, index) => (
            <rect
              key={`cricut-${index}`}
              x={mark.x0}
              y={mark.y0}
              width={mark.x1 - mark.x0}
              height={mark.y1 - mark.y0}
              fill="black"
              pointerEvents="none"
            />
          ))}
        </svg>

        {pendingImages > 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-panel/95 px-4 py-2.5 shadow-lg">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span className="text-xs text-foreground">
                Carregando as artes das cartas...
              </span>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Prévia rápida da folha {layout.number} de {layouts.length}. Clique em uma carta para marcar
        ou desmarcar o corte e arraste uma sobre a outra para trocar de lugar: o verso acompanha.
        {gutterfold
          ? ` Modo gutterfold: frente e verso ficam na mesma peça, com dobra no centro e corte só no contorno externo.`
          : side === "back"
          ? ` Enquadramento do verso: ${effectiveBackBleedMm(config)} mm. Sangria do verso: ${effectiveBackExtraBleedMm(config)} mm.${
              config.backOffsetXMm !== 0 || config.backOffsetYMm !== 0
                ? ` Deslocamento: ${config.backOffsetXMm} mm na horizontal e ${config.backOffsetYMm} mm na vertical.`
                : ""
            }`
          : ""}
      </p>
    </div>
  );
}
