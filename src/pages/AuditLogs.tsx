import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ShieldAlert, History, Filter, RefreshCcw, User, Building, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

type AuditLog = {
    id: string;
    account_id: string | null;
    actor_id: string | null;
    actor_email: string | null;
    action: string;
    module: string;
    target: string | null;
    details: any;
    created_at: string;
    accounts?: { company_name: string } | null;
};

export default function AuditLogs() {
    const { role, account } = useAuth();
    const [search, setSearch] = useState("");
    const [moduleFilter, setModuleFilter] = useState<string>("all");
    const [actionFilter, setActionFilter] = useState<string>("all");

    const { data: logs = [], isLoading, refetch } = useQuery({
        queryKey: ["audit_logs", role, account?.id],
        queryFn: async () => {
            let query = supabase
                .from("audit_logs")
                .select("*, accounts(company_name)")
                .order("created_at", { ascending: false })
                .limit(200);

            // Account Admin only sees logs belonging to their account
            if (role !== "super_admin" && account?.id) {
                query = query.eq("account_id", account.id);
            }

            const { data, error } = await query;
            if (error) {
                console.error("Error fetching audit logs:", error);
                return [];
            }
            return data as AuditLog[];
        },
        enabled: role === "super_admin" || role === "admin"
    });

    const filteredLogs = logs.filter(log => {
        if (moduleFilter !== "all" && log.module.toLowerCase() !== moduleFilter.toLowerCase()) return false;
        if (actionFilter !== "all" && !log.action.toLowerCase().includes(actionFilter.toLowerCase())) return false;

        if (!search) return true;
        const q = search.toLowerCase();
        return (
            (log.actor_email?.toLowerCase().includes(q)) ||
            (log.action.toLowerCase().includes(q)) ||
            (log.module.toLowerCase().includes(q)) ||
            (log.target?.toLowerCase().includes(q)) ||
            (log.accounts?.company_name?.toLowerCase().includes(q))
        );
    });

    const getActionBadge = (action: string) => {
        const act = action.toLowerCase();
        if (act.includes("create") || act.includes("generate") || act.includes("activate")) {
            return <Badge className="bg-emerald-600 text-white font-mono text-[10px]">{action}</Badge>;
        }
        if (act.includes("delete") || act.includes("revoke") || act.includes("suspend")) {
            return <Badge className="bg-red-600 text-white font-mono text-[10px]">{action}</Badge>;
        }
        if (act.includes("update") || act.includes("edit") || act.includes("change")) {
            return <Badge className="bg-blue-600 text-white font-mono text-[10px]">{action}</Badge>;
        }
        return <Badge variant="outline" className="font-mono text-[10px]">{action}</Badge>;
    };

    if (role !== "super_admin" && role !== "admin") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <ShieldAlert className="h-16 w-16 text-destructive mb-4 opacity-20" />
                <h1 className="text-3xl font-bold">Access Denied</h1>
                <p className="text-muted-foreground mt-2">Only Administrators and Super Admins can access Audit Trail logs.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <History className="h-6 w-6 text-primary" /> Audit Trail & System Activity
                    </h1>
                    <p className="text-muted-foreground">
                        {role === "super_admin"
                            ? "Global system-wide security, subscription, license, and user activity logs."
                            : "Account-level audit trail for user security, billing, and operational changes."}
                    </p>
                </div>
                <Button variant="outline" onClick={() => refetch()}>
                    <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Logs
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="relative flex-1 w-full sm:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search actor, action, module, or company..." 
                                className="pl-9"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                            <Select value={moduleFilter} onValueChange={setModuleFilter}>
                                <SelectTrigger className="w-[140px] text-xs">
                                    <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                    <SelectValue placeholder="Module" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Modules</SelectItem>
                                    <SelectItem value="account">Accounts</SelectItem>
                                    <SelectItem value="license">Licenses</SelectItem>
                                    <SelectItem value="billing">Billing</SelectItem>
                                    <SelectItem value="user">Users</SelectItem>
                                    <SelectItem value="role">Roles</SelectItem>
                                    <SelectItem value="auth">Authentication</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={actionFilter} onValueChange={setActionFilter}>
                                <SelectTrigger className="w-[140px] text-xs">
                                    <SelectValue placeholder="Action Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Actions</SelectItem>
                                    <SelectItem value="create">Created / Generated</SelectItem>
                                    <SelectItem value="update">Updated / Edited</SelectItem>
                                    <SelectItem value="delete">Deleted / Revoked</SelectItem>
                                    <SelectItem value="activate">Activated</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date & Time</TableHead>
                                <TableHead>Actor</TableHead>
                                {role === "super_admin" && <TableHead>Account / Company</TableHead>}
                                <TableHead>Module</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Target / Description</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={role === "super_admin" ? 6 : 5} className="text-center py-12 text-muted-foreground">
                                        Fetching system audit logs...
                                    </TableCell>
                                </TableRow>
                            ) : filteredLogs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={role === "super_admin" ? 6 : 5} className="text-center py-12 text-muted-foreground">
                                        No audit records found matching your filters.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredLogs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-muted/40">
                                        <TableCell className="text-xs font-mono whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Clock className="h-3.5 w-3.5 text-primary/70" />
                                                {format(parseISO(log.created_at), "dd MMM yyyy, hh:mm:ss a")}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                                {log.actor_email || "System / Guest"}
                                            </div>
                                        </TableCell>
                                        {role === "super_admin" && (
                                            <TableCell className="text-xs">
                                                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                                    <Building className="h-3.5 w-3.5 text-muted-foreground" />
                                                    {log.accounts?.company_name || "Global System"}
                                                </div>
                                            </TableCell>
                                        )}
                                        <TableCell className="text-xs font-medium">
                                            <Badge variant="secondary" className="capitalize text-[10px]">
                                                {log.module}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {getActionBadge(log.action)}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                                            {log.target ? <span className="font-semibold text-foreground mr-1">{log.target}:</span> : null}
                                            {typeof log.details === "object" ? JSON.stringify(log.details) : String(log.details || "")}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
