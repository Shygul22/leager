import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Bug, Plus, AlertTriangle, CheckCircle2, Clock, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type BugReport = {
    id: string;
    title: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    status: "open" | "fixing" | "resolved" | "closed";
    module: string;
    created_at: string;
    reported_by: string;
};

export default function BugTracker() {
    const { user, role, account } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        title: "",
        description: "",
        severity: "medium" as const,
        module: "General",
    });

    const { data: bugs = [], isLoading } = useQuery({
        queryKey: ["bug_reports", user?.id, account?.id],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("bug_reports").select("*");
            if (account?.id) {
                query = query.or(`account_id.eq.${account.id},reported_by.eq.${user.id}`);
            } else {
                query = query.eq("reported_by", user.id);
            }
            const { data, error } = await query.order("created_at", { ascending: false });

            if (error) {
                if (error.message.includes("does not exist")) return [];
                throw error;
            }
            return data as BugReport[];
        },
        enabled: !!user,
    });

    const createBug = useMutation({
        mutationFn: async (newBug: any) => {
            const payload = {
                ...newBug,
                reported_by: user?.id,
                ...(account?.id ? { account_id: account.id } : {})
            };
            const { error } = await supabase.from("bug_reports").insert([payload]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bug_reports"] });
            setOpen(false);
            setForm({ title: "", description: "", severity: "medium", module: "General" });
            toast.success("Bug reported successfully");
        },
        onError: (error: any) => toast.error(error.message)
    });

    const updateStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string, status: string }) => {
            const { error } = await supabase
                .from("bug_reports")
                .update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bug_reports"] });
            toast.success("Bug status updated");
        }
    });

    const deleteBug = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("bug_reports").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bug_reports"] });
            toast.success("Report deleted");
        }
    });

    const getSeverityBadge = (sev: string) => {
        switch (sev) {
            case "critical": return <Badge variant="destructive" className="animate-pulse">Critical</Badge>;
            case "high": return <Badge className="bg-orange-600">High</Badge>;
            case "medium": return <Badge className="bg-blue-600">Medium</Badge>;
            case "low": return <Badge variant="secondary">Low</Badge>;
            default: return <Badge>{sev}</Badge>;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "open": return <Badge variant="outline" className="text-red-500 border-red-200">Open</Badge>;
            case "fixing": return <Badge className="bg-amber-500">Fixing</Badge>;
            case "resolved": return <Badge className="bg-emerald-500">Resolved</Badge>;
            case "closed": return <Badge variant="secondary">Closed</Badge>;
            default: return <Badge>{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Bug & Error Tracker</h1>
                    <p className="text-muted-foreground">Report and track system issues for the development team.</p>
                </div>
                <Button onClick={() => setOpen(true)} variant="destructive">
                    <Plus className="mr-2 h-4 w-4" /> Report Bug
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium">Open Bugs</CardTitle>
                        <Bug className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">{bugs.filter(b => b.status === 'open').length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">{bugs.filter(b => b.status === 'fixing').length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">{bugs.filter(b => b.status === 'resolved').length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
                        <Filter className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold">{bugs.length}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Issue / Module</TableHead>
                            <TableHead>Severity</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Reported Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {bugs.length === 0 && !isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">
                                    No bugs reported yet. Click "Report Bug" to add one.
                                </TableCell>
                            </TableRow>
                        ) : (
                            bugs.map((bug) => (
                                <TableRow key={bug.id}>
                                    <TableCell>
                                        <div className="font-medium">{bug.title}</div>
                                        <div className="text-xs text-muted-foreground">{bug.module}</div>
                                    </TableCell>
                                    <TableCell>{getSeverityBadge(bug.severity)}</TableCell>
                                    <TableCell>{getStatusBadge(bug.status)}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {format(new Date(bug.created_at), "MMM d, HH:mm")}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Select 
                                                defaultValue={bug.status} 
                                                onValueChange={(val) => updateStatus.mutate({ id: bug.id, status: val })}
                                            >
                                                <SelectTrigger className="h-8 w-[110px] text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="open">Open</SelectItem>
                                                    <SelectItem value="fixing">Fixing</SelectItem>
                                                    <SelectItem value="resolved">Resolved</SelectItem>
                                                    <SelectItem value="closed">Closed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {role === 'admin' && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteBug.mutate(bug.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            Report System Bug
                        </DialogTitle>
                        <DialogDescription>Provide details about the issue you encountered.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Short Title</Label>
                            <Input 
                                placeholder="e.g. Dashboard not loading" 
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Severity</Label>
                                <Select value={form.severity} onValueChange={(v: any) => setForm({ ...form, severity: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="critical">Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Affected Module</Label>
                                <Input 
                                    placeholder="e.g. Auth, Invoices" 
                                    value={form.module}
                                    onChange={(e) => setForm({ ...form, module: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Issue Description</Label>
                            <Textarea 
                                placeholder="Describe exactly what happened and how to reproduce it..." 
                                className="min-h-[120px]"
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => createBug.mutate(form)} disabled={!form.title || !form.description}>
                            Submit Report
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
