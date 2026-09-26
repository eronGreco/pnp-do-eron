import { BridgeUnavailableError, type CameoTransport } from "./CameoTransport";
import {
  evaluateBridgeVersion,
  OFFLINE_HEALTH,
  type BridgeHealth,
} from "./bridgeVersion";
import type { CameoEvent, CutJob, DeviceStatus, RegistrationResult } from "./types";

/**
 * Fala com o companion local PNP Cameo Bridge.
 *
 * REGRAS:
 * - somente 127.0.0.1, nunca a rede local;
 * - envia SOMENTE geometria em mm e parametros de corte;
 * - nunca envia PDF, imagem, pixels ou caminho de arquivo.
 */
export const BRIDGE_ORIGIN = "http://127.0.0.1:8787";
const TOKEN_KEY = "pnp-cameo:bridge-token";

export class LocalBridgeTransport implements CameoTransport {
  readonly name = "PNP Cameo Bridge (local)";

  private listeners = new Set<(event: CameoEvent) => void>();
  private token: string | null = null;
  private stream: EventSource | null = null;

  onEvent(callback: (event: CameoEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: CameoEvent) {
    for (const listener of this.listeners) listener(event);
  }

  private storedToken(): string | null {
    if (this.token) return this.token;
    if (typeof window === "undefined") return null;
    this.token = window.localStorage.getItem(TOKEN_KEY);
    return this.token;
  }

  private async request<T>(path: string, body?: unknown): Promise<T> {
    const token = this.storedToken();
    let response: Response;

    try {
      response = await fetch(`${BRIDGE_ORIGIN}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Bridge-Token": token } : {}),
        },
        body: body === undefined ? null : JSON.stringify(body),
      });
    } catch {
      throw new BridgeUnavailableError();
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error("O companion recusou a sessão. Reabra o PNP Cameo Bridge.");
    }

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    } & Record<string, unknown>;

    if (!response.ok) {
      throw new Error(payload.error ?? "O companion retornou um erro.");
    }

    return payload as T;
  }

  async connect(): Promise<void> {
    const handshake = await this.request<{ token?: string; version?: string }>("/health");
    if (handshake.token && typeof window !== "undefined") {
      this.token = handshake.token;
      window.localStorage.setItem(TOKEN_KEY, handshake.token);
    }
    this.openEventStream();
    this.emit({ type: "diagnostic", message: `Bridge ${handshake.version ?? "?"} conectado.` });
  }

  async disconnect(): Promise<void> {
    this.stream?.close();
    this.stream = null;
  }

  /**
   * SSE em vez de WebSocket: o companion usa apenas a biblioteca padrao do Python.
   * O token vai na query porque EventSource nao permite cabecalhos.
   */
  private openEventStream() {
    if (typeof EventSource === "undefined" || this.stream) return;
    const token = this.storedToken();
    if (!token) return;
    try {
      const stream = new EventSource(
        `${BRIDGE_ORIGIN}/events?token=${encodeURIComponent(token)}`,
      );
      stream.onmessage = (message) => {
        try {
          this.emit(JSON.parse(String(message.data)) as CameoEvent);
        } catch {
          this.emit({ type: "diagnostic", message: String(message.data) });
        }
      };
      stream.onerror = () => {
        stream.close();
        this.stream = null;
      };
      this.stream = stream;
    } catch {
      this.stream = null;
    }
  }

  async testConnection(): Promise<DeviceStatus> {
    await this.connect();
    return this.request<DeviceStatus>("/test-connection", {});
  }

  async readRegistrationMarks(): Promise<RegistrationResult> {
    await this.connect();
    return this.request<RegistrationResult>("/read-marks", {});
  }

  /** Envia SOMENTE numeros: milimetros e parametros de corte. */
  async cutJob(job: CutJob): Promise<void> {
    await this.connect();
    await this.request<{ ok: boolean }>("/cut-job", {
      sheet: job.sheet,
      ...(job.sheetWidthMm && job.sheetHeightMm
        ? { sheetWidthMm: job.sheetWidthMm, sheetHeightMm: job.sheetHeightMm }
        : {}),
      cards: job.cards.map((rect) => ({
        x0Mm: rect.x0,
        y0Mm: rect.y0,
        x1Mm: rect.x1,
        y1Mm: rect.y1,
      })),
      settings: {
        depth: job.settings.depth,
        force: job.settings.force,
        speed: job.settings.speed,
        passes: job.settings.passes,
        radiusMm: job.settings.radiusMm,
        lineOvercut: job.settings.lineOvercut,
        lineOvercutMm: job.settings.lineOvercutMm,
      },
    });
  }
}

export async function isBridgeAvailable(): Promise<boolean> {
  return (await checkBridgeHealth()).online;
}

/** Confere se o programa local esta rodando E se a versao combina com a do site. */
export async function checkBridgeHealth(): Promise<BridgeHealth> {
  try {
    const response = await fetch(`${BRIDGE_ORIGIN}/health`);
    if (!response.ok) return OFFLINE_HEALTH;
    const payload = (await response.json().catch(() => ({}))) as { version?: string };
    return evaluateBridgeVersion(payload.version);
  } catch {
    return OFFLINE_HEALTH;
  }
}
