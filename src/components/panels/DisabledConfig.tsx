import { LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

export function DisabledConfig({
  disabled,
  reason,
  children,
  className,
}: {
  disabled: boolean;
  reason: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn(disabled && "opacity-45")} aria-disabled={disabled || undefined}>
        {children}
      </div>
      {disabled && (
        <p className="flex items-start gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground" role="note">
          <LockKeyhole className="mt-0.5 size-3 shrink-0" aria-hidden />
          {reason}
        </p>
      )}
    </div>
  );
}