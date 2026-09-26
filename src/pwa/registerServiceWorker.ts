/**
 * Registro unico do service worker do app.
 *
 * O registro e recusado em desenvolvimento e em contextos de preview
 * para evitar cache persistente durante testes e edicao.
 */
const SW_URL = "/sw.js";

function blockedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (new URLSearchParams(window.location.search).has("sw") &&
      new URLSearchParams(window.location.search).get("sw") === "off") {
    return true;
  }
  return false;
}

async function unregisterAppWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      registrations
        .filter((registration) => {
          const url =
            registration.active?.scriptURL ??
            registration.waiting?.scriptURL ??
            registration.installing?.scriptURL ??
            "";
          return url.endsWith(SW_URL);
        })
        .map((registration) => registration.unregister()),
    );
  } catch {
    // Sem service worker disponivel: nada a fazer.
  }
}

/** true quando o app realmente registrou o service worker. */
export async function registerServiceWorker(): Promise<boolean> {
  if (blockedContext()) {
    await unregisterAppWorker();
    return false;
  }
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    await navigator.serviceWorker.register(SW_URL, { scope: "/" });
    return true;
  } catch {
    return false;
  }
}

export function serviceWorkerEnabled(): boolean {
  return (
    !blockedContext() && typeof navigator !== "undefined" && "serviceWorker" in navigator
  );
}
