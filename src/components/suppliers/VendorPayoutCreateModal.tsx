import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Banknote, FileText, CheckCircle2, AlertCircle, CreditCard, Building2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { SupplierExtended, PaymentMethod } from "@/types/supplierPayout";

interface VendorPayoutCreateModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    suppliers: SupplierExtended[];
    initialSupplierId?: string | null;
}

export default function VendorPayoutCreateModal({
    open,
    onOpenChange,
    suppliers,
    initialSupplierId
}: VendorPayoutCreateModalProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
    const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
    const [payoutAmount, setPayoutAmount] = useState<string>("");
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Bank Transfer");
    const [referenceNumber, setReferenceNumber] = useState<string>("");
    const [paymentDate, setPaymentDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
    const [notes, setNotes] = useState<string>("");
    const [proofUrl, setProofUrl] = useState<string>("");

    useEffect(() => {
        if (open) {
            const defaultId = initialSupplierId || (suppliers[0]?.id || "");
            setSelectedSupplierId(defaultId);
            setSelectedBillIds([]);
            setPayoutAmount("");
            setReferenceNumber("");
            setNotes("");
            setProofUrl("");
            setPaymentDate(format(new Date(), "yyyy-MM-dd"));
        }
    }, [open, initialSupplierId, suppliers]);

    // Fetch unpaid/pending bills for selected supplier
    const { data: supplierBills = [] } = useQuery({
        queryKey: ["unpaid-supplier-bills", selectedSupplierId],
        queryFn: async () => {
            if (!selectedSupplierId) return [];
            const { data, error } = await supabase
                .from("bills")
                .select("*, bill_items(*)")
                .eq("supplier_id", selectedSupplierId)
                .neq("status", "paid")
                .order("date", { ascending: true });
            if (error) return [];
            return data || [];
        },
        enabled: !!selectedSupplierId && open,
    });

    const selectedSupplierObj = suppliers.find(s => s.id === selectedSupplierId);

    // Auto-calculate payout amount based on selected bills
    const handleBillToggle = (billId: string, isChecked: boolean, billBalance: number) => {
        let nextSelected: string[];
        if (isChecked) {
            nextSelected = [...selectedBillIds, billId];
        } else {
            nextSelected = selectedBillIds.filter(id => id !== billId);
        }
        setSelectedBillIds(nextSelected);

        // Sum up balances of selected bills
        const totalSelected = supplierBills
            .filter((b: any) => nextSelected.includes(b.id))
            .reduce((sum: number, b: any) => {
                const items = b.bill_items || [];
                const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.rate), 0);
                const gst = items.reduce((s: number, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
                const disc = subtotal * ((b.discount_percentage || 0) / 100);
                const billTotal = subtotal - disc + gst;
                const paid = b.paid_amount || 0;
                return sum + Math.max(0, billTotal - paid);
            }, 0);

        if (totalSelected > 0) {
            setPayoutAmount(totalSelected.toFixed(2));
        }
    };

    // Payout Submit Mutation
    const submitPayoutMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Not authenticated");
            const amt = parseFloat(payoutAmount);
            if (isNaN(amt) || amt <= 0) {
                throw new Error("Please enter a valid payout amount");
            }
            if (!selectedSupplierId) {
                throw new Error("Please select a supplier");
            }

            const payoutNum = `PAY-${format(new Date(), "yyyyMMdd")}-${Math.floor(1000 + Math.random() * 9000)}`;

            // 1. Insert Vendor Payout Record
            const { data: payoutData, error: payoutErr } = await supabase
                .from("vendor_payouts")
                .insert({
                    user_id: user.id,
                    payout_number: payoutNum,
                    supplier_id: selectedSupplierId,
                    bill_ids: selectedBillIds,
                    amount: amt,
                    payment_method: paymentMethod,
                    reference_number: referenceNumber || null,
                    payment_date: paymentDate,
                    status: "paid",
                    notes: notes || null,
                    proof_url: proofUrl || null,
                    created_by: user.id,
                    approved_by: user.id
                })
                .select()
                .single();

            if (payoutErr) throw payoutErr;

            // 2. Update selected Bills paid amounts and statuses
            let remainingPayout = amt;
            for (const bill of supplierBills) {
                if (selectedBillIds.length > 0 && !selectedBillIds.includes(bill.id)) continue;
                if (remainingPayout <= 0) break;

                const items = bill.bill_items || [];
                const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.rate), 0);
                const gst = items.reduce((s: number, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
                const disc = subtotal * ((bill.discount_percentage || 0) / 100);
                const billTotal = subtotal - disc + gst;
                const currentPaid = bill.paid_amount || 0;
                const billDue = Math.max(0, billTotal - currentPaid);

                if (billDue > 0) {
                    const payForThisBill = Math.min(remainingPayout, billDue);
                    const newPaidTotal = currentPaid + payForThisBill;
                    const isFullyPaid = newPaidTotal >= (billTotal - 0.01);

                    await supabase
                        .from("bills")
                        .update({
                            paid_amount: newPaidTotal,
                            status: isFullyPaid ? "paid" : "pending"
                        })
                        .eq("id", bill.id);

                    remainingPayout -= payForThisBill;
                }
            }

            // 3. Log Expense Transaction
            const sName = selectedSupplierObj?.name || "Vendor";
            const modeDesc = paymentMethod ? ` via ${paymentMethod}` : "";
            const refDesc = referenceNumber ? ` (Ref: ${referenceNumber})` : "";
            const txDesc = `Vendor Payout (${payoutNum}) to ${sName}${modeDesc}${refDesc}`;

            await supabase.from("transactions").insert({
                user_id: user.id,
                type: "expense",
                amount: amt,
                description: txDesc,
                category: "Vendor Payout",
                date: paymentDate
            });

            // 4. Record Audit Log
            try {
                await supabase.from("vendor_payout_audit_logs").insert({
                    payout_id: payoutData.id,
                    supplier_id: selectedSupplierId,
                    action: "CREATED_AND_PAID",
                    performed_by: user.id,
                    details: {
                        amount: amt,
                        payout_number: payoutNum,
                        payment_method: paymentMethod,
                        reference_number: referenceNumber,
                        linked_bills_count: selectedBillIds.length
                    }
                });
            } catch (auditErr) {
                console.warn("Audit log creation skipped:", auditErr);
            }

            return payoutData;
        },
        onSuccess: (payout) => {
            queryClient.invalidateQueries({ queryKey: ["vendor-payouts"] });
            queryClient.invalidateQueries({ queryKey: ["suppliers"] });
            queryClient.invalidateQueries({ queryKey: ["bills"] });
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
            onOpenChange(false);
            toast.success(`Vendor payout ${payout?.payout_number || ''} recorded successfully!`);
        },
        onError: (err) => {
            toast.error("Failed to record payout: " + (err as Error).message);
        }
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="border-b pb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600">
                            <Banknote className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold">Record Vendor Payout</DialogTitle>
                            <DialogDescription className="text-xs">
                                Issue a payment to settle supplier bills and record an expense ledger entry.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Supplier Select */}
                    <div className="space-y-1.5">
                        <Label htmlFor="create-payout-supplier" className="text-xs font-semibold">
                            Select Vendor / Supplier <span className="text-destructive">*</span>
                        </Label>
                        <Select 
                            value={selectedSupplierId}
                            onValueChange={(val) => {
                                setSelectedSupplierId(val);
                                setSelectedBillIds([]);
                            }}
                        >
                            <SelectTrigger id="create-payout-supplier">
                                <SelectValue placeholder="Choose supplier..." />
                            </SelectTrigger>
                            <SelectContent>
                                {suppliers.map(s => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.name} {s.category ? `(${s.category})` : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {selectedSupplierObj && (
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-lg border mt-1">
                                <span>Bank: <strong>{selectedSupplierObj.bank_name || 'Not set'}</strong></span>
                                <span>A/C: <strong className="font-mono">{selectedSupplierObj.account_number || 'Not set'}</strong></span>
                                <span>IFSC: <strong className="font-mono">{selectedSupplierObj.ifsc_code || 'Not set'}</strong></span>
                            </div>
                        )}
                    </div>

                    {/* Outstanding Bills Checklist */}
                    {selectedSupplierId && supplierBills.length > 0 && (
                        <div className="border rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold">
                                <span>Select Outstanding Bills to Settle ({supplierBills.length} pending)</span>
                                <span className="text-[10px] text-muted-foreground">Auto-populates payout total</span>
                            </div>
                            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                {supplierBills.map((b: any) => {
                                    const items = b.bill_items || [];
                                    const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.rate), 0);
                                    const gst = items.reduce((s: number, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
                                    const disc = subtotal * ((b.discount_percentage || 0) / 100);
                                    const billTotal = subtotal - disc + gst;
                                    const paid = b.paid_amount || 0;
                                    const due = Math.max(0, billTotal - paid);
                                    const isChecked = selectedBillIds.includes(b.id);

                                    return (
                                        <div 
                                            key={b.id} 
                                            className={`flex items-center justify-between p-2 rounded-lg text-xs border transition-colors ${
                                                isChecked ? "bg-emerald-50/60 border-emerald-300 dark:bg-emerald-950/20" : "bg-background border-border"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Checkbox 
                                                    id={`bill-${b.id}`}
                                                    checked={isChecked}
                                                    onCheckedChange={(checked) => handleBillToggle(b.id, !!checked, due)}
                                                />
                                                <Label htmlFor={`bill-${b.id}`} className="cursor-pointer font-medium">
                                                    Bill <span className="font-mono font-bold text-primary">{b.bill_number}</span> ({format(new Date(b.date), "dd MMM yyyy")})
                                                </Label>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-rose-600 font-bold">Due: ₹{due.toFixed(2)}</span>
                                                <span className="text-[10px] text-muted-foreground block">Total: ₹{billTotal.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Amount & Method Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="payout-amt-field" className="text-xs font-semibold">
                                Payout Amount (₹) <span className="text-destructive">*</span>
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 font-bold text-muted-foreground">₹</span>
                                <Input 
                                    id="payout-amt-field"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={payoutAmount}
                                    onChange={(e) => setPayoutAmount(e.target.value)}
                                    className="pl-7 text-lg font-bold text-emerald-600 bg-emerald-50/30 border-emerald-300"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="payout-mode-select" className="text-xs font-semibold">
                                Payment Method <span className="text-destructive">*</span>
                            </Label>
                            <Select 
                                value={paymentMethod} 
                                onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}
                            >
                                <SelectTrigger id="payout-mode-select">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</SelectItem>
                                    <SelectItem value="UPI">UPI Payment</SelectItem>
                                    <SelectItem value="Cheque">Cheque Payment</SelectItem>
                                    <SelectItem value="Cash">Cash Payment</SelectItem>
                                    <SelectItem value="Other">Other / Card Payment</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="payout-ref-field" className="text-xs font-semibold">
                                Transaction Ref / UTR / Cheque No.
                            </Label>
                            <Input 
                                id="payout-ref-field"
                                placeholder="e.g. UTR9876543210 or CHQ-00124"
                                value={referenceNumber}
                                onChange={(e) => setReferenceNumber(e.target.value)}
                                className="font-mono text-xs"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="payout-date-field" className="text-xs font-semibold">
                                Payment Date
                            </Label>
                            <Input 
                                id="payout-date-field"
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="payout-proof-url" className="text-xs font-semibold">
                            Payment Proof / Receipt Document Link (Optional)
                        </Label>
                        <Input 
                            id="payout-proof-url"
                            placeholder="https://... or reference document link"
                            value={proofUrl}
                            onChange={(e) => setProofUrl(e.target.value)}
                            className="text-xs"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="payout-notes-field" className="text-xs font-semibold">
                            Payment Remarks & Internal Notes
                        </Label>
                        <Textarea 
                            id="payout-notes-field"
                            placeholder="Settlement notes, bank confirmation memo..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="h-16 text-xs"
                        />
                    </div>
                </div>

                <DialogFooter className="border-t pt-3">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button 
                        onClick={() => submitPayoutMutation.mutate()}
                        disabled={submitPayoutMutation.isPending || !selectedSupplierId || !payoutAmount || parseFloat(payoutAmount) <= 0}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                        {submitPayoutMutation.isPending ? "Recording Payout..." : "Confirm & Send Payout"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
