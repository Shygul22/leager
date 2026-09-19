import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, CheckCircle2, AlertTriangle, FileText, Info } from "lucide-react";
import { toast } from "sonner";

export function NotificationCenter() {
  const { account, profile } = useAuth();
  const [readIds, setReadIds] = useState<string[]>([]);
  const activeAccountId = account?.id || profile?.account_id;

  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ["notifications-audit", activeAccountId],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("id, action, module, target, actor_email, details, created_at")
        .order("created_at", { ascending: false })
        .limit(15);

      if (activeAccountId) {
        query = query.eq("account_id", activeAccountId);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    }
  });

  const unreadCount = auditLogs.filter((log: any) => !readIds.includes(log.id)).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-full">
          <Bell className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-xl" align="end">
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-xs">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <span>ERP Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => {
                setReadIds(auditLogs.map((l: any) => l.id));
                toast.success("All notifications marked as read");
              }}
              className="text-[10px] text-primary hover:underline font-semibold"
            >
              Mark all read
            </button>
          )}
        </div>

        <ScrollArea className="h-64 p-2">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading notifications...</div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-1.5">
              <CheckCircle2 className="h-6 w-6 text-muted-foreground/40 mb-1" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">All caught up!</span>
              <span>No recent actions or alerts for this account.</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {auditLogs.map((n: any) => {
                const isUnread = !readIds.includes(n.id);
                return (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-lg transition-colors border ${
                      isUnread
                        ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:border-slate-200"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-0.5">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1">
                        {n.action}
                        {n.module && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                            {n.module}
                          </Badge>
                        )}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {n.target ? `Target: ${n.target}` : n.actor_email ? `By: ${n.actor_email}` : "System event"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
