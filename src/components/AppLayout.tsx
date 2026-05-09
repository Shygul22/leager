import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { role, profile } = useAuth();

  const formatRole = (r: string | null) => {
    if (!r) return "Guest";
    return r.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getRoleColor = (r: string | null) => {
    switch (r) {
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
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center justify-between border-b px-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end mr-1">
                <span className="text-xs font-semibold text-slate-900 leading-tight">{profile?.full_name || profile?.email?.split('@')[0] || "User"}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Member</span>
              </div>
              <Badge className={`${getRoleColor(role)} text-white border-none px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider`}>
                {formatRole(role)}
              </Badge>
              <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center border text-slate-400">
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
    </SidebarProvider>
  );
}
