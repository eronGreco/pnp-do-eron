import { describe, expect, it } from "vitest";
import { bleedGeometry, clampIndex, reflectIndex } from "@/bleed/bleedGeometry";
import { averageEdgeColor, createPixels, paintBleed, type Pixels } from "@/bleed/generateBleed";
import { DEFAULT_BLEED_CONFIG } from "@/bleed/types";

function solidCard(width: number, height: number, color: [number, number, number]): Pixels {
  const card = createPixels(width, height);
  for (let i = 0; i < width * height; i += 1) {
    card.data[i * 4] = color[0];
    card.data[i * 4 + 1] = color[1];
    card.data[i * 4 + 2] = color[2];
    card.data[i * 4 + 3] = 255;
  }
  return card;
}

function pixelAt(image: Pixels, x: number, y: number) {
  const index = (y * image.width + x) * 4;
  return [
    image.data[index],
    image.data[index + 1],
    image.data[index + 2],
    image.data[index + 3],
  ];
}

describe("geometria da sangria criada", () => {
  it("converte milimetros em pixels da propria arte", () => {
    const geometry = bleedGeometry(570, 890, 57, 89, 5, 0);
    expect(geometry.bandX).toBe(50);
    expect(geometry.bandY).toBe(50);
    expect(geometry.outW).toBe(670);
    expect(geometry.outH).toBe(990);
    expect(geometry.cropW).toBe(570);
  });

  it("apara a borda antes de criar a faixa", () => {
    const geometry = bleedGeometry(570, 890, 57, 89, 5, 1);
    expect(geometry.trimX).toBe(10);
    expect(geometry.trimY).toBe(10);
    expect(geometry.cropW).toBe(550);
    expect(geometry.cropH).toBe(870);
    expect(geometry.outW).toBe(geometry.cropW + geometry.bandX * 2);
  });

  it("nunca apara mais do que um quarto da arte", () => {
    const geometry = bleedGeometry(100, 100, 57, 89, 5, 999);
    expect(geometry.trimX).toBe(25);
    expect(geometry.cropW).toBe(50);
  });

  it("converte o raio do canto em pixels depois da apara", () => {
    const geometry = bleedGeometry(570, 890, 57, 89, 5, 1, 3);
    expect(geometry.cornerRx).toBe(Math.round((3 * 550) / 57));
    expect(geometry.cornerRy).toBe(Math.round((3 * 870) / 89));
    expect(bleedGeometry(570, 890, 57, 89, 5, 0).cornerRx).toBe(0);
  });

  it("nunca deixa o raio passar da metade da arte", () => {
    const geometry = bleedGeometry(100, 100, 57, 89, 5, 0, 999);
    expect(geometry.cornerRx).toBe(50);
    expect(geometry.cornerRy).toBe(50);
  });

  it("espelha e prende os indices dentro da arte", () => {
    expect(reflectIndex(-1, 10)).toBe(0);
    expect(reflectIndex(-3, 10)).toBe(2);
    expect(reflectIndex(11, 10)).toBe(8);
    expect(clampIndex(-5, 10)).toBe(0);
    expect(clampIndex(50, 10)).toBe(9);
  });
});

describe("preenchimento da sangria", () => {
  const geometry = bleedGeometry(20, 20, 50, 50, 5, 0);

  it("mantem a arte original no centro", () => {
    const card = solidCard(20, 20, [10, 20, 30]);
    card.data[0] = 200;
    const out = paintBleed(card, geometry, { ...DEFAULT_BLEED_CONFIG, method: "esticar" });
    expect(out.width).toBe(geometry.outW);
    expect(pixelAt(out, geometry.bandX, geometry.bandY)[0]).toBe(200);
  });

  it("esticar repete a cor da bordinha", () => {
    const card = solidCard(20, 20, [40, 50, 60]);
    const out = paintBleed(card, geometry, { ...DEFAULT_BLEED_CONFIG, method: "esticar" });
    expect(pixelAt(out, 0, 0)).toEqual([40, 50, 60, 255]);
  });

  it("espelhar reflete a arte para fora", () => {
    const card = solidCard(20, 20, [0, 0, 0]);
    // Primeira coluna preta, segunda vermelha.
    for (let y = 0; y < 20; y += 1) {
      const index = (y * 20 + 1) * 4;
      card.data[index] = 255;
    }
    const out = paintBleed(card, geometry, { ...DEFAULT_BLEED_CONFIG, method: "espelhar" });
    // Um pixel antes da carta corresponde a coluna 0; dois antes, a coluna 1.
    expect(pixelAt(out, geometry.bandX - 2, geometry.bandY)[0]).toBe(255);
  });

  it("cor solida usa a cor media da borda", () => {
    const card = solidCard(20, 20, [120, 130, 140]);
    expect(averageEdgeColor(card)).toEqual([120, 130, 140]);
    const out = paintBleed(card, geometry, {
      ...DEFAULT_BLEED_CONFIG,
      method: "cor",
      useAverageColor: true,
    });
    expect(pixelAt(out, 0, 0)).toEqual([120, 130, 140, 255]);
  });

  it("cor solida aceita a cor escolhida", () => {
    const card = solidCard(20, 20, [0, 0, 0]);
    const out = paintBleed(card, geometry, {
      ...DEFAULT_BLEED_CONFIG,
      method: "cor",
      useAverageColor: false,
      color: "#ff8000",
    });
    expect(pixelAt(out, 0, 0)).toEqual([255, 128, 0, 255]);
  });

  describe("cantos aparados", () => {
    // 40x40 px para uma carta de 40 mm: 1 mm = 1 px; raio de 8 mm; sangria de 4 mm.
    const rounded = bleedGeometry(40, 40, 40, 40, 4, 0, 8);

    function cardWithBadCorners() {
      const card = solidCard(40, 40, [10, 20, 30]);
      for (const [x, y] of [[0, 0], [39, 0], [0, 39], [39, 39]]) {
        const index = (y! * 40 + x!) * 4;
        card.data[index] = 255;
        card.data[index + 1] = 255;
        card.data[index + 2] = 255;
      }
      return card;
    }

    it("troca o canto original pela sangria criada", () => {
      const out = paintBleed(cardWithBadCorners(), rounded, {
        ...DEFAULT_BLEED_CONFIG,
        method: "esticar",
      });
      // O pixel branco da quina fica para tras: no lugar dele entra a cor da arte.
      expect(pixelAt(out, rounded.bandX, rounded.bandY)).toEqual([10, 20, 30, 255]);
      expect(pixelAt(out, 0, 0)).toEqual([10, 20, 30, 255]);
    });

    it("mantem intacto o que esta dentro do arco", () => {
      const card = cardWithBadCorners();
      card.data[(20 * 40 + 20) * 4] = 99;
      const out = paintBleed(card, rounded, { ...DEFAULT_BLEED_CONFIG, method: "esticar" });
      expect(pixelAt(out, rounded.bandX + 20, rounded.bandY + 20)[0]).toBe(99);
      expect(pixelAt(out, rounded.bandX + 20, rounded.bandY)[0]).toBe(10);
    });

    it("espelhar tambem nao traz a quina aparada de volta", () => {
      const out = paintBleed(cardWithBadCorners(), rounded, {
        ...DEFAULT_BLEED_CONFIG,
        method: "espelhar",
      });
      expect(pixelAt(out, rounded.bandX - 1, rounded.bandY - 1)).toEqual([10, 20, 30, 255]);
    });

    it("a cor media ignora os cantos removidos", () => {
      expect(averageEdgeColor(cardWithBadCorners(), rounded.cornerRx, rounded.cornerRy)).toEqual([
        10, 20, 30,
      ]);
    });
  });

  it("desfoque nao altera a area da carta", () => {
    const card = solidCard(20, 20, [10, 10, 10]);
    card.data[(10 * 20 + 10) * 4] = 250;
    const out = paintBleed(card, geometry, {
      ...DEFAULT_BLEED_CONFIG,
      method: "esticar-desfoque",
      blurStrength: 10,
    });
    expect(pixelAt(out, geometry.bandX + 10, geometry.bandY + 10)[0]).toBe(250);
  });
});
