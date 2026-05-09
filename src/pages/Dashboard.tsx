import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isThisWeek, parseISO } from "date-fns";
import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { getBillTotal, getInvoiceTotal } from "@/lib/utils";

export default function Dashboard() {
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

  const getCurrencySymbol = (currency?: string | null) => {
    switch (currency) {
      case "USD": return "$";
      case "EUR": return "€";
      case "GBP": return "£";
      case "AED": return "AED ";
      default: return "₹";
    }
  };

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
      let query = supabase.from("transactions").select("*");
      
      const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
      if (!isStaffOrAbove) {
        query = query.eq("user_id", user.id);
      }
      
      const { data, error } = await query.order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!role,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["bills", user?.id, role],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase.from("bills").select("*, bill_items(*)");
      
      // Transactions: Only Admin and Accounts Manager see these
      const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
      if (!isStaffOrAbove) {
        query = query.eq("user_id", user.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", user?.id, role],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase.from("invoices").select("*, invoice_items(*)");
      
      // Shared company invoices
      const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
      
      if (!isStaffOrAbove) {
        query = query.eq("user_id", user.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(format(new Date(), "MMM yyyy")); // Ensure current month is always an option
    transactions.forEach(t => months.add(format(new Date(t.date), "MMM yyyy")));
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

  // Cash Logic (Savings)
  const totalCashIn = incomeTxs.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalCashOut = expenseTxs.reduce((sum, t) => sum + Number(t.amount), 0);
  const savingAmount = totalCashIn - totalCashOut;

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

  const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + getInvoiceTotal(inv.invoice_items, inv.discount_percentage), 0);
  const totalBillsCost = filteredBills.reduce((sum, b) => sum + getBillTotal(b.bill_items), 0);
  const operatingExpenses = expenseTxs
    .filter(t => !t.description?.startsWith("Paid Bill "))
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalCost = totalBillsCost + operatingExpenses;
  const netProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const futureInvoices = useMemo(() => {
    return invoices.filter((inv: any) => inv.status === "draft" || (inv.date && new Date(inv.date) > new Date()));
  }, [invoices]);
  
  const futureAmount = useMemo(() => {
    return futureInvoices.reduce((sum, inv) => sum + getInvoiceTotal(inv.invoice_items, inv.discount_percentage), 0);
  }, [futureInvoices]);

  const recent = filteredTransactions.slice(0, 5);

  // Chart data: group by month
  const chartMap = new Map<string, { income: number; expense: number }>();
  transactions.forEach((t) => {
    const month = format(new Date(t.date), "MMM yyyy");
    const existing = chartMap.get(month) || { income: 0, expense: 0 };
    if (t.type === "income") existing.income += Number(t.amount);
    else existing.expense += Number(t.amount);
    chartMap.set(month, existing);
  });
  const chartData = Array.from(chartMap.entries())
    .map(([month, vals]) => ({ month, ...vals }))
    .reverse();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-4">
          <Select value={selectedRange} onValueChange={setSelectedRange}>
            <SelectTrigger className="w-[180px]">
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
      </div>

      {profile?.company_name && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              {profile.company_name}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-6 py-4">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Business Address</p>
              <p className="text-xs font-medium line-clamp-2">{profile.address || "No address set"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Authorized Person</p>
              <p className="text-xs font-medium">{profile.auth_person_name || "Not set"} ({profile.auth_designation || "No title"})</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Tax Details</p>
              <p className="text-xs font-medium">GSTIN: {profile.gstin || "Not provided"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {getCurrencySymbol(profile?.default_currency)}
              {formatAmount(totalRevenue)}
            </p>
            <p className="text-[10px] text-muted-foreground">Total Invoiced</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Costs</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {getCurrencySymbol(profile?.default_currency)}
              {formatAmount(totalCost)}
            </p>
            <p className="text-[10px] text-muted-foreground">Bills + Expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-blue-600" : "text-destructive"}`}>
              {getCurrencySymbol(profile?.default_currency)}
              {formatAmount(netProfit)}
            </p>
            <p className={`text-[10px] font-medium ${profitMargin >= 0 ? "text-blue-500" : "text-destructive"}`}>
              Margin: {profitMargin.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saving Amount</CardTitle>
            <Wallet className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${savingAmount >= 0 ? "text-amber-600" : "text-destructive"}`}>
              {getCurrencySymbol(profile?.default_currency)}
              {formatAmount(savingAmount)}
            </p>
            <p className="text-[10px] text-muted-foreground">Actual Cash flow</p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Legend />
                <Bar dataKey="income" fill="hsl(142, 71%, 45%)" name="Income" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="hsl(0, 84%, 60%)" name="Expense" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{format(new Date(t.date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{t.description}</TableCell>
                      <TableCell>{t.category}</TableCell>
                      <TableCell>
                        <Badge variant={t.type === "income" ? "default" : "destructive"}>
                          {t.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {getCurrencySymbol(profile?.default_currency)}
                        {formatAmount(Number(t.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Future Billing / Forecast */}
        <Card className="shadow-sm overflow-hidden border-t-4 border-t-blue-500">
          <CardHeader className="bg-blue-50/30 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-blue-700 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Future Forecast
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase">Upcoming Item</TableHead>
                  <TableHead className="text-right text-[10px] uppercase">Estimated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {futureInvoices.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground italic text-[10px] uppercase tracking-widest">No future billing found</TableCell></TableRow>
                ) : (
                  futureInvoices.slice(0, 5).map((inv: any) => (
                    <TableRow key={inv.id} className="hover:bg-blue-50/50 transition-colors">
                      <TableCell className="py-3">
                        <div className="text-[10px] font-bold text-slate-900">{inv.invoice_number}</div>
                        <div className="text-[8px] text-muted-foreground mt-0.5">
                          {inv.date ? format(new Date(inv.date), "PPP") : "Schedule Pending"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold text-blue-600">
                        {getCurrencySymbol(profile?.default_currency)}
                        {formatAmount(getInvoiceTotal(inv.invoice_items, inv.discount_percentage))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
    </div>
  );
}
