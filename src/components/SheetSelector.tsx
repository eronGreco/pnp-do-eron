import type { Sheet } from "@/cameo/types";
import { Button } from "@/components/ui/button";

type Props = {
  sheets: Sheet[];
  activeSheet: number;
  side: "front" | "back";
  onSheet: (number: number) => void;
  onSide: (side: "front" | "back") => void;
};

export function SheetSelector({ sheets, activeSheet, side, onSheet, onSide }: Props) {
  const sheet = sheets.find((item) => item.number === activeSheet) ?? sheets[0];
  const gutterfold = sheet?.assemblyMode === "gutterfold";
  const hasBack = sheet?.backPageIndex !== null;
  const displaySide = gutterfold ? "front" : side;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {sheets.map((sheet) => (
          <Button
            key={sheet.number}
            size="sm"
            variant={sheet.number === activeSheet ? "default" : "secondary"}
            onClick={() => onSheet(sheet.number)}
          >
            Folha {sheet.number}
          </Button>
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">
          {gutterfold ? "Prévia da peça" : "Lado da folha mostrado na prévia"}
        </p>
        {gutterfold ? (
          <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-[11px] leading-relaxed text-primary">
            Frente e verso estão na mesma página. A linha central é dobra, não corte.
          </div>
        ) : (
          <div className="flex gap-1">
            <Button
              size="sm"
              className="flex-1"
              variant={displaySide === "front" ? "default" : "secondary"}
              onClick={() => onSide("front")}
            >
              Frente
            </Button>
            <Button
              size="sm"
              className="flex-1"
              variant={displaySide === "back" ? "default" : "secondary"}
              onClick={() => onSide("back")}
              disabled={!hasBack}
            >
              Verso
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
