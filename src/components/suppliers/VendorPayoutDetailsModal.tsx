import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
    Banknote, Printer, CheckCircle2, Clock, XCircle, AlertTriangle, 
    FileText, User, Calendar, ExternalLink, ShieldCheck, History 
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { VendorPayout, PayoutStatus } from "@/types/supplierPayout";

interface VendorPayoutDetailsModalProps {
    payout: VendorPayout | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function VendorPayoutDetailsModal({
    payout,
    open,
    onOpenChange
}: VendorPayoutDetailsModalProps) {
    const { user, role } = useAuth();
    const queryClient = useQueryClient();
    const isAdminOrManager = role === "admin" || role === "accounts_manager";

    // Fetch linked bills if bill_ids are provided
    const { data: linkedBills = [] } = useQuery({
        queryKey: ["payout-linked-bills", payout?.id],
        queryFn: async () => {
            if (!payout?.bill_ids || payout.bill_ids.length === 0) return [];
            const { data, error } = await supabase
                .from("bills")
                .select("*, bill_items(*)")
                .in("id", payout.bill_ids);
            if (error) return [];
            return data || [];
        },
        enabled: !!payout?.id && open && (payout?.bill_ids?.length || 0) > 0,
    });

    // Fetch Audit Trail logs for this payout
    const { data: auditLogs = [] } = useQuery({
        queryKey: ["payout-audit-logs", payout?.id],
        queryFn: async () => {
            if (!payout?.id) return [];
            const { data, error } = await supabase
                .from("vendor_payout_audit_logs")
                .select("*, performer_profile:profiles!performed_by(full_name, email)")
                .eq("payout_id", payout.id)
                .order("created_at", { ascending: false });
            if (error) return [];
            return data || [];
        },
        enabled: !!payout?.id && open,
    });

    // Update Status Mutation
    const updateStatusMutation = useMutation({
        mutationFn: async (newStatus: PayoutStatus) => {
            if (!payout) return;
            const { error } = await supabase
                .from("vendor_payouts")
                .update({ 
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq("id", payout.id);

            if (error) throw error;

            // Audit log entry
            try {
                await supabase.from("vendor_payout_audit_logs").insert({
                    payout_id: payout.id,
                    supplier_id: payout.supplier_id,
                    action: `STATUS_CHANGED_TO_${newStatus.toUpperCase()}`,
                    performed_by: user?.id,
                    details: { previous_status: payout.status, new_status: newStatus }
                });
            } catch (aErr) { console.warn("Audit error:", aErr); }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["vendor-payouts"] });
            queryClient.invalidateQueries({ queryKey: ["payout-audit-logs"] });
            toast.success("Payout status updated");
        },
        onError: (err) => toast.error((err as Error).message),
    });

    // Print Receipt Function
    const handlePrintReceipt = () => {
        window.print();
    };

    if (!payout) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:max-w-none print:shadow-none print:border-none">
                <DialogHeader className="border-b pb-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap print:hidden">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                                <Banknote className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <DialogTitle className="text-lg font-bold">Payout Voucher #{payout.payout_number}</DialogTitle>
                                    <Badge 
                                        variant="outline"
                                        className={
                                            payout.status === "paid" ? "bg-emerald-500/10 text-emerald-600 border-emerald-300" :
                                            payout.status === "processing" ? "bg-blue-500/10 text-blue-600 border-blue-300" :
                                            payout.status === "pending" ? "bg-amber-500/10 text-amber-600 border-amber-300" :
                                            "bg-rose-500/10 text-rose-600 border-rose-300"
                                        }
                                    >
                                        {payout.status.toUpperCase()}
                                    </Badge>
                                </div>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    Created on {format(parseISO(payout.created_at), "dd MMM yyyy, hh:mm a")}
                                </DialogDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={handlePrintReceipt}>
                                <Printer className="h-4 w-4 mr-1.5" /> Print Receipt
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {/* Printable Official Receipt View */}
                <div id="printable-payout-receipt" className="space-y-6 pt-2">
                    {/* Voucher Header Banner */}
                    <div className="bg-muted/30 p-4 rounded-xl border flex justify-between items-center flex-wrap gap-4">
                        <div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block">PAYOUT VOUCHER</span>
                            <span className="text-2xl font-extrabold text-emerald-600">₹{Number(payout.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            <span className="text-xs text-muted-foreground block mt-0.5">Paid via <strong>{payout.payment_method}</strong></span>
                        </div>
                        <div className="text-right text-xs space-y-1">
                            <div>Date: <strong>{format(parseISO(payout.payment_date), "dd MMM yyyy")}</strong></div>
                            <div>Ref / UTR: <strong className="font-mono">{payout.reference_number || "N/A"}</strong></div>
                            <div>Status: <Badge variant="outline" className="capitalize text-[10px]">{payout.status}</Badge></div>
                        </div>
                    </div>

                    {/* Status Management Bar (Admin / Manager controls) */}
                    {isAdminOrManager && (
                        <Card className="bg-slate-50 border-slate-200 dark:bg-slate-900/40 print:hidden">
                            <CardContent className="p-3 flex items-center justify-between flex-wrap gap-2 text-xs">
                                <span className="font-semibold text-muted-foreground">Manage Status:</span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <Button 
                                        size="xs" 
                                        variant={payout.status === 'paid' ? 'default' : 'outline'}
                                        className={payout.status === 'paid' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                                        onClick={() => updateStatusMutation.mutate('paid')}
                                    >
                                        Mark Paid
                                    </Button>
                                    <Button 
                                        size="xs" 
                                        variant={payout.status === 'processing' ? 'default' : 'outline'}
                                        onClick={() => updateStatusMutation.mutate('processing')}
                                    >
                                        Processing
                                    </Button>
                                    <Button 
                                        size="xs" 
                                        variant={payout.status === 'pending' ? 'default' : 'outline'}
                                        onClick={() => updateStatusMutation.mutate('pending')}
                                    >
                                        Pending
                                    </Button>
                                    <Button 
                                        size="xs" 
                                        variant="outline"
                                        className="text-rose-600 hover:bg-rose-50"
                                        onClick={() => updateStatusMutation.mutate('cancelled')}
                                    >
                                        Cancel Payout
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Vendor & Payment Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <Card>
                            <CardHeader className="py-2.5 px-3 bg-muted/20 border-b">
                                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5 text-emerald-600" /> Beneficiary / Vendor Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Vendor Name:</span>
                                    <span className="font-bold">{payout.supplier?.name || "Vendor"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Contact Person:</span>
                                    <span>{payout.supplier?.contact_name || "-"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Email / Phone:</span>
                                    <span>{payout.supplier?.email || payout.supplier?.phone || "-"}</span>
                                </div>
                                <div className="flex justify-between border-t pt-1.5">
                                    <span className="text-muted-foreground">Bank A/C:</span>
                                    <span className="font-mono font-bold">{payout.supplier?.account_number || "-"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">IFSC / Swift:</span>
                                    <span className="font-mono">{payout.supplier?.ifsc_code || payout.supplier?.swift_code || "-"}</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="py-2.5 px-3 bg-muted/20 border-b">
                                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Transaction Audit Info
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Payout Number:</span>
                                    <span className="font-mono font-bold text-primary">{payout.payout_number}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Payment Date:</span>
                                    <span>{format(parseISO(payout.payment_date), "dd MMM yyyy")}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Payment Method:</span>
                                    <span className="font-semibold">{payout.payment_method}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">UTR / Ref No:</span>
                                    <span className="font-mono">{payout.reference_number || "None"}</span>
                                </div>
                                {payout.proof_url && (
                                    <div className="flex justify-between border-t pt-1.5">
                                        <span className="text-muted-foreground">Payment Proof:</span>
                                        <a href={payout.proof_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                            View Attachment <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Linked Invoices Covered */}
                    {linkedBills.length > 0 && (
                        <Card>
                            <CardHeader className="py-2.5 px-3 bg-muted/20 border-b">
                                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5 text-violet-600" /> Settled Supplier Invoices ({linkedBills.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table className="text-xs">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Bill Number</TableHead>
                                            <TableHead>Bill Date</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead className="text-right">Paid Amount</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {linkedBills.map((b: any) => (
                                            <TableRow key={b.id}>
                                                <TableCell className="font-mono font-bold text-primary">{b.bill_number}</TableCell>
                                                <TableCell>{format(parseISO(b.date), "dd MMM yyyy")}</TableCell>
                                                <TableCell>{b.category || "Purchase"}</TableCell>
                                                <TableCell className="text-right font-bold text-emerald-600">₹{Number(b.paid_amount || 0).toFixed(2)}</TableCell>
                                                <TableCell><Badge variant="outline" className="capitalize text-[10px]">{b.status}</Badge></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {payout.notes && (
                        <div className="p-3 bg-muted/30 rounded-lg border text-xs">
                            <span className="font-semibold block mb-1">Remarks & Notes:</span>
                            <span className="text-muted-foreground">{payout.notes}</span>
                        </div>
                    )}

                    {/* Audit Trail Timeline */}
                    {auditLogs.length > 0 && (
                        <Card className="print:hidden">
                            <CardHeader className="py-2.5 px-3 bg-muted/20 border-b">
                                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                                    <History className="h-3.5 w-3.5 text-amber-600" /> Audit Trail & Lifecycle Logs
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 space-y-2">
                                {auditLogs.map((log: any) => (
                                    <div key={log.id} className="flex items-center justify-between text-[11px] border-b last:border-0 pb-1.5">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[9px] uppercase font-mono">{log.action}</Badge>
                                            <span className="text-muted-foreground">{log.performer_profile?.full_name || "System User"}</span>
                                        </div>
                                        <span className="text-muted-foreground font-mono">{format(parseISO(log.created_at), "dd MMM, hh:mm a")}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
