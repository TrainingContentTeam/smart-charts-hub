import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export function CollaborationSurveyComingSoon() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          SME & Assigned ID Collaboration Surveys (Coming Soon)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This section will host collaboration survey outcomes for SMEs and Assigned IDs,
          including response trends, quality signals, and project-level collaboration notes.
        </p>
      </CardContent>
    </Card>
  );
}
