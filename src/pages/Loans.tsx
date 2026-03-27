import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Landmark, Wallet, History, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

type Loan = {
    id: string;
    lender_name: string;
    amount: number;
    interest_rate: number | null;
    date: string;
    due_date: string | null;
    status: string;
    notes: string | null;
    created_at: string;
};

export default function Loans() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<Loan>>({
        lender_name: "", amount: 0, interest_rate: 0, date: format(new Date(), "yyyy-MM-dd"), due_date: "", status: "pending", notes: ""
    });

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: async () => {
            if (!user) return null;
            const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
            if (error) throw error;
            return data;
        },
        enabled: !!user,
    });

    const getCurrencySymbol = (currency?: string | null) => {
        switch (currency) {
            case "USD": return "$";
            case "EUR": return "€";
            case "GBP": return "£";
            case "AED": return "AED ";
            default: return "₹";
        }
    };

    const { data: loans = [], isLoading } = useQuery({
        queryKey: ["loans", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase.from("loans").select("*").eq("user_id", user.id).order("date", { ascending: false });
            if (error) throw error;
            return data as Loan[];
        },
        enabled: !!user,
    });

    const saveLoan = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Not authenticated");
            const payload = {
                lender_name: form.lender_name!,
                amount: Number(form.amount || 0),
                interest_rate: Number(form.interest_rate || 0),
                date: form.date,
                due_date: form.due_date || null,
                status: form.status || "pending",
                notes: form.notes || null,
                user_id: user.id
            };

            if (editingId) {
                const { error } = await supabase.from("loans").update(payload).eq("id", editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("loans").insert([payload]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["loans"] });
            setOpen(false);
            toast.success(editingId ? "Loan updated" : "Loan recorded");
        },
        onError: (e) => toast.error(e.message),
    });

    const deleteLoan = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("loans").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["loans"] });
            toast.success("Loan record deleted");
        },
        onError: (e) => toast.error(e.message),
    });

    const openCreate = () => {
        setEditingId(null);
        setForm({ lender_name: "", amount: 0, interest_rate: 0, date: format(new Date(), "yyyy-MM-dd"), due_date: "", status: "pending", notes: "" });
        setOpen(true);
    };

    const openEdit = (l: Loan) => {
        setEditingId(l.id);
        setForm({ ...l });
        setOpen(true);
    };

    const metrics = {
        total: loans.reduce((sum, l) => sum + Number(l.amount), 0),
        pending: loans.filter(l => l.status === "pending").reduce((sum, l) => sum + Number(l.amount), 0),
        paid: loans.filter(l => l.status === "paid").reduce((sum, l) => sum + Number(l.amount), 0),
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Borrowing & Loans</h1>
                    <p className="text-muted-foreground text-sm mt-1">Track money borrowed from lenders and manage repayments.</p>
                </div>
                <Button onClick={openCreate} className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" /> Record New Loan
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-blue-50/50 border-blue-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-800">Total Borrowed</CardTitle>
                        <Landmark className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700">
                            {getCurrencySymbol(profile?.default_currency)}{metrics.total.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-amber-50/50 border-amber-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-amber-800">Pending Repayment</CardTitle>
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-700">
                            {getCurrencySymbol(profile?.default_currency)}{metrics.pending.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-green-50/50 border-green-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-green-800">Total Paid</CardTitle>
                        <Wallet className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">
                            {getCurrencySymbol(profile?.default_currency)}{metrics.paid.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Lender</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Interest (%)</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-24 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading loans...</TableCell></TableRow>
                            ) : loans.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                                        <History className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                                        No loan records found.
                                    </TableCell>
                                </TableRow>
                            ) : loans.map((l) => (
                                <TableRow key={l.id}>
                                    <TableCell className="text-sm">
                                        {format(parseISO(l.date), "MMM d, yyyy")}
                                    </TableCell>
                                    <TableCell className="font-medium">{l.lender_name}</TableCell>
                                    <TableCell className="text-right font-bold">
                                        {getCurrencySymbol(profile?.default_currency)}{l.amount.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right">{l.interest_rate || 0}%</TableCell>
                                    <TableCell className="text-sm">
                                        {l.due_date ? format(parseISO(l.due_date), "MMM d, yyyy") : "-"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={l.status === "paid" ? "default" : l.status === "overdue" ? "destructive" : "outline"} className="capitalize">
                                            {l.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(l)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => deleteLoan.mutate(l.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Loan Record" : "Record New Loan"}</DialogTitle>
                        <DialogDescription className="sr-only">Add or update borrowing details.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="lender">Lender Name *</Label>
                            <Input
                                id="lender"
                                value={form.lender_name}
                                onChange={(e) => setForm({ ...form, lender_name: e.target.value })}
                                placeholder="Individual or Institution"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount *</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    value={form.amount}
                                    onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="interest">Interest Rate (%)</Label>
                                <Input
                                    id="interest"
                                    type="number"
                                    step="0.1"
                                    value={form.interest_rate}
                                    onChange={(e) => setForm({ ...form, interest_rate: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="date">Start Date</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={form.date}
                                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="due_date">Due Date</Label>
                                <Input
                                    id="due_date"
                                    type="date"
                                    value={form.due_date || ""}
                                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="status">Repayment Status</Label>
                            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="overdue">Overdue</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                value={form.notes || ""}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                placeholder="Additional details..."
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={() => saveLoan.mutate()} disabled={!form.lender_name || saveLoan.isPending}>
                            {saveLoan.isPending ? "Saving..." : "Save Record"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
