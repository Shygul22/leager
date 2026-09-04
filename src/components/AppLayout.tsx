import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserCircle, Eye, Building } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { role, profile, account, userAccounts, switchAccount, impersonatedAccount, exitImpersonation } = useAuth();

  const formatRole = (r: string | null) => {
    if (!r) return "Guest";
    return r.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getRoleColor = (r: string | null) => {
    switch (r) {
      case 'super_admin': return 'bg-purple-600 hover:bg-purple-700';
      case 'admin': return 'bg-red-500 hover:bg-red-600';
      case 'accounts_manager': return 'bg-blue-600 hover:bg-blue-700';
      case 'project_manager': return 'bg-amber-600 hover:bg-amber-700';
      case 'staff': return 'bg-emerald-600 hover:bg-emerald-700';
      case 'ticket_support': return 'bg-purple-600 hover:bg-purple-700';
      default: return 'bg-slate-600 hover:bg-slate-700';
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex flex-col w-full">
        {/* Super Admin Direct View Active Banner */}
        {impersonatedAccount && (
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-950 text-white px-4 py-2 flex items-center justify-between text-xs shadow-md border-b border-purple-500/30 z-50">
            <div className="flex items-center gap-2 font-medium">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <Eye className="h-4 w-4 text-purple-300" />
              <span>
                <strong>Super Admin Direct View:</strong> Inspecting <strong>{impersonatedAccount.company_name}</strong> (No Password Required)
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                exitImpersonation();
                window.location.href = "/licenses";
              }}
              className="h-6 text-[11px] px-3 bg-purple-600 hover:bg-purple-700 text-white border-none rounded-full font-bold shadow-sm"
            >
              Exit Direct View
            </Button>
          </div>
        )}

        <div className="flex-1 flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col">
            <header className="h-12 flex items-center justify-between border-b px-4 bg-background">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                {userAccounts && userAccounts.length > 1 && (
                  <Select value={account?.id} onValueChange={(val) => switchAccount(val)}>
                    <SelectTrigger className="w-[190px] h-8 text-xs font-semibold bg-muted/60 border-muted">
                      <Building className="h-3.5 w-3.5 mr-1.5 text-primary" />
                      <SelectValue placeholder="Switch Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {userAccounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id} className="text-xs font-medium">
                          {acc.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end mr-1">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                    {profile?.full_name || profile?.email?.split('@')[0] || "User"}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    {account ? account.company_name : "Member"}
                  </span>
                </div>
                <Badge className={`${getRoleColor(role)} text-white border-none px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider`}>
                  {formatRole(role)}
                </Badge>
                <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border text-slate-400">
                  <UserCircle className="h-5 w-5" />
                </div>
                <button 
                  onClick={() => supabase.auth.signOut()}
                  className="ml-3 text-xs font-bold text-slate-400 hover:text-red-500 transition-all uppercase tracking-tighter"
                >
                  Log Out
                </button>
              </div>
            </header>
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
