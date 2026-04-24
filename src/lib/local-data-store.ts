import type { AnalyticsPersistenceBundle } from "@/lib/analytics/types";

export type LocalStore = AnalyticsPersistenceBundle;

const STORAGE_KEY = "smart_charts_local_store_v2";
const DB_NAME = "smart_charts_local_db_v2";
const DB_STORE = "kv";

function fallbackId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return fallbackId();
}

function emptyStore(): LocalStore {
  return {
    uploadHistory: [],
    rawProjectImportRows: [],
    rawTimeLogRows: [],
    rawSmeFeedbackRows: [],
    courseAliasConfig: [],
    personAliasConfig: [],
    personRoleConfig: [],
    smeManualJoinOverrides: [],
    workEntityDecisions: [],
  };
}

function migrateLegacySmeRow(row: Record<string, unknown>): Record<string, unknown> {
  const legacy = (row.id_survey_date ?? row.sme_survey_date ?? row.survey_date) as unknown;
  const surveyDate = typeof legacy === "string" ? legacy : null;

  // Strip removed legacy keys; collapse to a single survey_date.
  const {
    id_survey_raw_created: _r,
    id_survey_created_at: _c,
    id_survey_date: _idd,
    id_survey_date_source: _ids,
    sme_survey_raw_date: _srd,
    sme_survey_date: _smd,
    sme_survey_date_source: _sds,
    ...rest
  } = row as Record<string, unknown>;

  return { ...rest, survey_date: surveyDate };
}

function sanitizeStore(parsed: Partial<LocalStore> | null | undefined): LocalStore {
  return {
    uploadHistory: Array.isArray(parsed?.uploadHistory) ? parsed.uploadHistory : [],
    rawProjectImportRows: Array.isArray(parsed?.rawProjectImportRows) ? parsed.rawProjectImportRows : [],
    rawTimeLogRows: Array.isArray(parsed?.rawTimeLogRows) ? parsed.rawTimeLogRows : [],
    rawSmeFeedbackRows: Array.isArray(parsed?.rawSmeFeedbackRows)
      ? (parsed.rawSmeFeedbackRows.map((row) =>
          migrateLegacySmeRow(row as unknown as Record<string, unknown>),
        ) as unknown as LocalStore["rawSmeFeedbackRows"])
      : [],
    courseAliasConfig: Array.isArray(parsed?.courseAliasConfig) ? parsed.courseAliasConfig : [],
    personAliasConfig: Array.isArray(parsed?.personAliasConfig) ? parsed.personAliasConfig : [],
    personRoleConfig: Array.isArray(parsed?.personRoleConfig) ? parsed.personRoleConfig : [],
    smeManualJoinOverrides: Array.isArray(parsed?.smeManualJoinOverrides) ? parsed.smeManualJoinOverrides : [],
    workEntityDecisions: Array.isArray(parsed?.workEntityDecisions) ? parsed.workEntityDecisions : [],
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  return await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error || new Error("IndexedDB read failed"));
  });
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error("IndexedDB write failed"));
  });
}

export async function readLocalStore(): Promise<LocalStore> {
  if (typeof window === "undefined") return emptyStore();

  try {
    const idbValue = await idbGet<LocalStore>(STORAGE_KEY);
    if (idbValue) return sanitizeStore(idbValue);
  } catch {
    // Fallback to localStorage below.
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<LocalStore>;
    const sanitized = sanitizeStore(parsed);
    try {
      await idbSet(STORAGE_KEY, sanitized);
    } catch {
      // no-op
    }
    return sanitized;
  } catch {
    return emptyStore();
  }
}

export async function writeLocalStore(store: LocalStore): Promise<void> {
  if (typeof window === "undefined") return;
  const sanitized = sanitizeStore(store);
  await idbSet(STORAGE_KEY, sanitized);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Ignore localStorage quota issues when IndexedDB already succeeded.
  }
}
