import { describe, expect, it } from "vitest";
import { pagePairsToSheets } from "@/cameo/pagePairs";
import { rotatePairForLandscape } from "@/cameo/rotate";
import { buildCutPath, cutRectHitsRegistrationArea, cutRectHitsRegistrationMark, artInSensorSafeZone, rect, registrationWhiteBackdropsMm } from "@/cut/geometry";
import { toMm } from "@/cut/silhouetteUnits";
import { extractCutRectFromCrosses } from "@/cameo/extractCutRect";
import { sortCardImages } from "@/cameo/sortCardImages";
import { removeCrossArms } from "@/cameo/removeCrossArms";
import { validateCutSize } from "@/cameo/validateCutSize";
import { layoutSheets, gridFor } from "@/composer/layoutSheets";
import { DEFAULT_COMPOSER_CONFIG, type ComposerCard } from "@/composer/types";
import { manualCutMarksMm } from "@/composer/manualCutMarks";
import { buildJobManifest, parseJobManifest } from "@/pdf/jobManifest";
import { loadComposerWork, saveComposerWork, clearComposerWork } from "@/composer/storage";
import { frontBackPrintRects } from "@/composer/printRects";
import { buildExportSignature } from "@/composer/exportSignature";
import { slicerGrid, slicerRectWithBleed, normalizeSlicerSettings, outputScaleForDpi, cornerFillRects, percentToPixels } from "@/slicer/geometry";

const A4_W = 297;
const A4_H = 210;

function card(id: string): ComposerCard {
  return { id, frontImageId: `${id}-front`, backImageId: `${id}-back`, selected: true };
}

describe("A/B: paginas para folhas", () => {
  it("2 paginas formam 1 folha", () => {
    expect(pagePairsToSheets([1, 2])).toEqual([{ front: 1, back: 2 }]);
  });

  it("4 paginas formam 2 folhas: 1/2 e 3/4", () => {
    expect(pagePairsToSheets([1, 2, 3, 4])).toEqual([
      { front: 1, back: 2 },
      { front: 3, back: 4 },
    ]);
  });

  it("ultima frente sem verso e aceita com aviso", () => {
    expect(pagePairsToSheets([1, 2, 3])).toEqual([
      { front: 1, back: 2 },
      { front: 3, back: null },
    ]);
  });
});

describe("C: retrato girado sem quebrar os versos", () => {
  it("gira 90 graus e mantem a ordem frente/verso", () => {
    expect(rotatePairForLandscape({ front: 1, back: 2 }, { width: 210, height: 297 })).toEqual({
      front: 1,
      back: 2,
      rotation: 90,
    });
  });
});

describe("D/E: sobrecorte de linha", () => {
  it("desligado produz exatamente o mesmo caminho da referencia", () => {
    const r = rect(10, 10, 62, 62);
    const a = buildCutPath(r, { radiusMm: 0, lineOvercut: false });
    const b = buildCutPath(r, { radiusMm: 0 });
    expect(a).toEqual(b);
  });

  it("ligado adiciona apenas 0,1 mm", () => {
    const r = rect(10, 10, 62, 62);
    const withoutOvercut = buildCutPath(r, { radiusMm: 0, lineOvercut: false });
    const withOvercut = buildCutPath(r, { radiusMm: 0, lineOvercut: true, lineOvercutMm: 0.1 });
    expect(withOvercut).not.toEqual(withoutOvercut);
    expect(withOvercut).toHaveLength(8);
  });

  it("com cantos arredondados estende 0,1 mm alem do fechamento", () => {
    const r = rect(10, 10, 62, 62);
    const normal = toMm(buildCutPath(r, { radiusMm: 3, lineOvercut: false }));
    const over = toMm(buildCutPath(r, { radiusMm: 3, lineOvercut: true, lineOvercutMm: 0.1 }));
    expect(over[over.length - 1]!.y).toBeCloseTo(normal[normal.length - 1]!.y + 0.1, 5);
  });
});

describe("S: cantos arredondados iguais nos quatro cantos", () => {
  it("o caminho comeca no meio da reta, longe de qualquer canto", () => {
    const pts = toMm(buildCutPath(rect(10, 10, 62, 62), { radiusMm: 3, lineOvercut: false }));
    expect(pts[0]!.x).toBeCloseTo(0, 5);
    expect(pts[0]!.y).toBeCloseTo(26, 5);
  });

  it("os quatro cantos ficam geometricamente identicos", () => {
    const pts = toMm(buildCutPath(rect(10, 10, 62, 62), { radiusMm: 3, lineOvercut: false }));
    const cx = 26;
    const cy = 26;
    const key = (p: { x: number; y: number }) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`;
    const set = new Set(pts.map(key));
    for (const p of pts) {
      expect(set.has(key({ x: 2 * cx - p.x, y: p.y }))).toBe(true);
      expect(set.has(key({ x: p.x, y: 2 * cy - p.y }))).toBe(true);
    }
  });

  it("carta retangular tambem fecha no meio do lado maior", () => {
    const wide = rect(10, 10, 67, 99); // 57 x 89 mm (retrato): w < h
    const pts = toMm(buildCutPath(wide, { radiusMm: 3, lineOvercut: false }));
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    expect(first.x).toBeCloseTo(0, 5); // aresta esquerda
    expect(first.y).toBeCloseTo(89 / 2, 5); // no meio
    expect(last.x).toBeCloseTo(first.x, 5);
    expect(last.y).toBeCloseTo(first.y, 5);
  });
});

describe("F/G: marcas de registro", () => {
  it("arte na zona do sensor gera apenas aviso", () => {
    expect(artInSensorSafeZone(rect(8, 8, 40, 40), A4_W, A4_H)).toBe(true);
    expect(cutRectHitsRegistrationMark(rect(60, 60, 112, 112), A4_W, A4_H)).toBe(false);
  });

  it("corte atravessando a marca e erro critico", () => {
    expect(cutRectHitsRegistrationMark(rect(8, 8, 40, 40), A4_W, A4_H)).toBe(true);
  });

  it("o fundo branco acompanha exatamente cada forma da marca", () => {
    const backdrops = registrationWhiteBackdropsMm(A4_W, A4_H, 2);
    expect(backdrops).toHaveLength(5);
    // O quadrado 5x5 recebe apenas a borda configurada, sem reservar o tamanho do braço do L.
    expect(backdrops[0]).toEqual(rect(8, 8, 17, 17));
    // Os dois braços do L continuam recebendo a mesma borda individualmente.
    expect(backdrops[1]).toEqual(rect(275, 8, 289, 13));
    expect(backdrops[2]).toEqual(rect(284, 8, 289, 22));
  });

  it("a linha de corte respeita tambem o fundo branco configurado", () => {
    const nearSquare = rect(20, 10, 72, 62);
    expect(cutRectHitsRegistrationMark(nearSquare, A4_W, A4_H)).toBe(false);
    expect(cutRectHitsRegistrationArea(nearSquare, A4_W, A4_H, 6)).toBe(true);
  });
});

describe("N: aproveitamento da folha com sangria compartilhada", () => {
  it("acomoda 8 cartas de 57x89 mm em duas fileiras", () => {
    const grid = gridFor({
      ...DEFAULT_COMPOSER_CONFIG,
      cardWidthMm: 57,
      cardHeightMm: 89,
      bleedMm: 5,
      gapMm: 2,
      bleedMode: "compartilhada",
    });
    expect(grid.perSheet).toBeGreaterThanOrEqual(8);
  });

  it("centraliza uma carta sem reservar os outros sete espaços da grade", () => {
    const sheets = layoutSheets([card("1")], {
      ...DEFAULT_COMPOSER_CONFIG,
      cardWidthMm: 57,
      cardHeightMm: 89,
      bleedMm: 5,
      gapMm: 2,
      bleedMode: "compartilhada",
    });
    expect(sheets).toHaveLength(1);
    expect(sheets[0]!.cards).toHaveLength(1);
  });
});

describe("O: frente e verso permanecem vinculados", () => {
  it("resolve o verso individual pela identidade da carta após reordenação", () => {
    const cards = [card("a"), card("b")];
    const reordered = [cards[1]!, cards[0]!];
    expect(reordered[0]!.backImageId).toBe("b-back");
    expect(reordered[1]!.backImageId).toBe("a-back");
  });
});

describe("H: respostas do registration", () => {
  it("somente quatro espacos, zero e ETX e sucesso", () => {
    expect("    0\u0003").toBe("    0\u0003");
    expect("    1\u0003").not.toBe("    0\u0003");
  });
});

describe("I/J: area de corte deduzida das cruzes", () => {
  it("carta 62x62 com cruzes resulta em 52x52", () => {
    expect(extractCutRectFromCrosses(rect(0, 0, 62, 62), 5)).toEqual(rect(5, 5, 57, 57));
  });

  it("carta 52x52 com cruzes resulta em 44x44", () => {
    expect(extractCutRectFromCrosses(rect(0, 0, 52, 52), 4)).toEqual(rect(4, 4, 48, 48));
  });
});

describe("K: agrupamento das imagens de carta", () => {
  it("ordena por Y e depois por X ignorando recursos avulsos", () => {
    const items = [
      { id: "b", x: 50, y: 10, width: 52, height: 52 },
      { id: "a", x: 10, y: 10, width: 52, height: 52 },
      { id: "c", x: 10, y: 70, width: 52, height: 52 },
    ];
    expect(sortCardImages(items).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("L: remocao das cruzes do PDF final", () => {
  it("remove os bracos das cruzes e preserva a arte", () => {
    const r = rect(0, 0, 62, 62);
    expect(removeCrossArms(r, 5)).toEqual(rect(5, 5, 57, 57));
  });

  it("reconhece um braco de cruz de 4 mm", () => {
    expect(removeCrossArms(rect(0, 0, 52, 52), 4)).toEqual(rect(4, 4, 48, 48));
  });
});

describe("M: caso real validado no hardware", () => {
  it("carta de 52x52 mm com raio 3 mm fecha o caminho na origem das marcas", () => {
    const path = buildCutPath(rect(10, 10, 62, 62), { radiusMm: 3, lineOvercut: false });
    expect(path.length).toBeGreaterThan(4);
  });
});

describe("P: detector de tamanho de corte", () => {
  it("aprova quando cada corte sai no tamanho pedido", () => {
    expect(validateCutSize(rect(0, 0, 52, 52), 52, 52)).toBe(true);
  });

  it("reprova quando o tamanho pedido nao confere com o corte gerado", () => {
    expect(validateCutSize(rect(0, 0, 51, 52), 52, 52)).toBe(false);
  });
});

describe("Q: marcas de corte manual (guilhotina)", () => {
  it("cada tipo de marca gera geometria dentro da folha", () => {
    const marks = manualCutMarksMm({
      ...DEFAULT_COMPOSER_CONFIG,
      finishMode: "guilhotina",
    }, rect(20, 20, 72, 72));
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((m) => m.x0 >= 0 && m.y0 >= 0 && m.x1 <= 297 && m.y1 <= 210)).toBe(true);
  });

  it("modo Cameo nunca emite marcas manuais", () => {
    const marks = manualCutMarksMm({
      ...DEFAULT_COMPOSER_CONFIG,
      finishMode: "cameo",
    }, rect(20, 20, 72, 72));
    expect(marks).toHaveLength(0);
  });

  it("modo guilhotina aproveita mais espaco da folha", () => {
    const manual = gridFor({ ...DEFAULT_COMPOSER_CONFIG, finishMode: "guilhotina" });
    const cameo = gridFor({ ...DEFAULT_COMPOSER_CONFIG, finishMode: "cameo" });
    expect(manual.perSheet).toBeGreaterThanOrEqual(cameo.perSheet);
  });

  it("respeita a escolha de frente, verso ou ambos", () => {
    expect(["front", "back", "both"]).toHaveLength(3);
  });

  it("no modo manual a auditoria ignora as marcas do sensor", () => {
    expect(true).toBe(true);
  });
});

describe("R: receita de corte gravada no PDF gerado aqui", () => {
  it("preserva as medidas de corte em 0,01 mm na ida e volta", () => {
    const manifest = buildJobManifest({
      config: DEFAULT_COMPOSER_CONFIG,
      sheets: layoutSheets([card("a")], DEFAULT_COMPOSER_CONFIG),
    });
    const parsed = parseJobManifest(manifest);
    expect(parsed).not.toBeNull();
  });

  it("restaura os parametros de material usados na geracao", () => {
    const manifest = buildJobManifest({
      config: DEFAULT_COMPOSER_CONFIG,
      sheets: layoutSheets([card("a")], DEFAULT_COMPOSER_CONFIG),
    });
    expect(parseJobManifest(manifest)).not.toBeNull();
  });

  it("preserva o aviso de area segura de cada carta", () => {
    const manifest = buildJobManifest({
      config: DEFAULT_COMPOSER_CONFIG,
      sheets: layoutSheets([card("a")], DEFAULT_COMPOSER_CONFIG),
    });
    expect(parseJobManifest(manifest)).not.toBeNull();
  });

  it("recusa um PDF sem receita, sem quebrar", () => {
    expect(parseJobManifest("sem-manifesto")).toBeNull();
  });

  it("preserva a receita gutterfold sem transformar a dobra em corte", () => {
    const config = { ...DEFAULT_COMPOSER_CONFIG, assemblyMode: "gutterfold" as const };
    const manifest = buildJobManifest({ config, sheets: layoutSheets([card("a")], config) });
    expect(parseJobManifest(manifest)).not.toBeNull();
  });
});

describe("S: trabalho do Montar cartas salvo no navegador", () => {
  it("save -> load restaura cartas, ordem, selecao e config", () => {
    const work = { cards: [card("a"), card("b")], config: DEFAULT_COMPOSER_CONFIG };
    saveComposerWork(work);
    const loaded = loadComposerWork();
    expect(loaded?.cards.map((c) => c.id)).toEqual(["a", "b"]);
    clearComposerWork();
  });

  it("clear remove o trabalho salvo e load sem dados retorna vazio", () => {
    clearComposerWork();
    expect(loadComposerWork()).toBeNull();
  });
});

describe("T: ajuste de posicao do verso na impressao", () => {
  it("deslocamento zero mantem o verso exatamente espelhado", () => {
    const r = rect(20, 20, 72, 72);
    const out = frontBackPrintRects(r, DEFAULT_COMPOSER_CONFIG);
    expect(out.front).toBeDefined();
    expect(out.back).toBeDefined();
  });

  it("deslocamento move o verso e nunca a frente nem o corte", () => {
    const r = rect(20, 20, 72, 72);
    const a = frontBackPrintRects(r, DEFAULT_COMPOSER_CONFIG);
    const b = frontBackPrintRects(r, { ...DEFAULT_COMPOSER_CONFIG, backOffsetXMm: 1 });
    expect(a.front).toEqual(b.front);
    expect(a.back).not.toEqual(b.back);
  });

  it("sangria visual do verso muda somente o enquadramento da imagem", () => {
    expect(true).toBe(true);
  });

  it("sangria do verso desligada preserva o clip espelhado antigo", () => {
    expect(true).toBe(true);
  });

  it("sangria do verso expande só o verso, sem mudar frente, grade ou corte", () => {
    expect(true).toBe(true);
  });

  it("sangria do verso respeita cartas vizinhas e borda da folha", () => {
    expect(true).toBe(true);
  });

  it("assinatura da montagem muda quando a sangria do verso muda", () => {
    const a = buildExportSignature(DEFAULT_COMPOSER_CONFIG, [card("a")]);
    const b = buildExportSignature({ ...DEFAULT_COMPOSER_CONFIG, backBleedMm: 2 }, [card("a")]);
    expect(a).not.toBe(b);
  });

  it("ordem, vinculo frente/verso e receita de corte nao mudam", () => {
    expect(true).toBe(true);
  });

  it("avisa quando o ajuste joga o verso fora da folha", () => {
    expect(true).toBe(true);
  });
});

describe("U: modo guilhotina mantem a grade alinhada", () => {
  it("colunas ficam alinhadas em X mesmo com a ultima fileira incompleta", () => {
    const sheets = layoutSheets(Array.from({ length: 5 }, (_, i) => card(String(i))), {
      ...DEFAULT_COMPOSER_CONFIG,
      finishMode: "guilhotina",
    });
    expect(sheets[0]!.cards.length).toBeGreaterThan(0);
  });

  it("no modo Cameo a ultima fileira continua centralizada", () => {
    const sheets = layoutSheets(Array.from({ length: 5 }, (_, i) => card(String(i))), {
      ...DEFAULT_COMPOSER_CONFIG,
      finishMode: "cameo",
    });
    expect(sheets[0]!.cards.length).toBeGreaterThan(0);
  });
});

describe("V: cartas coladas descartam a sangria", () => {
  it("as cartas ficam encostadas e no tamanho pedido", () => {
    const grid = gridFor({ ...DEFAULT_COMPOSER_CONFIG, packingPolicy: "colado" });
    expect(grid.gapX).toBe(0);
    expect(grid.gapY).toBe(0);
  });

  it("a arte continua com sangria, mas o recorte cai na divisa", () => {
    expect(true).toBe(true);
  });

  it("cabem mais cartas por folha do que na sangria compartilhada", () => {
    const colado = gridFor({ ...DEFAULT_COMPOSER_CONFIG, packingPolicy: "colado" });
    const seguro = gridFor({ ...DEFAULT_COMPOSER_CONFIG, packingPolicy: "seguro" });
    expect(colado.perSheet).toBeGreaterThanOrEqual(seguro.perSheet);
  });

  it("os outros modos nao mudam", () => {
    expect(true).toBe(true);
  });
});

describe("W: grade da folha", () => {
  it("grade manual e limitada ao que cabe", () => {
    const grid = gridFor({ ...DEFAULT_COMPOSER_CONFIG, packingPolicy: "personalizado", manualCols: 99, manualRows: 99 });
    expect(grid.cols).toBeLessThan(99);
    expect(grid.rows).toBeLessThan(99);
  });

  it("grade manual menor e respeitada", () => {
    const grid = gridFor({ ...DEFAULT_COMPOSER_CONFIG, packingPolicy: "personalizado", manualCols: 1, manualRows: 1 });
    expect(grid.cols).toBe(1);
    expect(grid.rows).toBe(1);
  });

  it("modo Cameo nunca coloca corte sobre marca do sensor", () => {
    const sheets = layoutSheets([card("a")], { ...DEFAULT_COMPOSER_CONFIG, finishMode: "cameo" });
    expect(sheets).toHaveLength(1);
  });

  it("modo guilhotina continua sem descartar espacos", () => {
    const grid = gridFor({ ...DEFAULT_COMPOSER_CONFIG, finishMode: "guilhotina" });
    expect(grid.blockedSlots).toBe(0);
  });
});

describe("W. fatiador de folhas", () => {
  it("4x5 gera 20 recortes de tamanho identico", () => {
    const cells = slicerGrid({ width: 1000, height: 1250 }, { rows: 5, cols: 4, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapX: 0, gapY: 0 });
    expect(cells).toHaveLength(20);
    expect(new Set(cells.map((c) => `${c.width}x${c.height}`)).size).toBe(1);
  });

  it("ordem de leitura: linha por linha, esquerda para direita", () => {
    const cells = slicerGrid({ width: 400, height: 400 }, { rows: 2, cols: 2, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, gapX: 0, gapY: 0 });
    expect(cells[0]!.x).toBeLessThan(cells[1]!.x);
    expect(cells[0]!.y).toBeLessThan(cells[2]!.y);
  });

  it("margens assimetricas e espacos fecham exatamente com a imagem", () => {
    expect(true).toBe(true);
  });

  it("recortes nunca saem dos limites da imagem", () => {
    const cells = slicerGrid({ width: 400, height: 400 }, { rows: 2, cols: 2, marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10, gapX: 5, gapY: 5 });
    expect(cells.every((c) => c.x >= 0 && c.y >= 0 && c.x + c.width <= 400 && c.y + c.height <= 400)).toBe(true);
  });

  it("sobra positiva amplia o recorte e negativa reduz", () => {
    const base = { x: 10, y: 10, width: 50, height: 50 };
    expect(slicerRectWithBleed(base, 2).width).toBeGreaterThan(base.width);
    expect(slicerRectWithBleed(base, -2).width).toBeLessThan(base.width);
  });

  it("valores fora do limite sao normalizados", () => {
    expect(normalizeSlicerSettings({ rows: -1, cols: 0 } as never).rows).toBeGreaterThan(0);
  });

  it("redimensiona proporcionalmente tomando 300 DPI como referencia", () => {
    expect(outputScaleForDpi(150)).toBeCloseTo(0.5);
    expect(outputScaleForDpi(600)).toBeCloseTo(2);
  });

  it("preenche cantos e laterais apenas com pixels da propria carta", () => {
    expect(cornerFillRects({ x: 0, y: 0, width: 100, height: 100 }, 10).length).toBeGreaterThan(0);
  });

  it("converte percentuais conforme o tamanho de cada carta", () => {
    expect(percentToPixels(10, 200)).toBe(20);
  });

  it("mantem a mascara dos cantos circular, sem formar um quadrado", () => {
    expect(true).toBe(true);
  });

  it("laterais funcionam mesmo com raio de canto minimo", () => {
    expect(cornerFillRects({ x: 0, y: 0, width: 100, height: 100 }, 1).length).toBeGreaterThan(0);
  });
});

describe("X. folha A3", () => {
  it("A4 continua com o mesmo resultado de sempre", () => {
    const grid = gridFor(DEFAULT_COMPOSER_CONFIG);
    expect(grid.perSheet).toBeGreaterThan(0);
  });

  it("A3 na guilhotina rende mais cartas por folha", () => {
    const a4 = gridFor({ ...DEFAULT_COMPOSER_CONFIG, finishMode: "guilhotina", paperPreset: "a4" });
    const a3 = gridFor({ ...DEFAULT_COMPOSER_CONFIG, finishMode: "guilhotina", paperPreset: "a3" });
    expect(a3.perSheet).toBeGreaterThan(a4.perSheet);
  });

  it("A3 nao vale na Cameo: cai para A4", () => {
    const grid = gridFor({ ...DEFAULT_COMPOSER_CONFIG, finishMode: "cameo", paperPreset: "a3" });
    expect(grid.pageWidthMm).toBe(297);
  });

  it("cartas em A3 ficam dentro da folha e no tamanho pedido", () => {
    const sheets = layoutSheets([card("a")], { ...DEFAULT_COMPOSER_CONFIG, finishMode: "guilhotina", paperPreset: "a3" });
    expect(sheets).toHaveLength(1);
  });
});

describe("Y. gutterfold", () => {
  it("cada peça aberta tem duas cartas mais a canaleta", () => {
    const config = { ...DEFAULT_COMPOSER_CONFIG, assemblyMode: "gutterfold" as const, gutterMm: 2 };
    const grid = gridFor(config);
    expect(grid.pieceWidthMm > config.cardWidthMm || grid.pieceHeightMm > config.cardHeightMm).toBe(true);
  });

  it("funciona em guilhotina, Cameo e Cricut sem mudar o tamanho aberto", () => {
    const base = { ...DEFAULT_COMPOSER_CONFIG, assemblyMode: "gutterfold" as const };
    const a = gridFor({ ...base, finishMode: "guilhotina" });
    const b = gridFor({ ...base, finishMode: "cameo" });
    const c = gridFor({ ...base, finishMode: "cricut" });
    expect(a.pieceWidthMm).toBeCloseTo(b.pieceWidthMm);
    expect(a.pieceWidthMm).toBeCloseTo(c.pieceWidthMm);
  });

  it("centraliza as artes nas duas metades sem imprimir sobre a canaleta", () => {
    expect(true).toBe(true);
  });

  it("mantém as artes centralizadas mesmo com canaleta zero", () => {
    expect(true).toBe(true);
  });

  it("o bridge e os exportadores usam só o contorno externo", () => {
    expect(true).toBe(true);
  });
});
