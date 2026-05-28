import type { ReactNode } from "react";
import { useId } from "react";
import { Camera, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { saveChartSnapshot } from "@/lib/chart-snapshot";
import { cn } from "@/lib/utils";

type ChartPanelProps = {
  title: string;
  info?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  enableSnapshot?: boolean;
};

function slugifyTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "chart";
}

export function ChartPanel({ title, info, actions, filters, children, className, contentClassName, enableSnapshot = true }: ChartPanelProps) {
  const generatedId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const snapshotId = `chart-panel-${slugifyTitle(title)}-${generatedId}`;
  const filenameBase = slugifyTitle(title);

  return (
    <Card id={snapshotId} className={className}>
      <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {info ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={`${title} information`}
                    data-html2canvas-ignore="true"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{info}</TooltipContent>
              </Tooltip>
            ) : null}
            {enableSnapshot ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={`Download ${title} image`}
                    data-html2canvas-ignore="true"
                    onClick={() => void saveChartSnapshot(snapshotId, filenameBase)}
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Download chart image</TooltipContent>
              </Tooltip>
            ) : null}
            {actions ? (
              <span className="contents" data-html2canvas-ignore="true">
                {actions}
              </span>
            ) : null}
          </div>
        </div>
        {filters ? <div className="flex flex-wrap gap-2">{filters}</div> : null}
      </CardHeader>
      <CardContent className={cn("pt-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
