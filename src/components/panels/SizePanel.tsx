import {
  CARD_SIZE_PRESETS,
  CUSTOM_SIZE_ID,
  matchCardSize,
  sizeLabel,
} from "@/composer/cardSizePresets";
import type { Composer } from "@/composer/useComposer";
import type { Workspace } from "@/state/useWorkspace";
import { Field } from "@/components/panels/Field";
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

/** Tamanho final da carta e o arredondamento dos cantos. */
export function SizePanel({ composer, workspace }: { composer: Composer; workspace?: Workspace }) {
  const { config } = composer;
  const sizeId = matchCardSize(config.cardWidthMm, config.cardHeightMm);
  const manual = config.finishMode === "manual";

  return (
    <div className="space-y-6">
      <HelpButton topic="etapa-tamanho" variant="etapa" />

      <section className="space-y-2">
        <SectionLabel help="padrao-carta">Padrão de carta</SectionLabel>
        <Select
          value={sizeId}
          onValueChange={(value) => {
            const preset = CARD_SIZE_PRESETS.find((item) => item.id === value);
            if (!preset) return;
            composer.setConfig({
              ...config,
              cardWidthMm: preset.widthMm,
              cardHeightMm: preset.heightMm,
            });
          }}
        >
          <SelectTrigger className="h-10 gap-2 [&>span]:min-w-0 [&>span]:truncate">
            <SelectValue placeholder="Escolha um tamanho" />
          </SelectTrigger>
          <SelectContent>
            {sizeId === CUSTOM_SIZE_ID && (
              <SelectItem value={CUSTOM_SIZE_ID}>Personalizado</SelectItem>
            )}
            {CARD_SIZE_PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {sizeLabel(preset)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="space-y-2 border-t border-border pt-5">
        <SectionLabel help="medidas-carta">Medidas da carta</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Largura (mm)"
            value={config.cardWidthMm}
            onChange={(value) => composer.setConfig({ ...config, cardWidthMm: value })}
          />
          <Field
            label="Altura (mm)"
            value={config.cardHeightMm}
            onChange={(value) => composer.setConfig({ ...config, cardHeightMm: value })}
          />
        </div>
      </section>

      {workspace && (
        <section className="space-y-2 border-t border-border pt-5">
          <SectionLabel help="raio-cantos">Cantos arredondados</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Raio dos cantos (mm)"
              value={workspace.settings.radiusMm}
              min={0}
              onChange={(value) =>
                workspace.applySettings({ ...workspace.settings, radiusMm: value })
              }
            />
          </div>

          {manual && (
            <div className="space-y-1.5">
              <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                <Switch
                  checked={config.manualMarks.printRoundedOutline}
                  onCheckedChange={(checked) =>
                    composer.setConfig({
                      ...config,
                      manualMarks: { ...config.manualMarks, printRoundedOutline: checked },
                    })
                  }
                  aria-label="Imprimir o contorno arredondado"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-foreground">
                    Imprimir o contorno arredondado
                  </span>
                </span>
              </label>
              <HelpButton topic="contorno-impresso" label="entenda o contorno impresso" />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
