import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const CHART_FILTER_VARIANT = "chip" as const;

export function ChartFilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

type ChartDateRangeFilterProps = {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  label?: string;
  className?: string;
};

export function ChartDateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  label = "Date",
  className,
}: ChartDateRangeFilterProps) {
  const hasValue = Boolean(startDate || endDate);

  return (
    <div
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full border border-muted-foreground/20 bg-background px-3 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      <span className="shrink-0">{label}</span>
      <input
        type="date"
        value={startDate}
        onChange={(event) => onStartDateChange(event.target.value)}
        className="h-6 w-[112px] min-w-0 bg-transparent text-xs text-foreground outline-none"
        aria-label={`${label} start date`}
      />
      <span aria-hidden="true">to</span>
      <input
        type="date"
        value={endDate}
        onChange={(event) => onEndDateChange(event.target.value)}
        className="h-6 w-[112px] min-w-0 bg-transparent text-xs text-foreground outline-none"
        aria-label={`${label} end date`}
      />
      {hasValue ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-2 h-6 w-6 rounded-full"
          onClick={() => {
            onStartDateChange("");
            onEndDateChange("");
          }}
          aria-label={`Clear ${label.toLowerCase()} range`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
