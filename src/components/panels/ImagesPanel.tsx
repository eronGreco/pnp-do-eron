import { useRef, useState } from "react";
import { GripVertical, ImagePlus, Trash2 } from "lucide-react";
import type { Composer } from "@/composer/useComposer";
import { backImageFor } from "@/composer/pairFrontBack";
import { Button } from "@/components/ui/button";
import { HelpButton } from "@/components/HelpButton";

export function ImagesPanel({ composer }: { composer: Composer }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cardBackRef = useRef<HTMLInputElement>(null);
  const targetCardRef = useRef<string | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dropSlot, setDropSlot] = useState<{ id: string; after: boolean } | null>(null);

  const { config, cards, imageById, importMode } = composer;

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) void composer.addFiles(files);
        }}
      />
      <input
        ref={cardBackRef}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          const cardId = targetCardRef.current;
          if (file && cardId) void composer.setCardBackFromFile(cardId, file);
        }}
      />

      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => inputRef.current?.click()}>
          <ImagePlus />
          {importMode === "pares" ? "Adicionar frentes e versos" : "Adicionar frentes"}
        </Button>
        <Button
          variant="ghost"
          disabled={cards.length === 0}
          onClick={() => {
            const ok = window.confirm(
              "Isso apaga as imagens, as cartas, os versos e as folhas já montadas. Quer continuar?",
            );
            if (ok) void composer.clearAll();
          }}
        >
          Limpar
        </Button>
      </div>

      {cards.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-primary/5 px-2.5 py-2">
          <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground">
            {composer.restored
              ? "Estas cartas vieram do trabalho salvo neste navegador."
              : "Seu trabalho fica salvo apenas neste navegador."}
          </p>
          <HelpButton topic="trabalho-salvo" />
        </div>
      )}

      <div className="rounded-md border border-border bg-background/50 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
        {importMode === "individual"
          ? "Modo atual: cada imagem adicionada vira uma frente. Todas usam o verso comum do baralho."
          : "Modo atual: envie os arquivos em pares, sempre frente e depois verso da mesma carta."}
      </div>

      {cards.length > 0 && (
        <div className="space-y-2">
          <div
            className="space-y-2"
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDropSlot(null);
              }
            }}
          >
            {cards.map((card, index) => {
              const front = imageById.get(card.frontImageId);
              const backId = backImageFor(card, config);
              const back = backId ? imageById.get(backId) : undefined;
              const ownBack = card.backImageId !== null;
              const isDragging = draggedCardId === card.id;
              const showBefore = dropSlot?.id === card.id && !dropSlot.after && !isDragging;
              const showAfter = dropSlot?.id === card.id && dropSlot.after && !isDragging;

              const slot = (
                <div
                  aria-hidden
                  className="animate-scale-in rounded-md border-2 border-dashed border-primary/70 bg-primary/5 transition-all duration-150"
                  style={{ height: 64 }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceId = event.dataTransfer.getData("text/plain") || draggedCardId;
                    if (sourceId && sourceId !== card.id) {
                      composer.moveCard(sourceId, card.id, dropSlot?.after ?? false);
                    }
                    setDraggedCardId(null);
                    setDropSlot(null);
                  }}
                />
              );

              return (
                <div key={card.id} className="space-y-2">
                  {showBefore && slot}
                  <div
                    draggable
                    onDragStart={(event) => {
                      setDraggedCardId(card.id);
                      setDropSlot(null);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", card.id);
                    }}
                    onDragEnd={() => {
                      setDraggedCardId(null);
                      setDropSlot(null);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      if (draggedCardId === card.id) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      const after = event.clientY > rect.top + rect.height / 2;
                      setDropSlot((current) =>
                        current?.id === card.id && current.after === after
                          ? current
                          : { id: card.id, after },
                      );
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sourceId = event.dataTransfer.getData("text/plain") || draggedCardId;
                      if (sourceId && sourceId !== card.id) {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const after = event.clientY > rect.top + rect.height / 2;
                        composer.moveCard(sourceId, card.id, after);
                      }
                      setDraggedCardId(null);
                      setDropSlot(null);
                    }}
                    className={`flex flex-col gap-1.5 rounded-md border p-2 transition-all duration-150 ${
                      isDragging
                        ? "rotate-1 scale-[1.02] border-primary bg-primary/10 opacity-50 shadow-lg shadow-primary/20"
                        : "border-border"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
                        title="Arraste para reordenar"
                        aria-label="Arraste para reordenar"
                      >
                        <GripVertical className="size-4" />
                      </span>
                      <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">
                        {index + 1}
                      </span>
                      {front && (
                        <img
                          src={front.previewUrl}
                          alt={front.name}
                          title={front.name}
                          className="h-11 w-11 shrink-0 rounded border border-border object-cover"
                        />
                      )}
                      {back ? (
                        <img
                          src={back.previewUrl}
                          alt={back.name}
                          title={ownBack ? back.name : `${back.name} (verso comum)`}
                          className={`h-11 w-11 shrink-0 rounded border object-cover ${
                            ownBack ? "border-primary" : "border-border opacity-60"
                          }`}
                        />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-dashed border-border text-[10px] text-muted-foreground">
                          sem verso
                        </div>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto size-6 shrink-0 text-destructive"
                        title="Remover carta"
                        aria-label={`Remover carta ${index + 1}`}
                        onClick={() => composer.removeCard(card.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 flex-1 px-2 text-[11px]"
                        onClick={() => {
                          targetCardRef.current = card.id;
                          cardBackRef.current?.click();
                        }}
                      >
                        {ownBack ? "Trocar verso" : "Subir verso"}
                      </Button>
                      {ownBack && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 flex-1 px-2 text-[11px]"
                          onClick={() => composer.clearCardBack(card.id)}
                        >
                          Usar verso comum
                        </Button>
                      )}
                    </div>
                  </div>
                  {showAfter && slot}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">
              Arraste para mudar a posição.
            </p>
            <HelpButton topic="ordem-cartas" />
          </div>
          <HelpButton topic="verso-proprio" label="entenda o verso próprio de cada carta" />
        </div>
      )}
    </div>
  );
}
