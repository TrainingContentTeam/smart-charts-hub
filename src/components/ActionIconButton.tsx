import type { LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ActionIconButtonProps = Omit<ButtonProps, "children"> & {
  icon: LucideIcon;
  label: string;
  tooltip: string;
};

export function ActionIconButton({ icon: Icon, label, tooltip, ...props }: ActionIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button {...props}>
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

