// O parse/render do PDF roda no worker do pdf.js, dentro do navegador.
// O import e dinamico para que nada do pdf.js execute na renderizacao do servidor.
type Pdfjs = typeof import("pdfjs-dist");

let cached: Pdfjs | null = null;

/**
 * O pdf.js 6 usa Map.prototype.getOrInsert/getOrInsertComputed, que ainda nao
 * existe nos navegadores atuais. Sem isso a visualizacao das paginas falha.
 */
function polyfillMapHelpers() {
  const proto = Map.prototype as unknown as Record<string, unknown>;
  if (typeof proto["getOrInsert"] !== "function") {
    proto["getOrInsert"] = function <K, V>(this: Map<K, V>, key: K, value: V): V {
      if (!this.has(key)) this.set(key, value);
      return this.get(key)!;
    };
  }
  if (typeof proto["getOrInsertComputed"] !== "function") {
    proto["getOrInsertComputed"] = function <K, V>(
      this: Map<K, V>,
      key: K,
      compute: (key: K) => V,
    ): V {
      if (!this.has(key)) this.set(key, compute(key));
      return this.get(key)!;
    };
  }
}

export async function getPdfjs(): Promise<Pdfjs> {
  if (cached) return cached;
  polyfillMapHelpers();
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  cached = pdfjs;
  return pdfjs;
}

export type Matrix = [number, number, number, number, number, number];

export function applyMatrix(m: Matrix, x: number, y: number): { x: number; y: number } {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
