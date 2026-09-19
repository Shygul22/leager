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
  const { account } = useAuth();
  const [unreadCount, setUnreadCount] = useState(3);

  const notifications = [
    {
      id: "1",
      title: "Client Payment Received",
      message: "₹4,500.00 realized via SBI Bank Transfer from Zenith Global Tech.",
      time: "10 mins ago",
      type: "success"
    },
    {
      id: "2",
      title: "Timesheet Approved",
      message: "Engineering hours for Enterprise ERP Migration approved by PM.",
      time: "1 hour ago",
      type: "info"
    },
    {
      id: "3",
      title: "Upcoming AMC Renewal",
      message: "Apex Logistics SLA renewal due in 45 days. Review terms.",
      time: "1 day ago",
      type: "warning"
    }
  ];

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
          </div>
          <button
            onClick={() => {
              setUnreadCount(0);
              toast.success("All notifications marked as read");
            }}
            className="text-[10px] text-primary hover:underline font-semibold"
          >
            Mark all read
          </button>
        </div>

        <ScrollArea className="h-64 p-2">
          <div className="space-y-1.5">
            {notifications.map((n) => (
              <div key={n.id} className="p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200">
                <div className="flex justify-between items-start mb-0.5">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{n.title}</span>
                  <span className="text-[9px] text-muted-foreground">{n.time}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{n.message}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
