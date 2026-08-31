import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator, RefreshCw, Scale, ArrowRight, ShieldCheck, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface IncomeTaxCalculatorProps {
    syncedRevenue: number;
    syncedExpenses: number;
    syncedBills: number;
    syncedPayroll: number;
    syncedIncomeTx?: number;
    syncedExpenseTx?: number;
    syncedOutstanding?: number;
    onRefreshSync: () => void;
}

export default function IncomeTaxCalculator({
    syncedRevenue,
    syncedExpenses,
    syncedBills,
    syncedPayroll,
    syncedIncomeTx,
    syncedExpenseTx,
    syncedOutstanding,
    onRefreshSync
}: IncomeTaxCalculatorProps) {
    // Dynamic Current Financial Year calculation (Indian FY runs April 1 to March 31)
    const now = new Date();
    const month = now.getMonth(); // 0-indexed (April = 3)
    const year = now.getFullYear();
    const fyStart = month >= 3 ? year : year - 1;
    const fyEnd = (fyStart + 1) % 100;
    const dynamicFY = `FY ${fyStart}-${fyEnd < 10 ? '0' : ''}${fyEnd}`; // e.g., FY 2026-27

    // Accounting Method Selection ("cash" vs "accrual")
    const [accountingBasis, setAccountingBasis] = useState<"cash" | "accrual">("cash");

    // Compute live values dynamically from props
    const liveRev = accountingBasis === "cash" 
        ? (syncedIncomeTx !== undefined ? syncedIncomeTx : syncedRevenue) 
        : syncedRevenue;
    
    const liveOpex = accountingBasis === "cash" 
        ? (syncedExpenseTx !== undefined ? syncedExpenseTx : syncedExpenses) 
        : ((syncedExpenses || 0) + (syncedBills || 0));

    // Inputs (rounded to 2 decimal places for clean UI formatting)
    const [revenue, setRevenue] = useState<number>(Number((liveRev || 0).toFixed(2)));
    const [otherIncome, setOtherIncome] = useState<number>(0);
    const [operatingExpenses, setOperatingExpenses] = useState<number>(Number((liveOpex || 0).toFixed(2)));
    const [payrollExpenses, setPayrollExpenses] = useState<number>(Number((syncedPayroll || 0).toFixed(2)));
    const [depreciationComputers, setDepreciationComputers] = useState<number>(0); // 40%
    const [depreciationPlant, setDepreciationPlant] = useState<number>(0); // 15%
    const [depreciationFurniture, setDepreciationFurniture] = useState<number>(0); // 10%
    const [regime, setRegime] = useState<"115baa" | "old_400" | "old_above_400">("115baa");
    const [advanceTaxPaid, setAdvanceTaxPaid] = useState<number>(0);
    const [tdsCredits, setTdsCredits] = useState<number>(0);

    const handleApplySync = () => {
        const revVal = accountingBasis === "cash" 
            ? (syncedIncomeTx !== undefined ? syncedIncomeTx : syncedRevenue) 
            : syncedRevenue;
        const expVal = accountingBasis === "cash" 
            ? (syncedExpenseTx !== undefined ? syncedExpenseTx : syncedExpenses) 
            : ((syncedExpenses || 0) + (syncedBills || 0));

        setRevenue(Number((revVal || 0).toFixed(2)));
        setOperatingExpenses(Number((expVal || 0).toFixed(2)));
        setPayrollExpenses(Number((syncedPayroll || 0).toFixed(2)));
        toast.success(`Live ${accountingBasis === "cash" ? "Cash Basis" : "Accrual Basis"} figures synced to tax calculator!`);
    };

    // Calculations
    const totalIncome = (revenue || 0) + (otherIncome || 0);
    const totalITDepreciation = (depreciationComputers * 0.40) + (depreciationPlant * 0.15) + (depreciationFurniture * 0.10);
    const totalAllowableDeductions = (operatingExpenses || 0) + (payrollExpenses || 0) + totalITDepreciation;
    
    const profitBeforeTax = totalIncome - totalAllowableDeductions;
    const taxableProfit = Math.max(0, profitBeforeTax);

    // Corporate Tax Rates
    // Sec 115BAA: Base 22%, Surcharge 10% (Flat), Cess 4% -> Effective 25.168%
    // Old Regime (<=400 Cr): Base 25%, Surcharge 7% (if income > 1 Cr) or 0%, Cess 4%
    // Old Regime (>400 Cr): Base 30%, Surcharge 7% (if income > 1 Cr) or 0%, Cess 4%
    let baseTaxRate = 0.22;
    let surchargeRate = 0.10; // 115BAA flat 10% surcharge
    let cessRate = 0.04;

    if (regime === "old_400") {
        baseTaxRate = 0.25;
        surchargeRate = taxableProfit > 10000000 ? 0.07 : 0.00;
    } else if (regime === "old_above_400") {
        baseTaxRate = 0.30;
        surchargeRate = taxableProfit > 10000000 ? 0.07 : 0.00;
    }

    const baseTax = taxableProfit * baseTaxRate;
    const surcharge = baseTax * surchargeRate;
    const cess = (baseTax + surcharge) * cessRate;
    const totalTaxLiability = baseTax + surcharge + cess;
    const effectiveTaxRate = taxableProfit > 0 ? (totalTaxLiability / taxableProfit) * 100 : 0;

    const netTaxPayable = Math.max(0, totalTaxLiability - (advanceTaxPaid || 0) - (tdsCredits || 0));
    const refundClaimable = (advanceTaxPaid || 0) + (tdsCredits || 0) > totalTaxLiability ? ((advanceTaxPaid || 0) + (tdsCredits || 0)) - totalTaxLiability : 0;

    // Advance Tax Installment Schedule
    const advanceTaxJune = totalTaxLiability * 0.15;
    const advanceTaxSept = totalTaxLiability * 0.45;
    const advanceTaxDec = totalTaxLiability * 0.75;
    const advanceTaxMar = totalTaxLiability * 1.00;

    return (
        <div className="space-y-6">
            {/* Header Sync Banner */}
            <div className="flex items-center justify-between bg-muted/40 p-4 rounded-xl border flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                        <Calculator className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm">Income Tax Calculator (Indian Corporate Tax - {dynamicFY})</h3>
                        <p className="text-xs text-muted-foreground">Compute corporate tax liability under Section 115BAA vs Old Regime and generate Advance Tax schedules.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Select 
                        value={accountingBasis} 
                        onValueChange={(val: "cash" | "accrual") => {
                            setAccountingBasis(val);
                            const r = val === "cash" 
                                ? (syncedIncomeTx !== undefined ? syncedIncomeTx : syncedRevenue) 
                                : syncedRevenue;
                            const e = val === "cash" 
                                ? (syncedExpenseTx !== undefined ? syncedExpenseTx : syncedExpenses) 
                                : ((syncedExpenses || 0) + (syncedBills || 0));
                            setRevenue(Number((r || 0).toFixed(2)));
                            setOperatingExpenses(Number((e || 0).toFixed(2)));
                            toast.success(`Switched to ${val === "cash" ? "Cash Basis (Realized Transactions)" : "Accrual Basis (Billed Invoices)"}`);
                        }}
                    >
                        <SelectTrigger className="w-48 h-8 text-xs font-semibold bg-background">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="cash">Cash Basis (Realized Income)</SelectItem>
                            <SelectItem value="accrual">Accrual Basis (Billed Invoices)</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={onRefreshSync} className="h-8 text-xs">
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Re-fetch Ledger
                    </Button>
                    <Button size="sm" className="bg-primary text-primary-foreground font-semibold h-8 text-xs" onClick={handleApplySync}>
                        Sync Live Figures
                    </Button>
                </div>
            </div>

            {/* Main Calculation Inputs & Summary Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Inputs Column */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Revenue & Operating Expenses */}
                    <Card>
                        <CardHeader className="py-3 px-4 bg-muted/20 border-b">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                1. Gross Revenue & Operating Expenses
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="tx-rev">Sales Revenue (from Invoices)</Label>
                                    <Input 
                                        id="tx-rev"
                                        type="number"
                                        value={revenue}
                                        onChange={(e) => setRevenue(parseFloat(e.target.value) || 0)}
                                        className="font-bold text-emerald-600"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="tx-other">Other Non-Operating Income</Label>
                                    <Input 
                                        id="tx-other"
                                        type="number"
                                        value={otherIncome}
                                        onChange={(e) => setOtherIncome(parseFloat(e.target.value) || 0)}
                                        placeholder="Interest, Capital gains..."
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="tx-opex">Operating Expenses & Supplier Bills</Label>
                                    <Input 
                                        id="tx-opex"
                                        type="number"
                                        value={operatingExpenses}
                                        onChange={(e) => setOperatingExpenses(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="tx-payroll">Employee Salaries & Payroll</Label>
                                    <Input 
                                        id="tx-payroll"
                                        type="number"
                                        value={payrollExpenses}
                                        onChange={(e) => setPayrollExpenses(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* IT Act Depreciation Block */}
                    <Card>
                        <CardHeader className="py-3 px-4 bg-muted/20 border-b">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                2. Income Tax Act Depreciation (Block of Assets)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label>Computers & Software (40%)</Label>
                                    <Input 
                                        type="number"
                                        value={depreciationComputers}
                                        onChange={(e) => setDepreciationComputers(parseFloat(e.target.value) || 0)}
                                        placeholder="Asset cost..."
                                    />
                                    <span className="text-[10px] text-muted-foreground">Depreciation: ₹{(depreciationComputers * 0.40).toFixed(2)}</span>
                                </div>
                                <div className="space-y-1">
                                    <Label>Plant & Machinery (15%)</Label>
                                    <Input 
                                        type="number"
                                        value={depreciationPlant}
                                        onChange={(e) => setDepreciationPlant(parseFloat(e.target.value) || 0)}
                                        placeholder="Asset cost..."
                                    />
                                    <span className="text-[10px] text-muted-foreground">Depreciation: ₹{(depreciationPlant * 0.15).toFixed(2)}</span>
                                </div>
                                <div className="space-y-1">
                                    <Label>Furniture & Fixtures (10%)</Label>
                                    <Input 
                                        type="number"
                                        value={depreciationFurniture}
                                        onChange={(e) => setDepreciationFurniture(parseFloat(e.target.value) || 0)}
                                        placeholder="Asset cost..."
                                    />
                                    <span className="text-[10px] text-muted-foreground">Depreciation: ₹{(depreciationFurniture * 0.10).toFixed(2)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tax Regime & Prepaid Taxes */}
                    <Card>
                        <CardHeader className="py-3 px-4 bg-muted/20 border-b">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                3. Tax Regime & Prepaid Tax Credits
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1 col-span-1 sm:col-span-3">
                                    <Label htmlFor="tx-regime">Corporate Income Tax Regime</Label>
                                    <Select value={regime} onValueChange={(val: any) => setRegime(val)}>
                                        <SelectTrigger id="tx-regime">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="115baa">
                                                Section 115BAA (New Concessional Regime @ 22% + 10% Surcharge + 4% Cess = 25.168% Effective)
                                            </SelectItem>
                                            <SelectItem value="old_400">
                                                Old Regime - Turnover ≤ ₹400 Cr (Base 25% + Surcharge + 4% Cess = ~27.82%)
                                            </SelectItem>
                                            <SelectItem value="old_above_400">
                                                Old Regime - Turnover &gt; ₹400 Cr (Base 30% + Surcharge + 4% Cess = ~33.38%)
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label>Advance Tax Paid (Challan 280)</Label>
                                    <Input 
                                        type="number"
                                        value={advanceTaxPaid}
                                        onChange={(e) => setAdvanceTaxPaid(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="font-semibold text-blue-600"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>TDS Credits (Form 26AS / AIS)</Label>
                                    <Input 
                                        type="number"
                                        value={tdsCredits}
                                        onChange={(e) => setTdsCredits(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="font-semibold text-emerald-600"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Total Tax Credits Available</Label>
                                    <div className="h-9 px-3 border rounded-md flex items-center font-bold text-foreground bg-muted/30">
                                        ₹{((advanceTaxPaid || 0) + (tdsCredits || 0)).toLocaleString("en-IN")}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Computation Summary Card */}
                <div className="space-y-4">
                    <Card className="border-2 border-primary/20 shadow-md">
                        <CardHeader className="py-3 px-4 bg-primary/5 border-b">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Scale className="h-4 w-4 text-primary" /> Corporate Tax Computation
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3 text-xs">
                            <div className="flex justify-between border-b pb-1.5">
                                <span className="text-muted-foreground">Gross Revenues:</span>
                                <span className="font-bold">₹{totalIncome.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between border-b pb-1.5">
                                <span className="text-muted-foreground">Operating Expenses:</span>
                                <span>- ₹{(operatingExpenses || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between border-b pb-1.5">
                                <span className="text-muted-foreground">Payroll & Salaries:</span>
                                <span>- ₹{(payrollExpenses || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between border-b pb-1.5">
                                <span className="text-muted-foreground">IT Act Depreciation:</span>
                                <span>- ₹{totalITDepreciation.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2 pt-1 font-bold text-sm bg-muted/40 p-2 rounded">
                                <span>Profit Before Tax (PBT):</span>
                                <span className={profitBeforeTax >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                    ₹{profitBeforeTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="space-y-1.5 pt-2">
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-muted-foreground">Base Tax ({(baseTaxRate * 100).toFixed(0)}%):</span>
                                    <span>₹{baseTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-muted-foreground">Surcharge ({(surchargeRate * 100).toFixed(0)}%):</span>
                                    <span>₹{surcharge.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-muted-foreground">Health & Ed. Cess (4%):</span>
                                    <span>₹{cess.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between font-extrabold text-sm border-t pt-2 text-foreground">
                                    <span>Total Tax Liability:</span>
                                    <span>₹{totalTaxLiability.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground block text-right">
                                    Effective Tax Rate: <strong>{effectiveTaxRate.toFixed(2)}%</strong>
                                </span>
                            </div>

                            {/* Net Payable Result */}
                            <div className="mt-4 p-3 rounded-xl border bg-slate-50 dark:bg-slate-900/50 space-y-1">
                                <span className="text-[10px] font-bold text-muted-foreground block uppercase">NET SETTLEMENT POSITION</span>
                                {refundClaimable > 0 ? (
                                    <div className="text-lg font-bold text-emerald-600">
                                        Refund Claimable: ₹{refundClaimable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </div>
                                ) : (
                                    <div className="text-lg font-bold text-rose-600">
                                        Net Tax Payable: ₹{netTaxPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Advance Tax Schedule Table */}
                    <Card>
                        <CardHeader className="py-2.5 px-4 bg-muted/20 border-b">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Advance Tax Schedule (Sec 208/211)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 text-xs">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Installment</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead className="text-right">Cumulative Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell className="font-semibold">Q1 (15%)</TableCell>
                                        <TableCell>15 June 2025</TableCell>
                                        <TableCell className="text-right font-bold">₹{advanceTaxJune.toFixed(2)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-semibold">Q2 (45%)</TableCell>
                                        <TableCell>15 Sept 2025</TableCell>
                                        <TableCell className="text-right font-bold">₹{advanceTaxSept.toFixed(2)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-semibold">Q3 (75%)</TableCell>
                                        <TableCell>15 Dec 2025</TableCell>
                                        <TableCell className="text-right font-bold">₹{advanceTaxDec.toFixed(2)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-semibold">Q4 (100%)</TableCell>
                                        <TableCell>15 Mar 2026</TableCell>
                                        <TableCell className="text-right font-bold text-emerald-600">₹{advanceTaxMar.toFixed(2)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
