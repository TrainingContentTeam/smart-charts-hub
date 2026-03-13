import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export function CollaborationSurveyComingSoon() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          SME & Assigned ID Survey Notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Survey analytics are available above. This section will populate when imported rows include
          open-ended SME or instructional designer comments.
        </p>
      </CardContent>
    </Card>
  );
}
