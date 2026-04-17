import type { JoinConfidence, SuggestionConfidence } from "@/lib/analytics/types";
import { Badge } from "@/components/ui/badge";

type ConfidenceBadgeProps = {
  confidence: JoinConfidence | SuggestionConfidence | "manual" | null;
};

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  if (!confidence) {
    return <Badge variant="outline">None</Badge>;
  }

  if (confidence === "high") {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">High</Badge>;
  }

  if (confidence === "medium") {
    return <Badge className="bg-amber-500 text-black hover:bg-amber-500">Medium</Badge>;
  }

  return <Badge variant="secondary">Manual</Badge>;
}

