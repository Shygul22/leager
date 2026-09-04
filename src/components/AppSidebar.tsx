import { LayoutDashboard, ArrowLeftRight, FileText, Settings, PieChart, Users, Package, Truck, CreditCard, ShieldCheck, UserCircle, Globe, MessageSquare, ShieldAlert, Bug, Briefcase, FolderOpen, Map, Award, UserPlus, Key } from "lucide-react";
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

const adminItems = [
  { title: "License Keys & Accounts", url: "/licenses", icon: Key, roles: ["super_admin", "admin"] },
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
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["admin", "accounts_manager", "staff", "project_manager"] },
  { title: "Clients", url: "/clients", icon: Users, roles: ["admin", "project_manager"] },
  { title: "Lead Tracking", url: "/lead-tracking", icon: UserPlus, roles: ["admin", "accounts_manager", "project_manager", "staff"] },
  { title: "Service Catalog", url: "/products", icon: Package, roles: ["admin", "staff"] },
  { title: "Quotations", url: "/quotations", icon: FileText, roles: ["admin", "project_manager", "staff"] },
  { title: "Invoices", url: "/invoices", icon: FileText, roles: ["admin", "staff"] },
  { title: "Projects", url: "/projects", icon: Briefcase, roles: ["admin", "project_manager"] },
  { title: "Documents Library", url: "/documents", icon: FolderOpen, roles: ["admin", "accounts_manager", "project_manager", "staff"] },
  { title: "Support Tickets", url: "/tickets", icon: MessageSquare, roles: ["admin", "ticket_support"] },
  { title: "Bug Tracker", url: "/bug-tracker", icon: Bug, roles: ["admin", "project_manager", "ticket_support"] },
  { title: "Client Portal", url: "/portal", icon: Globe, roles: ["admin"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { role } = useAuth();
  
  const filterItems = (items: any[]) => {
    if (!role) return [];
    return items.filter(item => item.roles.includes(role));
  };

  const filteredAdmin = filterItems(adminItems);
  const filteredOps = filterItems(operationalItems);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
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
