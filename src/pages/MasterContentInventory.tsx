import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LibraryBig, Database, Link2, ListChecks } from "lucide-react";

export default function MasterContentInventory() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Master Content Inventory</h1>
        <p className="text-muted-foreground">
          Future home for a full-library index beyond active production projects.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LibraryBig className="h-5 w-5 text-primary" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This module will evolve into a unified catalog of all course assets, historical metadata, quality signals,
            version lineage, and lifecycle status.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="h-4 w-4" /> Metadata Coverage
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Planned fields: content IDs, owners, release windows, lifecycle stage, and retirement flags.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Link2 className="h-4 w-4" /> Source Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Planned connectors: LMS exports, authoring repositories, and quality/feedback systems.
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="secondary" className="gap-1"><ListChecks className="h-3.5 w-3.5" /> Schema Planning</Badge>
            <Badge variant="outline">Catalog Normalization</Badge>
            <Badge variant="outline">Cross-System Keys</Badge>
            <Badge variant="outline">Version Tracking</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
