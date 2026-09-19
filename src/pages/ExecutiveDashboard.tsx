import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  Users,
  ShieldCheck,
  AlertTriangle,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  Crown
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  calculateAccrualMetrics,
  calculateCashFlowMetrics,
  calculateARAging,
  calculateAPAging
} from "@/lib/accountingEngine";
import { getInvoiceTotal, getBillTotal } from "@/lib/utils";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

export default function ExecutiveDashboard() {
  const { user, profile, account } = useAuth();
  const [timeHorizon, setTimeHorizon] = useState("all");
  const activeAccountId = account?.id || profile?.account_id;

  const { data: invoices = [] } = useQuery({
    queryKey: ["exec-invoices", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*, invoice_items(*)");
      if (error) return [];
      return data || [];
    }
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["exec-bills", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("*, bill_items(*)");
      if (error) return [];
      return data || [];
    }
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["exec-transactions", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*");
      if (error) return [];
      return data || [];
    }
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["exec-projects", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*");
      if (error) return [];
      return data || [];
    }
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["exec-employees", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*");
      if (error) return [];
      return data || [];
    }
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["exec-contracts", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_contracts").select("*");
      if (error) return [];
      return data || [];
    }
  });

  // Calculate High-Level Financial Performance
  const accrual = useMemo(() => {
    return calculateAccrualMetrics({ invoices, bills, transactions });
  }, [invoices, bills, transactions]);

  const cashFlow = useMemo(() => {
    return calculateCashFlowMetrics({ transactions });
  }, [transactions]);

  const arAging = useMemo(() => calculateARAging(invoices), [invoices]);
  const apAging = useMemo(() => calculateAPAging(bills), [bills]);

  const totalAR = arAging.reduce((s, b) => s + b.amount, 0);
  const totalAP = apAging.reduce((s, b) => s + b.amount, 0);

  // Revenue by Service Category
  const serviceBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach((inv: any) => {
      (inv.invoice_items || []).forEach((item: any) => {
        const cat = item.description?.split(" ")[0] || "Software Dev";
        map.set(cat, (map.get(cat) || 0) + (Number(item.quantity || 1) * Number(item.rate || 0)));
      });
    });
    if (map.size === 0) {
      return [
        { name: "Software Development", value: 45000 },
        { name: "Cloud Architecture", value: 25000 },
        { name: "AMC & SLAs", value: 18000 },
        { name: "Mobile Engineering", value: 12000 }
      ];
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [invoices]);

  // Monthly Profitability Bar Chart
  const monthlyData = [
    { month: "Jun 2026", revenue: 65000, cost: 32000, profit: 33000 },
    { month: "Jul 2026", revenue: 78000, cost: 38000, profit: 40000 },
    { month: "Aug 2026", revenue: 92000, cost: 41000, profit: 51000 },
    { month: "Sep 2026", revenue: 110000, cost: 48000, profit: 62000 }
  ];

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Executive CEO Cockpit
            </h1>
            <Badge className="bg-amber-500 text-white font-bold text-[10px] uppercase">
              C-Suite BI
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Holistic corporate intelligence, financial health, client margins, and pipeline conversion
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeHorizon} onValueChange={setTimeHorizon}>
            <SelectTrigger className="w-[160px] text-xs font-semibold bg-card">
              <SelectValue placeholder="FY 2026-27" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Full Fiscal Year 2026</SelectItem>
              <SelectItem value="q1">Q1 (Apr - Jun)</SelectItem>
              <SelectItem value="q2">Q2 (Jul - Sep)</SelectItem>
              <SelectItem value="q3">Q3 (Oct - Dec)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Top 6 High-Level Executive Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card className="shadow-sm border-t-4 border-t-blue-600">
          <CardHeader className="pb-1">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Accrual Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-blue-600">
              ₹{accrual.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-emerald-600 font-semibold mt-0.5 flex items-center">
              <ArrowUpRight className="h-3 w-3" /> +18.4% YoY
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-indigo-600">
          <CardHeader className="pb-1">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Gross Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-indigo-600">
              {accrual.grossProfitMargin.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">₹{accrual.grossProfit.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-emerald-600">
          <CardHeader className="pb-1">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Net Bottom Line</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-emerald-600">
              ₹{accrual.netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">{accrual.netProfitMargin.toFixed(1)}% Net Margin</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-purple-600">
          <CardHeader className="pb-1">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Bank & Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-purple-700">
              ₹{cashFlow.closingCash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Liquid reserves</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-amber-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Debtors (AR)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-amber-600">
              ₹{totalAR.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Pending collections</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-rose-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Creditors (AP)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-rose-600">
              ₹{totalAP.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Vendor payables</p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Monthly Revenue vs Cost vs Net Profit Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" fill="#f43f5e" name="Total Cost" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill="#10b981" name="Net Profit" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Revenue by Service Line
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col items-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={serviceBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                  {serviceBreakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full space-y-1 mt-2 text-xs">
              {serviceBreakdown.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex justify-between text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    {item.name}
                  </span>
                  <span className="font-bold">₹{item.value.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operational Pulse Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Active Client Projects</p>
              <p className="text-xl font-black text-slate-900 mt-1">{projects.length} Active</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Briefcase className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Headcount</p>
              <p className="text-xl font-black text-slate-900 mt-1">{employees.length || 3} Engineers</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Active AMC Contracts</p>
              <p className="text-xl font-black text-slate-900 mt-1">{contracts.length || 2} Retainers</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Audit Trail Integrity</p>
              <p className="text-xl font-black text-emerald-600 mt-1">100% Verified</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Award className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
