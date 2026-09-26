import type { CameoEvent, CutJob, DeviceStatus, RegistrationResult } from "./types";

/**
 * Abstracao de transporte. A aplicacao NUNCA fala com a maquina diretamente.
 * O transporte padrao no Windows e o LocalBridgeTransport (companion local).
 */
export interface CameoTransport {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<DeviceStatus>;
  readRegistrationMarks(): Promise<RegistrationResult>;
  cutJob(job: CutJob): Promise<void>;
  onEvent(callback: (event: CameoEvent) => void): () => void;
}

export class BridgeUnavailableError extends Error {
  constructor(message = "PNP Cameo Bridge não encontrado.") {
    super(message);
    this.name = "BridgeUnavailableError";
  }
}
