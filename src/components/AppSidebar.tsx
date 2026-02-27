import { BarChart3, Upload, Wrench, Users, Building2, LibraryBig, FolderOpen, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: BarChart3 },
  { title: "Development", url: "/development", icon: Wrench },
  { title: "SME Collaboration", url: "/sme-collaboration", icon: Users },
  { title: "Other External Teams", url: "/external-teams", icon: Building2 },
  { title: "Master Content Inventory", url: "/master-content-inventory", icon: LibraryBig },
  { title: "Projects", url: "/projects", icon: FolderOpen },
  { title: "Upload Data", url: "/upload", icon: Upload },
];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const isBypass = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true";

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-primary-foreground">Course Analytics</h1>
            <p className="text-xs text-sidebar-foreground/60">Operations Hub</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="space-y-2">
          <div
            className={`text-[11px] inline-flex px-2 py-1 rounded-full border ${
              isBypass
                ? "bg-amber-100 text-amber-800 border-amber-300"
                : "bg-emerald-100 text-emerald-800 border-emerald-300"
            }`}
          >
            {isBypass ? "Local Bypass Data" : "Supabase Data"}
          </div>
          <div className="flex items-center justify-between">
          <p className="text-xs text-sidebar-foreground/60 truncate max-w-[140px]">
            {user?.email}
          </p>
          <button
            onClick={signOut}
            className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
