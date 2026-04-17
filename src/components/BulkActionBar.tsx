import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BulkActionBarProps = {
  selectedCount: number;
  children: ReactNode;
  className?: string;
};

export function BulkActionBar({ selectedCount, children, className }: BulkActionBarProps) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 md:flex-row md:items-center md:justify-between", className)}>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{selectedCount}</Badge>
        <p className="text-sm text-muted-foreground">
          {selectedCount === 1 ? "1 row selected for bulk action" : `${selectedCount} rows selected for bulk action`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
