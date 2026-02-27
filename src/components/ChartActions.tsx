import { Button } from "@/components/ui/button";
import { Camera, Table2 } from "lucide-react";

interface ChartActionsProps {
  showData: boolean;
  onToggleData: () => void;
  onSnapshot: () => void;
}

export function ChartActions({ showData, onToggleData, onSnapshot }: ChartActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant={showData ? "default" : "outline"} size="sm" onClick={onToggleData}>
        <Table2 className="h-3.5 w-3.5 mr-1" /> Reveal Data
      </Button>
      <Button variant="outline" size="sm" onClick={onSnapshot}>
        <Camera className="h-3.5 w-3.5 mr-1" /> Snapshot
      </Button>
    </div>
  );
}
