import { useEffect, useRef, useState } from "react";
import type { Sheet } from "@/cameo/types";
import {
  registrationShapesMm,
  registrationWhiteBackdropsMm,
  sensorSafeZonesMm,
} from "@/cut/geometry";
import { renderPageToCanvas } from "@/pdf/renderPreview";
import type { FinishMode } from "@/cut/manualMarks";

type Props = {
  bytes: ArrayBuffer;
  sheet: Sheet;
  side: "front" | "back";
  rotationDeg: 0 | 90;
  finishMode?: FinishMode;
  registrationWhiteBorderMm: number;
  onToggleCard: (cardId: string) => void;
};

export function PreviewCanvas({
  bytes,
  sheet,
  side,
  rotationDeg,
  finishMode = "cameo",
  registrationWhiteBorderMm,
  onToggleCard,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pxPerMm, setPxPerMm] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);

  const gutterfold = sheet.assemblyMode === "gutterfold";
  const displaySide = gutterfold ? "front" : sheet.frontPageIndex === null && sheet.backPageIndex !== null ? "back" : side;
  const pageIndex = displaySide === "front" ? sheet.frontPageIndex : sheet.backPageIndex;
  const showCameoOverlay = finishMode === "cameo";
  const registrationSide = gutterfold ? "front" : (sheet.registrationSide ?? "front");

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas || pageIndex === null) return;

    setError(null);
    renderPageToCanvas(bytes, pageIndex, rotationDeg, canvas)
      .then((render) => {
        if (cancelled) return;
        setPxPerMm(render.pxPerMm);
        setSize({ width: render.canvasWidth, height: render.canvasHeight });
      })
      .catch(() => {
        if (!cancelled) setError("Não consegui desenhar a visualização desta página.");
      });

    return () => {
      cancelled = true;
    };
  }, [bytes, pageIndex, rotationDeg]);

  if (pageIndex === null) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
        {displaySide === "front" ? "Este PDF não inclui a frente desta folha." : "Esta folha não possui verso."}
      </div>
    );
  }

  const scale = (mm: number) => mm * pxPerMm;

  return (
    <div className="relative w-full">
      <div
        className="relative mx-auto w-full max-w-[1100px]"
        style={{ aspectRatio: size.width && size.height ? `${size.width}/${size.height}` : "297/210" }}
      >
        <canvas ref={canvasRef} className="h-full w-full rounded-lg bg-white shadow-lg" />

        {size.width > 0 && (
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${size.width} ${size.height}`}
            preserveAspectRatio="none"
          >
            {showCameoOverlay && displaySide === registrationSide && registrationWhiteBackdropsMm(
              sheet.pageWidthMm,
              sheet.pageHeightMm,
              registrationWhiteBorderMm,
              sheet.registrationArmMm,
            ).map((backdrop, index) => (
              <rect
                key={`backdrop-${index}`}
                x={scale(backdrop.x0)}
                y={scale(backdrop.y0)}
                width={scale(backdrop.x1 - backdrop.x0)}
                height={scale(backdrop.y1 - backdrop.y0)}
                fill="white"
              />
            ))}

            {showCameoOverlay && displaySide === registrationSide && sensorSafeZonesMm(sheet.pageWidthMm, sheet.pageHeightMm, sheet.registrationArmMm).map((zone, index) => (
              <rect
                key={`zone-${index}`}
                x={scale(zone.x0)}
                y={scale(zone.y0)}
                width={scale(zone.x1 - zone.x0)}
                height={scale(zone.y1 - zone.y0)}
                fill="none"
                stroke="oklch(0.75 0.16 85)"
                strokeWidth={1}
                strokeDasharray="6 5"
                opacity={0.7}
              />
            ))}

            {showCameoOverlay && displaySide === registrationSide && registrationShapesMm(sheet.pageWidthMm, sheet.pageHeightMm, sheet.registrationArmMm).map((mark, index) => (
              <rect
                key={`mark-${index}`}
                x={scale(mark.x0)}
                y={scale(mark.y0)}
                width={scale(mark.x1 - mark.x0)}
                height={scale(mark.y1 - mark.y0)}
                fill="oklch(0.75 0.16 85)"
                opacity={0.35}
              />
            ))}

            {displaySide === registrationSide &&
              sheet.cards.map((card) => {
                const x = scale(card.cutRectMm.x0);
                const y = scale(card.cutRectMm.y0);
                const w = scale(card.cutRectMm.x1 - card.cutRectMm.x0);
                const h = scale(card.cutRectMm.y1 - card.cutRectMm.y0);
                const stroke = card.hitsRegistrationMark
                  ? "oklch(0.62 0.21 25)"
                  : card.selected
                    ? "oklch(0.74 0.19 145)"
                    : "oklch(0.62 0.02 250)";

                return (
                  <g
                    key={card.id}
                    onClick={() => onToggleCard(card.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={card.selected ? "oklch(0.74 0.19 145 / 0.10)" : "transparent"}
                      stroke={stroke}
                      strokeWidth={card.selected ? 2.5 : 1.5}
                      rx={6}
                    />
                    {gutterfold && card.frontRectMm && card.backRectMm && (
                      <>
                        <rect
                          x={scale(card.frontRectMm.x0)}
                          y={scale(card.frontRectMm.y0)}
                          width={scale(card.frontRectMm.x1 - card.frontRectMm.x0)}
                          height={scale(card.frontRectMm.y1 - card.frontRectMm.y0)}
                          fill="none"
                          stroke="oklch(0.2 0.02 250 / 0.35)"
                          strokeWidth={1}
                        />
                        <rect
                          x={scale(card.backRectMm.x0)}
                          y={scale(card.backRectMm.y0)}
                          width={scale(card.backRectMm.x1 - card.backRectMm.x0)}
                          height={scale(card.backRectMm.y1 - card.backRectMm.y0)}
                          fill="none"
                          stroke="oklch(0.2 0.02 250 / 0.35)"
                          strokeWidth={1}
                        />
                      </>
                    )}
                    {gutterfold && card.foldRectMm && (
                      <line
                        x1={scale((card.foldRectMm.x0 + card.foldRectMm.x1) / 2)}
                        y1={scale(card.foldRectMm.y0)}
                        x2={scale((card.foldRectMm.x0 + card.foldRectMm.x1) / 2)}
                        y2={scale(card.foldRectMm.y1)}
                        stroke="oklch(0.45 0.03 250)"
                        strokeWidth={1.4}
                        strokeDasharray="7 5"
                        pointerEvents="none"
                      />
                    )}
                    <circle cx={x + 16} cy={y + 16} r={12} fill="oklch(0.18 0.02 255 / 0.85)" />
                    <text
                      x={x + 16}
                      y={y + 21}
                      textAnchor="middle"
                      fontSize={13}
                      fontFamily="var(--font-mono, monospace)"
                      fill={card.selected ? "oklch(0.85 0.19 145)" : "oklch(0.78 0.02 250)"}
                    >
                      {card.number}
                    </text>
                  </g>
                );
              })}
          </svg>
        )}

        {gutterfold && (
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-md bg-primary px-3 py-1 text-xs font-semibold tracking-wide text-primary-foreground">
            GUTTERFOLD • DOBRA NO CENTRO • CORTE EXTERNO
          </div>
        )}

        {!gutterfold && side === "back" && registrationSide !== "back" && (
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-md bg-destructive px-3 py-1 text-xs font-semibold tracking-wide text-destructive-foreground">
            VERSO • NÃO CORTAR
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
