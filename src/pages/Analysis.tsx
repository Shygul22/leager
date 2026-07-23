import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format, isToday, isThisWeek, parseISO } from "date-fns";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
    PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, TrendingDown, Wallet, IndianRupee, AlertCircle, ShoppingBag, Scale, ArrowUpRight, ArrowDownRight, BarChart2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBillTotal, getInvoiceTotal } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c'];

const getCurrencySymbol = (currency?: string | null) => {
    switch (currency) {
        case "USD": return "$";
        case "EUR": return "€";
        case "GBP": return "£";
        case "AED": return "AED ";
        default: return "₹";
    }
};

export default function Analysis() {
    const { user, role } = useAuth();
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

    const { data: transactions = [] } = useQuery({
        queryKey: ["transactions", user?.id, role],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("transactions").select("*, employees(name)");
            const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
            if (!isStaffOrAbove) {
                query = query.eq("user_id", user.id);
            }
            const { data, error } = await query.order("date", { ascending: true });
            if (error) throw error;
            return data;
        },
        enabled: !!user && !!role,
    });

    const { data: bills = [] } = useQuery({
        queryKey: ["bills", user?.id, role],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("bills").select("*, suppliers(name), employees(name), bill_items(*)");
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

    const { data: invoices = [] } = useQuery({
        queryKey: ["invoices", user?.id, role],
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

    const { data: quotations = [] } = useQuery({
        queryKey: ["quotations", user?.id, role],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("quotations").select("*, quotation_items(*)");
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

    const uniqueMonths = useMemo(() => {
        const months = new Set<string>();
        months.add(format(new Date(), "MMM yyyy")); // Ensure current month is always an option
        transactions.forEach(t => months.add(format(new Date(t.date), "MMM yyyy")));
        invoices.forEach((inv: any) => inv.date && months.add(format(new Date(inv.date), "MMM yyyy")));
        quotations.forEach((q: any) => q.date && months.add(format(new Date(q.date), "MMM yyyy")));
        return Array.from(months);
    }, [transactions, invoices, quotations]);

    const filteredTransactions = useMemo(() => {
        if (selectedRange === "all") return transactions;
        if (selectedRange === "today") return transactions.filter(t => isToday(parseISO(t.date)));
        if (selectedRange === "this-week") return transactions.filter(t => isThisWeek(parseISO(t.date)));
        return transactions.filter(t => format(new Date(t.date), "MMM yyyy") === selectedRange);
    }, [transactions, selectedRange]);

    const incomeTxs = filteredTransactions.filter((t) => t.type === "income");
    const expenseTxs = filteredTransactions.filter((t) => t.type === "expense");

    // Accrual Logic (Net Profit)
    const filteredBills = useMemo(() => {
        if (selectedRange === "all") return bills;
        if (selectedRange === "today") return bills.filter(b => isToday(parseISO(b.date)));
        if (selectedRange === "this-week") return bills.filter(b => isThisWeek(parseISO(b.date)));
        return bills.filter(b => format(new Date(b.date), "MMM yyyy") === selectedRange);
    }, [bills, selectedRange]);

    const filteredInvoices = useMemo(() => {
        if (selectedRange === "all") return invoices;
        if (selectedRange === "today") return invoices.filter((inv: any) => isToday(parseISO(inv.date)));
        if (selectedRange === "this-week") return invoices.filter((inv: any) => isThisWeek(parseISO(inv.date)));
        return invoices.filter((inv: any) => format(new Date(inv.date), "MMM yyyy") === selectedRange);
    }, [invoices, selectedRange]);

    const filteredQuotations = useMemo(() => {
        if (selectedRange === "all") return quotations;
        if (selectedRange === "today") return quotations.filter((q: any) => isToday(parseISO(q.date)));
        if (selectedRange === "this-week") return quotations.filter((q: any) => isThisWeek(parseISO(q.date)));
        return quotations.filter((q: any) => format(new Date(q.date), "MMM yyyy") === selectedRange);
    }, [quotations, selectedRange]);

    const taxStats = useMemo(() => {
        const outputGst = filteredInvoices.reduce((sum, inv) => {
            return sum + (inv.invoice_items || []).reduce((s: number, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
        }, 0);

        const inputGst = filteredBills.reduce((sum, bill) => {
            return sum + (bill.bill_items || []).reduce((s: number, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
        }, 0);

        const b2bInvoices = filteredInvoices.filter(inv => inv.client_gstin && inv.client_gstin.trim().length > 0);
        const b2bGst = b2bInvoices.reduce((sum, inv) => {
            return sum + (inv.invoice_items || []).reduce((s: number, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
        }, 0);

        return {
            outputGst,
            inputGst,
            netPayable: outputGst - inputGst,
            b2bGst,
            b2cGst: outputGst - b2bGst,
            invCount: filteredInvoices.length,
            billCount: filteredBills.length
        };
    }, [filteredInvoices, filteredBills]);

    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + getInvoiceTotal(inv.invoice_items, inv.discount_percentage), 0);
    const totalBillsCost = filteredBills.reduce((sum, b) => sum + getBillTotal(b.bill_items), 0);
    
    // Cash Logic (Actual Cash Flow / Savings)
    const totalCashIn = incomeTxs.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalCashOut = expenseTxs.reduce((sum, t) => sum + Number(t.amount), 0);
    const savingAmount = totalCashIn - totalCashOut;

    const futureInvoices = useMemo(() => {
        return invoices.filter((inv: any) => inv.status === "draft" || (inv.date && new Date(inv.date) > new Date()));
    }, [invoices]);

    const futureAmount = useMemo(() => {
        return futureInvoices.reduce((sum, inv) => sum + getInvoiceTotal(inv.invoice_items, inv.discount_percentage), 0);
    }, [futureInvoices]);

    // Requested: Total Costs (Calculated in Transactions)
    const totalTransactionsCost = totalCashOut;

    // Requested: Outstanding Amount (Balance due from invoices, based on ledger transactions)
    const outstandingAmount = Math.max(0, totalRevenue - totalCashIn);

    // Operating expenses are manual expenses NOT logged as bill payments
    const operatingExpenses = expenseTxs
        .filter(t => !t.description?.startsWith("Paid Bill "))
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalCost = totalBillsCost + operatingExpenses;
    const netProfit = totalRevenue - totalTransactionsCost;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const outstandingBills = bills.filter(b => b.status === "pending").reduce((sum, b) => sum + getBillTotal(b.bill_items), 0);

    // Supplier Spend Map
    // Supplier Spend Map
    const supplierMap = new Map<string, number>();
    filteredBills.forEach(b => {
        const name = b.suppliers?.name || "Unknown Supplier";
        supplierMap.set(name, (supplierMap.get(name) || 0) + getBillTotal(b.bill_items));
    });
    const supplierData = Array.from(supplierMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Client Revenue Map
    const clientMap = new Map<string, number>();
    filteredInvoices.forEach((inv: any) => {
        const name = inv.client_name || "Unknown Client";
        const total = (inv.invoice_items || []).reduce((s: number, i: any) => s + (i.quantity * i.rate * (1 + (i.gst || 0) / 100)), 0);
        clientMap.set(name, (clientMap.get(name) || 0) + total);
    });
    const clientData = Array.from(clientMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Employee Spend Map
    const employeeMap = new Map<string, number>();

    // Bills spend
    filteredBills.forEach(b => {
        if (b.employees?.name && b.status !== "paid") {
            const name = b.employees.name;
            employeeMap.set(name, (employeeMap.get(name) || 0) + getBillTotal(b.bill_items));
        }
    });

    // Manual transactions spend
    expenseTxs.forEach(t => {
        if (t.employees?.name) {
            const name = t.employees.name;
            employeeMap.set(name, (employeeMap.get(name) || 0) + Number(t.amount));
        }
    });

    const employeeData = Array.from(employeeMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);


    // Pie Chart Data (Expenses by Category for selected month)
    const categoryMap = new Map<string, number>();
    expenseTxs.forEach(t => {
        categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + Number(t.amount));
    });
    const pieData = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Profit vs Savings Trend Data (Synced Logic)
    const trendMap = new Map<string, { revenue: number; cost: number; savings: number; collected: number }>();
    
    invoices.forEach(inv => {
        const month = format(new Date(inv.date), "MMM yyyy");
        const existing = trendMap.get(month) || { revenue: 0, cost: 0, savings: 0, collected: 0 };
        existing.revenue += getInvoiceTotal(inv.invoice_items, inv.discount_percentage);
        existing.collected += (Number(inv.paid_amount) || 0);
        trendMap.set(month, existing);
    });

    // Bills are tracked for cost in the accrual profit calculation if you want, 
    // but the user asked for Total Costs from Transactions.
    // However, for a trend, it's good to show both. Let's stick to their requested "Transactions Only" cost for consistency.

    transactions.forEach(t => {
        const month = format(new Date(t.date), "MMM yyyy");
        const existing = trendMap.get(month) || { revenue: 0, cost: 0, savings: 0, collected: 0 };
        
        if (t.type === "income") {
            existing.collected += Number(t.amount);
        } else {
            existing.cost += Number(t.amount);
        }
        trendMap.set(month, existing);
    });

    const profitSavingsData = Array.from(trendMap.entries())
        .map(([month, vals]) => ({ 
            month, 
            profit: vals.revenue - vals.cost, 
            savings: vals.collected - vals.cost,
            revenue: vals.revenue,
            costs: vals.cost,
            cashFlow: vals.collected - vals.cost,
            outstanding: vals.revenue - vals.collected
        }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

    // Original Monthly Trend (Income vs Expense)
    const chartMap = new Map<string, { income: number; expense: number }>();
    transactions.forEach((t) => {
        const month = format(new Date(t.date), "MMM yyyy");
        const existing = chartMap.get(month) || { income: 0, expense: 0 };
        if (t.type === "income") existing.income += Number(t.amount);
        else existing.expense += Number(t.amount);
        chartMap.set(month, existing);
    });
    // Maintain chronological order as fetched by parsing the month string back to a date for sorting
    const monthlyData = Array.from(chartMap.entries())
        .map(([month, vals]) => ({ month, ...vals }))
        .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

    const maxExpenseCategory = pieData.length > 0 ? pieData[0] : null;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold tracking-tight">Financial Analysis</h1>
                <Select value={selectedRange} onValueChange={setSelectedRange}>
                    <SelectTrigger className="w-full sm:w-[180px]">
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

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
                <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Revenue</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-emerald-600">
                            {getCurrencySymbol(profile?.default_currency)}
                            {formatAmount(totalRevenue)}
                        </p>
                        <p className="text-[9px] text-muted-foreground font-semibold mt-1 uppercase tracking-widest text-right">Total Invoiced</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-destructive shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Costs</CardTitle>
                        <TrendingDown className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-destructive">
                            {getCurrencySymbol(profile?.default_currency)}
                            {formatAmount(totalTransactionsCost)}
                        </p>
                        <p className="text-[9px] text-muted-foreground font-semibold mt-1 uppercase tracking-widest text-right">Ledger Transactions</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Net Profit</CardTitle>
                        <IndianRupee className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-blue-600" : "text-destructive"}`}>
                            {getCurrencySymbol(profile?.default_currency)}
                            {formatAmount(netProfit)}
                        </p>
                        <p className={`text-[9px] font-bold mt-1 uppercase tracking-widest text-right ${profitMargin >= 0 ? "text-blue-500" : "text-destructive"}`}>
                            Margin: {profitMargin.toFixed(1)}%
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-orange-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Client Balance</CardTitle>
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-orange-600">
                            {getCurrencySymbol(profile?.default_currency)}
                            {formatAmount(outstandingAmount)}
                        </p>
                        <p className="text-[9px] text-muted-foreground font-semibold mt-1 uppercase tracking-widest text-right">Outstanding Amount</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Actual Cash flow</CardTitle>
                        <Wallet className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <p className={`text-2xl font-bold ${savingAmount >= 0 ? "text-amber-600" : "text-destructive"}`}>
                            {getCurrencySymbol(profile?.default_currency)}
                            {formatAmount(savingAmount)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Expenses by Category */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Expenses by Category {selectedRange !== 'all' ? `(${selectedRange})` : ''}</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px] flex items-center justify-center p-0">
                        {pieData.length > 0 ? (
                            <div className="w-full h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip formatter={(value: number) => `${getCurrencySymbol(profile?.default_currency)}${formatAmount(value)}`} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="text-muted-foreground">No expense data available</div>
                        )}
                    </CardContent>
                </Card>

                {/* Income vs Expense Over Time */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Monthly Trend</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px] p-0">
                        {monthlyData.length > 0 ? (
                            <div className="w-full h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                        <XAxis dataKey="month" className="text-xs" />
                                        <YAxis className="text-xs" />
                                        <RechartsTooltip formatter={(value: number) => `${getCurrencySymbol(profile?.default_currency)}${formatAmount(value)}`} />
                                        <Legend />
                                        <Line type="monotone" dataKey="income" stroke="hsl(142, 71%, 45%)" activeDot={{ r: 8 }} name="Income" strokeWidth={2} />
                                        <Line type="monotone" dataKey="expense" stroke="hsl(0, 84%, 60%)" name="Expense" strokeWidth={2} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
                        )}
                    </CardContent>
                </Card>

                {/* Combined Bar Chart */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Revenue by Client</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[400px] p-0">
                        {clientData.length > 0 ? (
                            <div className="w-full h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={clientData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={({ name }) => name}
                                        >
                                            {clientData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip formatter={(value: number) => `${getCurrencySymbol(profile?.default_currency)}${formatAmount(value)}`} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">No client data available</div>
                        )}
                    </CardContent>
                </Card>

                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Spending by Supplier</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[400px] p-0">
                        {supplierData.length > 0 ? (
                            <div className="w-full h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={supplierData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={({ name }) => name}
                                        >
                                            {supplierData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip formatter={(value: number) => `${getCurrencySymbol(profile?.default_currency)}${formatAmount(value)}`} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">No supplier data available</div>
                        )}
                    </CardContent>
                </Card>

                <Card className="col-span-1 md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Profit vs Savings Trend</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[400px] p-0">
                        {profitSavingsData.length > 0 ? (
                            <div className="w-full h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={profitSavingsData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                        <XAxis dataKey="month" className="text-xs" />
                                        <YAxis className="text-xs" />
                                        <RechartsTooltip formatter={(value: number) => `${getCurrencySymbol(profile?.default_currency)}${formatAmount(value)}`} />
                                        <Legend />
                                        <Bar dataKey="profit" fill="hsl(217, 91%, 60%)" name="Accrual Profit" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="savings" fill="hsl(38, 92%, 50%)" name="Cash Savings" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">No trend data available</div>
                        )}
                    </CardContent>
                </Card>

                {/* Expenses by Employee */}
                <Card className="col-span-1 md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Expenses by Employee</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px] p-4">
                        {employeeData.length > 0 ? (
                            <div className="w-full h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        layout="vertical"
                                        data={employeeData}
                                        margin={{ left: 40, right: 40, top: 20, bottom: 20 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            axisLine={false}
                                            tickLine={false}
                                            width={100}
                                            className="text-xs"
                                        />
                                        <RechartsTooltip formatter={(value: number) => `${getCurrencySymbol(profile?.default_currency)}${formatAmount(value)}`} />
                                        <Bar dataKey="value" fill="hsl(215, 20%, 65%)" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">No employee expense data available</div>
                        )}
                    </CardContent>
                </Card>

                {/* Future Billing / Forecast */}
                <Card className="col-span-1 md:col-span-2 shadow-sm overflow-hidden border-t-4 border-t-blue-500">
                    <CardHeader className="bg-blue-50/30 border-b">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-blue-700 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Future Forecast
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        <th className="px-4 py-3 font-semibold text-[10px] uppercase text-muted-foreground">Upcoming Item</th>
                                        <th className="px-4 py-3 font-semibold text-[10px] uppercase text-muted-foreground text-right">Estimated</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {futureInvoices.length === 0 ? (
                                        <tr><td colSpan={2} className="text-center py-8 text-muted-foreground italic text-[10px] uppercase tracking-widest">No future billing found</td></tr>
                                    ) : (
                                        futureInvoices.slice(0, 5).map((inv: any) => (
                                            <tr key={inv.id} className="border-b last:border-0 hover:bg-blue-50/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="text-[10px] font-bold text-slate-900">{inv.invoice_number}</div>
                                                    <div className="text-[8px] text-muted-foreground mt-0.5">
                                                        {inv.date ? format(new Date(inv.date), "PPP") : "Schedule Pending"}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs font-bold text-blue-600">
                                                    {getCurrencySymbol(profile?.default_currency)}
                                                    {formatAmount(getInvoiceTotal(inv.invoice_items, inv.discount_percentage))}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {futureInvoices.length > 0 && (
                            <div className="p-3 bg-blue-50 border-t flex items-center justify-between">
                                <span className="text-[9px] font-bold text-blue-700 uppercase tracking-widest">Projected Future Total</span>
                                <span className="text-xs font-bold text-blue-700">
                                    {getCurrencySymbol(profile?.default_currency)}
                                    {formatAmount(futureAmount)}
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Monthly Report Table */}
            <Card className="shadow-sm border-none bg-card/50 backdrop-blur-sm mt-8">
                <CardHeader className="border-b bg-muted/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold">Monthly Financial Report</CardTitle>
                            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-semibold">Detailed synchronized breakdown</p>
                        </div>
                        <IndianRupee className="h-5 w-5 text-muted-foreground opacity-50" />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-muted/50 border-b">
                                    <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Month</th>
                                    <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-emerald-600">Revenue (Invoiced)</th>
                                    <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-destructive">Costs (Spent)</th>
                                    <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-blue-600">Net Profit</th>
                                    <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-orange-600">Outstanding</th>
                                    <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-amber-600">Cash Flow (Savings)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {profitSavingsData.length > 0 ? (
                                    profitSavingsData.slice().reverse().map((data, idx) => (
                                        <tr key={idx} className="border-b hover:bg-muted/20 transition-colors">
                                            <td className="px-6 py-4 font-semibold">{data.month}</td>
                                            <td className="px-6 py-4 font-bold text-emerald-600">{getCurrencySymbol(profile?.default_currency)}{formatAmount(data.revenue)}</td>
                                            <td className="px-6 py-4 font-bold text-destructive">{getCurrencySymbol(profile?.default_currency)}{formatAmount(data.costs)}</td>
                                            <td className="px-6 py-4">
                                                <div className={`inline-flex px-2 py-1 rounded text-xs font-bold ${data.profit >= 0 ? "bg-blue-100 text-blue-700" : "bg-destructive/10 text-destructive"}`}>
                                                    {getCurrencySymbol(profile?.default_currency)}{formatAmount(data.profit)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-orange-600">{getCurrencySymbol(profile?.default_currency)}{formatAmount(data.outstanding)}</td>
                                            <td className="px-6 py-4 font-black text-amber-600">{getCurrencySymbol(profile?.default_currency)}{formatAmount(data.cashFlow)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground italic">No financial data found for the selected range.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Unified Data Explorer */}
            <Card className="shadow-sm border-none bg-card/50 backdrop-blur-sm mt-8">
                <CardHeader className="border-b bg-muted/30 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-bold">Unified Data Explorer</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-semibold">Quotations, Invoices, Transactions & Tax Reports</p>
                    </div>
                    <BarChart2 className="h-5 w-5 text-muted-foreground opacity-50" />
                </CardHeader>
                <CardContent className="p-6">
                    <Tabs defaultValue="quotations" className="space-y-4">
                        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full md:w-[600px]">
                            <TabsTrigger value="quotations">Quotations</TabsTrigger>
                            <TabsTrigger value="invoices">Invoices</TabsTrigger>
                            <TabsTrigger value="transactions">Transactions</TabsTrigger>
                            <TabsTrigger value="tax-reports">Tax Reports</TabsTrigger>
                        </TabsList>

                        <TabsContent value="quotations" className="space-y-4">
                            <div className="overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="font-bold text-[10px] uppercase">Quotation #</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase">Client</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase">Date</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase">Status</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredQuotations.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">No quotations found for this period</TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredQuotations.map((q: any) => {
                                                const total = getInvoiceTotal(q.quotation_items, q.discount_percentage);
                                                return (
                                                    <TableRow key={q.id}>
                                                        <TableCell className="font-medium text-xs">{q.quotation_number}</TableCell>
                                                        <TableCell className="text-xs">{q.client_name}</TableCell>
                                                        <TableCell className="text-xs">{q.date ? format(new Date(q.date), "dd MMM yyyy") : ""}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={
                                                                q.status === "accepted" || q.status === "invoiced" ? "default" :
                                                                q.status === "sent" ? "outline" :
                                                                q.status === "rejected" ? "destructive" : "secondary"
                                                            } className="text-[10px] font-bold uppercase">
                                                                {q.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-xs">
                                                            {getCurrencySymbol(q.currency)}
                                                            {formatAmount(total)}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="invoices" className="space-y-4">
                            <div className="overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="font-bold text-[10px] uppercase">Invoice #</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase">Client</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase">Date</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase">Status</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase text-right">Paid Amount</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase text-right">Total Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredInvoices.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">No invoices found for this period</TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredInvoices.map((inv: any) => {
                                                const total = getInvoiceTotal(inv.invoice_items, inv.discount_percentage);
                                                return (
                                                    <TableRow key={inv.id}>
                                                        <TableCell className="font-medium text-xs">{inv.invoice_number}</TableCell>
                                                        <TableCell className="text-xs">{inv.client_name}</TableCell>
                                                        <TableCell className="text-xs">{inv.date ? format(new Date(inv.date), "dd MMM yyyy") : ""}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={
                                                                inv.status === "paid" ? "default" :
                                                                inv.status === "partially paid" ? "secondary" :
                                                                inv.status === "cancelled" ? "destructive" : "outline"
                                                            } className="text-[10px] font-bold uppercase">
                                                                {inv.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs">
                                                            {getCurrencySymbol(inv.currency)}
                                                            {formatAmount(Number(inv.paid_amount) || 0)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-xs">
                                                            {getCurrencySymbol(inv.currency)}
                                                            {formatAmount(total)}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="transactions" className="space-y-4">
                            <div className="overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="font-bold text-[10px] uppercase">Date</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase">Description</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase">Category</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase">Type</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredTransactions.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">No transactions found for this period</TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredTransactions.map((tx: any) => (
                                                <TableRow key={tx.id}>
                                                    <TableCell className="text-xs">{tx.date ? format(new Date(tx.date), "dd MMM yyyy") : ""}</TableCell>
                                                    <TableCell className="text-xs">{tx.description}</TableCell>
                                                    <TableCell className="text-xs">{tx.category}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={tx.type === "income" ? "default" : "destructive"} className="text-[10px] font-bold uppercase">
                                                            {tx.type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-xs">
                                                        {getCurrencySymbol(profile?.default_currency)}
                                                        {formatAmount(Number(tx.amount) || 0)}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="tax-reports" className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50 shadow-sm">
                                    <CardHeader className="pb-2">
                                        <CardDescription className="flex items-center text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[9px] tracking-wider">
                                            <ArrowUpRight className="w-3.5 h-3.5 mr-1" /> GST Collected (Output)
                                        </CardDescription>
                                        <CardTitle className="text-2xl font-bold">₹{formatAmount(taxStats.outputGst)}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-[10px] text-muted-foreground">From {taxStats.invCount} invoices</p>
                                    </CardContent>
                                </Card>

                                <Card className="bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50 shadow-sm">
                                    <CardHeader className="pb-2">
                                        <CardDescription className="flex items-center text-amber-600 dark:text-amber-400 font-bold uppercase text-[9px] tracking-wider">
                                            <ArrowDownRight className="w-3.5 h-3.5 mr-1" /> GST Paid (Input Credit)
                                        </CardDescription>
                                        <CardTitle className="text-2xl font-bold">₹{formatAmount(taxStats.inputGst)}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-[10px] text-muted-foreground">From {taxStats.billCount} bills</p>
                                    </CardContent>
                                </Card>

                                <Card className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/50 shadow-sm">
                                    <CardHeader className="pb-2">
                                        <CardDescription className="flex items-center text-blue-600 dark:text-blue-400 font-bold uppercase text-[9px] tracking-wider">
                                            <Scale className="w-3.5 h-3.5 mr-1" /> Net GST Payable
                                        </CardDescription>
                                        <CardTitle className={`text-2xl font-bold ${taxStats.netPayable >= 0 ? "text-blue-600" : "text-destructive"}`}>
                                            ₹{formatAmount(taxStats.netPayable)}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-[10px] text-muted-foreground">Estimated tax liability</p>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="border shadow-sm">
                                <CardHeader className="py-4">
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider">B2B vs B2C Breakdown</CardTitle>
                                    <CardDescription className="text-xs">GST collected categorized by customer type.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="font-bold text-[10px] uppercase">Category</TableHead>
                                                <TableHead className="font-bold text-[10px] uppercase text-right">GST Amount</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow>
                                                <TableCell className="font-medium text-xs">B2B (With GSTIN)</TableCell>
                                                <TableCell className="text-right text-xs">₹{formatAmount(taxStats.b2bGst)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell className="font-medium text-xs">B2C (Consumer)</TableCell>
                                                <TableCell className="text-right text-xs">₹{formatAmount(taxStats.b2cGst)}</TableCell>
                                            </TableRow>
                                            <TableRow className="font-bold border-t bg-muted/20">
                                                <TableCell className="text-xs">Total Output GST</TableCell>
                                                <TableCell className="text-right text-xs">₹{formatAmount(taxStats.outputGst)}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
