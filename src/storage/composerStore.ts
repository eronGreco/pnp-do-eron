import type {
  ComposerCard,
  ComposerConfig,
  ComposerImage,
} from "@/composer/types";
import type { ImportMode } from "@/composer/useComposer";
import type { StoredCricutMarksTemplate } from "@/cricut/markTemplate";

/**
 * Persistencia do trabalho do Montar cartas, SOMENTE no navegador do
 * usuario (IndexedDB). Nenhum byte de imagem sai da maquina.
 */

const DB_NAME = "pnp-cameo-studio";
const DB_VERSION = 1;
const STORE = "composer";
const STATE_KEY = "state";

export type StoredImage = Omit<ComposerImage, "previewUrl">;

export type StoredComposerState = {
  images: StoredImage[];
  cards: ComposerCard[];
  config: ComposerConfig;
  importMode: ImportMode;
  cricutMarks?: StoredCricutMarksTemplate | null;
};

/** Backend em memoria para ambientes sem IndexedDB (testes). */
const memory = new Map<string, StoredComposerState>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("idb open failed"));
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<StoredComposerState | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () =>
      resolve((request.result as StoredComposerState | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("idb get failed"));
  });
}

function idbPut(db: IDBDatabase, key: string, value: StoredComposerState): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb put failed"));
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb delete failed"));
  });
}

export async function saveComposerState(state: StoredComposerState): Promise<void> {
  if (!hasIndexedDb()) {
    memory.set(STATE_KEY, state);
    return;
  }
  const db = await openDb();
  try {
    await idbPut(db, STATE_KEY, state);
  } finally {
    db.close();
  }
}

export async function loadComposerState(): Promise<StoredComposerState | null> {
  if (!hasIndexedDb()) {
    return memory.get(STATE_KEY) ?? null;
  }
  const db = await openDb();
  try {
    return await idbGet(db, STATE_KEY);
  } finally {
    db.close();
  }
}

export async function clearComposerState(): Promise<void> {
  if (!hasIndexedDb()) {
    memory.delete(STATE_KEY);
    return;
  }
  const db = await openDb();
  try {
    await idbDelete(db, STATE_KEY);
  } finally {
    db.close();
  }
}

/** Recria as miniaturas (blob URLs) a partir dos bytes salvos. */
export function reviveImages(stored: StoredImage[]): ComposerImage[] {
  return stored.map((image) => ({
    ...image,
    previewUrl: URL.createObjectURL(new Blob([image.bytes.slice(0)], { type: image.mime })),
  }));
}
