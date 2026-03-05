import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/use-user-role";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";

interface ProtectedRouteProps {
  requiredRole: string;
  children: React.ReactNode;
}

export function ProtectedRoute({ requiredRole, children }: ProtectedRouteProps) {
  const { role, loading } = useUserRole();
  const { toast } = useToast();
  const toasted = useRef(false);

  const hasAccess = requiredRole === "admin" ? role === "admin" : true;

  useEffect(() => {
    if (!loading && !hasAccess && !toasted.current) {
      toasted.current = true;
      toast({
        title: "Access denied",
        description: "You don't have permission to view that page.",
        variant: "destructive",
      });
    }
  }, [loading, hasAccess, toast]);

  if (loading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <p className="text-muted-foreground">Checking permissions…</p>
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
