import { useQuery } from "@tanstack/react-query";
import { fetchAnalyticsPersistenceBundle } from "@/lib/analytics/persistence";
import { buildAnalyticsSnapshot } from "@/lib/analytics/snapshot";
import { readLocalStore } from "@/lib/local-data-store";

const DEV_BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true";

export function useAnalyticsSnapshot() {
  return useQuery({
    queryKey: ["analytics_snapshot"],
    queryFn: async () => {
      const bundle = DEV_BYPASS_AUTH
        ? await readLocalStore()
        : await fetchAnalyticsPersistenceBundle();

      return buildAnalyticsSnapshot(bundle);
    },
  });
}
