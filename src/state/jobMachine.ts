export type JobState =
  | "idle"
  | "pdf-loading"
  | "pdf-ready"
  | "device-connecting"
  | "device-ready"
  | "registering"
  | "registered"
  | "blade-configuring"
  | "cutting"
  | "finalizing"
  | "complete"
  | "error";

export type JobEvent =
  | { type: "PDF_LOAD" }
  | { type: "PDF_LOADED" }
  | { type: "PDF_FAILED" }
  | { type: "CONNECT" }
  | { type: "DEVICE_READY" }
  | { type: "REGISTER" }
  | { type: "REGISTERED" }
  | { type: "CONFIGURE_BLADE" }
  | { type: "CUT" }
  | { type: "FINALIZE" }
  | { type: "DONE" }
  | { type: "FAIL" }
  | { type: "RESET" };

const TRANSITIONS: Record<JobState, Partial<Record<JobEvent["type"], JobState>>> = {
  idle: { PDF_LOAD: "pdf-loading" },
  "pdf-loading": { PDF_LOADED: "pdf-ready", PDF_FAILED: "error", FAIL: "error" },
  "pdf-ready": { PDF_LOAD: "pdf-loading", CONNECT: "device-connecting", FAIL: "error" },
  "device-connecting": { DEVICE_READY: "device-ready", FAIL: "error" },
  "device-ready": { REGISTER: "registering", DONE: "pdf-ready", FAIL: "error" },
  registering: { REGISTERED: "registered", FAIL: "error" },
  registered: { CONFIGURE_BLADE: "blade-configuring", DONE: "pdf-ready", FAIL: "error" },
  "blade-configuring": { CUT: "cutting", FAIL: "error" },
  cutting: { FINALIZE: "finalizing", FAIL: "error" },
  finalizing: { DONE: "complete", FAIL: "error" },
  complete: { RESET: "pdf-ready", PDF_LOAD: "pdf-loading" },
  error: { RESET: "idle", PDF_LOAD: "pdf-loading" },
};

export function nextJobState(state: JobState, event: JobEvent): JobState {
  return TRANSITIONS[state][event.type] ?? state;
}

/** Um job de hardware por vez. */
export const BUSY_STATES: JobState[] = [
  "device-connecting",
  "registering",
  "blade-configuring",
  "cutting",
  "finalizing",
];

export function isJobBusy(state: JobState): boolean {
  return BUSY_STATES.includes(state);
}

export const JOB_STATE_LABELS: Record<JobState, string> = {
  idle: "Aguardando arquivo",
  "pdf-loading": "Lendo arquivo",
  "pdf-ready": "Folhas prontas",
  "device-connecting": "Conectando à Cameo",
  "device-ready": "Cameo pronta",
  registering: "Lendo marcas",
  registered: "Marcas lidas",
  "blade-configuring": "Configurando lâmina",
  cutting: "Cortando",
  finalizing: "Finalizando",
  complete: "Concluído",
  error: "Problema encontrado",
};
