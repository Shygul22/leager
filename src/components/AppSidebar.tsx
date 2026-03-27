import { LayoutDashboard, ArrowLeftRight, FileText, Settings, PieChart, Users, Package, Truck, CreditCard, ShieldCheck, UserCircle, Landmark } from "lucide-react";
import { NavLink } from "@/components/NavLink";
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

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Transactions", url: "/transactions", icon: ArrowLeftRight },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Products & Services", url: "/products", icon: Package },
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "Quotations", url: "/quotations", icon: FileText },
  { title: "Loans & Borrowing", url: "/loans", icon: Landmark },
  { title: "Suppliers", url: "/suppliers", icon: Truck },
  { title: "Bills & Expenses", url: "/bills", icon: CreditCard },
  { title: "Tax Reports", url: "/tax-reports", icon: ShieldCheck },
  { title: "Employees", url: "/employees", icon: UserCircle },
  { title: "Analysis", url: "/analysis", icon: PieChart },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider">
            {!collapsed && "zenjourney Accounts Manager"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
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
      </SidebarContent>
    </Sidebar>
  );
}
