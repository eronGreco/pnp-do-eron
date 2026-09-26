import { describe, expect, it } from "vitest";
import {
  clearComposerState,
  loadComposerState,
  saveComposerState,
} from "@/storage/composerStore";
import { DEFAULT_COMPOSER_CONFIG } from "@/composer/types";

const state = {
  images: [],
  cards: [
    {
      id: "c1",
      frontImageId: "i1",
      backImageId: null,
      selected: true,
    },
  ],
  config: { ...DEFAULT_COMPOSER_CONFIG, finishMode: "manual" as const },
  importMode: "individual" as const,
};

describe("trabalho salvo no navegador", () => {
  it("salva e le o estado", async () => {
    await saveComposerState(state);
    const stored = await loadComposerState();
    expect(stored?.cards).toHaveLength(1);
    expect(stored?.config.finishMode).toBe("manual");
  });

  it("limpar remove tudo", async () => {
    await saveComposerState(state);
    await clearComposerState();
    expect(await loadComposerState()).toBeNull();
  });
});
