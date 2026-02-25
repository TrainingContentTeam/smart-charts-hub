import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useTimeEntries() {
  return useQuery({
    queryKey: ["time_entries"],
    queryFn: async () => {
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
      const { data, error } = await supabase
        .from("upload_history")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
