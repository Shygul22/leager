import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, isToday, isThisWeek, parseISO } from "date-fns";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
    PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, TrendingDown, Wallet, IndianRupee, AlertCircle, ShoppingBag } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    const { user } = useAuth();
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
        queryKey: ["transactions", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from("transactions")
                .select("*, employees(name)")
                .eq("user_id", user.id)
                .order("date", { ascending: true });
            if (error) throw error;
            return data;
        },
        enabled: !!user,
    });

    const { data: bills = [] } = useQuery({
        queryKey: ["bills", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from("bills")
                .select("*, suppliers(name), employees(name), bill_items(*)")
                .eq("user_id", user.id);
            if (error) throw error;
            return data;
        },
        enabled: !!user,
    });

    const { data: invoices = [] } = useQuery({
        queryKey: ["invoices", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from("invoices")
                .select("*, invoice_items(*)")
                .eq("user_id", user.id);
            if (error) throw error;
            return data;
        },
        enabled: !!user,
    });

    const uniqueMonths = useMemo(() => {
        const months = new Set<string>();
        months.add(format(new Date(), "MMM yyyy")); // Ensure current month is always an option
        transactions.forEach(t => months.add(format(new Date(t.date), "MMM yyyy")));
        // Optionally sort them if needed, but the original logic sorts the monthly data for charts below
        return Array.from(months);
    }, [transactions]);

    const filteredTransactions = useMemo(() => {
        if (selectedRange === "all") return transactions;
        if (selectedRange === "today") return transactions.filter(t => isToday(parseISO(t.date)));
        if (selectedRange === "this-week") return transactions.filter(t => isThisWeek(parseISO(t.date)));
        return transactions.filter(t => format(new Date(t.date), "MMM yyyy") === selectedRange);
    }, [transactions, selectedRange]);

    const incomeTxs = filteredTransactions.filter((t) => t.type === "income");
    const expenseTxs = filteredTransactions.filter((t) => t.type === "expense");

    const totalIncome = incomeTxs.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpense = expenseTxs.reduce((sum, t) => sum + Number(t.amount), 0);
    const balance = totalIncome - totalExpense;

    const filteredBills = useMemo(() => {
        if (selectedRange === "all") return bills;
        if (selectedRange === "today") return bills.filter(b => isToday(parseISO(b.date)));
        if (selectedRange === "this-week") return bills.filter(b => isThisWeek(parseISO(b.date)));
        return bills.filter(b => format(new Date(b.date), "MMM yyyy") === selectedRange);
    }, [bills, selectedRange]);

    const getBillTotal = (items: any[]) => (items || []).reduce((s, i) => s + (i.quantity * i.rate * (1 + (i.gst || 0) / 100)), 0);

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
    const filteredInvoices = useMemo(() => {
        if (selectedRange === "all") return invoices;
        if (selectedRange === "today") return invoices.filter((inv: any) => isToday(parseISO(inv.date)));
        if (selectedRange === "this-week") return invoices.filter((inv: any) => isThisWeek(parseISO(inv.date)));
        return invoices.filter((inv: any) => format(new Date(inv.date), "MMM yyyy") === selectedRange);
    }, [invoices, selectedRange]);

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

    // Line/Bar Chart Data (Monthly Trend)
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

            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-emerald-600">
                            {getCurrencySymbol(profile?.default_currency)}
                            {formatAmount(totalIncome)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
                        <TrendingDown className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-destructive">
                            {getCurrencySymbol(profile?.default_currency)}
                            {formatAmount(totalExpense)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Net Balance</CardTitle>
                        <Wallet className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <p className={`text-2xl font-bold ${balance >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {getCurrencySymbol(profile?.default_currency)}
                            {formatAmount(balance)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Accounts Payable</CardTitle>
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-amber-500">
                            {getCurrencySymbol(profile?.default_currency)}
                            {formatAmount(outstandingBills)}
                        </p>
                        <p className="text-xs text-muted-foreground">Unpaid pending bills</p>
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

                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Income vs Expenses Details</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[400px] p-0">
                        {monthlyData.length > 0 ? (
                            <div className="w-full h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                        <XAxis dataKey="month" className="text-xs" />
                                        <YAxis className="text-xs" />
                                        <RechartsTooltip formatter={(value: number) => `${getCurrencySymbol(profile?.default_currency)}${formatAmount(value)}`} />
                                        <Legend />
                                        <Bar dataKey="income" fill="hsl(142, 71%, 45%)" name="Income" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="expense" fill="hsl(0, 84%, 60%)" name="Expense" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
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
            </div>
        </div>
    );
}
