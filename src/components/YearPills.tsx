import { Badge } from "@/components/ui/badge";

interface YearPillsProps {
  years: string[];
  selectedYears: string[];
  onChange: (next: string[]) => void;
}

export function YearPills({ years, selectedYears, onChange }: YearPillsProps) {
  const toggleYear = (year: string) => {
    if (selectedYears.includes(year)) {
      onChange(selectedYears.filter((y) => y !== year));
    } else {
      onChange([...selectedYears, year]);
    }
  };

  return (
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
  );
}
