import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isThisWeek, parseISO } from "date-fns";
import { DollarSign, TrendingUp, TrendingDown, Wallet, Calculator, Percent, BookOpen, Layers, Scale, Activity } from "lucide-react";
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
      
      const isStaffOrAbove = !role || ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
      if (!isStaffOrAbove) {
        query = query.eq("user_id", user.id);
      }
      
      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
    enabled: !!user,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["bills", user?.id, role],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase.from("bills").select("*, bill_items(*)");
      
      const isStaffOrAbove = !role || ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
      if (!isStaffOrAbove) {
        query = query.eq("user_id", user.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", user?.id, role],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase.from("invoices").select("*, invoice_items(*)");
      
      const isStaffOrAbove = !role || ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
      
      if (!isStaffOrAbove) {
        query = query.eq("user_id", user.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", user?.id, role],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase.from("clients").select("*");
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ["quotations", user?.id, role],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase.from("quotations").select("*, quotation_items(*)");
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(format(new Date(), "MMM yyyy")); // Ensure current month is always an option
    transactions.forEach(t => {
      const dStr = t.date || t.created_at;
      if (dStr) {
        try {
          months.add(format(new Date(dStr), "MMM yyyy"));
        } catch (e) {}
      }
    });
    return Array.from(months);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (selectedRange === "all") return transactions;
    return transactions.filter(t => {
      const dStr = t.date || t.created_at;
      if (!dStr) return false;
      try {
        const parsed = parseISO(dStr);
        if (selectedRange === "today") return isToday(parsed);
        if (selectedRange === "this-week") return isThisWeek(parsed);
        return format(new Date(dStr), "MMM yyyy") === selectedRange;
      } catch (e) {
        return false;
      }
    });
  }, [transactions, selectedRange]);

  const incomeTxs = filteredTransactions.filter((t) => t.type === "income");
  const expenseTxs = filteredTransactions.filter((t) => t.type === "expense");

  // Cash Logic (Savings)
  const totalCashIn = incomeTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalCashOut = expenseTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const savingAmount = totalCashIn - totalCashOut;

  // Accrual Logic (Net Profit)
  const filteredBills = useMemo(() => {
    if (selectedRange === "all") return bills;
    return bills.filter(b => {
      const dStr = b.date || b.created_at;
      if (!dStr) return false;
      try {
        const parsed = parseISO(dStr);
        if (selectedRange === "today") return isToday(parsed);
        if (selectedRange === "this-week") return isThisWeek(parsed);
        return format(new Date(dStr), "MMM yyyy") === selectedRange;
      } catch (e) {
        return false;
      }
    });
  }, [bills, selectedRange]);

  const filteredInvoices = useMemo(() => {
    if (selectedRange === "all") return invoices;
    return invoices.filter((inv: any) => {
      const dStr = inv.date || inv.created_at;
      if (!dStr) return false;
      try {
        const parsed = parseISO(dStr);
        if (selectedRange === "today") return isToday(parsed);
        if (selectedRange === "this-week") return isThisWeek(parsed);
        return format(new Date(dStr), "MMM yyyy") === selectedRange;
      } catch (e) {
        return false;
      }
    });
  }, [invoices, selectedRange]);

  const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + getInvoiceTotal(inv.invoice_items, inv.discount_percentage), 0);
  const totalBillsCost = filteredBills.reduce((sum, b) => sum + getBillTotal(b.bill_items), 0);
  const operatingExpenses = expenseTxs
    .filter(t => !t.description?.startsWith("Paid Bill "))
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalCost = totalBillsCost + operatingExpenses;
  const netProfit = totalCashIn - totalCashOut;
  const profitMargin = totalCashIn > 0 ? (netProfit / totalCashIn) * 100 : 0;
  const outstandingAmount = useMemo(() => {
    return clients.reduce((sum, client) => {
      // Find all invoices for this client
      const clientInvoices = invoices.filter(inv => 
        (inv.client_id === client.id || 
        (inv.client_name?.trim().toLowerCase() === client.name?.trim().toLowerCase()))
      );
      
      const totalSpentExclGST = clientInvoices.reduce((s, inv) => {
        const subtotal = (inv.invoice_items as any[] || []).reduce((tempSum, item) =>
          tempSum + (item.quantity * item.rate), 0
        );
        const discountPercentage = inv.discount_percentage || 0;
        const discountAmount = subtotal * (discountPercentage / 100);
        return s + (subtotal - discountAmount);
      }, 0);

      // Find all active quotations for this client
      const allClientQuotations = quotations.filter(q => 
        (q.client_id === client.id || 
        (q.client_name?.trim().toLowerCase() === client.name?.trim().toLowerCase())) &&
        q.status !== "rejected" && q.status !== "draft"
      );

      const totalAllQuotationsExclGST = allClientQuotations.reduce((s, q) => {
        const subtotal = (q.quotation_items as any[] || []).reduce((tempSum, item) =>
          tempSum + (item.quantity * item.rate), 0
        );
        const discountPercentage = q.discount_percentage || 0;
        const discountAmount = subtotal * (discountPercentage / 100);
        return s + (subtotal - discountAmount);
      }, 0);

      const remaining = Math.max(0, totalAllQuotationsExclGST - totalSpentExclGST);
      return sum + remaining;
    }, 0);
  }, [clients, invoices, quotations]);

  const futureInvoices = useMemo(() => {
    return invoices.filter((inv: any) => inv.status === "draft" || (inv.date && new Date(inv.date) > new Date()));
  }, [invoices]);
  
  const futureAmount = useMemo(() => {
    return futureInvoices.reduce((sum, inv) => sum + getInvoiceTotal(inv.invoice_items, inv.discount_percentage), 0);
  }, [futureInvoices]);

  const clientCashFlowData = useMemo(() => {
    return clients.map(client => {
      // Find all transactions associated with this client
      const clientTxs = filteredTransactions.filter(t => 
        t.client_id === client.id || 
        (t.description && t.description.toLowerCase().includes(client.name.toLowerCase()))
      );
      
      const inflow = clientTxs
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount), 0);
        
      const outflow = clientTxs
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount), 0);
        
      const netFlow = inflow - outflow;
      
      return {
        id: client.id,
        name: client.name,
        inflow,
        outflow,
        netFlow,
        txCount: clientTxs.length
      };
    }).filter(c => c.txCount > 0); // Only show clients with transaction activity
  }, [clients, filteredTransactions]);

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

  // 10 Accounting Formulas Calculations
  const calculatedAssets = useMemo(() => {
    return totalCashIn + outstandingAmount;
  }, [totalCashIn, outstandingAmount]);

  const unpaidBills = useMemo(() => {
    return bills.filter((b: any) => b.status === "unpaid" || b.status === "partially_paid");
  }, [bills]);

  const calculatedLiabilities = useMemo(() => {
    return unpaidBills.reduce((sum, b) => sum + getBillTotal(b.bill_items), 0);
  }, [unpaidBills]);

  const calculatedCapital = useMemo(() => {
    return Math.max(0, calculatedAssets - calculatedLiabilities);
  }, [calculatedAssets, calculatedLiabilities]);

  const netSales = useMemo(() => {
    return totalRevenue;
  }, [totalRevenue]);

  const cogs = useMemo(() => {
    return totalBillsCost;
  }, [totalBillsCost]);

  const grossProfit = useMemo(() => {
    return netSales - cogs;
  }, [netSales, cogs]);

  const grossProfitPercent = useMemo(() => {
    return netSales > 0 ? (grossProfit / netSales) * 100 : 0;
  }, [grossProfit, netSales]);

  const netProfitFormula = useMemo(() => {
    return grossProfit - operatingExpenses;
  }, [grossProfit, operatingExpenses]);

  const netProfitPercent = useMemo(() => {
    return netSales > 0 ? (netProfitFormula / netSales) * 100 : 0;
  }, [netProfitFormula, netSales]);

  const expensesRatio = useMemo(() => {
    return netSales > 0 ? (operatingExpenses / netSales) * 100 : 0;
  }, [operatingExpenses, netSales]);

  const averageInventory = useMemo(() => {
    return Math.max(5000, cogs * 0.15); // proxy estimation (15% of cogs, min 5000)
  }, [cogs]);

  const inventoryTurnoverRatio = useMemo(() => {
    return averageInventory > 0 ? cogs / averageInventory : 0;
  }, [cogs, averageInventory]);

  const creditInvoices = useMemo(() => {
    return invoices.filter((inv: any) => inv.status === "unpaid" || inv.status === "sent" || inv.status === "overdue");
  }, [invoices]);

  const netCreditSales = useMemo(() => {
    return creditInvoices.reduce((sum, inv) => sum + getInvoiceTotal(inv.invoice_items, inv.discount_percentage), 0);
  }, [creditInvoices]);

  const averageDebtors = useMemo(() => {
    return Math.max(10000, outstandingAmount);
  }, [outstandingAmount]);

  const debtorsTurnoverRatio = useMemo(() => {
    return averageDebtors > 0 ? netCreditSales / averageDebtors : 0;
  }, [netCreditSales, averageDebtors]);

  const ebit = useMemo(() => {
    return netProfitFormula;
  }, [netProfitFormula]);

  const capitalEmployed = useMemo(() => {
    return Math.max(10000, calculatedAssets - calculatedLiabilities);
  }, [calculatedAssets, calculatedLiabilities]);

  const roce = useMemo(() => {
    return capitalEmployed > 0 ? (ebit / capitalEmployed) * 100 : 0;
  }, [ebit, capitalEmployed]);

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
              {formatAmount(totalCashIn)}
            </p>
            <p className="text-[10px] text-muted-foreground">Ledger Transactions (Income)</p>
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
              {formatAmount(totalCashOut)}
            </p>
            <p className="text-[10px] text-muted-foreground">Ledger Transactions (Expense)</p>
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
            <p className="text-[10px] text-muted-foreground">
              Total Revenue - Total Costs
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Amount</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${outstandingAmount > 0 ? "text-orange-600" : "text-emerald-600"}`}>
              {getCurrencySymbol(profile?.default_currency)}
              {formatAmount(outstandingAmount)}
            </p>
            <p className="text-[10px] text-muted-foreground">Remaining balance</p>
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

      {/* Cash Flow Analysis Section */}
      <Card className="shadow-sm border-t-4 border-t-emerald-600">
        <CardHeader className="bg-emerald-50/20 border-b">
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-emerald-800 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Basic Features of Cash Flow Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {clientCashFlowData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground italic text-xs uppercase tracking-widest">
              No cash flow data available for the selected range
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-bold">Client Name</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-bold text-emerald-600">Cash Inflow</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-bold text-rose-600">Cash Outflow</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-bold text-slate-800">Net Cash Flow</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientCashFlowData.map((item) => (
                  <TableRow key={item.id} className="hover:bg-emerald-50/10 transition-colors">
                    <TableCell className="py-3 font-semibold text-slate-700">{item.name}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-emerald-600">
                      {getCurrencySymbol(profile?.default_currency)}
                      {formatAmount(item.inflow)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-rose-600">
                      {getCurrencySymbol(profile?.default_currency)}
                      {formatAmount(item.outflow)}
                    </TableCell>
                    <TableCell className={`text-right text-xs font-black ${item.netFlow >= 0 ? "text-slate-800" : "text-rose-700"}`}>
                      {getCurrencySymbol(profile?.default_currency)}
                      {formatAmount(item.netFlow)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Top 10 Accounting Formulas & Ratios */}
      <Card className="shadow-sm border-t-4 border-t-purple-600 bg-white">
        <CardHeader className="bg-purple-50/20 border-b flex flex-row items-center justify-between py-4">
          <div className="space-y-1">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-purple-800 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-purple-700" />
              Top 10 Accounting Formulas & Ratios
            </CardTitle>
            <CardDescription className="text-xs text-purple-600/80">Key financial indicators calculated in real-time from active records</CardDescription>
          </div>
          <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">GAAP / IAS Standard</span>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            
            {/* 1. Basic Accounting Equation */}
            <Card className="border border-slate-100 hover:border-purple-200 hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-2 bg-slate-50/50 border-b">
                <CardTitle className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-800 text-[10px]">1</span>
                  Basic Accounting Equation
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="bg-slate-900 text-slate-100 rounded px-2.5 py-1.5 font-mono text-[10px] text-center font-bold">
                  Assets = Liabilities + Capital
                </div>
                <div className="text-xs space-y-1 text-slate-600">
                  <div className="flex justify-between"><span className="font-semibold">Assets:</span> <span>{getCurrencySymbol(profile?.default_currency)}{formatAmount(calculatedAssets)}</span></div>
                  <div className="flex justify-between"><span>Liabilities:</span> <span>{getCurrencySymbol(profile?.default_currency)}{formatAmount(calculatedLiabilities)}</span></div>
                  <div className="flex justify-between"><span>Capital:</span> <span>{getCurrencySymbol(profile?.default_currency)}{formatAmount(calculatedCapital)}</span></div>
                </div>
                <div className="pt-2 border-t text-[10px] font-medium text-purple-700 flex items-center justify-between">
                  <span>Calculated Balance:</span>
                  <span className="font-bold">{getCurrencySymbol(profile?.default_currency)}{formatAmount(calculatedAssets)} = {getCurrencySymbol(profile?.default_currency)}{formatAmount(calculatedLiabilities + calculatedCapital)}</span>
                </div>
              </CardContent>
            </Card>

            {/* 2. Capital */}
            <Card className="border border-slate-100 hover:border-purple-200 hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-2 bg-slate-50/50 border-b">
                <CardTitle className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-800 text-[10px]">2</span>
                  Capital (Equity)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="bg-slate-900 text-slate-100 rounded px-2.5 py-1.5 font-mono text-[10px] text-center font-bold">
                  Capital = Assets - Liabilities
                </div>
                <div className="text-xs font-mono text-center pt-1">
                  {getCurrencySymbol(profile?.default_currency)}{formatAmount(calculatedAssets)} − {getCurrencySymbol(profile?.default_currency)}{formatAmount(calculatedLiabilities)}
                </div>
                <div className="pt-2 border-t text-[10px] font-medium text-emerald-700 flex items-center justify-between">
                  <span>Net Equity Value:</span>
                  <span className="font-extrabold text-sm">{getCurrencySymbol(profile?.default_currency)}{formatAmount(calculatedCapital)}</span>
                </div>
              </CardContent>
            </Card>

            {/* 3. Net Profit */}
            <Card className="border border-slate-100 hover:border-purple-200 hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-2 bg-slate-50/50 border-b">
                <CardTitle className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-800 text-[10px]">3</span>
                  Net Profit
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="bg-slate-900 text-slate-100 rounded px-2.5 py-1.5 font-mono text-[10px] text-center font-bold">
                  Net Profit = Gross Profit - Expenses
                </div>
                <div className="text-xs font-mono text-center pt-1">
                  {getCurrencySymbol(profile?.default_currency)}{formatAmount(grossProfit)} − {getCurrencySymbol(profile?.default_currency)}{formatAmount(operatingExpenses)}
                </div>
                <div className="pt-2 border-t text-[10px] font-medium text-blue-700 flex items-center justify-between">
                  <span>Net Cash Profit:</span>
                  <span className="font-extrabold text-sm text-blue-600">{getCurrencySymbol(profile?.default_currency)}{formatAmount(netProfitFormula)}</span>
                </div>
              </CardContent>
            </Card>

            {/* 4. Gross Profit */}
            <Card className="border border-slate-100 hover:border-purple-200 hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-2 bg-slate-50/50 border-b">
                <CardTitle className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-800 text-[10px]">4</span>
                  Gross Profit
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="bg-slate-900 text-slate-100 rounded px-2.5 py-1.5 font-mono text-[10px] text-center font-bold">
                  Gross Profit = Net Sales - COGS
                </div>
                <div className="text-xs font-mono text-center pt-1">
                  {getCurrencySymbol(profile?.default_currency)}{formatAmount(netSales)} − {getCurrencySymbol(profile?.default_currency)}{formatAmount(cogs)}
                </div>
                <div className="pt-2 border-t text-[10px] font-medium text-indigo-700 flex items-center justify-between">
                  <span>Gross Margin Value:</span>
                  <span className="font-extrabold text-sm text-indigo-600">{getCurrencySymbol(profile?.default_currency)}{formatAmount(grossProfit)}</span>
                </div>
              </CardContent>
            </Card>

            {/* 5. Gross Profit % */}
            <Card className="border border-slate-100 hover:border-purple-200 hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-2 bg-slate-50/50 border-b">
                <CardTitle className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-800 text-[10px]">5</span>
                  Gross Profit %
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="bg-slate-900 text-slate-100 rounded px-2.5 py-1.5 font-mono text-[10px] text-center font-bold">
                  GP % = (Gross Profit / Net Sales) * 100
                </div>
                <div className="text-[10px] font-mono text-center text-slate-500 pt-1">
                  ({formatAmount(grossProfit)} / {formatAmount(netSales)}) × 100
                </div>
                <div className="pt-2 border-t text-[10px] font-medium text-purple-700 flex items-center justify-between">
                  <span>Gross Efficiency:</span>
                  <span className="font-extrabold text-sm text-purple-700">{grossProfitPercent.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            {/* 6. Net Profit % */}
            <Card className="border border-slate-100 hover:border-purple-200 hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-2 bg-slate-50/50 border-b">
                <CardTitle className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-800 text-[10px]">6</span>
                  Net Profit %
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="bg-slate-900 text-slate-100 rounded px-2.5 py-1.5 font-mono text-[10px] text-center font-bold">
                  NP % = (Net Profit / Net Sales) * 100
                </div>
                <div className="text-[10px] font-mono text-center text-slate-500 pt-1">
                  ({formatAmount(netProfitFormula)} / {formatAmount(netSales)}) × 100
                </div>
                <div className="pt-2 border-t text-[10px] font-medium text-emerald-700 flex items-center justify-between">
                  <span>Bottom-line Margin:</span>
                  <span className="font-extrabold text-sm text-emerald-600">{netProfitPercent.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            {/* 7. Expenses Ratio */}
            <Card className="border border-slate-100 hover:border-purple-200 hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-2 bg-slate-50/50 border-b">
                <CardTitle className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-800 text-[10px]">7</span>
                  Expenses Ratio
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="bg-slate-900 text-slate-100 rounded px-2.5 py-1.5 font-mono text-[10px] text-center font-bold">
                  Expenses Ratio = (Expenses / Net Sales) * 100
                </div>
                <div className="text-[10px] font-mono text-center text-slate-500 pt-1">
                  ({formatAmount(operatingExpenses)} / {formatAmount(netSales)}) × 100
                </div>
                <div className="pt-2 border-t text-[10px] font-medium text-rose-700 flex items-center justify-between">
                  <span>Cost to Sales Ratio:</span>
                  <span className="font-extrabold text-sm text-rose-600">{expensesRatio.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            {/* 8. Inventory Turnover Ratio */}
            <Card className="border border-slate-100 hover:border-purple-200 hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-2 bg-slate-50/50 border-b">
                <CardTitle className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-800 text-[10px]">8</span>
                  Inventory Turnover Ratio
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="bg-slate-900 text-slate-100 rounded px-2.5 py-1.5 font-mono text-[10px] text-center font-bold">
                  Inventory Turnover = COGS / Avg Inventory
                </div>
                <div className="text-[10px] font-mono text-center text-slate-500 pt-1">
                  {formatAmount(cogs)} / {formatAmount(averageInventory)}
                </div>
                <div className="pt-2 border-t text-[10px] font-medium text-amber-700 flex items-center justify-between">
                  <span>Turnover Frequency:</span>
                  <span className="font-extrabold text-sm text-amber-600">{inventoryTurnoverRatio.toFixed(2)}x</span>
                </div>
              </CardContent>
            </Card>

            {/* 9. Debtors Turnover Ratio */}
            <Card className="border border-slate-100 hover:border-purple-200 hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-2 bg-slate-50/50 border-b">
                <CardTitle className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-800 text-[10px]">9</span>
                  Debtors Turnover Ratio
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="bg-slate-900 text-slate-100 rounded px-2.5 py-1.5 font-mono text-[10px] text-center font-bold">
                  Debtors Turnover = Credit Sales / Avg Debtors
                </div>
                <div className="text-[10px] font-mono text-center text-slate-500 pt-1">
                  {formatAmount(netCreditSales)} / {formatAmount(averageDebtors)}
                </div>
                <div className="pt-2 border-t text-[10px] font-medium text-indigo-700 flex items-center justify-between">
                  <span>Collection velocity:</span>
                  <span className="font-extrabold text-sm text-indigo-600">{debtorsTurnoverRatio.toFixed(2)}x</span>
                </div>
              </CardContent>
            </Card>

            {/* 10. Return on Capital Employed (ROCE) */}
            <Card className="border border-slate-100 hover:border-purple-200 hover:shadow-md transition-all duration-300 md:col-span-2 lg:col-span-1">
              <CardHeader className="pb-2 bg-slate-50/50 border-b">
                <CardTitle className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-800 text-[10px]">10</span>
                  Capital Employed (ROCE)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="bg-slate-900 text-slate-100 rounded px-2.5 py-1.5 font-mono text-[10px] text-center font-bold">
                  ROCE = (EBIT / Capital Employed) * 100
                </div>
                <div className="text-[10px] font-mono text-center text-slate-500 pt-1">
                  ({formatAmount(ebit)} / {formatAmount(capitalEmployed)}) × 100
                </div>
                <div className="pt-2 border-t text-[10px] font-medium text-violet-700 flex items-center justify-between">
                  <span>Profitability Efficiency:</span>
                  <span className="font-extrabold text-sm text-violet-600">{roce.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
