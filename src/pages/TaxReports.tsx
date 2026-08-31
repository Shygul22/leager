import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, isToday, isThisWeek } from "date-fns";
import { Download, Printer, Filter, ArrowUpRight, ArrowDownRight, Scale, ShieldCheck, Calculator, Calendar, FileText } from "lucide-react";

import IncomeTaxCalculator from "@/components/tax/IncomeTaxCalculator";
import ComplianceDashboard from "@/components/tax/ComplianceDashboard";
import TaxLedger from "@/components/tax/TaxLedger";

export default function TaxReports() {
    const { user, role } = useAuth();
    const [mainTab, setMainTab] = useState<string>("compliance");
    const [dateRange, setDateRange] = useState("current"); // current, last, last3, all

    // Fetch Invoices
    const { data: invoices = [], refetch: refetchInvoices } = useQuery({
        queryKey: ["invoices-tax", user?.id, role],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("invoices").select("*, invoice_items(*)");
            const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
            if (!isStaffOrAbove) {
                query = query.eq("user_id", user.id);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        enabled: !!user && !!role,
    });

    // Fetch Bills
    const { data: bills = [], refetch: refetchBills } = useQuery({
        queryKey: ["bills-tax", user?.id, role],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("bills").select("*, bill_items(*)");
            const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
            if (!isStaffOrAbove) {
                query = query.eq("user_id", user.id);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
        enabled: !!user && !!role,
    });

    // Fetch All Transactions (Income & Expense)
    const { data: transactions = [], refetch: refetchTransactions } = useQuery({
        queryKey: ["transactions-tax", user?.id, role],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("transactions").select("*");
            const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
            if (!isStaffOrAbove) {
                query = query.eq("user_id", user.id);
            }
            const { data, error } = await query;
            if (error) return [];
            return data || [];
        },
        enabled: !!user && !!role,
    });

    // Fetch Payroll Employees
    const { data: employees = [] } = useQuery({
        queryKey: ["employees-tax"],
        queryFn: async () => {
            const { data, error } = await supabase.from("employees").select("*");
            if (error) return [];
            return data || [];
        }
    });

    const handleRefetchAll = () => {
        refetchInvoices();
        refetchBills();
        refetchTransactions();
    };

    // Filtered Transactions by dateRange
    const filteredTransactionsTax = useMemo(() => {
        if (dateRange === "all") return transactions;
        return transactions.filter((t: any) => {
            const dStr = t.date || t.created_at;
            if (!dStr) return false;
            try {
                const parsed = parseISO(dStr);
                if (dateRange === "today") return isToday(parsed);
                if (dateRange === "this-week") return isThisWeek(parsed);
                return true;
            } catch (e) {
                return false;
            }
        });
    }, [transactions, dateRange]);

    const syncedIncomeTx = useMemo(() => {
        return filteredTransactionsTax
            .filter((t: any) => t.type === "income")
            .reduce((acc, t: any) => acc + Number(t.amount || 0), 0);
    }, [filteredTransactionsTax]);

    const syncedExpenseTx = useMemo(() => {
        return filteredTransactionsTax
            .filter((t: any) => t.type === "expense")
            .reduce((acc, t: any) => acc + Number(t.amount || 0), 0);
    }, [filteredTransactionsTax]);

    // GST & Filtered Invoices/Bills Data
    const filteredData = useMemo(() => {
        let start = new Date(0);
        let end = new Date();

        if (dateRange === "today") {
            const invoicesToday = invoices.filter(inv => isToday(parseISO(inv.date)));
            const billsToday = bills.filter(bill => isToday(parseISO(bill.date)));
            return { invoices: invoicesToday, bills: billsToday };
        } else if (dateRange === "this-week") {
            const invoicesWeek = invoices.filter(inv => isThisWeek(parseISO(inv.date)));
            const billsWeek = bills.filter(bill => isThisWeek(parseISO(bill.date)));
            return { invoices: invoicesWeek, bills: billsWeek };
        }

        if (dateRange === "current") {
            start = startOfMonth(new Date());
            end = endOfMonth(new Date());
        } else if (dateRange === "last") {
            start = startOfMonth(subMonths(new Date(), 1));
            end = endOfMonth(subMonths(new Date(), 1));
        } else if (dateRange === "last3") {
            start = startOfMonth(subMonths(new Date(), 2));
            end = endOfMonth(new Date());
        }

        const filteredInvoices = invoices.filter(inv => {
            const d = parseISO(inv.date);
            return isWithinInterval(d, { start, end });
        });

        const filteredBills = bills.filter(bill => {
            const d = parseISO(bill.date);
            return isWithinInterval(d, { start, end });
        });

        return { invoices: filteredInvoices, bills: filteredBills };
    }, [invoices, bills, dateRange]);

    // Calculate synced figures for income tax calculator
    const syncedRevenue = useMemo(() => {
        const invRev = filteredData.invoices.reduce((acc, inv) => {
            const items = inv.invoice_items || [];
            const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.rate), 0);
            const disc = subtotal * ((inv.discount_percentage || 0) / 100);
            return acc + (subtotal - disc);
        }, 0);

        return invRev > 0 ? invRev : syncedIncomeTx;
    }, [filteredData.invoices, syncedIncomeTx]);

    const syncedBillsExpenses = useMemo(() => {
        return filteredData.bills.reduce((acc, b) => {
            const items = b.bill_items || [];
            const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.rate), 0);
            const disc = subtotal * ((b.discount_percentage || 0) / 100);
            return acc + (subtotal - disc);
        }, 0);
    }, [filteredData.bills]);

    const syncedOpex = useMemo(() => {
        return syncedExpenseTx;
    }, [syncedExpenseTx]);

    const syncedPayroll = useMemo(() => {
        return employees.reduce((acc, emp) => acc + (Number(emp.salary || 0) * 12), 0);
    }, [employees]);

    const gstStats = useMemo(() => {
        const { invoices, bills } = filteredData;

        const outputGst = invoices.reduce((sum, inv) => {
            return sum + (inv.invoice_items || []).reduce((s: number, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
        }, 0);

        const inputGst = bills.reduce((sum, bill) => {
            return sum + (bill.bill_items || []).reduce((s: number, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
        }, 0);

        const b2bInvoices = invoices.filter(inv => inv.client_gstin && inv.client_gstin.trim().length > 0);

        const b2bGst = b2bInvoices.reduce((sum, inv) => {
            return sum + (inv.invoice_items || []).reduce((s: number, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
        }, 0);

        return {
            outputGst,
            inputGst,
            netPayable: outputGst - inputGst,
            b2bGst,
            b2cGst: outputGst - b2bGst,
            count: { inv: invoices.length, bills: bills.length }
        };
    }, [filteredData]);

    const handlePrint = () => window.print();

    return (
        <div className="space-y-6">
            {/* Header Title */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Tax & Compliance Hub</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Corporate Income Tax, Advance Tax Schedules, Statutory Filings Calendar, and GST Center.
                    </p>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                    <Button variant="outline" size="sm" onClick={handlePrint}>
                        <Printer className="w-4 h-4 mr-2" /> Print Summary
                    </Button>
                </div>
            </div>

            {/* Main Tabs Navigation */}
            <Tabs value={mainTab} onValueChange={setMainTab} className="w-full space-y-4">
                <TabsList className="bg-muted/40 w-full sm:w-auto grid grid-cols-2 sm:grid-cols-4 print:hidden">
                    <TabsTrigger value="compliance" className="font-semibold text-xs">
                        <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Due-Date Compliance
                    </TabsTrigger>
                    <TabsTrigger value="income-tax" className="font-semibold text-xs">
                        <Calculator className="h-3.5 w-3.5 mr-1.5" /> Income Tax & Advance Tax
                    </TabsTrigger>
                    <TabsTrigger value="tax-ledger" className="font-semibold text-xs">
                        <FileText className="h-3.5 w-3.5 mr-1.5" /> Tax Ledger & TDS
                    </TabsTrigger>
                    <TabsTrigger value="gst" className="font-semibold text-xs">
                        <Scale className="h-3.5 w-3.5 mr-1.5" /> GST Tax Center
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: Statutory Compliance Due-Date Tracker */}
                <TabsContent value="compliance">
                    <ComplianceDashboard />
                </TabsContent>

                {/* Tab 2: Corporate Income Tax & Advance Tax Calculator */}
                <TabsContent value="income-tax">
                    <IncomeTaxCalculator 
                        syncedRevenue={syncedRevenue}
                        syncedExpenses={syncedOpex}
                        syncedBills={syncedBillsExpenses}
                        syncedPayroll={syncedPayroll}
                        syncedIncomeTx={syncedIncomeTx}
                        syncedExpenseTx={syncedExpenseTx}
                        onRefreshSync={handleRefetchAll}
                    />
                </TabsContent>

                {/* Tab 3: Tax Ledger & TDS Credits */}
                <TabsContent value="tax-ledger">
                    <TaxLedger />
                </TabsContent>

                {/* Tab 4: GST Tax Center */}
                <TabsContent value="gst" className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm">Goods & Services Tax (GST) Summary</h3>
                        <Select value={dateRange} onValueChange={setDateRange}>
                            <SelectTrigger className="w-[180px] text-xs">
                                <Filter className="w-3.5 h-3.5 mr-2" />
                                <SelectValue placeholder="Period" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="this-week">This Week</SelectItem>
                                <SelectItem value="current">This Month</SelectItem>
                                <SelectItem value="last">Last Month</SelectItem>
                                <SelectItem value="last3">Last 3 Months</SelectItem>
                                <SelectItem value="all">All Time</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50">
                            <CardHeader className="pb-2">
                                <CardDescription className="flex items-center text-emerald-600 dark:text-emerald-400 text-xs">
                                    <ArrowUpRight className="w-4 h-4 mr-1" /> GST Collected (Output)
                                </CardDescription>
                                <CardTitle className="text-3xl font-bold">₹{gstStats.outputGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">From {gstStats.count.inv} sales invoices</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50">
                            <CardHeader className="pb-2">
                                <CardDescription className="flex items-center text-amber-600 dark:text-amber-400 text-xs">
                                    <ArrowDownRight className="w-4 h-4 mr-1" /> GST Paid (Input Credit)
                                </CardDescription>
                                <CardTitle className="text-3xl font-bold">₹{gstStats.inputGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">From {gstStats.count.bills} purchase bills</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/50">
                            <CardHeader className="pb-2">
                                <CardDescription className="flex items-center text-blue-600 dark:text-blue-400 text-xs">
                                    <Scale className="w-4 h-4 mr-1" /> Net GST Payable
                                </CardDescription>
                                <CardTitle className="text-3xl font-bold">₹{gstStats.netPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">Output GST minus Input Credit</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-bold">B2B vs B2C Breakdown</CardTitle>
                                <CardDescription className="text-xs">GST collected categorized by customer GSTIN.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table className="text-xs">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Category</TableHead>
                                            <TableHead className="text-right">GST Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell className="font-medium">B2B (With GSTIN)</TableCell>
                                            <TableCell className="text-right">₹{gstStats.b2bGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">B2C (Consumer)</TableCell>
                                            <TableCell className="text-right">₹{gstStats.b2cGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                                        </TableRow>
                                        <TableRow className="font-bold border-t">
                                            <TableCell>Total Output GST</TableCell>
                                            <TableCell className="text-right">₹{gstStats.outputGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-bold">Recent Taxable Transactions</CardTitle>
                                <CardDescription className="text-xs">Invoices and Bills affecting GST liability.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table className="text-xs">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Entity</TableHead>
                                            <TableHead className="text-right">GST</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredData.invoices.slice(0, 3).map((inv: any) => (
                                            <TableRow key={inv.id}>
                                                <TableCell><span className="text-emerald-600 text-[10px] font-bold uppercase py-0.5 px-1.5 rounded bg-emerald-100">Sale</span></TableCell>
                                                <TableCell className="truncate max-w-[120px] font-medium">{inv.client_name}</TableCell>
                                                <TableCell className="text-right font-bold text-emerald-600">₹{(inv.invoice_items || []).reduce((s: number, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                        {filteredData.bills.slice(0, 3).map((bill: any) => (
                                            <TableRow key={bill.id}>
                                                <TableCell><span className="text-amber-600 text-[10px] font-bold uppercase py-0.5 px-1.5 rounded bg-amber-100">Purch</span></TableCell>
                                                <TableCell className="truncate max-w-[120px] font-medium">{bill.suppliers?.name || "Supplier"}</TableCell>
                                                <TableCell className="text-right font-bold text-amber-600">₹{(bill.bill_items || []).reduce((s: number, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                        {gstStats.count.inv === 0 && gstStats.count.bills === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-4 text-muted-foreground italic">No transactions in this period</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
