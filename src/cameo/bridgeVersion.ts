/**
 * Conferencia de versao entre o site e o programa local.
 *
 * Sempre que o bridge mudar (local-bridge/bridge.py -> VERSION),
 * atualize REQUIRED_BRIDGE_VERSION aqui para o site avisar o usuario
 * que existe um pacote novo para baixar.
 */
export const REQUIRED_BRIDGE_VERSION = "1.0.3";

function parts(version: string): number[] {
  return version
    .trim()
    .split(".")
    .map((piece) => Number.parseInt(piece, 10) || 0);
}

/** -1 = a menor, 0 = iguais, 1 = a maior. */
export function compareVersions(a: string, b: string): number {
  const left = parts(a);
  const right = parts(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l !== r) return l < r ? -1 : 1;
  }
  return 0;
}

export type BridgeHealth = {
  online: boolean;
  /** versao informada pelo programa local, quando disponivel */
  version: string | null;
  /** true quando a versao instalada e mais antiga que a exigida pelo site */
  outdated: boolean;
  /** true quando o programa local e mais novo que o site conhece */
  ahead: boolean;
};

export const OFFLINE_HEALTH: BridgeHealth = {
  online: false,
  version: null,
  outdated: false,
  ahead: false,
};

export function evaluateBridgeVersion(version: string | null | undefined): BridgeHealth {
  if (!version) {
    // Programa local respondeu, mas e antigo demais para informar a versao.
    return { online: true, version: null, outdated: true, ahead: false };
  }
  const diff = compareVersions(version, REQUIRED_BRIDGE_VERSION);
  return {
    online: true,
    version,
    outdated: diff < 0,
    ahead: diff > 0,
  };
}
