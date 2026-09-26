import { useState } from "react";
import { Check, Layers, ShieldCheck, Sparkles, StretchHorizontal, UnfoldHorizontal } from "lucide-react";
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
import { DisabledConfig } from "@/components/panels/DisabledConfig";
import { AdvancedSection } from "@/components/panels/AdvancedSection";
import { effectivePacking, packingPatch } from "@/composer/packingPolicy";
import type { PackingPolicy } from "@/composer/types";

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
  disabled = false,
}: {
  checked: boolean;
  label: string;
  description?: string;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 rounded-lg border border-border bg-background/50 p-3 ${disabled ? "opacity-45" : ""}`}>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={ariaLabel} disabled={disabled} />
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
  disabled = false,
}: {
  value: BleedConfig;
  onChange: (patch: Partial<BleedConfig>) => void;
  helpTopic?: HelpTopicId;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <Select disabled={disabled} value={value.method} onValueChange={(method) => onChange({ method: method as BleedMethod })}>
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
              disabled={disabled}
              onCheckedChange={(checked) => onChange({ useAverageColor: checked })}
            />
          </label>
          {!value.useAverageColor && (
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={value.color}
                disabled={disabled}
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
            disabled={disabled}
            ariaLabel="Desfoque"
            onChange={(blurStrength) => onChange({ blurStrength })}
          />
        </div>
      )}

      <ToggleRow
        checked={value.trimEnabled}
        disabled={disabled}
        onChange={(trimEnabled) => onChange({ trimEnabled })}
        ariaLabel="Aparar a borda da arte"
        label="Aparar a borda antes de criar"
        description="Use quando a arte tem uma sobra branca ou canto arredondado já impresso."
      />
      <HelpButton topic="aparar-borda" label="entenda o aparar a borda" />
      <DisabledConfig
        disabled={!value.trimEnabled || disabled}
        reason={disabled
          ? "Não é possível editar a faixa porque a criação de sangria está desligada."
          : "Não é possível editar a faixa porque “Aparar a borda antes de criar” está desligado."}
      >
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
            disabled={!value.trimEnabled || disabled}
            ariaLabel="Faixa aparada"
            onChange={(trimMm) => onChange({ trimMm })}
          />
        </div>
      </DisabledConfig>
    </div>
  );
}

export function BleedPanel({ composer }: { composer: Composer }) {
  const { config, cards, imageById } = composer;
  const gutterfold = config.assemblyMode === "gutterfold";
  const glued = effectivePacking(config).mode === "colada";
  const gluedSource = config.packingPolicy === "personalizado"
    ? "a organização personalizada está em Cartas coladas"
    : "“Cartas coladas” está ativa em Como organizar na folha";
  // No gutterfold com cartas coladas a margem da frente e a do verso viram 0 mm
  // no cálculo, então os campos ficam bloqueados com a explicação.
  const frontMarginLocked = glued && gutterfold;
  const backMarginLocked = glued && gutterfold;
  const [editing, setEditing] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);

  const editingCard = editing ? (cards.find((card) => card.id === editing) ?? null) : null;
  const active: BleedConfig = editingCard
    ? effectiveCardBleed(editingCard, config.bleed)
    : config.bleed;
  const exceptions = cards.filter((card) => cardHasOwnBleed(card)).length;
  const packingOptions: {
    value: Exclude<PackingPolicy, "personalizado">;
    label: string;
    description: string;
    icon: typeof ShieldCheck;
  }[] = [
    { value: "seguro", label: "Seguro", description: "Preserva toda a margem de cada carta.", icon: ShieldCheck },
    { value: "economico", label: "Econômico", description: "Compartilha a faixa segura para caber mais.", icon: StretchHorizontal },
    { value: "colado", label: "Cartas coladas", description: "Corta na divisa, sem margem entre vizinhas.", icon: UnfoldHorizontal },
  ];

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
        <SectionLabel help="modo-sangria">Como organizar na folha</SectionLabel>
        <div className="space-y-2">
          {packingOptions.map(({ value, label, description, icon: Icon }) => {
            const active = config.packingPolicy === value;
            return (
              <Button
                key={value}
                type="button"
                variant={active ? "default" : "outline"}
                className="grid h-auto w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-2 whitespace-normal px-3 py-2.5 text-left"
                aria-pressed={active}
                onClick={() => composer.setConfig({ ...config, ...packingPatch(value, config) })}
              >
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">{label}</span>
                  <span className="block text-[10px] font-normal leading-relaxed opacity-80">{description}</span>
                </span>
              </Button>
            );
          })}
        </div>
        {config.packingPolicy === "personalizado" && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-2.5">
            <p className="text-[11px] font-semibold text-foreground">Organização personalizada</p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              A distância e o compartilhamento foram definidos nos Ajustes avançados da folha.
            </p>
          </div>
        )}
      </PanelBlock>

      <PanelBlock>
        <SectionLabel help="sangria-mm">Frente</SectionLabel>
        <DisabledConfig
          disabled={frontMarginLocked}
          reason={`Não é possível editar a margem porque ${gluedSource}. Nesse modo o corte cai exatamente na divisa e nenhuma margem é impressa. Escolha Seguro ou Econômico para usar a margem.`}
        >
          <Field
            label="Margem para o corte (mm)"
            value={config.bleedMm}
            disabled={frontMarginLocked}
            onChange={(bleedMm) => composer.setConfig({ ...config, bleedMm })}
          />
        </DisabledConfig>
        {!frontMarginLocked && glued && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-2.5">
            <p className="text-[11px] font-semibold text-foreground">Com Cartas coladas, nada é impresso além do corte</p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Aqui a medida só diz quanto da borda da imagem é descartado na divisa. Ela não cria margem nem afasta as cartas. Para ter margem de verdade, escolha Seguro ou Econômico.
            </p>
          </div>
        )}
        {!glued && (
          <InfoLine>
            {gutterfold
              ? "A margem fica isolada na frente e nunca atravessa a dobra, o verso ou outra carta."
              : "Essa é a tinta extra ao redor da linha de corte. Pode ficar em 0 mm quando a arte já termina exatamente na linha."}
          </InfoLine>
        )}
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
        <AdvancedSection title="Ajustes avançados da frente" summary="Método, aparo, cor e desfoque">
          <DisabledConfig
            disabled={!active.enabled}
            reason="Não é possível editar o método porque “Criar sangria nas frentes” está desligado."
          >
            <MethodControls value={active} onChange={setFrontBleed} disabled={!active.enabled} />
          </DisabledConfig>
        </AdvancedSection>
      </PanelBlock>

      <PanelBlock>
        <SectionLabel help="sangria-fake-verso">Verso</SectionLabel>
        <DisabledConfig
          disabled={backMarginLocked}
          reason={`Não é possível editar a margem do verso porque ${gluedSource}. O verso também é cortado na divisa. Para prolongar a imagem do verso, use “Criar margem na imagem do verso”.`}
        >
          <Field
            label="Margem do verso (mm)"
            value={effectiveBackBleedMm(config)}
            min={0}
            max={20}
            disabled={backMarginLocked}
            onChange={(backBleedMm) => composer.setConfig({ ...config, backBleedMm })}
          />
          {config.backBleedMm == null ? (
            <InfoLine>A margem do verso acompanha a frente: {config.bleedMm} mm.</InfoLine>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-full text-xs"
              disabled={backMarginLocked}
              onClick={() => composer.setConfig({ ...config, backBleedMm: null })}
            >
              Fazer o verso acompanhar a frente
            </Button>
          )}
        </DisabledConfig>
        <ToggleRow
          checked={config.backBleed.enabled}
          onChange={(enabled) => composer.setConfig({ ...config, backBleed: { ...config.backBleed, enabled } })}
          ariaLabel="Criar sangria no verso"
          label="Criar margem na imagem do verso"
          description="Prolonga a imagem quando ela não tem tinta suficiente ao redor do corte."
        />
        <AdvancedSection title="Ajustes avançados do verso" summary="Prolongamento, redução, método, aparo e cor">
          <DisabledConfig
            disabled={!config.backBleed.enabled}
            reason="Não é possível editar o prolongamento porque “Criar margem na imagem do verso” está desligado."
          >
            <Field
              label="Prolongar além do corte (mm)"
              value={config.backExtraBleedMm}
              min={0}
              max={20}
              disabled={!config.backBleed.enabled}
              onChange={(backExtraBleedMm) => composer.setConfig({ ...config, backExtraBleedMm })}
            />
          </DisabledConfig>
          <Field
            label="Reduzir a arte do verso (mm)"
            value={config.backInsetMm}
            min={0}
            max={10}
            onChange={(backInsetMm) => composer.setConfig({ ...config, backInsetMm })}
          />
          <InfoLine>Reduzir a arte expõe mais da borda do verso sem mudar o corte ou a grade.</InfoLine>
          <DisabledConfig
            disabled={!config.backBleed.enabled}
            reason="Não é possível editar o método porque “Criar margem na imagem do verso” está desligado."
          >
            <MethodControls value={config.backBleed} onChange={setBackBleed} helpTopic="sangria-fake-verso" disabled={!config.backBleed.enabled} />
          </DisabledConfig>
        </AdvancedSection>
        <InfoLine>
          {gutterfold
            ? "No gutterfold essa margem vale só para o verso, que fica à direita. Ela não invade a frente, a canaleta nem outra peça, e não muda o contorno de corte."
            : "Ideal para verso com borda sólida: a borda vira uma margem extra nas laterais externas da folha e entre cartas quando há espaço."}
        </InfoLine>
      </PanelBlock>

      {cards.length > 0 && (
        <AdvancedSection title="Ajustes por carta" summary={`${exceptions} carta(s) com exceção própria`}>
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
        </AdvancedSection>
      )}

      <InfoLine>O resultado aparece na prévia principal das folhas, ao lado.</InfoLine>
    </div>
  );
}