import { LayoutDashboard, ArrowLeftRight, FileText, Settings, PieChart, Users, Package, Truck, CreditCard, ShieldCheck, UserCircle, Globe, MessageSquare, ShieldAlert, Bug, Briefcase, FolderOpen, Map, Award, UserPlus, Key, History } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const superAdminItems = [
  { title: "Super Admin Portal", url: "/licenses", icon: Key },
  { title: "System Audit Trail", url: "/audit-logs", icon: History },
];

const adminItems = [
  { title: "Transactions", url: "/transactions", icon: ArrowLeftRight, roles: ["super_admin", "admin", "accounts_manager"] },
  { title: "Tax Reports", url: "/tax-reports", icon: ShieldCheck, roles: ["super_admin", "admin", "accounts_manager"] },
  { title: "Shareholders & Dividends", url: "/shareholders", icon: Award, roles: ["super_admin", "admin", "accounts_manager"] },
  { title: "Bills & Expenses", url: "/bills", icon: CreditCard, roles: ["super_admin", "admin", "accounts_manager"] },
  { title: "Suppliers & Payouts", url: "/suppliers", icon: Truck, roles: ["super_admin", "admin", "accounts_manager"] },
  { title: "Employees", url: "/employees", icon: UserCircle, roles: ["super_admin", "admin"] },
  { title: "User Roles", url: "/roles", icon: ShieldAlert, roles: ["super_admin", "admin"] },
  { title: "Access Directory", url: "/access-directory", icon: Map, roles: ["super_admin", "admin"] },
  { title: "Settings", url: "/settings", icon: Settings, roles: ["super_admin", "admin"] },
];

const operationalItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["super_admin", "admin", "accounts_manager", "staff", "project_manager"] },
  { title: "Clients", url: "/clients", icon: Users, roles: ["super_admin", "admin", "project_manager"] },
  { title: "Lead Tracking", url: "/lead-tracking", icon: UserPlus, roles: ["super_admin", "admin", "accounts_manager", "project_manager", "staff"] },
  { title: "Service Catalog", url: "/products", icon: Package, roles: ["super_admin", "admin", "staff"] },
  { title: "Quotations", url: "/quotations", icon: FileText, roles: ["super_admin", "admin", "project_manager", "staff"] },
  { title: "Invoices", url: "/invoices", icon: FileText, roles: ["super_admin", "admin", "staff"] },
  { title: "Projects", url: "/projects", icon: Briefcase, roles: ["super_admin", "admin", "project_manager"] },
  { title: "Documents Library", url: "/documents", icon: FolderOpen, roles: ["super_admin", "admin", "accounts_manager", "project_manager", "staff"] },
  { title: "Support Tickets", url: "/tickets", icon: MessageSquare, roles: ["super_admin", "admin", "ticket_support"] },
  { title: "Bug Tracker", url: "/bug-tracker", icon: Bug, roles: ["super_admin", "admin", "project_manager", "ticket_support"] },
  { title: "Client Portal", url: "/portal", icon: Globe, roles: ["super_admin", "admin"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { role } = useAuth();
  const normRole = (role || "").toLowerCase();
  const isSuperAdmin = normRole === "super_admin";
  
  const filterItems = (items: any[]) => {
    if (!role) return [];
    
    // Super Admin sees company management items
    if (isSuperAdmin) return items;
    
    const isCustomOrStaffRole = !["super_admin", "admin", "client"].includes(normRole);

    return items.filter(item => {
      if (item.roles.includes(normRole) || item.roles.includes(role)) return true;
      if (isCustomOrStaffRole) return true;
      return false;
    });
  };

  const filteredAdmin = filterItems(adminItems);
  const filteredOps = filterItems(operationalItems);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Dedicated Super Admin Portal Separated Section */}
        {isSuperAdmin && (
          <SidebarGroup className="mx-2 mt-2 p-2 bg-gradient-to-br from-purple-950/50 via-purple-900/25 to-slate-900/40 border border-purple-500/30 rounded-xl shadow-sm">
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-black text-purple-400 flex items-center justify-between px-2 py-1">
              {!collapsed && (
                <>
                  <span className="flex items-center gap-1.5 font-bold text-purple-300">
                    <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
                    Super Admin Portal
                  </span>
                  <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] px-1.5 py-0.5 rounded font-extrabold tracking-wider">
                    MASTER
                  </span>
                </>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1">
              <SidebarMenu>
                {superAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-purple-500/20 text-purple-100 hover:text-white transition-colors"
                        activeClassName="bg-purple-600 text-white font-semibold shadow-sm shadow-purple-900/50"
                      >
                        <item.icon className="mr-2 h-4 w-4 text-purple-400" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {filteredAdmin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70">
              {!collapsed && "Management"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAdmin.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-accent/50"
                        activeClassName="bg-accent text-accent-foreground font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {filteredOps.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70">
              {!collapsed && "Operations"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredOps.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-accent/50"
                        activeClassName="bg-accent text-accent-foreground font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
