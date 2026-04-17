import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { buildPersonDetailPath } from "@/lib/analytics/person-routing";
import { cn } from "@/lib/utils";

type PersonLinkProps = {
  personName: string;
  className?: string;
  children?: ReactNode;
};

export function PersonLink({ personName, className, children }: PersonLinkProps) {
  const location = useLocation();

  return (
    <Link
      to={buildPersonDetailPath(personName)}
      state={{ from: `${location.pathname}${location.search}` }}
      className={cn("font-medium text-foreground underline-offset-4 hover:text-primary hover:underline", className)}
    >
      {children || personName}
    </Link>
  );
}
