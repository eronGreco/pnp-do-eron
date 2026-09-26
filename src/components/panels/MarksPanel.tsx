import type { Composer } from "@/composer/useComposer";
import type { CameoRegistrationSide } from "@/composer/types";
import { clampRegArmMm } from "@/cut/geometry";
import {
  MANUAL_MARK_HINTS,
  MANUAL_MARK_LABELS,
  type ManualMarkColor,
  type ManualMarkSides,
  type ManualMarkType,
} from "@/cut/manualMarks";
import { Field } from "@/components/panels/Field";
import { HelpButton } from "@/components/HelpButton";
import { DisabledConfig } from "@/components/panels/DisabledConfig";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPES: ManualMarkType[] = ["cantos", "cruzes", "guias", "bordas", "contorno"];

const COLORS: { id: ManualMarkColor; label: string }[] = [
  { id: "preto", label: "Preto" },
  { id: "cinza", label: "Cinza" },
  { id: "ciano", label: "Ciano" },
];

const SIDES: { id: ManualMarkSides; label: string }[] = [
  { id: "frente", label: "Só na frente" },
  { id: "verso", label: "Só no verso" },
  { id: "ambos", label: "Frente e verso" },
];

// Duas paginas lado a lado: a marcada recebe os traços das marcas.
function SidesGlyph({ sides, active }: { sides: ManualMarkSides; active: boolean }) {
  const mark = active ? "stroke-primary" : "stroke-muted-foreground";
  const on = (page: "frente" | "verso") =>
    sides === "ambos" || sides === page;

  const sheet = (x: number, page: "frente" | "verso", key: string) => (
    <g key={key}>
      <rect
        x={x}
        y={3}
        width={16}
        height={22}
        rx={1.5}
        fill="none"
        className={on(page) ? mark : "stroke-border"}
        strokeWidth={1.2}
      />
      {on(page) && (
        <g className={mark} strokeWidth={1.3} strokeLinecap="round">
          <line x1={x + 4} y1={8} x2={x + 8} y2={8} />
          <line x1={x + 4} y1={8} x2={x + 4} y2={12} />
          <line x1={x + 12} y1={20} x2={x + 8} y2={20} />
          <line x1={x + 12} y1={20} x2={x + 12} y2={16} />
        </g>
      )}
    </g>
  );

  return (
    <svg viewBox="0 0 40 28" className="h-8 w-11 shrink-0" aria-hidden>
      {sheet(2, "frente", "f")}
      {sheet(22, "verso", "v")}
    </svg>
  );
}

export function MarksPanel({ composer }: { composer: Composer }) {
  const { config } = composer;
  const manual = config.manualMarks;
  const isManual = config.finishMode === "manual";
  const isCameo = config.finishMode === "cameo";
  const gutterfold = config.assemblyMode === "gutterfold";

  const setManual = (patch: Partial<typeof manual>) =>
    composer.setConfig({ ...config, manualMarks: { ...manual, ...patch } });

  const toggleType = (type: ManualMarkType) => {
    const next = manual.types.includes(type)
      ? manual.types.filter((item) => item !== type)
      : [...manual.types, type];
    setManual({ types: next });
  };

  return (
    <div className="space-y-4">
      {isManual ? (
        <>
          <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-bold text-foreground">
                {gutterfold ? "Marcas na peça gutterfold" : "Em quais páginas imprimir as marcas"}
              </Label>
              <HelpButton topic="marcas-onde" />
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {gutterfold
                ? "Frente e verso ficam na mesma página, então as marcas manuais saem nessa página única."
                : "As páginas ímpares são a frente das cartas e as pares são o verso."}
            </p>
            <DisabledConfig
              disabled={gutterfold}
              reason="Não é possível escolher páginas porque, no gutterfold, frente e verso ficam na mesma página."
            >
              <div className="grid grid-cols-3 gap-2">
                {SIDES.map((side) => {
                  const active = manual.sides === side.id;
                  return (
                    <button
                      key={side.id}
                      type="button"
                      disabled={gutterfold}
                      onClick={() => setManual({ sides: side.id })}
                      aria-pressed={active}
                      className={`flex flex-col items-center gap-1.5 rounded-md border p-2 transition-colors ${
                        active
                          ? "border-primary bg-primary/15"
                          : "border-border bg-background hover:bg-secondary/40"
                      }`}
                    >
                      <SidesGlyph sides={side.id} active={active} />
                      <span className="text-[11px] font-medium leading-tight">{side.label}</span>
                    </button>
                  );
                })}
              </div>
            </DisabledConfig>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground">Marcas impressas</Label>
              <HelpButton topic="marcas-tipos" />
            </div>
            <div className="space-y-1.5">
              {TYPES.map((type) => {
                const active = manual.types.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    aria-pressed={active}
                    className={`flex w-full items-start gap-2 rounded-md border p-2 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-secondary/40"
                    }`}
                  >
                    <MarkGlyph type={type} active={active} />

                    <span>
                      <span className="block text-xs font-medium">{MANUAL_MARK_LABELS[type]}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {MANUAL_MARK_HINTS[type]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <DisabledConfig
            disabled={!manual.types.includes("cruzes")}
            reason="Não é possível editar esta opção porque a marca Cruzes está desligada."
          >
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <Label className="text-xs">Cruzes até as bordas</Label>
                <p className="text-[11px] text-muted-foreground">
                  Acrescenta traços nas margens da folha.
                </p>
              </div>
              <Switch
                checked={manual.crossToEdges}
                disabled={!manual.types.includes("cruzes")}
                onCheckedChange={(checked) => setManual({ crossToEdges: checked })}
              />
            </div>
          </DisabledConfig>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div className="min-w-0">
              <Label className="text-xs">Imprimir o contorno arredondado</Label>
              <HelpButton topic="contorno-impresso" label="entenda o contorno impresso" />
            </div>
            <Switch
              checked={manual.printRoundedOutline}
              onCheckedChange={(checked) => setManual({ printRoundedOutline: checked })}
              aria-label="Imprimir o contorno arredondado"
            />
          </div>

          <HelpButton topic="marcas-medidas" label="entenda espessura, comprimento e distância" />

          <DisabledConfig
            disabled={manual.types.length === 0}
            reason="Não é possível editar as medidas porque nenhuma marca impressa está selecionada."
          >
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Espessura (mm)"
              step={0.05}
              value={manual.thicknessMm}
              disabled={manual.types.length === 0}
              onChange={(value) => setManual({ thicknessMm: value })}
            />
            <Field
              label="Comprimento (mm)"
              value={manual.lengthMm}
              disabled={manual.types.length === 0}
              onChange={(value) => setManual({ lengthMm: value })}
            />
            <Field
              label="Distância da carta (mm)"
              value={manual.offsetMm}
              disabled={manual.types.length === 0}
              onChange={(value) => setManual({ offsetMm: value })}
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground">Cor</Label>
                <HelpButton topic="marcas-cor" />
              </div>
              <Select
                disabled={manual.types.length === 0}
                value={manual.color}
                onValueChange={(value) => setManual({ color: value as ManualMarkColor })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((color) => (
                    <SelectItem key={color.id} value={color.id}>
                      {color.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          </DisabledConfig>

        </>
      ) : (
        <>
          {isCameo && !gutterfold && (
            <DisabledConfig
              disabled={gutterfold}
              reason="Não é possível escolher o lado porque, no gutterfold, as marcas ficam na página única."
            >
            <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-bold text-foreground">
                  Em qual lado imprimir as marcas
                </Label>
                <HelpButton topic="marcas-silhouette-onde" />
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Este será o lado virado para cima quando a folha for carregada na Silhouette.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["front", "back"] as CameoRegistrationSide[]).map((side) => {
                  const active = config.cameoRegistrationSide === side;
                  const manualSide: ManualMarkSides = side === "front" ? "frente" : "verso";
                  return (
                    <button
                      key={side}
                      type="button"
                      disabled={gutterfold}
                      onClick={() => composer.setConfig({ ...config, cameoRegistrationSide: side })}
                      aria-pressed={active}
                      className={`flex flex-col items-center gap-1.5 rounded-md border p-2 transition-colors ${
                        active
                          ? "border-primary bg-primary/15"
                          : "border-border bg-background hover:bg-secondary/40"
                      }`}
                    >
                      <SidesGlyph sides={manualSide} active={active} />
                      <span className="text-[11px] font-medium leading-tight">
                        {side === "front" ? "Na frente" : "No verso"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            </DisabledConfig>
          )}
          <div id="campo-borda-branca" className="scroll-mt-4 rounded-md transition-shadow">
            <Field
              label="Borda branca das marcas (mm)"
              max={10}
              value={config.registrationWhiteBorderMm}
              onChange={(value) =>
                composer.setConfig({ ...config, registrationWhiteBorderMm: value })
              }
            />
          </div>
          <HelpButton topic="borda-branca-marcas" label="entenda a borda branca" />
          <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="cameo-arm-custom" className="text-xs font-medium">
                Mudar o tamanho do L das marcas
              </Label>
              <Switch
                id="cameo-arm-custom"
                checked={config.cameoMarkArmCustom}
                onCheckedChange={(checked) =>
                  // Ao ligar, o campo ja abre com um valor valido escrito:
                  // 10 mm quando nenhum tamanho foi escolhido antes.
                  composer.setConfig({
                    ...config,
                    cameoMarkArmCustom: checked,
                    cameoMarkArmMm: clampRegArmMm(config.cameoMarkArmMm),
                  })
                }
              />
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Padrão testado na Cameo 4: braço de 10 mm. O quadrado, a espessura e a distância da borda não mudam.
            </p>
            <DisabledConfig
              disabled={!config.cameoMarkArmCustom}
              reason="Não é possível editar porque o tamanho testado de 10 mm está em uso. Ligue a opção acima para mudar."
            >
              <Field
                label="Comprimento do braço do L (mm)"
                min={10}
                max={20}
                step={0.5}
                value={config.cameoMarkArmMm}
                disabled={!config.cameoMarkArmCustom}
                onChange={(value) => composer.setConfig({ ...config, cameoMarkArmMm: value })}
              />
            </DisabledConfig>
            {config.cameoMarkArmCustom && (
              <p className="rounded-md border border-warning/50 bg-warning/10 p-2 text-[11px] leading-snug text-warning">
                Experimental: só o braço de 10 mm foi testado numa Cameo 4. Com outro tamanho, a Cameo também recebe a
                nova medida na leitura das marcas. Faça um teste em papel comum antes de cortar o material bom, e
                imprima de novo as folhas se mudar este valor.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Miniatura em SVG mostrando como cada tipo de marca sai na folha.
// Fundo = folha, retângulos claros = cartas, traços = marcas impressas.
function MarkGlyph({ type, active }: { type: ManualMarkType; active: boolean }) {
  const W = 44;
  const H = 34;
  const cw = 15;
  const ch = 11;
  const gx = 4;
  const gy = 4;
  const cards = [
    { x: gx, y: gy },
    { x: gx + cw + gx, y: gy },
    { x: gx, y: gy + ch + gy },
    { x: gx + cw + gx, y: gy + ch + gy },
  ];
  const mark = active ? "stroke-primary" : "stroke-muted-foreground";
  const sw = 1.4;

  const cropMark = (x: number, y: number, sx: 1 | -1, sy: 1 | -1, key: string) => (
    <g key={key} className={mark} strokeWidth={sw} strokeLinecap="round">
      <line x1={x + sx * 2.5} y1={y} x2={x + sx * 6.5} y2={y} />
      <line x1={x} y1={y + sy * 2.5} x2={x} y2={y + sy * 6.5} />
    </g>
  );
  const cross = (x: number, y: number, key: string) => (
    <g key={key} className={mark} strokeWidth={sw} strokeLinecap="round">
      <line x1={x - 3} y1={y} x2={x + 3} y2={y} />
      <line x1={x} y1={y - 3} x2={x} y2={y + 3} />
    </g>
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-0.5 h-9 w-12 shrink-0 rounded-sm border border-border bg-background"
      aria-hidden
    >
      {cards.map((c, i) => (
          <rect
            key={i}
            x={c.x}
            y={c.y}
            width={cw}
            height={ch}
            fill="none"
            className={type === "contorno" ? mark : "stroke-border"}
            strokeWidth={type === "contorno" ? sw : 1}
          />
        ))}
      {type === "guias" && (
        <g className={mark} strokeWidth={sw}>
          <line x1={0} y1={gy + ch + gy / 2} x2={W} y2={gy + ch + gy / 2} />
          <line x1={gx + cw + gx / 2} y1={0} x2={gx + cw + gx / 2} y2={H} />
        </g>
      )}
      {type === "cantos" &&
        cards.flatMap((c, i) => [
          cropMark(c.x, c.y, -1, -1, `tl${i}`),
          cropMark(c.x + cw, c.y, 1, -1, `tr${i}`),
          cropMark(c.x, c.y + ch, -1, 1, `bl${i}`),
          cropMark(c.x + cw, c.y + ch, 1, 1, `br${i}`),
        ])}
      {type === "cruzes" && [
        cross(gx + cw + gx / 2, gy + ch + gy / 2, "c"),
        cross(gx + cw + gx / 2, gy, "t"),
        cross(gx + cw + gx / 2, gy + 2 * ch + gy, "b"),
        cross(gx, gy + ch + gy / 2, "l"),
        cross(gx + 2 * cw + gx, gy + ch + gy / 2, "r"),
      ]}
      {type === "bordas" && (
        <g className={mark} strokeWidth={sw} strokeLinecap="round">
          <line x1={gx + cw + gx / 2} y1={0} x2={gx + cw + gx / 2} y2={4} />
          <line x1={gx + cw + gx / 2} y1={H} x2={gx + cw + gx / 2} y2={H - 4} />
          <line x1={0} y1={gy + ch + gy / 2} x2={4} y2={gy + ch + gy / 2} />
          <line x1={W} y1={gy + ch + gy / 2} x2={W - 4} y2={gy + ch + gy / 2} />
        </g>
      )}
    </svg>
  );
}
