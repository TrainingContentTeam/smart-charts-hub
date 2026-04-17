import { useMemo, useState } from "react";
import { Check, ChevronDown, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SearchableProjectOption = {
  value: string;
  label: string;
  projectName: string;
  reportingYear: string;
};

type SearchableProjectSelectProps = {
  label: string;
  options: SearchableProjectOption[];
  selected: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
};

export function SearchableProjectSelect({
  label,
  options,
  selected,
  onChange,
  className,
  placeholder = "Select project...",
}: SearchableProjectSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === selected) || null,
    [options, selected],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("h-10 min-w-[280px] justify-between gap-3 px-3 text-left", className)}>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className="truncate text-sm">
              {selectedOption ? selectedOption.label : placeholder}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] p-0">
        <Command>
          <CommandInput placeholder="Search project records..." />
          <CommandList>
            <CommandEmpty>No project records found.</CommandEmpty>
            <CommandGroup heading={label}>
              {selected ? (
                <CommandItem
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="flex items-center justify-between text-muted-foreground"
                >
                  <span>Clear selection</span>
                  <X className="h-4 w-4" />
                </CommandItem>
              ) : null}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.projectName} ${option.reportingYear}`}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="flex items-center gap-3"
                >
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate">{option.projectName}</p>
                    <p className="text-xs text-muted-foreground">{option.reportingYear}</p>
                  </div>
                  {selected === option.value ? <Check className="h-4 w-4 text-primary" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
