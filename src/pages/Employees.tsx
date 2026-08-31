import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import EntityDocumentsSection from "@/components/documents/EntityDocumentsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Mail, Phone, Edit, User, Briefcase, Eye, Receipt, X, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

type BillItem = { id?: string; description: string; quantity: number; rate: number; gst: number };
type Bill = {
    id: string;
    bill_number: string;
    supplier_id: string;
    employee_id?: string | null;
    date: string;
    due_date: string;
    status: string;
    notes: string | null;
    category: string | null;
    created_at: string;
    bill_items?: BillItem[];
    suppliers?: { name: string };
};

type Employee = {
    id: string;
    name: string;
    designation: string | null;
    email: string | null;
    phone: string | null;
    created_at: string;
};

export default function Employees() {
    const { user, role } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: "",
        designation: "",
        email: "",
        phone: ""
    });

    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [billEditOpen, setBillEditOpen] = useState(false);
    const [editingBillId, setEditingBillId] = useState<string | null>(null);
    const [billForm, setBillForm] = useState({
        bill_number: "",
        supplier_id: "",
        date: format(new Date(), "yyyy-MM-dd"),
        due_date: "",
        notes: "",
        category: "Purchase",
        items: [{ description: "", quantity: 1, rate: 0, gst: 0 }] as BillItem[],
    });

    const { data: suppliers = [] } = useQuery({
        queryKey: ["suppliers", user?.id, role],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("suppliers").select("*");
            const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
            if (!isStaffOrAbove) {
                query = query.eq("user_id", user.id);
            }
            const { data, error } = await query.order("name", { ascending: true });
            if (error) throw error;
            return data;
        },
        enabled: !!user && !!role,
    });

    const { data: employees = [], isLoading: loadingEmployees } = useQuery({
        queryKey: ["employees", user?.id, role],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("employees").select("*");
            const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
            if (!isStaffOrAbove) {
                query = query.eq("user_id", user.id);
            }
            const { data, error } = await query.order("name", { ascending: true });

            if (error) throw error;
            return data as Employee[];
        },
        enabled: !!user && !!role,
    });

    const { data: bills = [], isLoading: loadingBills } = useQuery({
        queryKey: ["bills", user?.id, role],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("bills").select("*, bill_items(*)");
            const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
            if (!isStaffOrAbove) {
                query = query.eq("user_id", user.id);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
        enabled: !!user && !!role,
    });


    const { data: transactions = [], isLoading: loadingTransactions } = useQuery({
        queryKey: ["transactions", user?.id, role],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("transactions").select("*").eq("type", "expense");
            const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
            if (!isStaffOrAbove) {
                query = query.eq("user_id", user.id);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
        enabled: !!user && !!role,
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

    const getEmployeeSpend = (employeeId: string) => {
        const billsTotal = bills
            .filter(b => b.employee_id === employeeId && b.status !== "paid")
            .reduce((sum, b) => {
                const total = (b.bill_items || []).reduce((s: number, i: any) => s + (i.quantity * i.rate * (1 + (i.gst || 0) / 100)), 0);
                return sum + total;
            }, 0);

        const transactionsTotal = transactions
            .filter(t => t.employee_id === employeeId)
            .reduce((sum, t) => sum + Number(t.amount), 0);

        return billsTotal + transactionsTotal;
    };

    const isLoading = loadingEmployees || loadingBills || loadingTransactions;

    const upsertEmployee = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("User not authenticated");

            const payload = {
                name: form.name,
                designation: form.designation || null,
                email: form.email || null,
                phone: form.phone || null,
            };

            if (editingId) {
                const { error } = await supabase.from("employees").update(payload).eq("id", editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("employees").insert({ ...payload, user_id: user.id });
                if (error) throw error;
            }
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            setOpen(false);
            setEditingId(null);
            toast.success(editingId ? "Employee updated!" : "Employee added successfully!");
        },
        onError: (e) => toast.error(e.message),
    });

    const deleteEmployee = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("employees").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            toast.success("Employee removed");
        },
        onError: (e) => toast.error(e.message),
    });

    const openCreate = () => {
        setEditingId(null);
        setForm({ name: "", designation: "", email: "", phone: "" });
        setOpen(true);
    };

    const openEdit = (emp: Employee) => {
        setEditingId(emp.id);
        setForm({
            name: emp.name,
            designation: emp.designation || "",
            email: emp.email || "",
            phone: emp.phone || ""
        });
        setOpen(true);
    };

    const openDetails = (emp: Employee) => {
        setSelectedEmployee(emp);
        setDetailOpen(true);
    };

    const openBillEdit = (bill: any) => {
        setEditingBillId(bill.id);
        setBillForm({
            bill_number: bill.bill_number || "",
            supplier_id: bill.supplier_id || "",
            date: bill.date || format(new Date(), "yyyy-MM-dd"),
            due_date: bill.due_date || "",
            notes: bill.notes || "",
            category: bill.category || "Purchase",
            items: bill.bill_items && bill.bill_items.length > 0
                ? bill.bill_items.map((i: any) => ({ ...i }))
                : [{ description: "", quantity: 1, rate: 0, gst: 0 }],
        });
        setBillEditOpen(true);
    };

    const upsertBill = useMutation({
        mutationFn: async () => {
            if (!user || !selectedEmployee) throw new Error("No user or employee selected");

            const billPayload = {
                bill_number: billForm.bill_number,
                supplier_id: billForm.supplier_id,
                employee_id: selectedEmployee.id,
                date: billForm.date,
                due_date: billForm.due_date || null,
                notes: billForm.notes || null,
                category: billForm.category || null,
            };

            if (editingBillId) {
                const { error } = await supabase.from("bills").update(billPayload).eq("id", editingBillId);
                if (error) throw error;
                await supabase.from("bill_items").delete().eq("bill_id", editingBillId);
                const items = billForm.items.filter(i => i.description).map(i => ({
                    bill_id: editingBillId,
                    description: i.description,
                    quantity: i.quantity,
                    rate: i.rate,
                    gst: i.gst
                }));
                if (items.length > 0) {
                    const { error: itemErr } = await supabase.from("bill_items").insert(items);
                    if (itemErr) throw itemErr;
                }
            } else {
                const { data, error } = await supabase.from("bills").insert({ ...billPayload, user_id: user.id }).select().single();
                if (error) throw error;
                const items = billForm.items.filter(i => i.description).map(i => ({
                    bill_id: data.id,
                    description: i.description,
                    quantity: i.quantity,
                    rate: i.rate,
                    gst: i.gst
                }));
                if (items.length > 0) {
                    const { error: itemErr } = await supabase.from("bill_items").insert(items);
                    if (itemErr) throw itemErr;
                }
            }
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bills"] });
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
            setBillEditOpen(false);
            toast.success("Bill updated");
        },
        onError: (e) => toast.error(e.message),
    });

    const updateBillItem = (i: number, field: keyof BillItem, value: string | number) => {
        const items = [...billForm.items];
        (items[i] as any)[field] = value;
        setBillForm({ ...billForm, items });
    };

    const addBillItem = () => setBillForm({ ...billForm, items: [...billForm.items, { description: "", quantity: 1, rate: 0, gst: 0 }] });
    const removeBillItem = (i: number) => setBillForm({ ...billForm, items: billForm.items.filter((_, idx) => idx !== i) });

    const getSubtotal = (items?: BillItem[]) => (items || []).reduce((s, i) => s + i.quantity * i.rate, 0);
    const getGSTTotal = (items?: BillItem[]) => (items || []).reduce((s, i) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
    const getTotal = (items?: BillItem[]) => getSubtotal(items) + getGSTTotal(items);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
                    <p className="text-muted-foreground text-sm mt-1">Manage your team and track their business expenses.</p>
                </div>
                <Button onClick={openCreate} className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" /> Add Employee
                </Button>
            </div>

            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    <Table className="min-w-[600px] md:min-w-full">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name / Designation</TableHead>
                                <TableHead>Contact Info</TableHead>
                                <TableHead className="text-right">Total Expenses</TableHead>
                                <TableHead className="w-24 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {employees.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground py-12">
                                        {isLoading ? "Loading employees..." : "No employees found. Add your first team member."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                employees.map((emp) => (
                                    <TableRow key={emp.id}>
                                        <TableCell>
                                            <div className="font-medium">{emp.name}</div>
                                            {emp.designation && (
                                                <div className="flex items-center text-xs text-muted-foreground mt-0.5">
                                                    <Briefcase className="h-3 w-3 mr-1" /> {emp.designation}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                {emp.email && (
                                                    <div className="flex items-center text-sm text-muted-foreground">
                                                        <Mail className="h-3 w-3 mr-1.5" /> {emp.email}
                                                    </div>
                                                )}
                                                {emp.phone && (
                                                    <div className="flex items-center text-sm text-muted-foreground">
                                                        <Phone className="h-3 w-3 mr-1.5" /> {emp.phone}
                                                    </div>
                                                )}
                                                {!emp.email && !emp.phone && <span className="text-muted-foreground text-xs italic">No contact info</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                className="font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2 h-8"
                                                onClick={() => openDetails(emp)}
                                            >
                                                {getCurrencySymbol(profile?.default_currency)}{getEmployeeSpend(emp.id).toLocaleString(profile?.default_currency === "INR" ? "en-IN" : "en-US", { minimumFractionDigits: 2 })}
                                                <Eye className="ml-2 h-3 w-3 opacity-50" />
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => deleteEmployee.mutate(emp.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Employee" : "Add New Employee"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
                            <Input
                                id="name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Employee name"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="designation">Designation</Label>
                            <Input
                                id="designation"
                                value={form.designation}
                                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                                placeholder="e.g. Sales Manager, Developer"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="email@company.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    placeholder="Phone number"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => upsertEmployee.mutate()}
                            disabled={upsertEmployee.isPending || !form.name.trim()}
                        >
                            {upsertEmployee.isPending ? "Saving..." : "Save Employee"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Employee Detail & Expense View */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            {selectedEmployee?.name}'s Expenses
                        </DialogTitle>
                        <DialogDescription>
                            Reviewing all documented expenses for {selectedEmployee?.name}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Card className="bg-amber-50/50 border-amber-100">
                                <CardHeader className="py-3 px-4">
                                    <CardTitle className="text-sm font-medium text-amber-800">Total Spent</CardTitle>
                                </CardHeader>
                                <CardContent className="py-0 px-4 pb-4">
                                    <div className="text-2xl font-bold text-amber-700">
                                        {getCurrencySymbol(profile?.default_currency)}{selectedEmployee && getEmployeeSpend(selectedEmployee.id).toLocaleString()}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-semibold flex items-center gap-2 px-1">
                                <Receipt className="h-4 w-4" /> Bills & Purchases
                            </h3>
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date / #</TableHead>
                                            <TableHead>Supplier</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                            <TableHead className="w-10"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {bills.filter(b => b.employee_id === selectedEmployee?.id).length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">No bills assigned.</TableCell>
                                            </TableRow>
                                        ) : (
                                            bills.filter(b => b.employee_id === selectedEmployee?.id).map((bill: any) => (
                                                <TableRow key={bill.id}>
                                                    <TableCell>
                                                        <div className="text-xs">{format(parseISO(bill.date), "MMM d, yyyy")}</div>
                                                        <div className="font-mono text-[10px] text-muted-foreground">{bill.bill_number}</div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">{bill.suppliers?.name || "Unknown"}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={bill.status === "paid" ? "default" : "outline"} className="capitalize text-[10px]">
                                                            {bill.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {getCurrencySymbol(profile?.default_currency)}{getTotal(bill.bill_items).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openBillEdit(bill)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-semibold flex items-center gap-2 px-1">
                                <Mail className="h-4 w-4" /> Other Ledger Expenses
                            </h3>
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactions.filter(t => t.employee_id === selectedEmployee?.id).length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center text-muted-foreground py-6">No direct transactions found.</TableCell>
                                            </TableRow>
                                        ) : (
                                            transactions.filter(t => t.employee_id === selectedEmployee?.id).map((t: any) => (
                                                <TableRow key={t.id}>
                                                    <TableCell className="text-xs">{format(parseISO(t.date), "MMM d, yyyy")}</TableCell>
                                                    <TableCell className="text-sm">{t.description}</TableCell>
                                                    <TableCell className="text-right font-medium text-destructive">
                                                        -{getCurrencySymbol(profile?.default_currency)}{Number(t.amount).toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {selectedEmployee && (
                            <div className="pt-4 border-t border-slate-800">
                                <EntityDocumentsSection 
                                    entityId={selectedEmployee.id}
                                    entityType="employee"
                                    title="Employee Verification & KYC Documents"
                                    description="Manage PAN, Aadhaar, Passport copies, and contracts for this employee."
                                />
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Bill Quick Edit Dialog */}
            <Dialog open={billEditOpen} onOpenChange={setBillEditOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Bill for {selectedEmployee?.name}</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                        <div className="md:col-span-1 space-y-4">
                            <div className="space-y-2">
                                <Label>Supplier</Label>
                                <Select value={billForm.supplier_id} onValueChange={(val) => setBillForm({ ...billForm, supplier_id: val })}>
                                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Bill Number</Label>
                                <Input value={billForm.bill_number} onChange={(e) => setBillForm({ ...billForm, bill_number: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input type="date" value={billForm.date} onChange={(e) => setBillForm({ ...billForm, date: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Input value={billForm.category} onChange={(e) => setForm({ ...billForm, category: e.target.value })} />
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-4">
                            <Label className="text-lg font-semibold flex items-center"><Receipt className="mr-2 h-5 w-5" /> Line Items</Label>
                            <div className="space-y-3">
                                {billForm.items.map((item, i) => (
                                    <div key={i} className="flex gap-2 border p-3 rounded-lg bg-muted/20 relative">
                                        <div className="flex-1">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Description</Label>
                                            <Input value={item.description} onChange={(e) => updateBillItem(i, "description", e.target.value)} />
                                        </div>
                                        <div className="w-16">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Qty</Label>
                                            <Input type="number" value={item.quantity} onChange={(e) => updateBillItem(i, "quantity", Number(e.target.value))} />
                                        </div>
                                        <div className="w-24">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Rate</Label>
                                            <Input type="number" value={item.rate} onChange={(e) => updateBillItem(i, "rate", Number(e.target.value))} />
                                        </div>
                                        {billForm.items.length > 1 && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive self-end" onClick={() => removeBillItem(i)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={addBillItem} className="w-full border-dashed"><Plus className="mr-2 h-4 w-4" /> Add Line Item</Button>
                            </div>

                            <div className="bg-secondary/10 p-4 rounded-lg flex flex-col items-end space-y-1 mt-4">
                                <div className="text-sm text-muted-foreground">Subtotal: {getCurrencySymbol(profile?.default_currency)}{getSubtotal(billForm.items).toFixed(2)}</div>
                                <div className="text-sm text-muted-foreground">GST: {getCurrencySymbol(profile?.default_currency)}{getGSTTotal(billForm.items).toFixed(2)}</div>
                                <div className="text-xl font-bold pt-2 border-t w-48 text-right">
                                    Total: {getCurrencySymbol(profile?.default_currency)}{getTotal(billForm.items).toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => setBillEditOpen(false)}>Cancel</Button>
                        <Button onClick={() => upsertBill.mutate()} disabled={upsertBill.isPending}>
                            {upsertBill.isPending ? "Updating..." : "Update Bill"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
