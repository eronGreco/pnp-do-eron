import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FinishPanel } from "@/components/panels/FinishPanel";
import type { Composer } from "@/composer/useComposer";
import { DEFAULT_COMPOSER_CONFIG } from "@/composer/types";

function renderFinish(finishMode: "cameo" | "cricut" | "manual") {
  const composer: Pick<Composer, "config" | "setConfig"> = {
    config: { ...DEFAULT_COMPOSER_CONFIG, finishMode },
    setConfig: () => {},
  };
  return renderToStaticMarkup(<FinishPanel composer={composer} />);
}

function pressed(markup: string, title: string, active: boolean) {
  expect(markup).toMatch(new RegExp(`<button[^>]*aria-pressed="${active}"[^>]*>[\\s\\S]*?${title}</span>`));
}

function titlePositions(markup: string) {
  const positions: Array<[string, number]> = [
    ["SILHOUETTE", markup.indexOf("SILHOUETTE</span>")],
    ["CAMEO", markup.indexOf("CAMEO</span>")],
    ["CRICUT", markup.indexOf("CRICUT</span>")],
    ["GUILHOTINA", markup.indexOf("GUILHOTINA</span>")],
  ];
  return positions;
}

describe("hierarquia de Acabamento", () => {
  for (const mode of ["cameo", "cricut"] as const) {
    it(`${mode}: GUILHOTINA, depois SILHOUETTE, depois CAMEO/CRICUT subordinadas`, () => {
      const markup = renderFinish(mode);
      // Ordem visual: GUILHOTINA < SILHOUETTE < CAMEO < CRICUT.
      const positions = titlePositions(markup);
      expect(positions.find(([title]) => title === "SILHOUETTE")![1]).toBeGreaterThan(
        positions.find(([title]) => title === "GUILHOTINA")![1],
      );
      expect(positions.find(([title]) => title === "CAMEO")![1]).toBeGreaterThan(
        positions.find(([title]) => title === "SILHOUETTE")![1],
      );
      expect(positions.find(([title]) => title === "CRICUT")![1]).toBeGreaterThan(
        positions.find(([title]) => title === "CAMEO")![1],
      );
      // Isolate each control so the assertion cannot match a later button.
      const buttons = markup.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
      for (const [title, active] of [
        ["SILHOUETTE", true], ["GUILHOTINA", false],
        ["CAMEO", mode === "cameo"], ["CRICUT", mode === "cricut"],
      ] as const) {
        const button = buttons.find((item) => item.includes(`${title}</span>`));
        expect(button).toBeDefined();
        pressed(button ?? "", title, active);
      }
      expect(markup).toContain("<fieldset");
      expect(markup).toContain("SILHOUETTE: máquina</legend>");
      for (const title of ["Etapa 1: Acabamento", "Silhouette Cameo", "Cricut", "Guilhotina", "Modo de montagem", "Montagem normal", "Gutterfold"]) {
        expect(markup).toContain(`Ajuda: ${title}`);
      }
    });
  }

  it("manual: GUILHOTINA, depois SILHOUETTE, sem subopções de máquina", () => {
    const markup = renderFinish("manual");
    // Ordem visual: GUILHOTINA < SILHOUETTE (e nenhuma CAMEO/CRICUT).
    const positions = titlePositions(markup);
    expect(positions.find(([title]) => title === "SILHOUETTE")![1]).toBeGreaterThan(
      positions.find(([title]) => title === "GUILHOTINA")![1],
    );
    const buttons = markup.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
    pressed(buttons.find((item) => item.includes("GUILHOTINA</span>")) ?? "", "GUILHOTINA", true);
    pressed(buttons.find((item) => item.includes("SILHOUETTE</span>")) ?? "", "SILHOUETTE", false);
    expect(markup).not.toContain("<fieldset");
    expect(markup).not.toContain("CAMEO</span>");
    expect(markup).not.toContain("CRICUT</span>");
    expect(markup).toContain("Ajuda: Guilhotina");
  });
});
