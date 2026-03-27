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

export default function Dashboard() {
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
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });
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

  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;
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

      <div className="grid gap-4 md:grid-cols-3">
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
    </div>
  );
}
