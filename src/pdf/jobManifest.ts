import type { Card, CutSettings, Rect, Sheet } from "@/cameo/types";

/**
 * Receita de corte gravada dentro do PDF gerado pelo sistema.
 * Contem apenas geometria e parametros: nunca imagem, nunca conteudo da arte.
 * Assim o usuario pode reabrir aqui um PDF que ele mesmo gerou e cortar depois,
 * sem redetectar nada e sem digitar valores.
 */

const PREFIX = "PNPCAMEO1:";

type MRect = [number, number, number, number];

type MCard = {
  n: number;
  c: MRect;
  i: MRect;
  fr?: MRect;
  br?: MRect;
  fd?: MRect;
  z?: 1;
  h?: 1;
};

type MSheet = {
  n: number;
  f: number;
  b: number | null;
  w: number;
  h: number;
  a?: "g";
  r?: 1;
  c: MCard[];
};

type Manifest = {
  v: 1;
  s: MSheet[];
  t?: CutSettings;
};

export type JobManifest = {
  sheets: Sheet[];
  settings?: CutSettings;
};

function r2(value: number): number {
  return Math.round(value * 100) / 100;
}

function rectOut(rect: Rect): MRect {
  return [r2(rect.x0), r2(rect.y0), r2(rect.x1), r2(rect.y1)];
}

function rectIn(rect: MRect): Rect {
  return { x0: rect[0], y0: rect[1], x1: rect[2], y1: rect[3] };
}

function toBase64(text: string): string {
  if (typeof btoa === "function") return btoa(text);
  return Buffer.from(text, "binary").toString("base64");
}

function fromBase64(text: string): string {
  if (typeof atob === "function") return atob(text);
  return Buffer.from(text, "base64").toString("binary");
}

export function encodeJobManifest(sheets: Sheet[], settings?: CutSettings): string {
  const manifest: Manifest = {
    v: 1,
    s: sheets.map((sheet) => {
      const out: MSheet = {
        n: sheet.number,
        f: sheet.frontPageIndex,
        b: sheet.backPageIndex,
        w: r2(sheet.pageWidthMm),
        h: r2(sheet.pageHeightMm),
        c: sheet.cards.map((card) => {
          const mc: MCard = {
            n: card.number,
            c: rectOut(card.cutRectMm),
            i: rectOut(card.imageRectMm),
          };
          if (card.frontRectMm) mc.fr = rectOut(card.frontRectMm);
          if (card.backRectMm) mc.br = rectOut(card.backRectMm);
          if (card.foldRectMm) mc.fd = rectOut(card.foldRectMm);
          if (card.inSensorSafeZone) mc.z = 1;
          if (card.hitsRegistrationMark) mc.h = 1;
          return mc;
        }),
      };
      if (sheet.assemblyMode === "gutterfold") out.a = "g";
      if (sheet.rotated) out.r = 1;
      return out;
    }),
  };
  if (settings) manifest.t = settings;
  return PREFIX + toBase64(JSON.stringify(manifest));
}

export function decodeJobManifestString(value: string | null | undefined): JobManifest | null {
  if (!value) return null;
  const start = value.indexOf(PREFIX);
  if (start < 0) return null;
  const payload = value.slice(start + PREFIX.length).trim();
  try {
    const parsed = JSON.parse(fromBase64(payload)) as Manifest;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.s)) return null;
    const sheets: Sheet[] = parsed.s.map((sheet) => ({
      number: sheet.n,
      frontPageIndex: sheet.f,
      backPageIndex: sheet.b,
      assemblyMode: sheet.a === "g" ? "gutterfold" : "normal",
      pageWidthMm: sheet.w,
      pageHeightMm: sheet.h,
      rotated: sheet.r === 1,
      cards: sheet.c.map<Card>((card) => {
        const out: Card = {
          id: `s${sheet.n}-c${card.n}`,
          sheetNumber: sheet.n,
          number: card.n,
          cutRectMm: rectIn(card.c),
          imageRectMm: rectIn(card.i),
          selected: true,
          inSensorSafeZone: card.z === 1,
          hitsRegistrationMark: card.h === 1,
        };
        if (card.fr) out.frontRectMm = rectIn(card.fr);
        if (card.br) out.backRectMm = rectIn(card.br);
        if (card.fd) out.foldRectMm = rectIn(card.fd);
        return out;
      }),
    }));
    return parsed.t ? { sheets, settings: parsed.t } : { sheets };
  } catch {
    return null;
  }
}

function latin1(bytes: Uint8Array): string {
  let out = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    out += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return out;
}

function hexToText(hex: string): string {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const codes: number[] = [];
  for (let i = 0; i + 1 < clean.length; i += 2) {
    codes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  // UTF-16BE quando ha BOM FEFF, senao bytes simples.
  if (codes[0] === 0xfe && codes[1] === 0xff) {
    let text = "";
    for (let i = 2; i + 1 < codes.length; i += 2) {
      text += String.fromCharCode((codes[i]! << 8) | codes[i + 1]!);
    }
    return text;
  }
  return String.fromCharCode(...codes);
}

/**
 * Le a receita de corte direto dos bytes do PDF (campo Keywords do Info).
 * Nao depende do pdf.js e roda 100% no computador do usuario.
 */
export async function readJobManifest(bytes: ArrayBuffer): Promise<JobManifest | null> {
  const raw = latin1(new Uint8Array(bytes.slice(0)));
  let from = 0;
  while (true) {
    const at = raw.indexOf("/Keywords", from);
    if (at < 0) return null;
    from = at + 9;
    const rest = raw.slice(from, from + 200_000);
    const hex = /^\s*<([^>]*)>/.exec(rest);
    if (hex) {
      const found = decodeJobManifestString(hexToText(hex[1]!));
      if (found) return found;
      continue;
    }
    const literal = /^\s*\(((?:\\.|[^\\)])*)\)/.exec(rest);
    if (literal) {
      const found = decodeJobManifestString(literal[1]!.replace(/\\([()\\])/g, "$1"));
      if (found) return found;
    }
  }
}
