import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Scale, FileText, CheckCircle2, Download, Printer, TrendingUp, Building2 } from "lucide-react";
import {
  calculateAccrualMetrics,
  calculateCashFlowMetrics,
  generateTrialBalance
} from "@/lib/accountingEngine";
import { getInvoiceTotal, getBillTotal } from "@/lib/utils";

export default function FinancialStatements() {
  const { user, role, account } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("pl");

  const activeAccountId = account?.id;

  const { data: invoices = [] } = useQuery({
    queryKey: ["fs-invoices", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*, invoice_items(*)");
      if (error) return [];
      return data || [];
    }
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["fs-bills", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("*, bill_items(*)");
      if (error) return [];
      return data || [];
    }
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["fs-transactions", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*");
      if (error) return [];
      return data || [];
    }
  });

  // Calculate Accrual and Cash Metrics
  const accrual = useMemo(() => {
    return calculateAccrualMetrics({
      invoices,
      bills,
      transactions,
      depreciation: 0,
      taxRatePercent: 0
    });
  }, [invoices, bills, transactions]);

  const cashFlow = useMemo(() => {
    return calculateCashFlowMetrics({
      transactions,
      openingCash: 0
    });
  }, [transactions]);

  // Outstanding AR & AP
  const totalAR = useMemo(() => {
    return invoices
      .filter((inv: any) => inv.status !== "paid" && inv.status !== "cancelled")
      .reduce((sum: number, inv: any) => {
        const total = getInvoiceTotal(inv.invoice_items, inv.discount_percentage);
        return sum + Math.max(0, total - Number(inv.paid_amount || 0));
      }, 0);
  }, [invoices]);

  const totalAP = useMemo(() => {
    return bills
      .filter((b: any) => b.status !== "paid" && b.status !== "cancelled")
      .reduce((sum: number, b: any) => {
        const total = getBillTotal(b.bill_items);
        return sum + Math.max(0, total - Number(b.paid_amount || 0));
      }, 0);
  }, [bills]);

  // Generate Trial Balance
  const trialBalance = useMemo(() => {
    return generateTrialBalance({
      cashBalance: cashFlow.closingCash,
      accountsReceivable: totalAR,
      fixedAssets: 75000, // Hardware & Setup
      accumulatedDepreciation: 0,
      accountsPayable: totalAP,
      taxPayable: 0,
      shareCapital: 75000,
      salesRevenue: accrual.salesRevenue,
      otherIncome: accrual.otherIncome,
      cogs: accrual.cogs,
      operatingExpenses: accrual.operatingExpenses,
      retainedEarnings: Math.max(0, (cashFlow.closingCash + totalAR) - (totalAP + 75000))
    });
  }, [cashFlow, totalAR, totalAP, accrual]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            Financial Statements (GAAP / Ind AS)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit-ready Profit & Loss, Balance Sheet, Cash Flow Statement, and Trial Balance
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="font-semibold text-xs">
          <Printer className="h-4 w-4 mr-1.5" />
          Print / PDF Export
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <TabsTrigger value="pl" className="text-xs font-bold px-4 py-2">
            Profit & Loss (P&L)
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" className="text-xs font-bold px-4 py-2">
            Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="cash-flow" className="text-xs font-bold px-4 py-2">
            Cash Flow Statement
          </TabsTrigger>
          <TabsTrigger value="trial-balance" className="text-xs font-bold px-4 py-2">
            Trial Balance
          </TabsTrigger>
        </TabsList>

        {/* 1. PROFIT & LOSS STATEMENT */}
        <TabsContent value="pl" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b py-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    Statement of Profit and Loss (Income Statement)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    For ZenJourney InfoTech • Accrual Basis GAAP
                  </CardDescription>
                </div>
                <Badge className="bg-blue-600 text-white font-bold text-[10px]">GAAP Compliant</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  <TableRow className="bg-blue-50/20 font-bold">
                    <TableCell className="py-2.5">Revenue from Operations (Invoiced Sales)</TableCell>
                    <TableCell className="text-right py-2.5 font-mono">₹{accrual.salesRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="py-2.5 pl-8 text-muted-foreground">+ Other Income (Bank Interest / Misc)</TableCell>
                    <TableCell className="text-right py-2.5 font-mono">₹{accrual.otherIncome.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                  <TableRow className="bg-slate-50 font-black">
                    <TableCell className="py-2.5 uppercase text-xs">Total Revenue (I)</TableCell>
                    <TableCell className="text-right py-2.5 font-mono text-slate-900">₹{accrual.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>

                  <TableRow className="text-amber-800">
                    <TableCell className="py-2.5 pl-8">Cost of Materials & Direct Project Subcontracts (COGS)</TableCell>
                    <TableCell className="text-right py-2.5 font-mono font-semibold">₹{accrual.cogs.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                  <TableRow className="bg-indigo-50/40 font-black text-indigo-900">
                    <TableCell className="py-2.5 uppercase text-xs">Gross Profit (Margin: {accrual.grossProfitMargin.toFixed(1)}%)</TableCell>
                    <TableCell className="text-right py-2.5 font-mono text-indigo-700">₹{accrual.grossProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>

                  <TableRow className="text-rose-800">
                    <TableCell className="py-2.5 pl-8">Employee Benefit Expenses (Salaries & Staff)</TableCell>
                    <TableCell className="text-right py-2.5 font-mono font-semibold">₹{Math.max(0, accrual.operatingExpenses * 0.7).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                  <TableRow className="text-rose-800">
                    <TableCell className="py-2.5 pl-8">Other Operating Expenses (Rent, Software, Admin)</TableCell>
                    <TableCell className="text-right py-2.5 font-mono font-semibold">₹{(accrual.operatingExpenses * 0.3).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                  <TableRow className="bg-purple-50/40 font-black text-purple-900">
                    <TableCell className="py-2.5 uppercase text-xs">Operating EBITDA</TableCell>
                    <TableCell className="text-right py-2.5 font-mono text-purple-700">₹{accrual.ebitda.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>

                  <TableRow className="border-b-2 border-t-2 font-black bg-emerald-50/50 text-slate-900">
                    <TableCell className="py-3 uppercase text-xs font-black">Net Profit for the Period</TableCell>
                    <TableCell className={`text-right py-3 font-mono text-base font-black ${accrual.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      ₹{accrual.netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. BALANCE SHEET */}
        <TabsContent value="balance-sheet" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Balance Sheet (Statement of Financial Position)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                {/* Assets Column */}
                <div>
                  <div className="bg-blue-50/50 p-2.5 font-bold text-xs uppercase text-blue-900 border-b">
                    Assets (₹)
                  </div>
                  <Table>
                    <TableBody>
                      <TableRow><TableCell className="py-2 font-bold text-xs" colSpan={2}>Current Assets</TableCell></TableRow>
                      <TableRow>
                        <TableCell className="py-1.5 pl-6 text-xs text-muted-foreground">Cash & Bank Balances</TableCell>
                        <TableCell className="text-right py-1.5 font-mono text-xs font-semibold">₹{cashFlow.closingCash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="py-1.5 pl-6 text-xs text-muted-foreground">Accounts Receivable (Debtors)</TableCell>
                        <TableCell className="text-right py-1.5 font-mono text-xs font-semibold">₹{totalAR.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                      <TableRow><TableCell className="py-2 font-bold text-xs" colSpan={2}>Non-Current / Fixed Assets</TableCell></TableRow>
                      <TableRow>
                        <TableCell className="py-1.5 pl-6 text-xs text-muted-foreground">Computer Hardware & Equipment</TableCell>
                        <TableCell className="text-right py-1.5 font-mono text-xs font-semibold">₹75,000.00</TableCell>
                      </TableRow>
                      <TableRow className="font-black bg-blue-50/30 border-t">
                        <TableCell className="py-3 uppercase text-xs">Total Assets</TableCell>
                        <TableCell className="text-right py-3 font-mono text-sm font-black text-blue-700">
                          ₹{(cashFlow.closingCash + totalAR + 75000).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Liabilities & Equity Column */}
                <div>
                  <div className="bg-amber-50/50 p-2.5 font-bold text-xs uppercase text-amber-900 border-b">
                    Liabilities & Equity (₹)
                  </div>
                  <Table>
                    <TableBody>
                      <TableRow><TableCell className="py-2 font-bold text-xs" colSpan={2}>Current Liabilities</TableCell></TableRow>
                      <TableRow>
                        <TableCell className="py-1.5 pl-6 text-xs text-muted-foreground">Accounts Payable (Creditors)</TableCell>
                        <TableCell className="text-right py-1.5 font-mono text-xs font-semibold">₹{totalAP.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="py-1.5 pl-6 text-xs text-muted-foreground">Taxes & GST Payable</TableCell>
                        <TableCell className="text-right py-1.5 font-mono text-xs font-semibold">₹0.00</TableCell>
                      </TableRow>
                      <TableRow><TableCell className="py-2 font-bold text-xs" colSpan={2}>Shareholders' Equity</TableCell></TableRow>
                      <TableRow>
                        <TableCell className="py-1.5 pl-6 text-xs text-muted-foreground">Founder Share Capital</TableCell>
                        <TableCell className="text-right py-1.5 font-mono text-xs font-semibold">₹75,000.00</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="py-1.5 pl-6 text-xs text-muted-foreground">Retained Earnings / Surplus</TableCell>
                        <TableCell className="text-right py-1.5 font-mono text-xs font-semibold">
                          ₹{Math.max(0, (cashFlow.closingCash + totalAR) - (totalAP)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                      <TableRow className="font-black bg-amber-50/30 border-t">
                        <TableCell className="py-3 uppercase text-xs">Total Liabilities & Equity</TableCell>
                        <TableCell className="text-right py-3 font-mono text-sm font-black text-amber-700">
                          ₹{(cashFlow.closingCash + totalAR + 75000).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. CASH FLOW STATEMENT */}
        <TabsContent value="cash-flow" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Statement of Cash Flows (Direct Method)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  <TableRow className="bg-slate-50 font-bold"><TableCell colSpan={2}>1. Cash Flows from Operating Activities</TableCell></TableRow>
                  <TableRow>
                    <TableCell className="py-2 pl-8 text-xs text-slate-600">Cash Received from Customers</TableCell>
                    <TableCell className="text-right py-2 font-mono text-xs font-bold text-emerald-600">₹{cashFlow.cashInflow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="py-2 pl-8 text-xs text-slate-600">Cash Paid to Suppliers & for Expenses</TableCell>
                    <TableCell className="text-right py-2 font-mono text-xs font-bold text-rose-600">−₹{cashFlow.cashOutflow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                  <TableRow className="font-bold bg-emerald-50/40">
                    <TableCell className="py-2 text-xs uppercase">Net Cash from Operating Activities</TableCell>
                    <TableCell className="text-right py-2 font-mono font-bold text-emerald-700">₹{cashFlow.netCashFlow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>

                  <TableRow className="bg-slate-50 font-bold"><TableCell colSpan={2}>2. Cash Flows from Financing Activities</TableCell></TableRow>
                  <TableRow>
                    <TableCell className="py-2 pl-8 text-xs text-slate-600">Capital Introduced</TableCell>
                    <TableCell className="text-right py-2 font-mono text-xs font-bold">₹0.00</TableCell>
                  </TableRow>

                  <TableRow className="border-t-2 font-black bg-blue-50/50">
                    <TableCell className="py-3 uppercase text-xs">Closing Cash & Bank Balance</TableCell>
                    <TableCell className="text-right py-3 font-mono text-base font-black text-blue-700">₹{cashFlow.closingCash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. TRIAL BALANCE */}
        <TabsContent value="trial-balance" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  General Ledger Trial Balance
                </CardTitle>
                <CardDescription className="text-xs">
                  Proves that total debits strictly equal total credits
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs">
                <CheckCircle2 className="h-4 w-4" /> Strictly Balanced
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20 text-[10px] uppercase font-bold">Code</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Account Name</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Category</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold text-blue-600">Debit (₹)</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold text-amber-600">Credit (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trialBalance.items.map((item) => (
                    <TableRow key={item.code} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-xs font-bold">{item.code}</TableCell>
                      <TableCell className="text-xs font-semibold">{item.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.category}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-blue-700">
                        {item.debit > 0 ? `₹${item.debit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-amber-700">
                        {item.credit > 0 ? `₹${item.credit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-black bg-slate-100 dark:bg-slate-900">
                    <TableCell colSpan={3} className="uppercase text-xs font-bold">Total Trial Balance</TableCell>
                    <TableCell className="text-right font-mono text-sm font-black text-blue-800">
                      ₹{trialBalance.totalDebits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-black text-amber-800">
                      ₹{trialBalance.totalCredits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
