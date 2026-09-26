import { useRef } from "react";
import { Copy, ImagePlus, Images } from "lucide-react";
import type { Composer } from "@/composer/useComposer";
import { Button } from "@/components/ui/button";
import { HelpButton } from "@/components/HelpButton";

export function BackPanel({ composer }: { composer: Composer }) {
  const sharedBackRef = useRef<HTMLInputElement>(null);
  const { cards, config, imageById } = composer;
  const sharedBack = config.sharedBackImageId
    ? imageById.get(config.sharedBackImageId)
    : undefined;
  const cardsUsingSharedBack = cards.filter((card) => card.backImageId === null).length;
  const sharedMode = composer.importMode === "individual";

  return (
    <div className="space-y-2.5">
      <input
        ref={sharedBackRef}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void composer.setSharedBackFromFile(file);
        }}
      />

      <div className="rounded-md border border-border bg-secondary/30 p-3">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-sm font-bold text-foreground">Como serão os versos?</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Escolha isso antes de adicionar as imagens. Dá para trocar depois se precisar.
            </p>
          </div>
          <HelpButton topic="modo-importacao" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={sharedMode ? "default" : "outline"}
            className="h-auto min-h-[92px] flex-col items-start justify-start whitespace-normal p-3 text-left"
            aria-pressed={sharedMode}
            onClick={() => composer.setImportMode("individual")}
          >
            <span className="flex items-center gap-2 font-semibold">
              <Copy className="size-4" aria-hidden />
              Mesmo verso
            </span>
            <span className="text-[11px] font-normal leading-relaxed opacity-80">
              Uma imagem de verso vale para o baralho inteiro.
            </span>
          </Button>
          <Button
            type="button"
            variant={!sharedMode ? "default" : "outline"}
            className="h-auto min-h-[92px] flex-col items-start justify-start whitespace-normal p-3 text-left"
            aria-pressed={!sharedMode}
            onClick={() => composer.setImportMode("pares")}
          >
            <span className="flex items-center gap-2 font-semibold">
              <Images className="size-4" aria-hidden />
              Versos diferentes
            </span>
            <span className="text-[11px] font-normal leading-relaxed opacity-80">
              Envie frente e verso em sequência para cada carta.
            </span>
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-primary/45 bg-primary/10 p-3 shadow-[0_0_0_1px_var(--color-primary)/0.08]">
        <div className="mb-3 flex items-start gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ImagePlus className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold text-foreground">
              {sharedMode ? "Verso comum do baralho" : "Verso comum de reserva"}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {cards.length === 0
                ? sharedMode
                  ? "Suba aqui o verso padrão. Depois, adicione só as frentes das cartas."
                  : "Opcional: use quando alguma carta ficar sem verso próprio."
                : cardsUsingSharedBack > 0
                  ? `${cardsUsingSharedBack} carta(s) vão usar este verso.`
                  : "Todas as cartas atuais já têm verso próprio."}
            </p>
          </div>
          <HelpButton topic="verso-comum" />
        </div>

        <div className="flex items-center gap-3">
        {sharedBack ? (
          <img
            src={sharedBack.previewUrl}
            alt={sharedBack.name}
            className="h-16 w-16 shrink-0 rounded border border-border object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-dashed border-border text-[10px] text-muted-foreground">
            sem verso
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-[11px] text-muted-foreground">
            {sharedBack ? sharedBack.name : "Nenhuma imagem de verso comum definida."}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => sharedBackRef.current?.click()}
            >
              {sharedBack ? "Trocar verso comum" : "Definir verso comum"}
            </Button>
            {sharedBack && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={composer.clearSharedBack}
              >
                Remover
              </Button>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
