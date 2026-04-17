import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SortDirection = "asc" | "desc";

type SortableTableHeaderProps = {
  label: string;
  active: boolean;
  direction: SortDirection;
  onToggle: () => void;
  className?: string;
};

export function SortableTableHeader({
  label,
  active,
  direction,
  onToggle,
  className,
}: SortableTableHeaderProps) {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground",
        active && "text-foreground",
        className,
      )}
    >
      <span>{label}</span>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
