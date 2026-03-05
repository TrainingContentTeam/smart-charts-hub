export type LocalProject = {
  id: string;
  name: string;
  status: string;
  total_hours: number;
  data_source: string;
  reporting_year: string;
  id_assigned?: string;
  sme?: string;
  legal_reviewer?: string;
  vertical?: string;
  course_type?: string;
  authoring_tool?: string;
  course_style?: string;
  course_length?: string;
  interaction_count?: number | null;
  user_id?: string;
  created_at: string;
  updated_at: string;
};

export type LocalTimeEntry = {
  id: string;
  project_id: string | null;
  phase: string;
  hours: number;
  category: string;
  entry_date: string | null;
  user_name: string;
  upload_id: string;
  user_id?: string;
  created_at: string;
};

export type LocalUploadHistory = {
  id: string;
  file_name: string;
  row_count: number;
  status: string;
  user_id?: string;
  created_at: string;
};

type LocalStore = {
  projects: LocalProject[];
  time_entries: LocalTimeEntry[];
  upload_history: LocalUploadHistory[];
};

const STORAGE_KEY = "smart_charts_local_store_v1";
const DB_NAME = "smart_charts_local_db_v1";
const DB_STORE = "kv";

function fallbackId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return fallbackId();
}

function sanitizeStore(parsed: Partial<LocalStore> | null | undefined): LocalStore {
  return {
    projects: Array.isArray(parsed?.projects) ? parsed.projects : [],
    time_entries: Array.isArray(parsed?.time_entries) ? parsed.time_entries : [],
    upload_history: Array.isArray(parsed?.upload_history) ? parsed.upload_history : [],
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
  const empty: LocalStore = { projects: [], time_entries: [], upload_history: [] };
  if (typeof window === "undefined") return empty;

  try {
    const idbValue = await idbGet<LocalStore>(STORAGE_KEY);
    if (idbValue) return sanitizeStore(idbValue);
  } catch {
    // Fallback to localStorage path below.
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<LocalStore>;
    const sanitized = sanitizeStore(parsed);
    // Best-effort migration from localStorage to IndexedDB.
    try {
      await idbSet(STORAGE_KEY, sanitized);
    } catch {
      // no-op
    }
    return sanitized;
  } catch {
    return empty;
  }
}

export async function writeLocalStore(store: LocalStore): Promise<void> {
  if (typeof window === "undefined") return;
  const sanitized = sanitizeStore(store);

  // Primary: IndexedDB (larger quota).
  await idbSet(STORAGE_KEY, sanitized);

  // Best-effort compatibility write; ignore quota overflow.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Ignore quota errors from localStorage now that IndexedDB is the source of truth.
  }
}
