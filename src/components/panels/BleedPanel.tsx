import { useState } from "react";
import { Check, Layers, Sparkles } from "lucide-react";
import type { Composer } from "@/composer/useComposer";
import {
  BLEED_METHOD_HELP,
  BLEED_METHOD_LABEL,
  type BleedConfig,
  type BleedMethod,
} from "@/bleed/types";
import { cardHasOwnBleed, effectiveCardBleed } from "@/bleed/cardBleed";
import { guessBleedFromAspect } from "@/bleed/detectBleed";
import { effectiveBackBleedMm } from "@/composer/layoutSheets";
import { Field, NumberStepper } from "@/components/panels/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { HelpButton } from "@/components/HelpButton";
import type { HelpTopicId } from "@/help/helpTopics";

const METHODS: BleedMethod[] = ["esticar", "espelhar", "cor", "esticar-desfoque"];

function SectionLabel({ children, help }: { children: React.ReactNode; help?: HelpTopicId }) {
  return (
    <div className="flex items-center gap-2">
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {children}
      </p>
      {help && <HelpButton topic={help} />}
    </div>
  );
}

function InfoLine({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-muted-foreground">{children}</p>;
}

function PanelBlock({ children }: { children: React.ReactNode }) {
  return <section className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">{children}</section>;
}

function ToggleRow({
  checked,
  label,
  description,
  ariaLabel,
  onChange,
}: {
  checked: boolean;
  label: string;
  description?: string;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border bg-background/50 p-3">
      <Switch checked={checked} onCheckedChange={onChange} aria-label={ariaLabel} />
      <span className="min-w-0 space-y-1">
        <span className="block text-xs font-semibold text-foreground">{label}</span>
        {description && <span className="block text-[11px] leading-relaxed text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}

function MethodControls({
  value,
  onChange,
  helpTopic = "metodos-sangria",
}: {
  value: BleedConfig;
  onChange: (patch: Partial<BleedConfig>) => void;
  helpTopic?: HelpTopicId;
}) {
  return (
    <div className="space-y-3">
      <Select value={value.method} onValueChange={(method) => onChange({ method: method as BleedMethod })}>
        <SelectTrigger className="h-10 gap-2 [&>span]:min-w-0 [&>span]:truncate">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {METHODS.map((method) => (
            <SelectItem key={method} value={method}>
              {BLEED_METHOD_LABEL[method]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <InfoLine>{BLEED_METHOD_HELP[value.method]}</InfoLine>
        <HelpButton topic={helpTopic} />
      </div>

      {value.method === "cor" && (
        <div className="space-y-3 rounded-lg border border-border bg-background/45 p-3">
          <label className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">
              Usar a cor média da borda da carta
            </span>
            <Switch
              checked={value.useAverageColor}
              onCheckedChange={(checked) => onChange({ useAverageColor: checked })}
            />
          </label>
          {!value.useAverageColor && (
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={value.color}
                onChange={(event) => onChange({ color: event.target.value })}
                className="h-9 w-16 p-1"
                aria-label="Cor da sangria"
              />
              <span className="text-[11px] text-muted-foreground">{value.color}</span>
            </div>
          )}
        </div>
      )}

      {value.method === "esticar-desfoque" && (
        <div className="space-y-2 rounded-lg border border-border bg-background/45 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Desfoque</span>
            <span className="text-[11px] font-medium text-foreground">{value.blurStrength}</span>
          </div>
          <NumberStepper
            min={1}
            max={10}
            step={1}
            value={value.blurStrength}
            ariaLabel="Desfoque"
            onChange={(blurStrength) => onChange({ blurStrength })}
          />
        </div>
      )}

      <ToggleRow
        checked={value.trimEnabled}
        onChange={(trimEnabled) => onChange({ trimEnabled })}
        ariaLabel="Aparar a borda da arte"
        label="Aparar a borda antes de criar"
        description="Use quando a arte tem uma sobra branca ou canto arredondado já impresso."
      />
      <HelpButton topic="aparar-borda" label="entenda o aparar a borda" />
      {value.trimEnabled && (
        <div className="space-y-2 rounded-lg border border-border bg-background/45 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Faixa aparada (mm)</span>
            <span className="text-[11px] font-medium text-foreground">{value.trimMm.toFixed(1)}</span>
          </div>
          <NumberStepper
            min={0}
            max={5}
            step={0.5}
            value={value.trimMm}
            ariaLabel="Faixa aparada"
            onChange={(trimMm) => onChange({ trimMm })}
          />
        </div>
      )}
    </div>
  );
}

export function BleedPanel({ composer }: { composer: Composer }) {
  const { config, cards, imageById } = composer;
  const gutterfold = config.assemblyMode === "gutterfold";
  const [editing, setEditing] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);

  const editingCard = editing ? (cards.find((card) => card.id === editing) ?? null) : null;
  const active: BleedConfig = editingCard
    ? effectiveCardBleed(editingCard, config.bleed)
    : config.bleed;
  const exceptions = cards.filter((card) => cardHasOwnBleed(card)).length;

  const setFrontBleed = (patch: Partial<BleedConfig>) => {
    if (editingCard) {
      composer.setCardBleed(editingCard.id, { ...active, ...patch });
      return;
    }
    composer.setConfig({ ...config, bleed: { ...config.bleed, ...patch } });
  };

  const setBackBleed = (patch: Partial<BleedConfig>) => {
    composer.setConfig({ ...config, backBleed: { ...config.backBleed, ...patch } });
  };

  const withoutSangria = cards.filter((card) => {
    const image = imageById.get(card.frontImageId);
    if (!image) return false;
    return (
      guessBleedFromAspect(
        image.widthPx,
        image.heightPx,
        config.cardWidthMm,
        config.cardHeightMm,
        config.bleedMm,
      ).guess === "sem-sangria"
    );
  }).length;

  return (
    <div className="space-y-5">
      <HelpButton topic="etapa-sangria" variant="etapa" />

      <PanelBlock>
        <SectionLabel help="sangria-mm">Sangria da frente e espaço na folha</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Sangria da frente (mm)"
            value={config.bleedMm}
            onChange={(bleedMm) => composer.setConfig({ ...config, bleedMm })}
          />
        </div>
        <Select
          value={config.bleedMode}
          onValueChange={(bleedMode) =>
            composer.setConfig({ ...config, bleedMode: bleedMode as typeof config.bleedMode })
          }
        >
          <SelectTrigger className="h-10 gap-2 [&>span]:min-w-0 [&>span]:truncate">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="completa">Sangria completa em cada carta</SelectItem>
            <SelectItem value="compartilhada">Sangria compartilhada, ocupa menos espaço</SelectItem>
            <SelectItem value="colada">Cartas coladas, sem sangria entre elas</SelectItem>
          </SelectContent>
        </Select>
        <HelpButton topic="modo-sangria" label="entenda os modos de sangria" />
        <InfoLine>
          {gutterfold
            ? "Esta parte define a margem da frente, que fica à esquerda da peça. Ela nunca atravessa a canaleta nem invade o verso."
            : "Esta parte define quanto a frente ocupa na folha. Pode ficar em 0 mm quando a frente já está pronta para cortar na linha."}
        </InfoLine>
      </PanelBlock>

      {cards.length > 0 && withoutSangria > 0 && (
        <div className="flex gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p className="text-xs leading-relaxed text-foreground/80">
            {withoutSangria} de {cards.length} carta(s) parecem estar cortadas na linha. Se a frente precisar de margem, ligue a criação de sangria da frente abaixo.
          </p>
        </div>
      )}

      <PanelBlock>
        <SectionLabel help="criar-sangria">
          {editingCard
            ? `Criar sangria na frente da carta ${cards.indexOf(editingCard) + 1}`
            : "Criar sangria nas frentes"}
        </SectionLabel>
        <ToggleRow
          checked={active.enabled}
          onChange={(enabled) => setFrontBleed({ enabled })}
          ariaLabel="Criar sangria nas frentes"
          label="Criar sangria nas frentes"
          description="Inventa uma faixa quando a imagem da frente veio cortada rente à carta."
        />
        {active.enabled && <MethodControls value={active} onChange={setFrontBleed} />}
      </PanelBlock>

      <PanelBlock>
        <SectionLabel help="sangria-fake-verso">Sangria só no verso</SectionLabel>
        <ToggleRow
          checked={config.backBleed.enabled}
          onChange={(enabled) => composer.setConfig({ ...config, backBleed: { ...config.backBleed, enabled } })}
          ariaLabel="Criar sangria no verso"
          label="Criar sangria no verso"
          description="Cria a mesma faixa da frente, mas só na imagem do verso, sem mexer na frente e sem mudar o corte."
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Faixa do verso (mm)"
            value={config.backExtraBleedMm}
            min={0}
            max={20}
            onChange={(backExtraBleedMm) => composer.setConfig({ ...config, backExtraBleedMm })}
          />
          <Field
            label="Enquadramento (mm)"
            value={effectiveBackBleedMm(config)}
            min={0}
            max={20}
            onChange={(backBleedMm) => composer.setConfig({ ...config, backBleedMm })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Reduzir a arte do verso (mm)"
            value={config.backInsetMm}
            min={0}
            max={10}
            onChange={(backInsetMm) => composer.setConfig({ ...config, backInsetMm })}
          />
        </div>
        <InfoLine>
          Reduzir a arte encolhe só a imagem do verso ao redor do centro, então a borda sólida dela
          sobra mais para dentro da carta. O corte, a frente e a grade continuam iguais. Se a
          redução passar da faixa do verso, começa a aparecer folha branca junto da linha de corte.
        </InfoLine>
        {config.backBleedMm != null && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-full text-xs"
            onClick={() => composer.setConfig({ ...config, backBleedMm: null })}
          >
            Enquadramento acompanha a frente ({config.bleedMm} mm)
          </Button>
        )}
        {config.backBleed.enabled && (
          <MethodControls value={config.backBleed} onChange={setBackBleed} helpTopic="sangria-fake-verso" />
        )}
        <InfoLine>
          {gutterfold
            ? "No gutterfold essa margem vale só para o verso, que fica à direita. Ela não invade a frente, a canaleta nem outra peça, e não muda o contorno de corte."
            : "Ideal para verso com borda sólida: a borda vira uma margem extra nas laterais externas da folha e entre cartas quando há espaço."}
        </InfoLine>
      </PanelBlock>

      {cards.length > 0 && (
        <PanelBlock>
          <SectionLabel help="excecoes-carta">Ajustes por carta na frente</SectionLabel>
          <InfoLine>Toque em uma carta para mudar só a sangria criada na frente dela.</InfoLine>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={editing === null}
              onClick={() => {
                setEditing(null);
                setCopyOpen(false);
              }}
              className={`rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${
                editing === null
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary/40"
              }`}
            >
              Todas (padrão)
            </button>
            {cards.map((card, index) => {
              const image = imageById.get(card.frontImageId);
              const own = cardHasOwnBleed(card);
              const selected = editing === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setEditing(selected ? null : card.id);
                    setCopyOpen(false);
                  }}
                  title={`Carta ${index + 1}`}
                  className={`relative overflow-hidden rounded-md border transition-colors ${
                    selected ? "border-primary ring-1 ring-primary" : "border-border hover:border-muted-foreground"
                  }`}
                >
                  {image ? (
                    <img
                      src={image.previewUrl}
                      alt={`Carta ${index + 1}`}
                      className="h-12 w-9 object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-9 items-center justify-center text-[11px] text-muted-foreground">
                      {index + 1}
                    </span>
                  )}
                  <span className="absolute bottom-0 left-0 bg-background/80 px-1 text-[9px] tabular-nums text-foreground">
                    {index + 1}
                  </span>
                  {own && (
                    <span
                      className="absolute right-0.5 top-0.5 rounded-full bg-primary p-0.5 text-primary-foreground"
                      aria-label="Ajuste próprio"
                    >
                      <Check className="size-2.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {editingCard && (
            <div className="space-y-2 rounded-lg border border-border bg-background/45 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Layers className="size-3.5 text-primary" aria-hidden />
                Carta {cards.indexOf(editingCard) + 1} com ajuste próprio
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 px-2 text-[11px]"
                  onClick={() => {
                    setCopyOpen((open) => !open);
                    setCopyTargets([]);
                  }}
                >
                  Copiar este ajuste
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-[11px]"
                  onClick={() => {
                    composer.setCardBleed(editingCard.id, null);
                    setEditing(null);
                  }}
                >
                  Voltar ao padrão
                </Button>
              </div>

              {copyOpen && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <InfoLine>Escolha para quais cartas copiar este mesmo ajuste.</InfoLine>
                  <div className="flex flex-wrap gap-1.5">
                    {cards.map((card, index) => {
                      if (card.id === editingCard.id) return null;
                      const picked = copyTargets.includes(card.id);
                      return (
                        <button
                          key={card.id}
                          type="button"
                          aria-pressed={picked}
                          onClick={() =>
                            setCopyTargets((current) =>
                              current.includes(card.id)
                                ? current.filter((id) => id !== card.id)
                                : [...current, card.id],
                            )
                          }
                          className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                            picked
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:bg-secondary/40"
                          }`}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      className="h-8 px-2 text-[11px]"
                      disabled={copyTargets.length === 0}
                      onClick={() => {
                        composer.copyCardBleed(editingCard.id, copyTargets);
                        setCopyOpen(false);
                        setCopyTargets([]);
                      }}
                    >
                      Copiar para {copyTargets.length} carta(s)
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 px-2 text-[11px]"
                      onClick={() => {
                        composer.copyCardBleed(
                          editingCard.id,
                          cards.map((card) => card.id),
                        );
                        setCopyOpen(false);
                        setCopyTargets([]);
                      }}
                    >
                      Copiar para todas
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {exceptions > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-full text-xs"
              onClick={() => {
                composer.clearCardBleedOverrides();
                setEditing(null);
              }}
            >
              Todas voltam ao padrão ({exceptions} com ajuste próprio)
            </Button>
          )}
        </PanelBlock>
      )}

      <InfoLine>O resultado aparece na prévia principal das folhas, ao lado.</InfoLine>
    </div>
  );
}