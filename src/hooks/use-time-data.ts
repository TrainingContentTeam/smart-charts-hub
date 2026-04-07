import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { readLocalStore } from "@/lib/local-data-store";

const DEV_BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      if (DEV_BYPASS_AUTH) {
        const local = await readLocalStore();
        return [...local.projects]
          .filter((p) => String((p as any).data_source || "").toLowerCase() !== "time_only")
          .sort((a, b) => a.name.localeCompare(b.name));
      }
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .neq("data_source", "time_only")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useTimeEntries() {
  return useQuery({
    queryKey: ["time_entries"],
    queryFn: async () => {
      if (DEV_BYPASS_AUTH) {
        const local = await readLocalStore();
        return [...local.time_entries].sort((a, b) => b.created_at.localeCompare(a.created_at));
      }
      // Fetch all time entries (may exceed 1000 rows)
      let allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("time_entries")
          .select("*, projects(name)")
          .order("created_at", { ascending: false })
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < batchSize) break;
        from += batchSize;
      }
      return allData;
    },
  });
}

export function useUploadHistory() {
  return useQuery({
    queryKey: ["upload_history"],
    queryFn: async () => {
      if (DEV_BYPASS_AUTH) {
        const local = await readLocalStore();
        return [...local.upload_history].sort((a, b) => b.created_at.localeCompare(a.created_at));
      }
      const { data, error } = await supabase
        .from("upload_history")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCatalogUploadHistory() {
  return useQuery({
    queryKey: ["catalog_upload_history"],
    queryFn: async () => {
      if (DEV_BYPASS_AUTH) {
        const local = await readLocalStore();
        return [...local.upload_history]
          .filter((row) => String(row.dataset_type || "").startsWith("catalog_"))
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
      }
      const { data, error } = await supabase
        .from("upload_history")
        .select("*")
        .like("dataset_type", "catalog_%")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSmeSurveys() {
  return useQuery({
    queryKey: ["sme_surveys"],
    queryFn: async () => {
      if (DEV_BYPASS_AUTH) {
        const local = await readLocalStore();
        return [...local.sme_surveys].sort((a, b) => b.created_at.localeCompare(a.created_at));
      }
      const { data, error } = await supabase
        .from("sme_collaboration_surveys")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useLmsCourseInfo() {
  return useQuery({
    queryKey: ["lms_course_info"],
    queryFn: async () => {
      if (DEV_BYPASS_AUTH) {
        const local = await readLocalStore();
        return [...local.lms_course_info].sort((a, b) => a.course_id.localeCompare(b.course_id));
      }
      const allRows: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("lms_course_info")
          .select("*")
          .order("course_id")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        allRows.push(...(data || []));
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      return allRows;
    },
  });
}

export function useLmsCourseVersions() {
  return useQuery({
    queryKey: ["lms_course_versions"],
    queryFn: async () => {
      if (DEV_BYPASS_AUTH) {
        const local = await readLocalStore();
        return [...local.lms_course_versions].sort((a, b) =>
          a.course_id.localeCompare(b.course_id) || a.course_version.localeCompare(b.course_version),
        );
      }
      const allRows: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("lms_course_versions")
          .select("*")
          .order("course_id")
          .order("course_version")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        allRows.push(...(data || []));
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      return allRows;
    },
  });
}
