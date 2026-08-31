import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
    Building2, Mail, Phone, MapPin, User, Banknote, CreditCard, 
    Calendar, CheckCircle2, Clock, FileText, ArrowUpRight, Receipt, Edit, ShieldAlert, Printer 
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { SupplierExtended, VendorPayout } from "@/types/supplierPayout";

interface SupplierProfileModalProps {
    supplier: SupplierExtended | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRecordPayout: (supplier: SupplierExtended) => void;
    onEditSupplier: (supplier: SupplierExtended) => void;
}

export default function SupplierProfileModal({
    supplier,
    open,
    onOpenChange,
    onRecordPayout,
    onEditSupplier
}: SupplierProfileModalProps) {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("overview");

    // Fetch supplier bills/purchases history
    const { data: bills = [], isLoading: isLoadingBills } = useQuery({
        queryKey: ["supplier-bills", supplier?.id],
        queryFn: async () => {
            if (!supplier?.id) return [];
            const { data, error } = await supabase
                .from("bills")
                .select("*, bill_items(*)")
                .eq("supplier_id", supplier.id)
                .order("date", { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!supplier?.id && open,
    });

    // Fetch supplier payouts history
    const { data: payouts = [], isLoading: isLoadingPayouts } = useQuery({
        queryKey: ["supplier-payouts", supplier?.id],
        queryFn: async () => {
            if (!supplier?.id) return [];
            const { data, error } = await supabase
                .from("vendor_payouts")
                .select("*")
                .eq("supplier_id", supplier.id)
                .order("created_at", { ascending: false });
            if (error) return [];
            return (data || []) as VendorPayout[];
        },
        enabled: !!supplier?.id && open,
    });

    // Toggle Supplier Status mutation
    const toggleStatusMutation = useMutation({
        mutationFn: async () => {
            if (!supplier) return;
            const newStatus = supplier.status === "active" ? "inactive" : "active";
            const { error } = await supabase
                .from("suppliers")
                .update({ status: newStatus })
                .eq("id", supplier.id);
            if (error) throw error;
            return newStatus;
        },
        onSuccess: (newStatus) => {
            queryClient.invalidateQueries({ queryKey: ["suppliers"] });
            toast.success(`Supplier marked as ${newStatus}`);
        },
        onError: (err) => toast.error("Failed to update status: " + (err as Error).message),
    });

    const handlePrintStatement = () => {
        window.print();
    };

    if (!supplier) return null;

    // Calculate metrics
    const totalBillsAmount = bills.reduce((acc, bill) => {
        const items = bill.bill_items || [];
        const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.rate), 0);
        const gst = items.reduce((s: number, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
        const disc = subtotal * ((bill.discount_percentage || 0) / 100);
        return acc + (subtotal - disc + gst);
    }, 0);

    const totalPaidAmount = bills.reduce((acc, bill) => acc + (bill.paid_amount || 0), 0);
    const totalPayoutsSum = payouts.filter(p => p.status === 'paid').reduce((acc, p) => acc + Number(p.amount), 0);
    const effectivePaid = Math.max(totalPaidAmount, totalPayoutsSum);
    const outstandingBalance = Math.max(0, totalBillsAmount - effectivePaid);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:shadow-none print:border-none">
                <DialogHeader className="border-b pb-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 font-bold text-xl">
                                {supplier.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <DialogTitle className="text-xl font-bold">{supplier.name}</DialogTitle>
                                    <Badge 
                                        variant={supplier.status === "active" ? "default" : "secondary"}
                                        className={supplier.status === "active" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}
                                    >
                                        {supplier.status === "active" ? "Active Vendor" : "Inactive"}
                                    </Badge>
                                    {supplier.category && (
                                        <Badge variant="outline" className="text-xs">
                                            {supplier.category}
                                        </Badge>
                                    )}
                                </div>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    {supplier.contact_name ? `Contact: ${supplier.contact_name}` : "Supplier Profile & Financial Ledger Statement"}
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap print:hidden">
                            <Button 
                                size="sm"
                                variant="outline"
                                onClick={handlePrintStatement}
                            >
                                <Printer className="h-3.5 w-3.5 mr-1" /> Print Statement
                            </Button>
                            <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => toggleStatusMutation.mutate()}
                                disabled={toggleStatusMutation.isPending}
                            >
                                {supplier.status === "active" ? "Deactivate" : "Activate"}
                            </Button>
                            <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    onOpenChange(false);
                                    onEditSupplier(supplier);
                                }}
                            >
                                <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                            <Button 
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                onClick={() => {
                                    onOpenChange(false);
                                    onRecordPayout(supplier);
                                }}
                            >
                                <Banknote className="h-4 w-4 mr-1.5" /> Send Payout
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {/* Summary KPI Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                    <Card className="bg-muted/30 border-muted">
                        <CardContent className="p-3">
                            <span className="text-[11px] font-medium text-muted-foreground block">Total Purchases</span>
                            <span className="text-lg font-bold text-foreground">₹{totalBillsAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            <span className="text-[10px] text-muted-foreground block mt-0.5">{bills.length} bills recorded</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-50/50 border-emerald-200/60 dark:bg-emerald-950/20">
                        <CardContent className="p-3">
                            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 block">Total Paid</span>
                            <span className="text-lg font-bold text-emerald-600">₹{effectivePaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            <span className="text-[10px] text-emerald-600/80 block mt-0.5">{payouts.length} payouts completed</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-rose-50/50 border-rose-200/60 dark:bg-rose-950/20">
                        <CardContent className="p-3">
                            <span className="text-[11px] font-medium text-rose-700 dark:text-rose-400 block">Outstanding Balance</span>
                            <span className="text-lg font-bold text-rose-600">₹{outstandingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            <span className="text-[10px] text-rose-600/80 block mt-0.5">Amount payable</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-50/50 border-blue-200/60 dark:bg-blue-950/20">
                        <CardContent className="p-3">
                            <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400 block">Payment Terms</span>
                            <span className="text-sm font-bold text-blue-600 mt-1 block">{supplier.payment_terms || "Net 30"}</span>
                            <span className="text-[10px] text-blue-600/80 block mt-0.5">Standard terms</span>
                        </CardContent>
                    </Card>
                </div>

                {/* On screen interactive Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full print:hidden">
                    <TabsList className="grid grid-cols-3 w-full mb-4">
                        <TabsTrigger value="overview">Profile & Bank Details</TabsTrigger>
                        <TabsTrigger value="bills">Purchase Bills ({bills.length})</TabsTrigger>
                        <TabsTrigger value="payouts">Vendor Payouts ({payouts.length})</TabsTrigger>
                    </TabsList>

                    {/* Profile & Bank Overview */}
                    <TabsContent value="overview" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Contact Details */}
                            <Card>
                                <CardHeader className="py-3 px-4 bg-muted/20 border-b">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-emerald-600" /> Vendor Contact Info
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Contact Person:</span>
                                        <span className="font-semibold">{supplier.contact_name || "-"}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email:</span>
                                        <span className="font-semibold">{supplier.email || "-"}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone:</span>
                                        <span className="font-semibold">{supplier.phone || "-"}</span>
                                    </div>
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="text-muted-foreground flex items-center gap-1.5 shrink-0"><MapPin className="h-3.5 w-3.5" /> Address:</span>
                                        <span className="font-semibold text-right max-w-[200px]">{supplier.address || "-"}</span>
                                    </div>
                                    <div className="flex items-center justify-between border-t pt-2 mt-2">
                                        <span className="text-muted-foreground font-mono">GSTIN / Tax ID:</span>
                                        <Badge variant="outline" className="font-mono text-xs">{supplier.gstin || "Not Specified"}</Badge>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Bank Details */}
                            <Card>
                                <CardHeader className="py-3 px-4 bg-muted/20 border-b">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <CreditCard className="h-4 w-4 text-blue-600" /> Settlement & Bank Account
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Bank Name:</span>
                                        <span className="font-bold text-foreground">{supplier.bank_name || "-"}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Account Number:</span>
                                        <span className="font-mono font-bold text-primary">{supplier.account_number || "-"}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">IFSC Code:</span>
                                        <span className="font-mono font-semibold">{supplier.ifsc_code || "-"}</span>
                                    </div>
                                    {supplier.swift_code && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">SWIFT Code:</span>
                                            <span className="font-mono font-semibold">{supplier.swift_code}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between border-t pt-2 mt-2">
                                        <span className="text-muted-foreground">UPI ID:</span>
                                        <span className="font-mono font-bold text-emerald-600">{supplier.upi_id || "-"}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {supplier.notes && (
                            <Card className="bg-amber-50/40 border-amber-200/60 dark:bg-amber-950/20">
                                <CardContent className="p-3 text-xs text-amber-900 dark:text-amber-300">
                                    <strong>Vendor Notes:</strong> {supplier.notes}
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Purchase Bills Tab */}
                    <TabsContent value="bills">
                        <Card>
                            <CardContent className="p-0">
                                <Table className="text-xs">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Bill # / Date</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Total Amount</TableHead>
                                            <TableHead className="text-right">Paid</TableHead>
                                            <TableHead className="text-right">Balance Due</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {bills.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                                    No purchase bills recorded for this vendor.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            bills.map((b: any) => {
                                                const items = b.bill_items || [];
                                                const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.rate), 0);
                                                const gst = items.reduce((s: number, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
                                                const disc = subtotal * ((b.discount_percentage || 0) / 100);
                                                const billTotal = subtotal - disc + gst;
                                                const paid = b.paid_amount || 0;
                                                const bal = Math.max(0, billTotal - paid);

                                                return (
                                                    <TableRow key={b.id}>
                                                        <TableCell className="font-medium">
                                                            <div className="font-mono text-primary font-bold">{b.bill_number}</div>
                                                            <div className="text-[10px] text-muted-foreground">{format(parseISO(b.date), "dd MMM yyyy")}</div>
                                                        </TableCell>
                                                        <TableCell>{b.category || "Purchase"}</TableCell>
                                                        <TableCell>
                                                            <Badge 
                                                                variant="outline"
                                                                className={
                                                                    b.status === "paid" ? "bg-emerald-500/10 text-emerald-600 border-emerald-300" :
                                                                    b.status === "pending" ? "bg-amber-500/10 text-amber-600 border-amber-300" :
                                                                    "bg-muted text-muted-foreground"
                                                                }
                                                            >
                                                                {b.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">₹{billTotal.toFixed(2)}</TableCell>
                                                        <TableCell className="text-right text-emerald-600">₹{paid.toFixed(2)}</TableCell>
                                                        <TableCell className="text-right text-rose-600 font-bold">₹{bal.toFixed(2)}</TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Vendor Payouts History Tab */}
                    <TabsContent value="payouts">
                        <Card>
                            <CardContent className="p-0">
                                <Table className="text-xs">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Payout # / Date</TableHead>
                                            <TableHead>Method</TableHead>
                                            <TableHead>Reference / UTR</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Payout Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {payouts.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                                    No payout records found for this vendor.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            payouts.map((p) => (
                                                <TableRow key={p.id}>
                                                    <TableCell className="font-medium">
                                                        <div className="font-mono font-bold text-emerald-600">{p.payout_number}</div>
                                                        <div className="text-[10px] text-muted-foreground">{format(parseISO(p.payment_date), "dd MMM yyyy")}</div>
                                                    </TableCell>
                                                    <TableCell>{p.payment_method}</TableCell>
                                                    <TableCell className="font-mono text-[11px]">{p.reference_number || "-"}</TableCell>
                                                    <TableCell>
                                                        <Badge 
                                                            variant="outline"
                                                            className={
                                                                p.status === "paid" ? "bg-emerald-500/10 text-emerald-600 border-emerald-300" :
                                                                p.status === "processing" ? "bg-blue-500/10 text-blue-600 border-blue-300" :
                                                                p.status === "pending" ? "bg-amber-500/10 text-amber-600 border-amber-300" :
                                                                "bg-rose-500/10 text-rose-600 border-rose-300"
                                                            }
                                                        >
                                                            {p.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-emerald-600 text-sm">
                                                        ₹{Number(p.amount).toFixed(2)}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Print Layout: Included when user clicks Print Statement */}
                <div className="hidden print:block space-y-6 pt-4 text-xs font-sans">
                    <div className="border-b pb-3">
                        <h2 className="text-lg font-bold text-foreground">SUPPLIER FINANCIAL STATEMENT & LEDGER REPORT</h2>
                        <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                            <span>Vendor: <strong>{supplier.name}</strong></span>
                            <span>Statement Date: <strong>{format(new Date(), "dd MMMM yyyy, hh:mm a")}</strong></span>
                        </div>
                    </div>

                    {/* Section 1: Profile & Bank Details */}
                    <div>
                        <h3 className="font-bold text-sm border-b pb-1 mb-2 text-emerald-700">1. Profile & Bank Account Details</h3>
                        <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg">
                            <div>
                                <div>Contact Person: <strong>{supplier.contact_name || "N/A"}</strong></div>
                                <div>Email: <strong>{supplier.email || "N/A"}</strong></div>
                                <div>Phone: <strong>{supplier.phone || "N/A"}</strong></div>
                                <div>GSTIN / Tax ID: <strong>{supplier.gstin || "N/A"}</strong></div>
                                <div>Address: <strong>{supplier.address || "N/A"}</strong></div>
                            </div>
                            <div>
                                <div>Bank Name: <strong>{supplier.bank_name || "N/A"}</strong></div>
                                <div>Account Number: <strong className="font-mono">{supplier.account_number || "N/A"}</strong></div>
                                <div>IFSC Code: <strong className="font-mono">{supplier.ifsc_code || "N/A"}</strong></div>
                                {supplier.swift_code && <div>SWIFT Code: <strong className="font-mono">{supplier.swift_code}</strong></div>}
                                <div>UPI ID: <strong className="font-mono">{supplier.upi_id || "N/A"}</strong></div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Purchase Bills Ledger */}
                    <div>
                        <h3 className="font-bold text-sm border-b pb-1 mb-2 text-blue-700">2. Purchase Bills Ledger ({bills.length})</h3>
                        <Table className="text-xs border">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bill #</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Total Amount</TableHead>
                                    <TableHead className="text-right">Paid</TableHead>
                                    <TableHead className="text-right">Balance Due</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bills.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-4">No purchase bills recorded.</TableCell></TableRow>
                                ) : (
                                    bills.map((b: any) => {
                                        const items = b.bill_items || [];
                                        const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.rate), 0);
                                        const gst = items.reduce((s: number, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
                                        const disc = subtotal * ((b.discount_percentage || 0) / 100);
                                        const billTotal = subtotal - disc + gst;
                                        const paid = b.paid_amount || 0;
                                        const bal = Math.max(0, billTotal - paid);

                                        return (
                                            <TableRow key={b.id}>
                                                <TableCell className="font-mono font-bold">{b.bill_number}</TableCell>
                                                <TableCell>{format(parseISO(b.date), "dd/MM/yyyy")}</TableCell>
                                                <TableCell>{b.category || "Purchase"}</TableCell>
                                                <TableCell>{b.status}</TableCell>
                                                <TableCell className="text-right font-semibold">₹{billTotal.toFixed(2)}</TableCell>
                                                <TableCell className="text-right">₹{paid.toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-bold text-rose-600">₹{bal.toFixed(2)}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Section 3: Vendor Payouts History */}
                    <div>
                        <h3 className="font-bold text-sm border-b pb-1 mb-2 text-violet-700">3. Vendor Payouts History ({payouts.length})</h3>
                        <Table className="text-xs border">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Payout #</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Payment Method</TableHead>
                                    <TableHead>Ref / UTR</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payouts.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-4">No vendor payouts recorded.</TableCell></TableRow>
                                ) : (
                                    payouts.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-mono font-bold">{p.payout_number}</TableCell>
                                            <TableCell>{format(parseISO(p.payment_date), "dd/MM/yyyy")}</TableCell>
                                            <TableCell>{p.payment_method}</TableCell>
                                            <TableCell className="font-mono">{p.reference_number || "N/A"}</TableCell>
                                            <TableCell>{p.status}</TableCell>
                                            <TableCell className="text-right font-bold text-emerald-600">₹{Number(p.amount).toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
