import { useMemo } from "react";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";

export function useProjects() {
  const query = useAnalyticsSnapshot();
  const data = useMemo(() => query.data?.canonicalProjects ?? [], [query.data]);
  return { ...query, data };
}

export function useTimeEntries() {
  const query = useAnalyticsSnapshot();
  const data = useMemo(() => query.data?.timeLogs ?? [], [query.data]);
  return { ...query, data };
}

export function useUploadHistory() {
  const query = useAnalyticsSnapshot();
  const data = useMemo(() => query.data?.uploadHistory ?? [], [query.data]);
  return { ...query, data };
}

export function useSmeSurveys() {
  const query = useAnalyticsSnapshot();
  const data = useMemo(
    () => ({
      idView: query.data?.smeFeedbackIdView ?? [],
      smeView: query.data?.smeFeedbackSmeView ?? [],
      audit: query.data?.smeJoinAudit ?? [],
    }),
    [query.data],
  );
  return { ...query, data };
}
