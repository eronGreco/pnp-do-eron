import { NumberStepper } from "@/components/panels/Field";
import { Label } from "@/components/ui/label";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

export function SlicerSliderField({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  onChange,
}: Props) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${disabled ? "opacity-45" : ""}`} aria-disabled={disabled || undefined}>
      <Label
        title={label}
        className="block truncate text-[11px] leading-4 text-muted-foreground"
      >
        {label}
      </Label>
      <NumberStepper
        value={value}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        ariaLabel={label}
        onChange={onChange}
      />
    </div>
  );
}
