import type { CutSettings } from "@/cameo/types";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NumberStepper } from "@/components/panels/Field";
import { Switch } from "@/components/ui/switch";
import { LINE_OVERCUT_MM } from "@/cut/overcut";
import { PRESETS, SETTINGS_RANGES, type PresetId } from "@/storage/presets";

type Props = {
  settings: CutSettings;
  presetId: PresetId;
  disabled: boolean;
  onPreset: (id: PresetId) => void;
  onChange: (settings: CutSettings) => void;
};

const FIELDS: {
  key: "depth" | "force" | "speed" | "passes" | "radiusMm";
  label: string;
  suffix?: string;
}[] = [
  { key: "depth", label: "Profundidade" },
  { key: "force", label: "Força" },
  { key: "speed", label: "Velocidade" },
  { key: "passes", label: "Passadas" },
  { key: "radiusMm", label: "Raio dos cantos", suffix: " mm" },
];

export function MaterialSettings({ settings, presetId, disabled, onPreset, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Material</Label>
        <Select
          value={presetId}
          disabled={disabled}
          onValueChange={(value) => onPreset(value as PresetId)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {FIELDS.map((field) => {
        const range = SETTINGS_RANGES[field.key];
        return (
          <div key={field.key} className="space-y-1">
            <Label className="block truncate text-[11px] leading-4 text-muted-foreground">
              {field.label}
              {field.suffix ? ` (${field.suffix.trim()})` : ""}
            </Label>
            <NumberStepper
              value={settings[field.key]}
              min={range.min}
              max={range.max}
              step={range.step}
              disabled={disabled}
              ariaLabel={field.label}
              onChange={(value) => onChange({ ...settings, [field.key]: value })}
            />
          </div>
        );
      })}

      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
        <div>
          <Label className="text-sm">Sobrecorte de linha</Label>
          <p className="text-xs text-muted-foreground">
            Quando ligado, cada linha avança {LINE_OVERCUT_MM.toString().replace(".", ",")} mm.
          </p>
        </div>
        <Switch
          checked={settings.lineOvercut}
          disabled={disabled}
          onCheckedChange={(checked) =>
            onChange({ ...settings, lineOvercut: checked, lineOvercutMm: LINE_OVERCUT_MM })
          }
        />
      </div>
    </div>
  );
}
