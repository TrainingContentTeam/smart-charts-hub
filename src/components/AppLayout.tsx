import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const isBypass = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="h-14 flex items-center justify-between border-b px-4 bg-card">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <div
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  isBypass
                    ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-400/10 dark:text-amber-200 dark:border-amber-400/30"
                    : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-400/10 dark:text-emerald-200 dark:border-emerald-400/30"
                }`}
                title="Current data source mode"
              >
                Data Source: {isBypass ? "Local Bypass" : "Supabase"}
              </div>
            </div>
          </header>
          <div className="p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
