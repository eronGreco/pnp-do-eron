import { useState } from "react";
import { BookOpen, ChevronRight, HelpCircle } from "lucide-react";

import { HelpDialog } from "@/components/HelpDialog";
import { helpTopic, type HelpTopicId } from "@/help/helpTopics";

/**
 * Botao visivel de ajuda. Abre o modal com a explicacao completa do assunto.
 *
 * "etapa" e a faixa larga do cabecalho de cada etapa.
 * "campo" e o botao redondo ao lado do nome de uma opcao.
 */
export function HelpButton({
  topic,
  variant = "campo",
  label,
  className = "",
}: {
  topic: HelpTopicId;
  variant?: "etapa" | "campo";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const help = helpTopic(topic);
  const aria = `Ajuda: ${help.title}`;

  return (
    <>
      {variant === "etapa" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={aria}
          className={`group flex w-full items-center gap-2.5 rounded-lg bg-primary px-3 py-2.5 text-left font-display text-[13px] font-bold text-primary-foreground shadow-[0_2px_10px_-2px_var(--color-primary)] transition-transform hover:brightness-110 active:scale-[0.99] ${className}`}
        >
          <BookOpen className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">{label ?? "Guia desta etapa"}</span>
          <ChevronRight
            className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </button>

      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={aria}
          title={aria}
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/45 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary transition-colors hover:bg-primary/25 ${className}`}
        >
          <HelpCircle className="size-3" aria-hidden />
          <span>{label ?? "ajuda"}</span>
        </button>
      )}

      <HelpDialog topic={topic} open={open} onOpenChange={setOpen} />
    </>
  );
}
