import type { Card, CutSettings, Sheet } from "@/cameo/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { presetById, type PresetId } from "@/storage/presets";
import { registrationPageIndex } from "@/cameo/registrationPage";

type Props = {
  open: boolean;
  sheet: Sheet;
  cards: Card[];
  settings: CutSettings;
  presetId: PresetId;
  totalSheets: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function CutConfirmDialog({
  open,
  sheet,
  cards,
  settings,
  presetId,
  totalSheets,
  onOpenChange,
  onConfirm,
}: Props) {
  const gutterfold = sheet.assemblyMode === "gutterfold";
  const registrationSide = sheet.registrationSide === "back" ? "verso" : "frente";
  const registrationPage = registrationPageIndex(sheet);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar corte</DialogTitle>
          <DialogDescription>
            {gutterfold
              ? "Confirme que a folha gutterfold está carregada na Cameo. A dobra central não será cortada."
              : `Confirme que o ${registrationSide} desta folha está carregado virado para cima na Cameo.`}
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-1 rounded-md border border-border bg-background/60 p-3 text-sm">
          <Row label="Folha" value={`${sheet.number} de ${totalSheets}`} />
          <Row
            label={gutterfold ? "Página" : `Página do ${registrationSide}`}
            value={registrationPage !== null ? `${registrationPage + 1}` : "não incluída neste PDF"}
          />
          <Row
            label={gutterfold ? "Peças" : "Cartas"}
            value={cards.map((card) => card.number).join(", ") || "nenhuma"}
          />
          <Row label="Material" value={presetById(presetId).name} />
          <Row
            label="Parâmetros"
            value={`profundidade ${settings.depth}, força ${settings.force}, velocidade ${settings.speed}, ${settings.passes} passada(s), raio ${settings.radiusMm} mm`}
          />
          <Row
            label="Sobrecorte de linha"
            value={settings.lineOvercut ? `ligado (${settings.lineOvercutMm} mm)` : "desligado"}
          />
        </dl>

        {registrationPage === null && (
          <p role="alert" className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
            Este PDF não contém a página com as marcas ({registrationSide}). Só corte se a folha
            carregada já foi impressa com as marcas em outra passada.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={cards.length === 0}>
            Cortar agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono text-xs">{value}</dd>
    </div>
  );
}
