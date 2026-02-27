import { Badge } from "@/components/ui/badge";

interface YearPillsProps {
  years: string[];
  selectedYears: string[];
  onChange: (next: string[]) => void;
}

export function YearPills({ years, selectedYears, onChange }: YearPillsProps) {
  const has2022 = years.some((year) => year.trim() === "2022");
  const showing2022 = has2022 && (selectedYears.length === 0 || selectedYears.some((year) => year.trim() === "2022"));

  const toggleYear = (year: string) => {
    if (selectedYears.includes(year)) {
      onChange(selectedYears.filter((y) => y !== year));
    } else {
      onChange([...selectedYears, year]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={selectedYears.length === 0 ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => onChange([])}
        >
          All Years
        </Badge>
        {years.map((year) => (
          <Badge
            key={year}
            variant={selectedYears.includes(year) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggleYear(year)}
          >
            {year}
          </Badge>
        ))}
      </div>
      {showing2022 && (
        <p className="text-xs text-muted-foreground">
          Disclaimer: 2022 course time was not consistently recorded. Any 2022 time values were captured using a
          retired process and are considered unreliable, so time data for 2022 is excluded.
        </p>
      )}
    </div>
  );
}
