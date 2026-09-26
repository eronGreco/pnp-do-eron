import { NumberStepper } from "@/components/panels/Field";
import { Label } from "@/components/ui/label";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
};

export function SlicerSliderField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: Props) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
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
        ariaLabel={label}
        onChange={onChange}
      />
    </div>
  );
}
