import { useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type CompactFilterOption = {
  label: string;
  value: string;
};

type CompactMultiSelectFilterProps = {
  label: string;
  options: CompactFilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
  placeholder?: string;
  variant?: "default" | "chip";
};

export function CompactMultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  className,
  placeholder = "All",
  variant = "default",
}: CompactMultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const selectedLabels = useMemo(
    () => options.filter((option) => selected.includes(option.value)).map((option) => option.label),
    [options, selected],
  );
  const chipValue = selectedLabels.length === 0
    ? placeholder
    : selectedLabels.length === 1
      ? selectedLabels[0]
      : `${selectedLabels.length} selected`;

  const toggleValue = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((entry) => entry !== value));
      return;
    }

    onChange([...selected, value]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            variant === "chip"
              ? "h-8 max-w-[190px] justify-start gap-1.5 rounded-full border-muted-foreground/20 bg-background px-3 text-xs font-medium text-muted-foreground hover:border-foreground/30 hover:bg-background hover:text-foreground"
              : "h-auto min-h-10 justify-between gap-3 px-3 py-2 text-left",
            className,
          )}
        >
          {variant === "chip" ? (
            <>
              <span className="shrink-0">{label}</span>
              <span className="min-w-0 truncate text-foreground">{chipValue}</span>
              <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </>
          ) : (
            <>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                <div className="mt-1 flex min-h-5 flex-wrap items-center gap-1">
                  {selectedLabels.length ? (
                    <>
                      {selectedLabels.slice(0, 2).map((selectedLabel) => (
                        <Badge key={selectedLabel} variant="secondary" className="max-w-[130px] truncate">
                          {selectedLabel}
                        </Badge>
                      ))}
                      {selectedLabels.length > 2 ? (
                        <Badge variant="outline">+{selectedLabels.length - 2}</Badge>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">{placeholder}</span>
                  )}
                </div>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder={`Filter ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No matches found.</CommandEmpty>
            <CommandGroup heading={label}>
              {selected.length ? (
                <CommandItem
                  onSelect={() => onChange([])}
                  className="flex items-center justify-between text-muted-foreground"
                >
                  <span>Clear selection</span>
                  <X className="h-4 w-4" />
                </CommandItem>
              ) : null}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => toggleValue(option.value)}
                  className="flex items-center gap-3"
                >
                  <Checkbox checked={selected.includes(option.value)} aria-label={`${label}: ${option.label}`} />
                  <span className="flex-1">{option.label}</span>
                  {selected.includes(option.value) ? <Check className="h-4 w-4 text-primary" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
