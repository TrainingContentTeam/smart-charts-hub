import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function Accreditation() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Accreditation</h1>
        <p className="text-muted-foreground">This area is currently under construction.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Construction className="h-4 w-4 text-primary" />
            Accreditation (Under Construction)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Accreditation workflows, reporting views, and progress summaries will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
