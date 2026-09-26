import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StepperProps = {
  value: number;
  step?: number;
  min?: number;
  max?: number | undefined;
  disabled?: boolean;
  ariaLabel?: string;
  onChange: (value: number) => void;
};

function decimalsOf(step: number): number {
  const text = String(step);
  const index = text.indexOf(".");
  return index === -1 ? 0 : text.length - index - 1;
}

export function NumberStepper({
  value,
  step = 0.5,
  min = 0,
  max,
  disabled,
  ariaLabel,
  onChange,
}: StepperProps) {
  const decimals = decimalsOf(step);
  const clamp = (next: number) => {
    let result = Number(next.toFixed(decimals));
    if (result < min) result = min;
    if (typeof max === "number" && result > max) result = max;
    return result;
  };
  const atMin = value <= min;
  const atMax = typeof max === "number" && value >= max;

  return (
    <div className="flex items-stretch gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        disabled={disabled || atMin}
        aria-label={ariaLabel ? `Diminuir ${ariaLabel}` : "Diminuir"}
        onClick={() => onChange(clamp(value - step))}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        className="h-9 min-w-0 flex-1 px-2 text-center tabular-nums"
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next)) return;
          if (next < min) return;
          if (typeof max === "number" && next > max) return;
          onChange(next);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        disabled={disabled || atMax}
        aria-label={ariaLabel ? `Aumentar ${ariaLabel}` : "Aumentar"}
        onClick={() => onChange(clamp(value + step))}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function Field({
  label,
  value,
  step = 0.5,
  min = 0,
  max,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
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
