export type Point = { x: number; y: number };

export type RoundedRectOptions = {
  arcSteps?: number;
  /**
   * Inicia o caminho no meio do lado maior, em vez de rente ao primeiro canto.
   * Assim a lamina desce, percorre um trecho reto para se alinhar e so entao
   * encontra o primeiro arco, igual aos demais cantos.
   */
  startMidSide?: boolean;
  /**
   * Sobrecorte no fechamento (mm): estende o fim do caminho alem do ponto
   * inicial, seguindo a direcao da reta de fechamento.
   */
  overcutMm?: number;
};

/**
 * Polilinha fechada de um retangulo com cantos arredondados.
 * Os arcos sao subdivididos (nunca um unico ponto por canto).
 */
export function roundedRectPoints(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  options: RoundedRectOptions = {},
): Point[] {
  const arcSteps = options.arcSteps ?? 8;
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));

  if (r <= 0.0001) {
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
      { x, y },
    ];
  }

  if (!options.startMidSide) {
    const pts: Point[] = [];
    const arc = (cx: number, cy: number, a0: number, a1: number) => {
      for (let i = 0; i <= arcSteps; i++) {
        const a = ((a0 + ((a1 - a0) * i) / arcSteps) * Math.PI) / 180;
        pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
    };

    arc(x + w - r, y + r, -90, 0);
    arc(x + w - r, y + h - r, 0, 90);
    arc(x + r, y + h - r, 90, 180);
    arc(x + r, y + r, 180, 270);
    pts.push({ ...pts[0]! });

    return pts;
  }

  // Caminho com inicio no meio do lado maior (sentido horario).
  const pts: Point[] = [];
  const arc = (cx: number, cy: number, a0: number, a1: number, skipFirst: boolean) => {
    for (let i = 0; i <= arcSteps; i++) {
      if (skipFirst && i === 0) continue;
      const a = ((a0 + ((a1 - a0) * i) / arcSteps) * Math.PI) / 180;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  };
  const ext = Math.max(0, options.overcutMm ?? 0);

  if (w >= h) {
    // Inicio no meio da aresta superior, andando para a direita.
    const mx = x + w / 2;
    const my = y;
    // O sobrecorte nao pode passar da tangencia do primeiro canto.
    const e = Math.min(ext, Math.max(0, w / 2 - r));

    pts.push({ x: mx, y: my });
    pts.push({ x: x + w - r, y });
    arc(x + w - r, y + r, -90, 0, true); // canto superior direito
    pts.push({ x: x + w, y: y + h - r });
    arc(x + w - r, y + h - r, 0, 90, true); // canto inferior direito
    pts.push({ x: x + r, y: y + h });
    arc(x + r, y + h - r, 90, 180, true); // canto inferior esquerdo
    pts.push({ x, y: y + r });
    arc(x + r, y + r, 180, 270, true); // canto superior esquerdo
    pts.push({ x: mx + e, y: my }); // fecha passando e mm do inicio
  } else {
    // Inicio no meio da aresta esquerda, andando para cima.
    const mx = x;
    const my = y + h / 2;
    const e = Math.min(ext, Math.max(0, h / 2 - r));

    pts.push({ x: mx, y: my });
    pts.push({ x, y: y + r });
    arc(x + r, y + r, 180, 270, true); // canto superior esquerdo
    pts.push({ x: x + w - r, y });
    arc(x + w - r, y + r, -90, 0, true); // canto superior direito
    pts.push({ x: x + w, y: y + h - r });
    arc(x + w - r, y + h - r, 0, 90, true); // canto inferior direito
    pts.push({ x: x + r, y: y + h });
    arc(x + r, y + h - r, 90, 180, true); // canto inferior esquerdo
    pts.push({ x: mx, y: my - e }); // fecha passando e mm do inicio
  }

  return pts;
}
