import { useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function AdvancedSection({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border bg-secondary/15">
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="grid h-auto w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-3 py-3 text-left"
        >
          <SlidersHorizontal className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-foreground">{title}</span>
            <span className="block truncate text-[10px] font-normal text-muted-foreground">{summary}</span>
          </span>
          <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 border-t border-border p-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}