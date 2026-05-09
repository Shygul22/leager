import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, isToday, isThisWeek } from "date-fns";
import { Download, Printer, Filter, ArrowUpRight, ArrowDownRight, Scale } from "lucide-react";

export default function TaxReports() {
    const { user, role } = useAuth();
    const [dateRange, setDateRange] = useState("current"); // current, last, last3, all

    const { data: invoices = [], isLoading: invLoading } = useQuery({
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
            return data;
        },
        enabled: !!user && !!role,
    });

    const { data: bills = [], isLoading: billsLoading } = useQuery({
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
            return data;
        },
        enabled: !!user && !!role,
    });


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

    const stats = useMemo(() => {
        const { invoices, bills } = filteredData;

        const outputGst = invoices.reduce((sum, inv) => {
            return sum + (inv.invoice_items || []).reduce((s, i) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
        }, 0);

        const inputGst = bills.reduce((sum, bill) => {
            return sum + (bill.bill_items || []).reduce((s, i) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
        }, 0);

        const b2bInvoices = invoices.filter(inv => inv.client_gstin && inv.client_gstin.trim().length > 0);
        const b2cInvoices = invoices.filter(inv => !inv.client_gstin || inv.client_gstin.trim().length === 0);

        const b2bGst = b2bInvoices.reduce((sum, inv) => {
            return sum + (inv.invoice_items || []).reduce((s, i) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Tax Reports (GST)</h1>
                    <p className="text-muted-foreground text-sm mt-1">Summary of GST collected from sales and GST paid on purchases.</p>
                </div>
                <div className="flex gap-2 print:hidden">
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-[180px]">
                            <Filter className="w-4 h-4 mr-2" />
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
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="w-4 h-4 mr-2" /> Print Report
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center text-emerald-600 dark:text-emerald-400">
                            <ArrowUpRight className="w-4 h-4 mr-1" /> GST Collected (Output)
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold">₹{stats.outputGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">From {stats.count.inv} invoices</p>
                    </CardContent>
                </Card>

                <Card className="bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center text-amber-600 dark:text-amber-400">
                            <ArrowDownRight className="w-4 h-4 mr-1" /> GST Paid (Input Credit)
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold">₹{stats.inputGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">From {stats.count.bills} bills</p>
                    </CardContent>
                </Card>

                <Card className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/50">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center text-blue-600 dark:text-blue-400">
                            <Scale className="w-4 h-4 mr-1" /> Net GST Payable
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold">₹{stats.netPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Estimated tax liability</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>B2B vs B2C Breakdown</CardTitle>
                        <CardDescription>GST collected categorized by customer type.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">GST Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-medium">B2B (With GSTIN)</TableCell>
                                    <TableCell className="text-right">₹{stats.b2bGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">B2C (Consumer)</TableCell>
                                    <TableCell className="text-right">₹{stats.b2cGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                                <TableRow className="font-bold border-t">
                                    <TableCell>Total Output GST</TableCell>
                                    <TableCell className="text-right">₹{stats.outputGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Taxable Transactions</CardTitle>
                        <CardDescription>Invoices and Bills affecting GST.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Entity</TableHead>
                                    <TableHead className="text-right">GST</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredData.invoices.slice(0, 3).map(inv => (
                                    <TableRow key={inv.id}>
                                        <TableCell><span className="text-emerald-600 text-[10px] font-bold uppercase py-0.5 px-1.5 rounded bg-emerald-100">Sale</span></TableCell>
                                        <TableCell className="text-sm truncate max-w-[120px]">{inv.client_name}</TableCell>
                                        <TableCell className="text-right text-sm">₹{(inv.invoice_items || []).reduce((s, i) => s + (i.quantity * i.rate * (i.gst / 100)), 0).toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                                {filteredData.bills.slice(0, 3).map(bill => (
                                    <TableRow key={bill.id}>
                                        <TableCell><span className="text-amber-600 text-[10px] font-bold uppercase py-0.5 px-1.5 rounded bg-amber-100">Purch</span></TableCell>
                                        <TableCell className="text-sm truncate max-w-[120px]">{bill.suppliers?.name}</TableCell>
                                        <TableCell className="text-right text-sm">₹{(bill.bill_items || []).reduce((s, i) => s + (i.quantity * i.rate * (i.gst / 100)), 0).toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                                {stats.count.inv === 0 && stats.count.bills === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm font-italic">No transactions in this period</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
