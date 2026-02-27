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

function fallbackId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return fallbackId();
}

export function readLocalStore(): LocalStore {
  const empty: LocalStore = { projects: [], time_entries: [], upload_history: [] };
  if (typeof window === "undefined") return empty;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<LocalStore>;
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      time_entries: Array.isArray(parsed.time_entries) ? parsed.time_entries : [],
      upload_history: Array.isArray(parsed.upload_history) ? parsed.upload_history : [],
    };
  } catch {
    return empty;
  }
}

export function writeLocalStore(store: LocalStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
