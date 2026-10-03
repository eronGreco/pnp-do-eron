import type { CricutMarkBounds } from "./markTemplate";

/** Imagem RGBA simples (ImageData ou equivalente em teste). */
export type PixelSource = { width: number; height: number; data: Uint8ClampedArray };

type Component = {
  pixels: number[];
  bounds: CricutMarkBounds;
};

function isDark(data: Uint8ClampedArray, offset: number): boolean {
  const r = data[offset] ?? 255;
  const g = data[offset + 1] ?? 255;
  const b = data[offset + 2] ?? 255;
  const a = data[offset + 3] ?? 255;
  if (a < 160) return false;
  return r * 0.299 + g * 0.587 + b * 0.114 < 120;
}

export type Corner = "TL" | "TR" | "BL" | "BR";

const CORNER_BAND_MM = 45;

function cornerOf(b: CricutMarkBounds, width: number, height: number, pxPerMm: number): Corner | null {
  const band = CORNER_BAND_MM * pxPerMm;
  const edge = 2 * pxPerMm;
  const left = b.x1Px < band - edge;
  const right = b.x0Px > width - band + edge;
  const top = b.y1Px < band - edge;
  const bottom = b.y0Px > height - band + edge;
  if (top && left) return "TL";
  if (top && right) return "TR";
  if (bottom && left) return "BL";
  if (bottom && right) return "BR";
  return null;
}

/**
 * Marcas da Cricut: braco fino solto, "L" ligado (caixa quadrada mas quase
 * vazia) ou quadrado preto cheio. Arte de carta e grande e densa demais.
 */
function markShaped(b: CricutMarkBounds, pixels: number, pxPerMm: number): boolean {
  const bw = (b.x1Px - b.x0Px) / pxPerMm;
  const bh = (b.y1Px - b.y0Px) / pxPerMm;
  const long = Math.max(bw, bh);
  const short = Math.min(bw, bh);
  const fill = pixels / Math.max(1, (b.x1Px - b.x0Px) * (b.y1Px - b.y0Px));
  const arm = short <= 3 && long >= 4 && long <= 35;
  const bracket = long >= 6 && long <= 35 && short >= 6 && fill <= 0.35;
  const square = long >= 3 && long <= 12 && short / long >= 0.7 && fill >= 0.8;
  return arm || bracket || square;
}

function selectedComponents(
  source: PixelSource,
  pxPerMm: number,
): { components: Component[]; corners: Corner[] } {
  const { width, height, data } = source;
  const total = width * height;
  const band = CORNER_BAND_MM * pxPerMm;
  const candidates = new Uint8Array(total);
  const visited = new Uint8Array(total);

  for (let y = 0; y < height; y += 1) {
    const inY = y < band || y > height - band;
    if (!inY) continue;
    for (let x = 0; x < width; x += 1) {
      if (!(x < band || x > width - band)) continue;
      const index = y * width + x;
      if (isDark(data, index * 4)) candidates[index] = 1;
    }
  }

  const components: Component[] = [];
  const corners = new Set<Corner>();
  const stack: number[] = [];

  for (let start = 0; start < total; start += 1) {
    if (!candidates[start] || visited[start]) continue;
    visited[start] = 1;
    stack.push(start);
    const pixels: number[] = [];
    let x0 = width;
    let y0 = height;
    let x1 = 0;
    let y1 = 0;

    while (stack.length > 0) {
      const current = stack.pop();
      if (typeof current !== "number") continue;
      pixels.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x + 1);
      y1 = Math.max(y1, y + 1);
      const neighbors = [current - 1, current + 1, current - width, current + width];
      for (const next of neighbors) {
        if (next < 0 || next >= total || visited[next] || !candidates[next]) continue;
        const nx = next % width;
        if (Math.abs(nx - x) > 1) continue;
        visited[next] = 1;
        stack.push(next);
      }
    }

    const bounds = { x0Px: x0, y0Px: y0, x1Px: x1, y1Px: y1 };
    const corner = cornerOf(bounds, width, height, pxPerMm);
    if (corner && markShaped(bounds, pixels.length, pxPerMm)) {
      components.push({ pixels, bounds });
      corners.add(corner);
    }
  }

  return { components, corners: [...corners] };
}

/**
 * Area do desenho: tudo que nao e branco dentro da caixa das marcas, fora dos
 * pixels das proprias marcas. Sem faixa de folga: no Design Space a primeira
 * coluna de cartas pode comecar na mesma linha do braco do L.
 */
function designRect(
  source: PixelSource,
  marks: Component[],
  pxPerMm: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  const { width, height, data } = source;
  const markMask = new Uint8Array(width * height);
  for (const m of marks) {
    for (const index of m.pixels) {
      const x = index % width;
      const y = Math.floor(index / width);
      // 1 px de folga cobre o antisserrilhado da borda da marca.
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) markMask[ny * width + nx] = 1;
        }
      }
    }
  }
  const fx0 = Math.min(...marks.map((m) => m.bounds.x0Px));
  const fy0 = Math.min(...marks.map((m) => m.bounds.y0Px));
  const fx1 = Math.max(...marks.map((m) => m.bounds.x1Px));
  const fy1 = Math.max(...marks.map((m) => m.bounds.y1Px));
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = Math.max(0, fy0); y < Math.min(height, fy1); y += 1) {
    for (let x = Math.max(0, fx0); x < Math.min(width, fx1); x += 1) {
      const i = y * width + x;
      if (markMask[i]) continue;
      const o = i * 4;
      const lum = (data[o] ?? 255) * 0.299 + (data[o + 1] ?? 255) * 0.587 + (data[o + 2] ?? 255) * 0.114;
      if (lum >= 235) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const w = (x1 + 1 - x0) / pxPerMm;
  const h = (y1 + 1 - y0) / pxPerMm;
  if (w < 10 || h < 10) return null;
  return { x0: x0 / pxPerMm, y0: y0 / pxPerMm, x1: (x1 + 1) / pxPerMm, y1: (y1 + 1) / pxPerMm };
}


type Candidate = { component: Component; corners: Corner[]; kind: "bracket" | "square" };

/** Todos os componentes escuros da pagina inteira (vizinhanca de 4). */
function allComponents(source: PixelSource): Component[] {
  const { width, height, data } = source;
  const total = width * height;
  const dark = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) if (isDark(data, i * 4)) dark[i] = 1;
  const visited = new Uint8Array(total);
  const out: Component[] = [];
  const stack: number[] = [];
  for (let start = 0; start < total; start += 1) {
    if (!dark[start] || visited[start]) continue;
    visited[start] = 1;
    stack.push(start);
    const pixels: number[] = [];
    let x0 = width;
    let y0 = height;
    let x1 = 0;
    let y1 = 0;
    while (stack.length > 0) {
      const current = stack.pop()!;
      pixels.push(current);
      const x = current % width;
      const y = (current - x) / width;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x + 1 > x1) x1 = x + 1;
      if (y + 1 > y1) y1 = y + 1;
      if (x > 0 && dark[current - 1] && !visited[current - 1]) { visited[current - 1] = 1; stack.push(current - 1); }
      if (x < width - 1 && dark[current + 1] && !visited[current + 1]) { visited[current + 1] = 1; stack.push(current + 1); }
      if (y > 0 && dark[current - width] && !visited[current - width]) { visited[current - width] = 1; stack.push(current - width); }
      if (y < height - 1 && dark[current + width] && !visited[current + width]) { visited[current + width] = 1; stack.push(current + width); }
    }
    out.push({ pixels, bounds: { x0Px: x0, y0Px: y0, x1Px: x1, y1Px: y1 } });
  }
  return out;
}

/**
 * Classifica um componente pela geometria: "L" ligado (dois bracos finos em
 * lados vizinhos da propria caixa) ou quadrado preto cheio. Blocos grandes de
 * arte, contornos de carta e molduras de quatro lados sao descartados.
 */
function classify(component: Component, width: number, pxPerMm: number): Candidate | null {
  const b = component.bounds;
  const wPx = b.x1Px - b.x0Px;
  const hPx = b.y1Px - b.y0Px;
  const bw = wPx / pxPerMm;
  const bh = hPx / pxPerMm;
  const long = Math.max(bw, bh);
  const short = Math.min(bw, bh);
  const fill = component.pixels.length / Math.max(1, wPx * hPx);

  if (long >= 3 && long <= 12 && short / long >= 0.7 && fill >= 0.8) {
    return { component, corners: ["TL", "TR", "BL", "BR"], kind: "square" };
  }
  if (!(short >= 6 && long <= 35 && fill <= 0.35)) return null;

  // Densidade de pixels escuros numa faixa de 1,5 mm junto a cada lado da caixa.
  const band = Math.max(1, Math.round(1.5 * pxPerMm));
  let top = 0;
  let bottom = 0;
  let left = 0;
  let right = 0;
  for (const index of component.pixels) {
    const x = index % width;
    const y = (index - x) / width;
    if (y < b.y0Px + band) top += 1;
    if (y >= b.y1Px - band) bottom += 1;
    if (x < b.x0Px + band) left += 1;
    if (x >= b.x1Px - band) right += 1;
  }
  const t = top / (wPx * band);
  const bo = bottom / (wPx * band);
  const l = left / (hPx * band);
  const r = right / (hPx * band);
  const dense = (v: number) => v >= 0.4;
  const sparse = (v: number) => v <= 0.25;
  let corner: Corner | null = null;
  if (dense(t) && dense(l) && sparse(bo) && sparse(r)) corner = "TL";
  else if (dense(t) && dense(r) && sparse(bo) && sparse(l)) corner = "TR";
  else if (dense(bo) && dense(l) && sparse(t) && sparse(r)) corner = "BL";
  else if (dense(bo) && dense(r) && sparse(t) && sparse(l)) corner = "BR";
  return corner ? { component, corners: [corner], kind: "bracket" } : null;
}

/**
 * Procura quatro marcas (ou tres) que formem os cantos de um mesmo retangulo
 * de registro, em qualquer lugar da pagina. O Design Space pode deixar esse
 * retangulo bem para dentro da folha, longe dos cantos fisicos.
 */
function rectangleMarks(source: PixelSource, pxPerMm: number): { components: Component[]; corners: Corner[] } {
  const candidates = allComponents(source)
    .map((c) => classify(c, source.width, pxPerMm))
    .filter((c): c is Candidate => c !== null);
  const byCorner = (corner: Corner) => candidates.filter((c) => c.corners.includes(corner)).slice(0, 15);
  const tl = [null, ...byCorner("TL")];
  const tr = [null, ...byCorner("TR")];
  const bl = [null, ...byCorner("BL")];
  const br = [null, ...byCorner("BR")];
  const tol = 3 * pxPerMm;
  const minSpan = 40 * pxPerMm;
  let best: { score: number; picks: [Corner, Candidate][] } | null = null;

  for (const a of tl) for (const b of tr) for (const c of bl) for (const d of br) {
    const picks = ([["TL", a], ["TR", b], ["BL", c], ["BR", d]] as [Corner, Candidate | null][])
      .filter((p): p is [Corner, Candidate] => p[1] !== null);
    if (picks.length < 3) continue;
    const used = new Set(picks.map((p) => p[1]));
    if (used.size !== picks.length) continue;
    if (picks.filter((p) => p[1].kind === "square").length > 1) continue;
    const bx = (cand: Candidate | null, key: "x0Px" | "x1Px" | "y0Px" | "y1Px") => cand?.component.bounds[key];
    const near = (u?: number, v?: number) => u === undefined || v === undefined || Math.abs(u - v) <= tol;
    if (!near(bx(a, "x0Px"), bx(c, "x0Px")) || !near(bx(b, "x1Px"), bx(d, "x1Px"))) continue;
    if (!near(bx(a, "y0Px"), bx(b, "y0Px")) || !near(bx(c, "y1Px"), bx(d, "y1Px"))) continue;
    const left = Math.min(...[a, c].filter(Boolean).map((k) => k!.component.bounds.x0Px));
    const right = Math.max(...[b, d].filter(Boolean).map((k) => k!.component.bounds.x1Px));
    const topY = Math.min(...[a, b].filter(Boolean).map((k) => k!.component.bounds.y0Px));
    const bottomY = Math.max(...[c, d].filter(Boolean).map((k) => k!.component.bounds.y1Px));
    if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(topY) || !Number.isFinite(bottomY)) continue;
    if (right - left < minSpan || bottomY - topY < minSpan) continue;
    const score = picks.length * 1e12 + (right - left) * (bottomY - topY);
    if (!best || score > best.score) best = { score, picks };
  }
  if (!best) return { components: [], corners: [] };
  return { components: best.picks.map((p) => p[1].component), corners: best.picks.map((p) => p[0]) };
}

/**
 * Leitura completa das marcas de uma pagina. Primeiro busca o retangulo de
 * registro pela geometria do "L" em qualquer lugar da folha; se o leitor
 * antigo (cantos fisicos, aceita bracos soltos) achar mais cantos, usa ele.
 */
export function detectCricutMarks(source: PixelSource, pxPerMm: number) {
  const byRect = rectangleMarks(source, pxPerMm);
  const byCorner = selectedComponents(source, pxPerMm);
  let chosen = byCorner.corners.length > byRect.corners.length ? byCorner : byRect;
  if (chosen === byRect && byRect.corners.length === 3) chosen = completeWithLegacy(byRect, byCorner, source, pxPerMm);
  const design = chosen.corners.length >= 3 ? designRect(source, chosen.components, pxPerMm) : null;
  return { components: chosen.components, corners: chosen.corners, design };
}

/**
 * Com 3 cantos achados pelo retangulo, tenta completar o quarto com os bracos
 * soltos do leitor antigo, desde que caibam no mesmo retangulo.
 */
function completeWithLegacy(
  rect: { components: Component[]; corners: Corner[] },
  legacy: { components: Component[]; corners: Corner[] },
  source: PixelSource,
  pxPerMm: number,
): { components: Component[]; corners: Corner[] } {
  const missing = (["TL", "TR", "BL", "BR"] as Corner[]).find((c) => !rect.corners.includes(c));
  if (!missing || !legacy.corners.includes(missing)) return rect;
  const pieces = legacy.components.filter(
    (c) => cornerOf(c.bounds, source.width, source.height, pxPerMm) === missing,
  );
  if (pieces.length === 0) return rect;
  const box = {
    x0: Math.min(...pieces.map((c) => c.bounds.x0Px)),
    y0: Math.min(...pieces.map((c) => c.bounds.y0Px)),
    x1: Math.max(...pieces.map((c) => c.bounds.x1Px)),
    y1: Math.max(...pieces.map((c) => c.bounds.y1Px)),
  };
  const others = rect.components;
  const tol = 3 * pxPerMm;
  const left = Math.min(...others.map((c) => c.bounds.x0Px));
  const right = Math.max(...others.map((c) => c.bounds.x1Px));
  const top = Math.min(...others.map((c) => c.bounds.y0Px));
  const bottom = Math.max(...others.map((c) => c.bounds.y1Px));
  const okX = missing === "TL" || missing === "BL" ? Math.abs(box.x0 - left) <= tol : Math.abs(box.x1 - right) <= tol;
  const okY = missing === "TL" || missing === "TR" ? Math.abs(box.y0 - top) <= tol : Math.abs(box.y1 - bottom) <= tol;
  if (!okX || !okY) return rect;
  return { components: [...others, ...pieces], corners: [...rect.corners, missing] };
}
