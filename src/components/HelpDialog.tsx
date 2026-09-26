import { AlertTriangle, CheckCircle2, CircleSlash, Lightbulb, ListOrdered } from "lucide-react";

import { helpTopic, type HelpTopicId } from "@/help/helpTopics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Modal de explicacao de um assunto do catalogo de ajuda. */
export function HelpDialog({
  topic,
  open,
  onOpenChange,
}: {
  topic: HelpTopicId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const help = helpTopic(topic);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-border bg-panel">
        <DialogHeader>
          <DialogTitle className="font-display text-base text-foreground">{help.title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-foreground/85">
            {help.lead}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
          {help.howTo && help.howTo.length > 0 && (
            <section className="space-y-2">
              <Heading icon={<ListOrdered className="size-3.5" />}>Como usar</Heading>
              <ol className="space-y-1.5">
                {help.howTo.map((step, index) => (
                  <li key={step} className="flex gap-2">
                    <span className="mt-px inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                      {index + 1}
                    </span>
                    <span className="text-foreground/80">{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {help.when && (
            <Block icon={<CheckCircle2 className="size-3.5 text-success" />} title="Quando mexer">
              {help.when}
            </Block>
          )}

          {help.avoid && (
            <Block
              icon={<CircleSlash className="size-3.5 text-muted-foreground" />}
              title="Quando não mexer"
            >
              {help.avoid}
            </Block>
          )}

          {help.example && (
            <Block icon={<Lightbulb className="size-3.5 text-primary" />} title="Exemplo prático">
              {help.example}
            </Block>
          )}

          {help.warning && (
            <div className="flex gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <p className="text-xs leading-relaxed text-foreground/85">{help.warning}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Heading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 font-display text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
      <span className="text-primary">{icon}</span>
      {children}
    </p>
  );
}

function Block({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5 rounded-lg border border-border bg-secondary/25 p-3">
      <Heading icon={icon}>{title}</Heading>
      <p className="text-xs leading-relaxed text-foreground/80">{children}</p>
    </section>
  );
}
