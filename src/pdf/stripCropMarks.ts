import { MM_PER_PT } from "@/cut/silhouetteUnits";
import { isCropMarkSegment, type Segment } from "./detectCropMarks";
import { applyMatrix, multiply, type Matrix } from "./pdfjs";

const CONSTRUCT_OPS = new Set(["m", "l", "c", "v", "y", "re", "h"]);
const PAINT_OPS = new Set(["S", "s", "f", "F", "f*", "B", "B*", "b", "b*", "n"]);
const CLIP_OPS = new Set(["W", "W*"]);

type Token = { text: string; isNumber: boolean };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i]!;

    if (ch === "(") {
      let depth = 1;
      let j = i + 1;
      while (j < source.length && depth > 0) {
        if (source[j] === "\\") j += 2;
        else {
          if (source[j] === "(") depth++;
          if (source[j] === ")") depth--;
          j++;
        }
      }
      tokens.push({ text: source.slice(i, j), isNumber: false });
      i = j;
      continue;
    }

    if (ch === "<" || ch === "[") {
      const close = ch === "<" ? ">" : "]";
      const end = source.indexOf(close, i);
      const j = end === -1 ? source.length : end + 1;
      tokens.push({ text: source.slice(i, j), isNumber: false });
      i = j;
      continue;
    }

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    let j = i;
    while (j < source.length && !/[\s([<]/.test(source[j]!)) j++;
    const text = source.slice(i, j);
    tokens.push({ text, isNumber: /^[+-]?(\d+\.?\d*|\.\d+)$/.test(text) });
    i = j;
  }

  return tokens;
}

function segmentsFromPath(tokens: Token[], ctm: Matrix): Segment[] {
  const toMm = (x: number, y: number) => {
    const p = applyMatrix(ctm, x, y);
    return { x: p.x * MM_PER_PT, y: p.y * MM_PER_PT };
  };

  const segments: Segment[] = [];
  const numbers: number[] = [];
  let current: { x: number; y: number } | null = null;
  let start: { x: number; y: number } | null = null;

  const push = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });

  for (const token of tokens) {
    if (token.isNumber) {
      numbers.push(Number(token.text));
      continue;
    }

    const op = token.text;
    if (op === "m" && numbers.length >= 2) {
      current = toMm(numbers[numbers.length - 2]!, numbers[numbers.length - 1]!);
      start = current;
    } else if (op === "l" && numbers.length >= 2) {
      const next = toMm(numbers[numbers.length - 2]!, numbers[numbers.length - 1]!);
      if (current) push(current, next);
      current = next;
    } else if (op === "c" && numbers.length >= 6) {
      current = toMm(numbers[numbers.length - 2]!, numbers[numbers.length - 1]!);
    } else if ((op === "v" || op === "y") && numbers.length >= 4) {
      current = toMm(numbers[numbers.length - 2]!, numbers[numbers.length - 1]!);
    } else if (op === "h") {
      if (current && start) push(current, start);
      current = start;
    } else if (op === "re" && numbers.length >= 4) {
      const [x, y, w, h] = numbers.slice(-4) as [number, number, number, number];
      const p0 = toMm(x, y);
      const p1 = toMm(x + w, y + h);
      const x0 = Math.min(p0.x, p1.x);
      const x1 = Math.max(p0.x, p1.x);
      const y0 = Math.min(p0.y, p1.y);
      const y1 = Math.max(p0.y, p1.y);
      if (Math.min(x1 - x0, y1 - y0) <= 0.35) {
        if (x1 - x0 >= y1 - y0) {
          push({ x: x0, y: (y0 + y1) / 2 }, { x: x1, y: (y0 + y1) / 2 });
        } else {
          push({ x: (x0 + x1) / 2, y: y0 }, { x: (x0 + x1) / 2, y: y1 });
        }
      } else {
        push({ x: x0, y: y0 }, { x: x1, y: y0 });
        push({ x: x1, y: y0 }, { x: x1, y: y1 });
        push({ x: x1, y: y1 }, { x: x0, y: y1 });
        push({ x: x0, y: y1 }, { x: x0, y: y0 });
      }
    }

    numbers.length = 0;
  }

  return segments;
}

export type StripResult = { content: string; removed: number };

/**
 * Remove SOMENTE as cruzes/crop marks vetoriais do PNP do content stream.
 *
 * As imagens (XObjects) e todas as demais instrucoes ficam intactas: nada e
 * rasterizado, recomprimido ou redimensionado.
 */
export function stripCropMarksFromContent(source: string): StripResult {
  const tokens = tokenize(source);
  const out: string[] = [];

  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  const numbers: number[] = [];

  let path: Token[] | null = null;
  let pathCtm: Matrix = ctm;
  let pathHasClip = false;
  let removed = 0;

  const flush = (keep: boolean) => {
    if (path && keep) out.push(path.map((t) => t.text).join(" "));
    else if (path) removed++;
    path = null;
    pathHasClip = false;
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;

    if (token.isNumber) {
      numbers.push(Number(token.text));
      continue;
    }

    const op = token.text;

    if (op === "BI") {
      // Imagem inline: copiada literalmente ate EI.
      let j = i;
      const chunk: string[] = [];
      while (j < tokens.length && tokens[j]!.text !== "EI") {
        chunk.push(tokens[j]!.text);
        j++;
      }
      chunk.push("EI");
      flush(true);
      out.push(chunk.join(" "));
      i = j;
      numbers.length = 0;
      continue;
    }

    if (path && CLIP_OPS.has(op)) {
      pathHasClip = true;
      path.push(token);
      numbers.length = 0;
      continue;
    }

    if (CONSTRUCT_OPS.has(op)) {
      if (!path) {
        path = [];
        pathCtm = ctm;
      }
      for (const n of numbers) path.push({ text: String(n), isNumber: true });
      path.push(token);
      numbers.length = 0;
      continue;
    }

    if (path && PAINT_OPS.has(op)) {
      path.push(token);
      const segments = segmentsFromPath(path, pathCtm);
      const isCropMark =
        !pathHasClip && segments.length > 0 && segments.every((s) => isCropMarkSegment(s));
      flush(!isCropMark);
      numbers.length = 0;
      continue;
    }

    flush(true);

    if (op === "q") stack.push(ctm);
    else if (op === "Q") ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (op === "cm" && numbers.length >= 6) {
      ctm = multiply(ctm, numbers.slice(-6) as Matrix);
    }

    out.push([...numbers.map(String), op].join(" "));
    numbers.length = 0;
  }

  flush(true);

  return { content: out.join("\n"), removed };
}
