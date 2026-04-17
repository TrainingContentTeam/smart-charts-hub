import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ChartPanelProps = {
  title: string;
  info?: string;
  filters?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function ChartPanel({ title, info, filters, children, className, contentClassName }: ChartPanelProps) {
  return (
    <Card className={className}>
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
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{info}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>
        {filters ? <div className="flex flex-wrap gap-2">{filters}</div> : null}
      </CardHeader>
      <CardContent className={cn("pt-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

