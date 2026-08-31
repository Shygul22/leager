import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText, Banknote, ShieldCheck, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export interface TaxLedgerEntry {
    id: string;
    type: "Advance Tax" | "TDS Credit" | "Self-Assessment Tax" | "Tax Provision" | "Tax Refund";
    challanOrRef: string;
    bsrCode?: string;
    section?: string;
    amount: number;
    paymentDate: string;
    status: "Paid" | "Credited" | "Provisioned" | "Refunded";
    remarks: string;
}

const initialLedgerEntries: TaxLedgerEntry[] = [];

export default function TaxLedger() {
    const [entries, setEntries] = useState<TaxLedgerEntry[]>(() => {
        const saved = localStorage.getItem("tax_ledger_entries");
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return initialLedgerEntries;
    });
    const [modalOpen, setModalOpen] = useState(false);

    const [form, setForm] = useState({
        type: "Advance Tax" as TaxLedgerEntry["type"],
        challanOrRef: "",
        bsrCode: "",
        section: "Sec 208",
        amount: "",
        paymentDate: format(new Date(), "yyyy-MM-dd"),
        remarks: ""
    });

    const handleAddEntry = () => {
        const amt = parseFloat(form.amount);
        if (isNaN(amt) || amt <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        let status: TaxLedgerEntry["status"] = "Paid";
        if (form.type === "TDS Credit") status = "Credited";
        if (form.type === "Tax Provision") status = "Provisioned";
        if (form.type === "Tax Refund") status = "Refunded";

        const newEntry: TaxLedgerEntry = {
            id: `entry-${Date.now()}`,
            type: form.type,
            challanOrRef: form.challanOrRef || `REF-${Math.floor(1000 + Math.random() * 9000)}`,
            bsrCode: form.bsrCode || undefined,
            section: form.section,
            amount: amt,
            paymentDate: form.paymentDate,
            status,
            remarks: form.remarks
        };

        const updated = [newEntry, ...entries];
        setEntries(updated);
        try { localStorage.setItem("tax_ledger_entries", JSON.stringify(updated)); } catch (e) {}
        setModalOpen(false);
        toast.success(`${form.type} entry recorded in Tax Ledger!`);

        setForm({
            type: "Advance Tax",
            challanOrRef: "",
            bsrCode: "",
            section: "Sec 208",
            amount: "",
            paymentDate: format(new Date(), "yyyy-MM-dd"),
            remarks: ""
        });
    };

    const handleDelete = (id: string) => {
        const updated = entries.filter(e => e.id !== id);
        setEntries(updated);
        try { localStorage.setItem("tax_ledger_entries", JSON.stringify(updated)); } catch (e) {}
        toast.success("Entry removed from Tax Ledger");
    };

    // Calculate Ledgers Total
    const totalAdvanceTax = entries.filter(e => e.type === "Advance Tax").reduce((s, e) => s + e.amount, 0);
    const totalTdsCredits = entries.filter(e => e.type === "TDS Credit").reduce((s, e) => s + e.amount, 0);
    const totalSelfAssessment = entries.filter(e => e.type === "Self-Assessment Tax").reduce((s, e) => s + e.amount, 0);
    const totalTaxCredits = totalAdvanceTax + totalTdsCredits + totalSelfAssessment;

    return (
        <div className="space-y-6">
            {/* Header KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20">
                    <CardContent className="p-4">
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Advance Tax Paid</span>
                        <div className="text-2xl font-extrabold text-blue-600 mt-1">
                            ₹{totalAdvanceTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        <span className="text-[10px] text-blue-600/80 mt-1 block">Challan ITNS 280</span>
                    </CardContent>
                </Card>

                <Card className="bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20">
                    <CardContent className="p-4">
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">TDS Credits (26AS)</span>
                        <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                            ₹{totalTdsCredits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        <span className="text-[10px] text-emerald-600/80 mt-1 block">Deducted by clients</span>
                    </CardContent>
                </Card>

                <Card className="bg-purple-50/50 border-purple-200 dark:bg-purple-950/20">
                    <CardContent className="p-4">
                        <span className="text-xs font-medium text-purple-700 dark:text-purple-400">Self-Assessment Tax</span>
                        <div className="text-2xl font-extrabold text-purple-600 mt-1">
                            ₹{totalSelfAssessment.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        <span className="text-[10px] text-purple-600/80 mt-1 block">Pre-ITR payment</span>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 text-white dark:bg-slate-800">
                    <CardContent className="p-4">
                        <span className="text-xs font-medium text-slate-300">Total Tax Credits</span>
                        <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                            ₹{totalTaxCredits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block">Available against tax liability</span>
                    </CardContent>
                </Card>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between border-b pb-3 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm">Tax Ledger & Payment Entries</h3>
                </div>
                <Button size="sm" onClick={() => setModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                    <Plus className="h-4 w-4 mr-1.5" /> Record Tax Payment / TDS
                </Button>
            </div>

            {/* Tax Ledger Entries Table */}
            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    <Table className="text-xs">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Entry Type</TableHead>
                                <TableHead>Challan / Ref No.</TableHead>
                                <TableHead>BSR / Section</TableHead>
                                <TableHead>Payment Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Amount (₹)</TableHead>
                                <TableHead className="w-16 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                        No tax ledger entries recorded.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                entries.map(entry => (
                                    <TableRow key={entry.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="font-medium">
                                            <Badge variant="outline" className="font-semibold text-[10px]">
                                                {entry.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono font-bold text-primary">{entry.challanOrRef}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {entry.bsrCode ? `BSR: ${entry.bsrCode}` : entry.section || "-"}
                                        </TableCell>
                                        <TableCell>{entry.paymentDate}</TableCell>
                                        <TableCell>
                                            <Badge 
                                                variant="outline"
                                                className={
                                                    entry.status === "Paid" || entry.status === "Credited" ? "bg-emerald-500/10 text-emerald-600 border-emerald-300" :
                                                    "bg-blue-500/10 text-blue-600 border-blue-300"
                                                }
                                            >
                                                {entry.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-emerald-600 text-sm">
                                            ₹{entry.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 text-destructive"
                                                onClick={() => handleDelete(entry.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Add Tax Entry Dialog Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Record Tax Payment / TDS Credit</DialogTitle>
                        <DialogDescription className="text-xs">
                            Add Advance Tax Challan 280, TDS Certificate credits, or Self-Assessment tax records.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2 text-xs">
                        <div className="space-y-1">
                            <Label htmlFor="t-type">Entry Category</Label>
                            <Select 
                                value={form.type} 
                                onValueChange={(val: any) => setForm({ ...form, type: val })}
                            >
                                <SelectTrigger id="t-type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Advance Tax">Advance Tax (Challan ITNS 280)</SelectItem>
                                    <SelectItem value="TDS Credit">TDS Credit (Form 26AS / AIS)</SelectItem>
                                    <SelectItem value="Self-Assessment Tax">Self-Assessment Tax (Sec 140A)</SelectItem>
                                    <SelectItem value="Tax Provision">Tax Provision</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="t-amt">Amount (₹) <span className="text-destructive">*</span></Label>
                                <Input 
                                    id="t-amt"
                                    type="number"
                                    placeholder="0.00"
                                    value={form.amount}
                                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                    className="font-bold text-emerald-600"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="t-date">Payment Date</Label>
                                <Input 
                                    id="t-date"
                                    type="date"
                                    value={form.paymentDate}
                                    onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="t-ref">Challan / Ref No.</Label>
                                <Input 
                                    id="t-ref"
                                    placeholder="ITNS-280-XXXX"
                                    value={form.challanOrRef}
                                    onChange={(e) => setForm({ ...form, challanOrRef: e.target.value })}
                                    className="font-mono"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="t-bsr">BSR Code / Section</Label>
                                <Input 
                                    id="t-bsr"
                                    placeholder="e.g. 0510012 or Sec 194J"
                                    value={form.bsrCode}
                                    onChange={(e) => setForm({ ...form, bsrCode: e.target.value })}
                                    className="font-mono"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="t-rem">Remarks / Bank Memo</Label>
                            <Input 
                                id="t-rem"
                                placeholder="Payment details..."
                                value={form.remarks}
                                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter className="mt-3">
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddEntry} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                            Save Entry
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
