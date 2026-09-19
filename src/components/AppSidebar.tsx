import { LayoutDashboard, ArrowLeftRight, FileText, Settings, PieChart, Users, Package, Truck, CreditCard, ShieldCheck, UserCircle, Globe, MessageSquare, ShieldAlert, Bug, Briefcase, FolderOpen, Map, Award, UserPlus, Key, History, ArrowLeft } from "lucide-react";
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

const financeAndAccountingItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["super_admin", "admin", "accounts_manager", "staff", "project_manager"] },
  { title: "Transactions", url: "/transactions", icon: ArrowLeftRight, roles: ["super_admin", "admin", "accounts_manager"] },
  { title: "Financial Reports", url: "/tax-reports", icon: ShieldCheck, roles: ["super_admin", "admin", "accounts_manager"] },
  { title: "Financial Analysis", url: "/analysis", icon: PieChart, roles: ["super_admin", "admin", "accounts_manager"] },
  { title: "Bills & Expenses", url: "/bills", icon: CreditCard, roles: ["super_admin", "admin", "accounts_manager"] },
  { title: "Suppliers & Payouts", url: "/suppliers", icon: Truck, roles: ["super_admin", "admin", "accounts_manager"] },
  { title: "Shareholders & Dividends", url: "/shareholders", icon: Award, roles: ["super_admin", "admin", "accounts_manager"] },
  { title: "Employees", url: "/employees", icon: UserCircle, roles: ["super_admin", "admin"] },
  { title: "User Roles & Permissions", url: "/roles", icon: ShieldAlert, roles: ["super_admin", "admin"] },
  { title: "Access Directory", url: "/access-directory", icon: Map, roles: ["super_admin", "admin"] },
  { title: "Configuration", url: "/settings", icon: Settings, roles: ["super_admin", "admin"] },
];

const operationalItems = [
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
  const location = useLocation();
  const normRole = (role || "").toLowerCase();
  const isSuperAdmin = normRole === "super_admin";
  
  // Check if we are currently inside the Super Admin Portal routes
  const isSuperAdminPortalRoute = location.pathname === "/licenses" || location.pathname === "/audit-logs";

  // ─── CASE 1: SUPER ADMIN PORTAL (COMPLETELY SEPARATED VIEW) ─────────────
  if (isSuperAdmin && isSuperAdminPortalRoute) {
    return (
      <Sidebar collapsible="icon">
        <SidebarContent className="flex flex-col justify-between h-full bg-slate-950/40">
          <SidebarGroup className="mx-2 mt-3 p-2 bg-gradient-to-br from-purple-950/70 via-purple-900/30 to-slate-900/60 border border-purple-500/30 rounded-xl shadow-md">
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-black text-purple-400 flex items-center justify-between px-2 py-1">
              {!collapsed && (
                <>
                  <span className="flex items-center gap-1.5 font-bold text-purple-200">
                    <ShieldCheck className="h-4 w-4 text-purple-400" />
                    Super Admin Portal
                  </span>
                  <span className="bg-purple-500/25 text-purple-300 border border-purple-500/40 text-[9px] px-2 py-0.5 rounded-full font-black tracking-wider">
                    MASTER
                  </span>
                </>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-2">
              <SidebarMenu>
                {superAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-purple-500/20 text-purple-100 hover:text-white transition-colors"
                        activeClassName="bg-purple-600 text-white font-semibold shadow-sm shadow-purple-900/50"
                      >
                        <item.icon className="mr-2.5 h-4 w-4 text-purple-400" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Exit Button back to Company View */}
          <div className="p-3 border-t border-purple-500/20">
            <NavLink
              to="/dashboard"
              className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2.5 transition-all w-full justify-center shadow-sm"
            >
              <ArrowLeft className="h-4 w-4 text-purple-400" />
              {!collapsed && <span>Exit to Company View</span>}
            </NavLink>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  // ─── CASE 2: COMPANY LEDGER VIEW (MANAGEMENT & OPERATIONS) ──────────────
  const filterItems = (items: any[]) => {
    if (!role) return [];
    if (isSuperAdmin) return items;
    
    const isCustomOrStaffRole = !["super_admin", "admin", "client"].includes(normRole);

    return items.filter(item => {
      if (item.roles.includes(normRole) || item.roles.includes(role)) return true;
      if (isCustomOrStaffRole) return true;
      return false;
    });
  };

  const filteredFinance = filterItems(financeAndAccountingItems);
  const filteredOps = filterItems(operationalItems);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Quick Shortcut to Super Admin Portal when in Company view */}
        {isSuperAdmin && (
          <div className="mx-2 mt-2">
            <NavLink
              to="/licenses"
              className="flex items-center justify-between p-2.5 bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-slate-900/40 hover:from-purple-900/50 hover:to-slate-800/60 border border-purple-500/30 rounded-xl text-purple-300 hover:text-white transition-all text-xs font-bold shadow-sm group"
            >
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-purple-400 group-hover:scale-110 transition-transform" />
                {!collapsed && <span>Super Admin Portal</span>}
              </div>
              {!collapsed && (
                <span className="text-[10px] bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/30 text-purple-300 font-extrabold">
                  Open →
                </span>
              )}
            </NavLink>
          </div>
        )}

        {filteredFinance.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70">
              {!collapsed && "Finance & Accounting"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredFinance.map((item) => (
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
              {!collapsed && "Operations & CRM"}
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

