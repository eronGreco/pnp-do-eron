/**
 * Espelha exatamente a leitura de resposta do registration no companion.
 *
 * CONGELADO: sucesso REAL e somente b"    0\x03" (quatro espacos, zero, ETX).
 * b"    1\x03" NAO e sucesso. b"   -1\x03" e falha.
 * Qualquer outra resposta em sessao exclusiva e erro de protocolo.
 */
export const REGISTRATION_SUCCESS = "    0\u0003";
export const REGISTRATION_IN_PROGRESS = "    1\u0003";
export const REGISTRATION_FAILURE = "   -1\u0003";

export type RegistrationResponse = "success" | "in-progress" | "failure" | "protocol-error";

export function parseRegistrationResponse(raw: string | Uint8Array): RegistrationResponse {
  const text =
    typeof raw === "string"
      ? raw
      : Array.from(raw)
          .map((byte) => String.fromCharCode(byte))
          .join("");

  if (text === REGISTRATION_SUCCESS) return "success";
  if (text === REGISTRATION_IN_PROGRESS) return "in-progress";
  if (text === REGISTRATION_FAILURE) return "failure";
  return "protocol-error";
}

/** Status ESC ENQ: 0 READY, 1 MOVING, 2 UNLOADED. */
export const STATUS_QUERY = "\u001b\u0005";
export const STATUS_READY = "0\u0003";
export const STATUS_MOVING = "1\u0003";
export const STATUS_UNLOADED = "2\u0003";
