import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Briefcase, TrendingUp, TrendingDown, DollarSign, PieChart, Layers } from "lucide-react";

export default function ProjectProfitability() {
  const { account } = useAuth();
  const activeAccountId = account?.id;

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["profitability-projects", activeAccountId],
    queryFn: async () => {
      let query = supabase.from("projects").select("*, clients(name)");
      if (activeAccountId) {
        query = query.eq("account_id", activeAccountId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn("Could not fetch projects:", error.message);
        return [];
      }
      return data || [];
    }
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ["profitability-timesheets", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("timesheets").select("*");
      if (error || !data) return [];
      return data;
    }
  });

  // Calculate profitability per project
  const profitabilityList = useMemo(() => {
    return projects.map((p: any) => {
      const pTimesheets = timesheets.filter((t: any) => t.project_id === p.id);
      const laborCost = pTimesheets.reduce((sum: number, t: any) => {
        return sum + (Number(t.hours || 0) * Number(t.hourly_rate || 850));
      }, 0);
      const totalHours = pTimesheets.reduce((sum: number, t: any) => sum + Number(t.hours || 0), 0);

      // Subcontractor & direct expense allowance (demo estimation or actual)
      const contractorCost = p.budget * 0.15;
      const totalCost = laborCost + contractorCost;
      const contractRevenue = Number(p.budget || 0);
      const netProfit = contractRevenue - totalCost;
      const margin = contractRevenue > 0 ? (netProfit / contractRevenue) * 100 : 0;

      return {
        id: p.id,
        title: p.title,
        clientName: p.clients?.name || "Corporate Client",
        status: p.status,
        contractRevenue,
        laborCost,
        contractorCost,
        totalCost,
        totalHours,
        netProfit,
        margin
      };
    });
  }, [projects, timesheets]);

  const totalPortfolioRevenue = profitabilityList.reduce((s, p) => s + p.contractRevenue, 0);
  const totalPortfolioCost = profitabilityList.reduce((s, p) => s + p.totalCost, 0);
  const totalPortfolioProfit = totalPortfolioRevenue - totalPortfolioCost;
  const portfolioMargin = totalPortfolioRevenue > 0 ? (totalPortfolioProfit / totalPortfolioRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" />
          Project Profitability Analytics
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Real-time contract revenue, developer labor costs, direct expenses & profit margins
        </p>
      </div>

      {/* Portfolio KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm border-t-4 border-t-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Portfolio Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-blue-600">
              ₹{totalPortfolioRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-t-4 border-t-amber-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Direct Project Costs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-amber-600">
              ₹{totalPortfolioCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-t-4 border-t-emerald-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Net Project Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-emerald-600">
              ₹{totalPortfolioProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-t-4 border-t-purple-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Blended Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-purple-700">{portfolioMargin.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Project Breakdown Table */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 dark:bg-slate-900 py-3 border-b">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Project-by-Project Profitability Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] uppercase font-bold">Project Name</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Client</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold text-blue-600">Revenue</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold">Labor Cost</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold">Direct Expenses</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold text-emerald-600">Net Profit</TableHead>
                <TableHead className="text-center text-[10px] uppercase font-bold">Margin %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profitabilityList.map((p) => (
                <TableRow key={p.id} className="hover:bg-slate-50">
                  <TableCell className="font-semibold text-xs text-slate-900">{p.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.clientName}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-blue-700">
                    ₹{p.contractRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-slate-700">
                    ₹{p.laborCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-slate-700">
                    ₹{p.contractorCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-emerald-700">
                    ₹{p.netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={p.margin >= 40 ? "bg-emerald-600 text-white font-bold" : p.margin >= 20 ? "bg-blue-600 text-white" : "bg-amber-600 text-white"}>
                      {p.margin.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
