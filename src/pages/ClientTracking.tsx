import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit, Search, Loader2, DollarSign, Calendar, Clock, UserCheck, Briefcase, Phone, Building2 } from "lucide-react";
import { toast } from "sonner";

type ClientTrackingRecord = {
    id: string;
    client_id_code: string;
    client_name: string;
    company_name: string | null;
    phone: string | null;
    service_type: string | null;
    project_start_date: string | null;
    project_end_date: string | null;
    deadline: string | null;
    project_status: "planning" | "in_progress" | "on_hold" | "completed" | "cancelled";
    payment_status: "unpaid" | "partially_paid" | "paid" | "overdue";
    total_budget: number;
    amount_paid: number;
    balance: number;
    last_contact_date: string | null;
    created_at: string;
};

export default function ClientTracking() {
    const { user, role } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<ClientTrackingRecord | null>(null);
    const [search, setSearch] = useState("");

    const [form, setForm] = useState({
        client_name: "",
        company_name: "",
        phone: "",
        service_type: "",
        project_start_date: new Date().toISOString().split("T")[0],
        project_end_date: "",
        deadline: "",
        project_status: "in_progress",
        payment_status: "unpaid",
        total_budget: 0,
        amount_paid: 0,
        last_contact_date: new Date().toISOString().split("T")[0],
    });

    const { data: records = [], isLoading } = useQuery({
        queryKey: ["client_tracking", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from("client_tracking")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as ClientTrackingRecord[];
        },
        enabled: !!user,
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Unauthenticated");
            const payload = {
                user_id: user.id,
                client_name: form.client_name,
                company_name: form.company_name || null,
                phone: form.phone || null,
                service_type: form.service_type || null,
                project_start_date: form.project_start_date || null,
                project_end_date: form.project_end_date || null,
                deadline: form.deadline || null,
                project_status: form.project_status as any,
                payment_status: form.payment_status as any,
                total_budget: Number(form.total_budget) || 0,
                amount_paid: Number(form.amount_paid) || 0,
                last_contact_date: form.last_contact_date || null,
            };

            if (editingRecord) {
                const { error } = await supabase
                    .from("client_tracking")
                    .update(payload)
                    .eq("id", editingRecord.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("client_tracking")
                    .insert([payload]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["client_tracking"] });
            toast.success(editingRecord ? "Client tracking record updated" : "Client tracking record added");
            handleClose();
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to save record");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("client_tracking").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["client_tracking"] });
            toast.success("Record deleted successfully");
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to delete record");
        }
    });

    const handleOpen = (record?: ClientTrackingRecord) => {
        if (record) {
            setEditingRecord(record);
            setForm({
                client_name: record.client_name,
                company_name: record.company_name || "",
                phone: record.phone || "",
                service_type: record.service_type || "",
                project_start_date: record.project_start_date || "",
                project_end_date: record.project_end_date || "",
                deadline: record.deadline || "",
                project_status: record.project_status,
                payment_status: record.payment_status,
                total_budget: record.total_budget,
                amount_paid: record.amount_paid,
                last_contact_date: record.last_contact_date || "",
            });
        } else {
            setEditingRecord(null);
            setForm({
                client_name: "",
                company_name: "",
                phone: "",
                service_type: "",
                project_start_date: new Date().toISOString().split("T")[0],
                project_end_date: "",
                deadline: "",
                project_status: "in_progress",
                payment_status: "unpaid",
                total_budget: 0,
                amount_paid: 0,
                last_contact_date: new Date().toISOString().split("T")[0],
            });
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditingRecord(null);
    };

    const filteredRecords = records.filter(r =>
        r.client_name.toLowerCase().includes(search.toLowerCase()) ||
        (r.company_name && r.company_name.toLowerCase().includes(search.toLowerCase())) ||
        (r.client_id_code && r.client_id_code.toLowerCase().includes(search.toLowerCase())) ||
        (r.service_type && r.service_type.toLowerCase().includes(search.toLowerCase()))
    );

    const totalBudgetSum = records.reduce((acc, curr) => acc + (Number(curr.total_budget) || 0), 0);
    const totalPaidSum = records.reduce((acc, curr) => acc + (Number(curr.amount_paid) || 0), 0);
    const totalBalanceSum = totalBudgetSum - totalPaidSum;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "completed": return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Completed</Badge>;
            case "in_progress": return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">In Progress</Badge>;
            case "planning": return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Planning</Badge>;
            case "on_hold": return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">On Hold</Badge>;
            case "cancelled": return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Cancelled</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getPaymentBadge = (status: string) => {
        switch (status) {
            case "paid": return <Badge className="bg-emerald-600 text-white">Paid</Badge>;
            case "partially_paid": return <Badge className="bg-amber-500 text-white">Partially Paid</Badge>;
            case "overdue": return <Badge className="bg-red-600 text-white">Overdue</Badge>;
            default: return <Badge variant="secondary">Unpaid</Badge>;
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Client Tracking</h1>
                    <p className="text-sm text-muted-foreground">Monitor client projects, deadlines, budgets, and payment status in real-time.</p>
                </div>
                <Button onClick={() => handleOpen()} className="gap-2 shadow-sm">
                    <Plus className="h-4 w-4" /> Add Client Tracking
                </Button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-slate-900 text-white">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Clients Tracked</CardTitle>
                        <UserCheck className="h-4 w-4 text-blue-400" />
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                        <div className="text-2xl font-bold">{records.length}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Budget</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                        <div className="text-2xl font-bold text-emerald-600">₹{totalBudgetSum.toLocaleString("en-IN")}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount Received</CardTitle>
                        <DollarSign className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                        <div className="text-2xl font-bold text-blue-600">₹{totalPaidSum.toLocaleString("en-IN")}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outstanding Balance</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                        <div className="text-2xl font-bold text-amber-600">₹{totalBalanceSum.toLocaleString("en-IN")}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Table Search & Controls */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, company, code..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">Showing {filteredRecords.length} records</p>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                <TableRow>
                                    <TableHead className="w-[110px]">Client ID</TableHead>
                                    <TableHead>Client & Company</TableHead>
                                    <TableHead>Service</TableHead>
                                    <TableHead>Dates & Deadline</TableHead>
                                    <TableHead>Project Status</TableHead>
                                    <TableHead>Payment Status</TableHead>
                                    <TableHead className="text-right">Total Budget</TableHead>
                                    <TableHead className="text-right">Amount Paid</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                    <TableHead className="text-center w-[90px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground mt-2 block">Loading client tracking data...</span>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredRecords.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                                            No client tracking records found. Click "Add Client Tracking" to create one.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRecords.map((r) => (
                                        <TableRow key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                            <TableCell className="font-mono text-xs font-semibold text-blue-600">{r.client_id_code}</TableCell>
                                            <TableCell>
                                                <div className="font-medium text-sm text-slate-900 dark:text-slate-100">{r.client_name}</div>
                                                {r.company_name && <div className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" />{r.company_name}</div>}
                                                {r.phone && <div className="text-xs text-slate-400 flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</div>}
                                            </TableCell>
                                            <TableCell className="text-xs font-medium">{r.service_type || "N/A"}</TableCell>
                                            <TableCell className="text-xs space-y-0.5">
                                                <div><span className="text-slate-400">Start:</span> {r.project_start_date || "-"}</div>
                                                <div><span className="text-slate-400">End:</span> {r.project_end_date || "-"}</div>
                                                {r.deadline && <div className="text-red-500 font-medium"><span className="text-slate-400">Due:</span> {r.deadline}</div>}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(r.project_status)}</TableCell>
                                            <TableCell>{getPaymentBadge(r.payment_status)}</TableCell>
                                            <TableCell className="text-right font-medium text-xs">₹{Number(r.total_budget).toLocaleString("en-IN")}</TableCell>
                                            <TableCell className="text-right font-medium text-xs text-emerald-600">₹{Number(r.amount_paid).toLocaleString("en-IN")}</TableCell>
                                            <TableCell className="text-right font-semibold text-xs text-amber-600">₹{Number(r.balance || (r.total_budget - r.amount_paid)).toLocaleString("en-IN")}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpen(r)}>
                                                        <Edit className="h-4 w-4 text-blue-600" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                                        if (confirm("Are you sure you want to delete this client tracking record?")) {
                                                            deleteMutation.mutate(r.id);
                                                        }
                                                    }}>
                                                        <Trash2 className="h-4 w-4 text-red-600" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Modal Dialog */}
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingRecord ? "Edit Client Tracking" : "New Client Tracking Record"}</DialogTitle>
                        <DialogDescription>Enter client details, project timeline, budget, and payment tracking status.</DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Client Name *</Label>
                            <Input
                                placeholder="e.g. John Doe"
                                value={form.client_name}
                                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Company Name</Label>
                            <Input
                                placeholder="e.g. Acme Corp"
                                value={form.company_name}
                                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Phone</Label>
                            <Input
                                placeholder="+91 98765 43210"
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Service Type</Label>
                            <Input
                                placeholder="e.g. Web Development / ERP"
                                value={form.service_type}
                                onChange={(e) => setForm({ ...form, service_type: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Project Start Date</Label>
                            <Input
                                type="date"
                                value={form.project_start_date}
                                onChange={(e) => setForm({ ...form, project_start_date: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Project End Date</Label>
                            <Input
                                type="date"
                                value={form.project_end_date}
                                onChange={(e) => setForm({ ...form, project_end_date: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Deadline</Label>
                            <Input
                                type="date"
                                value={form.deadline}
                                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Last Contact Date</Label>
                            <Input
                                type="date"
                                value={form.last_contact_date}
                                onChange={(e) => setForm({ ...form, last_contact_date: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Project Status</Label>
                            <Select
                                value={form.project_status}
                                onValueChange={(val) => setForm({ ...form, project_status: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select project status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="planning">Planning</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="on_hold">On Hold</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Payment Status</Label>
                            <Select
                                value={form.payment_status}
                                onValueChange={(val) => setForm({ ...form, payment_status: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select payment status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unpaid">Unpaid</SelectItem>
                                    <SelectItem value="partially_paid">Partially Paid</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="overdue">Overdue</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Total Budget (₹)</Label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={form.total_budget}
                                onChange={(e) => setForm({ ...form, total_budget: Number(e.target.value) })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Amount Paid (₹)</Label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={form.amount_paid}
                                onChange={(e) => setForm({ ...form, amount_paid: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg flex items-center justify-between text-xs font-semibold">
                        <span>Calculated Outstanding Balance:</span>
                        <span className="text-amber-600 font-bold text-sm">
                            ₹{((Number(form.total_budget) || 0) - (Number(form.amount_paid) || 0)).toLocaleString("en-IN")}
                        </span>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={handleClose}>Cancel</Button>
                        <Button
                            onClick={() => saveMutation.mutate()}
                            disabled={!form.client_name || saveMutation.isPending}
                        >
                            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingRecord ? "Save Changes" : "Create Tracking Record"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
