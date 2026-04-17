import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { buildProjectDetailPath } from "@/lib/analytics/project-routing";
import { cn } from "@/lib/utils";

type ProjectLinkProps = {
  projectName: string;
  reportingYear: string | null;
  className?: string;
  children?: ReactNode;
};

export function ProjectLink({ projectName, reportingYear, className, children }: ProjectLinkProps) {
  const location = useLocation();

  return (
    <Link
      to={buildProjectDetailPath({ raw_course_name: projectName, reporting_year: reportingYear })}
      state={{ from: `${location.pathname}${location.search}` }}
      className={cn("font-medium text-foreground underline-offset-4 hover:text-primary hover:underline", className)}
    >
      {children || projectName}
    </Link>
  );
}
