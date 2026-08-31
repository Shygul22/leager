import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import EntityDocumentsSection from "@/components/documents/EntityDocumentsSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isToday, isThisWeek, parseISO } from "date-fns";
import { Plus, Trash2, Edit, X, Receipt, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type BillItem = { id?: string; description: string; quantity: number; rate: number; gst: number; mrp?: number; discount?: number };
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
    discount_percentage?: number;
    paid_amount?: number;
    bill_items?: BillItem[];
    suppliers?: { name: string };
    employees?: { name: string };
};


const getCurrencySymbol = (currency?: string | null) => {
    switch (currency) {
        case "USD": return "$";
        case "EUR": return "€";
        case "GBP": return "£";
        case "AED": return "AED ";
        default: return "₹";
    }
};
export default function Bills() {
    const { user, role } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedRange, setSelectedRange] = useState<string>(format(new Date(), "MMM yyyy"));

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

    const formatAmount = (amount: number) => {
        return amount.toLocaleString(profile?.default_currency === "INR" ? "en-IN" : "en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const [form, setForm] = useState({
        bill_number: "",
        supplier_id: "",
        employee_id: "",
        date: format(new Date(), "yyyy-MM-dd"),
        due_date: "",
        notes: "",
        category: "Purchase",
        discount_percentage: 0,
        paid_amount: 0,
        status: "pending",
        items: [{ description: "", quantity: 1, rate: 0, gst: 0, mrp: 0, discount: 0 }] as BillItem[],
    });


    const { data: employees = [] } = useQuery({
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
            return data;
        },
        enabled: !!user,
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
        enabled: !!user,
    });

    const { data: bills = [], isLoading } = useQuery({
        queryKey: ["bills", user?.id, role],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase
                .from("bills")
                .select("*, suppliers(name), employees(name), bill_items(*)");
            
            const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
            if (!isStaffOrAbove) {
                query = query.eq("user_id", user.id);
            }
            
            const { data, error } = await query.order("date", { ascending: false });
            if (error) throw error;
            return data as unknown as Bill[];
        },
        enabled: !!user,
    });

    const uniqueMonths = useMemo(() => {
        const months = new Set<string>();
        months.add(format(new Date(), "MMM yyyy"));
        bills.forEach((bill: any) => months.add(format(new Date(bill.date), "MMM yyyy")));
        return Array.from(months);
    }, [bills]);

    const filteredBills = useMemo(() => {
        if (selectedRange === "all") return bills;
        if (selectedRange === "today") return bills.filter((bill: any) => isToday(parseISO(bill.date)));
        if (selectedRange === "this-week") return bills.filter((bill: any) => isThisWeek(parseISO(bill.date)));
        return bills.filter((bill: any) => format(new Date(bill.date), "MMM yyyy") === selectedRange);
    }, [bills, selectedRange]);

    const upsertBill = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("User not authenticated");

            const billPayload = {
                bill_number: form.bill_number,
                supplier_id: form.supplier_id,
                employee_id: (form.employee_id === "none" || !form.employee_id) ? null : form.employee_id,
                date: form.date,
                due_date: form.due_date || null,
                notes: form.notes || null,
                category: form.category || null,
                discount_percentage: form.discount_percentage || 0,
                paid_amount: form.paid_amount || 0,
                status: form.status || "pending",
            };


            let billId = editingId;

            if (editingId) {
                const { error } = await supabase.from("bills").update(billPayload).eq("id", editingId);
                if (error) throw error;
                await supabase.from("bill_items").delete().eq("bill_id", editingId);
            } else {
                const { data, error } = await supabase.from("bills").insert({ ...billPayload, user_id: user.id }).select().single();
                if (error) throw error;
                billId = data.id;
            }

            const items = form.items.filter(i => i.description).map(i => ({
                bill_id: billId,
                description: i.description,
                quantity: i.quantity,
                rate: i.rate,
                gst: i.gst,
                mrp: i.mrp || 0,
                discount: i.discount || 0
            }));

            if (items.length > 0) {
                const { error: itemErr } = await supabase.from("bill_items").insert(items);
                if (itemErr) throw itemErr;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bills"] });
            setOpen(false);
            toast.success(editingId ? "Bill updated" : "Bill recorded successfully");
        },
        onError: (e) => toast.error(e.message),
    });

    const updateStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            const { error } = await supabase.from("bills").update({ status }).eq("id", id);
            if (error) throw error;

            // If status changed to "paid", auto-log expense transaction
            if (status === "paid") {
                const bill = bills.find(b => b.id === id);
                if (bill && user) {
                    const total = getTotal(bill.bill_items, bill.discount_percentage);
                    await supabase.from("transactions").insert({
                        user_id: user.id,
                        date: format(new Date(), "yyyy-MM-dd"),
                        description: `Paid Bill ${bill.bill_number} - ${bill.suppliers?.name}`,
                        category: bill.category || "Purchase",
                        amount: total,
                        type: "expense",
                        employee_id: bill.employee_id || null
                    });
                    queryClient.invalidateQueries({ queryKey: ["transactions"] });
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bills"] });
            toast.success("Status updated");
        },
    });

    const deleteBill = useMutation({
        mutationFn: async (id: string) => {
            try {
                await supabase.from("bill_items").delete().eq("bill_id", id);
            } catch (e) {
                console.warn("Pre-delete bill items warning:", e);
            }
            const { error } = await supabase.from("bills").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bills"] });
            toast.success("Bill deleted successfully");
        },
    });

    const addItem = () => setForm({ ...form, items: [...form.items, { description: "", quantity: 1, rate: 0, gst: 0, mrp: 0, discount: 0 }] });
    const removeItem = (i: number) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
    const updateItem = (i: number, field: keyof BillItem, value: string | number) => {
        const items = [...form.items];
        const item = { ...items[i] } as any;
        item[field] = value;

        if (field === "mrp" || field === "discount") {
            const mrp = field === "mrp" ? Number(value) : (item.mrp || 0);
            const disc = field === "discount" ? Number(value) : (item.discount || 0);
            item.rate = mrp * (1 - disc / 100);
        } else if (field === "rate") {
            const rate = Number(value);
            const mrp = item.mrp || 0;
            if (mrp > 0) {
                item.discount = ((mrp - rate) / mrp) * 100;
            }
        }

        items[i] = item;
        setForm({ ...form, items });
    };

    const openCreate = () => {
        setEditingId(null);
        setForm({
            bill_number: "",
            supplier_id: "",
            employee_id: "",
            date: format(new Date(), "yyyy-MM-dd"),
            due_date: "",
            notes: "",
            category: "Purchase",
            discount_percentage: 0,
            paid_amount: 0,
            status: "pending",
            items: [{ description: "", quantity: 1, rate: 0, gst: 0, mrp: 0, discount: 0 }]
        });
        setOpen(true);
    };

    const openEdit = (bill: Bill) => {
        setEditingId(bill.id);
        setForm({
            bill_number: bill.bill_number,
            supplier_id: bill.supplier_id,
            employee_id: bill.employee_id || "",
            date: bill.date,
            due_date: bill.due_date || "",
            notes: bill.notes || "",
            category: bill.category || "Purchase",
            discount_percentage: bill.discount_percentage || 0,
            paid_amount: bill.paid_amount || 0,
            status: bill.status || "pending",
            items: bill.bill_items && bill.bill_items.length > 0 ? bill.bill_items.map(i => ({ ...i })) : [{ description: "", quantity: 1, rate: 0, gst: 0, mrp: 0, discount: 0 }],
        });
        setOpen(true);
    };


    const getSubtotal = (items?: BillItem[]) => (items || []).reduce((s, i) => s + i.quantity * i.rate, 0);
    const getGSTTotal = (items?: BillItem[], discountPercentage?: number) => {
        const totalGst = (items || []).reduce((s, i) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
        return totalGst * (1 - (discountPercentage || 0) / 100);
    };
    const getTotal = (items?: BillItem[], discountPercentage?: number) => {
        const sub = getSubtotal(items);
        const disc = sub * ((discountPercentage || 0) / 100);
        return (sub - disc) + getGSTTotal(items, discountPercentage);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Bills & Expenses</h1>
                        <p className="text-muted-foreground text-sm mt-1">Track money you owe and business purchases.</p>
                    </div>
                    <Select value={selectedRange} onValueChange={setSelectedRange}>
                        <SelectTrigger className="w-full sm:w-[160px]">
                            <SelectValue placeholder="Select Range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Time</SelectItem>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="this-week">This Week</SelectItem>
                            {uniqueMonths.map(month => (
                                <SelectItem key={month} value={month}>{month}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={openCreate} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Record Bill</Button>
            </div>

            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    <Table className="min-w-[800px] md:min-w-full">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date / Bill #</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="text-right">Paid</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                                <TableHead className="w-24 text-right">Actions</TableHead>
                            </TableRow>

                        </TableHeader>
                        <TableBody>
                            {filteredBills.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                                        {isLoading ? "Loading bills..." : "No bills found for this period."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredBills.map((bill) => (
                                    <TableRow key={bill.id}>
                                        <TableCell>
                                            <div className="font-medium">{format(new Date(bill.date), "MMM d, yyyy")}</div>
                                            <div className="text-xs text-muted-foreground font-mono">{bill.bill_number}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-semibold">{bill.suppliers?.name}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-[10px] py-0">{bill.category}</Badge>
                                                {bill.employees?.name && (
                                                    <span className="flex items-center text-[10px] text-muted-foreground">
                                                        <UserCircle className="h-3 w-3 mr-1" /> {bill.employees.name}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Select value={bill.status} onValueChange={(v) => updateStatus.mutate({ id: bill.id, status: v })}>
                                                <SelectTrigger className="w-28 h-8 capitalize">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pending">Pending</SelectItem>
                                                    <SelectItem value="paid">Paid</SelectItem>
                                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {getCurrencySymbol(profile?.default_currency)}
                                            {formatAmount(getTotal(bill.bill_items, bill.discount_percentage))}
                                        </TableCell>
                                        <TableCell className="text-right text-emerald-600 font-medium">
                                            {getCurrencySymbol(profile?.default_currency)}
                                            {(bill.paid_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right text-destructive font-bold">
                                            {getCurrencySymbol(profile?.default_currency)}
                                            {(getTotal(bill.bill_items, bill.discount_percentage) - (bill.paid_amount || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                        </TableCell>

                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(bill)}><Edit className="h-4 w-4" /></Button>
                                                {(role === "admin" || role === "accounts_manager") && (
                                                    <Button variant="ghost" size="icon" onClick={() => deleteBill.mutate(bill.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                )}
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
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Bill" : "Record New Bill"}</DialogTitle>
                        <DialogDescription className="sr-only">Enter bill details and line items below.</DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                        <div className="md:col-span-1 space-y-4">
                            <div className="space-y-2">
                                <Label>Supplier <span className="text-destructive">*</span></Label>
                                <Select value={form.supplier_id} onValueChange={(val) => setForm({ ...form, supplier_id: val })}>
                                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Bill / Invoice Number</Label>
                                <Input value={form.bill_number} onChange={(e) => setForm({ ...form, bill_number: e.target.value })} placeholder="e.g. BILL-001" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Due Date</Label>
                                    <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Inventory, Utilities" />
                            </div>
                            <div className="space-y-2">
                                <Label>Employee (Expense incurred by)</Label>
                                <Select value={form.employee_id} onValueChange={(val) => setForm({ ...form, employee_id: val })}>
                                    <SelectTrigger><SelectValue placeholder="Select employee (optional)" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None / Company Expense</SelectItem>
                                        {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Notes</Label>
                                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes..." className="h-20" />
                            </div>
                            <div className="space-y-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                <Label className="text-emerald-900">Amount Already Paid ({getCurrencySymbol(profile?.default_currency)})</Label>
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    value={form.paid_amount} 
                                    onChange={(e) => setForm({ ...form, paid_amount: parseFloat(e.target.value) || 0 })} 
                                    className="bg-white"
                                />
                            </div>
                        </div>


                        <div className="md:col-span-2 space-y-4">
                            <Label className="text-lg font-semibold flex items-center"><Receipt className="mr-2 h-5 w-5" /> Line Items</Label>
                            <div className="space-y-3">
                                {form.items.map((item, i) => (
                                    <div key={i} className="flex flex-col md:flex-row gap-2 border p-3 rounded-lg bg-muted/20 relative group">
                                        <div className="flex-1 space-y-1">
                                            <Label className="text-[10px] uppercase text-muted-foreground font-bold">Item Description</Label>
                                            <Input value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="What did you buy?" className="bg-background" />
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 w-full md:w-auto items-end">
                                            <div className="space-y-1 w-14">
                                                <Label className="text-[10px] uppercase text-muted-foreground font-bold text-center block">Qty</Label>
                                                <Input type="number" value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} className="text-center bg-background p-1" />
                                            </div>
                                            <div className="space-y-1 w-20">
                                                <Label className="text-[10px] uppercase text-muted-foreground font-bold text-right block">MRP</Label>
                                                <Input type="number" step="0.01" value={item.mrp} onChange={(e) => updateItem(i, "mrp", Number(e.target.value))} className="text-right bg-background p-1" />
                                            </div>
                                            <div className="space-y-1 w-16">
                                                <Label className="text-[10px] uppercase text-muted-foreground font-bold text-right block">Disc %</Label>
                                                <Input type="number" step="0.1" value={item.discount} onChange={(e) => updateItem(i, "discount", Number(e.target.value))} className="text-right bg-background p-1" />
                                            </div>
                                            <div className="space-y-1 w-20">
                                                <Label className="text-[10px] uppercase text-muted-foreground font-bold text-right block">Rate</Label>
                                                <Input type="number" step="0.01" value={item.rate} onChange={(e) => updateItem(i, "rate", Number(e.target.value))} className="text-right bg-background p-1 font-semibold" />
                                            </div>
                                            <div className="space-y-1 w-16">
                                                <Label className="text-[10px] uppercase text-muted-foreground font-bold text-right block">GST %</Label>
                                                <Input type="number" value={item.gst} onChange={(e) => updateItem(i, "gst", Number(e.target.value))} className="text-right bg-background p-1" />
                                            </div>
                                        </div>
                                        {form.items.length > 1 && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive self-end md:self-center" onClick={() => removeItem(i)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={addItem} className="w-full border-dashed"><Plus className="mr-2 h-4 w-4" /> Add Line Item</Button>
                            </div>

                            <div className="bg-secondary/10 p-4 rounded-lg border border-border/50 flex flex-col items-end space-y-2 mt-6">
                                <div className="flex justify-between w-full text-sm">
                                    <span className="text-muted-foreground">Subtotal:</span>
                                    <span>{getCurrencySymbol(profile?.default_currency)}{getSubtotal(form.items).toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between w-full text-sm text-red-500 font-medium">
                                    <div className="flex items-center gap-2">
                                        <span>Discount (%)</span>
                                        <Input type="number" className="h-7 w-16 text-xs bg-white text-black" value={form.discount_percentage} onChange={(e) => setForm({ ...form, discount_percentage: parseFloat(e.target.value) || 0 })} />
                                    </div>
                                    <span>-{getCurrencySymbol(profile?.default_currency)}{(getSubtotal(form.items) * (form.discount_percentage / 100)).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between w-full text-sm border-b pb-2">
                                    <span className="text-muted-foreground">GST Total:</span>
                                    <span>{getCurrencySymbol(profile?.default_currency)}{getGSTTotal(form.items, form.discount_percentage).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between w-full text-xl font-bold pt-2">
                                    <span>Total Amount:</span>
                                    <span className="text-primary">{getCurrencySymbol(profile?.default_currency)}{getTotal(form.items, form.discount_percentage).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between w-full text-sm text-emerald-600 font-medium pt-1">
                                    <span>Paid:</span>
                                    <span>{getCurrencySymbol(profile?.default_currency)}{form.paid_amount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between w-full text-lg font-bold text-destructive pt-1 border-t border-dashed mt-1">
                                    <span>Balance Due:</span>
                                    <span>{getCurrencySymbol(profile?.default_currency)}{(getTotal(form.items, form.discount_percentage) - form.paid_amount).toFixed(2)}</span>
                                </div>
                            </div>

                        </div>
                    </div>

                    {editingId && (
                        <div className="mt-6 pt-6 border-t border-slate-800">
                            <EntityDocumentsSection 
                                entityId={editingId}
                                entityType="bill"
                                title="Bill Invoices & Receipts"
                                description="Attach and manage original supplier invoices or payment slips for this bill."
                            />
                        </div>
                    )}

                    <DialogFooter className="mt-6 border-t pt-4">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={() => upsertBill.mutate()} disabled={upsertBill.isPending || !form.supplier_id}>
                            {upsertBill.isPending ? "Recording..." : "Save Bill"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
