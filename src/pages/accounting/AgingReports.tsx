import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingDown, ArrowUpRight, ArrowDownRight, AlertTriangle } from "lucide-react";
import { calculateARAging, calculateAPAging } from "@/lib/accountingEngine";
import { format } from "date-fns";

export default function AgingReports() {
  const { account } = useAuth();
  const activeAccountId = account?.id;

  const { data: invoices = [] } = useQuery({
    queryKey: ["aging-invoices", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*, invoice_items(*)");
      if (error) return [];
      return data || [];
    }
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["aging-bills", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("*, bill_items(*)");
      if (error) return [];
      return data || [];
    }
  });

  const arBuckets = useMemo(() => calculateARAging(invoices), [invoices]);
  const apBuckets = useMemo(() => calculateAPAging(bills), [bills]);

  const totalAR = arBuckets.reduce((sum, b) => sum + b.amount, 0);
  const totalAP = apBuckets.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" />
          Aging Schedules (AR & AP)
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Accounts Receivable (Debtors) & Accounts Payable (Creditors) aging buckets
        </p>
      </div>

      <Tabs defaultValue="ar" className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <TabsTrigger value="ar" className="text-xs font-bold px-4 py-2 flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-emerald-600" />
            Accounts Receivable (AR Aging) • ₹{totalAR.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </TabsTrigger>
          <TabsTrigger value="ap" className="text-xs font-bold px-4 py-2 flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-rose-600" />
            Accounts Payable (AP Aging) • ₹{totalAP.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </TabsTrigger>
        </TabsList>

        {/* AR AGING */}
        <TabsContent value="ar" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {arBuckets.map((bucket, idx) => (
              <Card key={bucket.period} className="shadow-sm border-t-4 border-t-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {bucket.period}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-xl font-black ${idx === 3 ? "text-rose-600" : "text-slate-900"}`}>
                    ₹{bucket.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{bucket.count} invoices pending</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* AR Invoices Table */}
          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 dark:bg-slate-900 py-3 border-b">
              <CardTitle className="text-xs font-bold uppercase tracking-wider">Unpaid Customer Invoices Schedule</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold">Invoice #</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Customer Name</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Date / Due Date</TableHead>
                    <TableHead className="text-center text-[10px] uppercase font-bold">Days Overdue</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold">Outstanding (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {arBuckets.flatMap(b => b.items).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                        All client invoices are fully settled! Zero outstanding receivables.
                      </TableCell>
                    </TableRow>
                  ) : (
                    arBuckets.flatMap(b => b.items).map((inv: any) => (
                      <TableRow key={inv.id} className="hover:bg-slate-50">
                        <TableCell className="font-mono text-xs font-bold text-slate-900">{inv.invoice_number}</TableCell>
                        <TableCell className="text-xs font-semibold text-slate-800">{inv.client_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {inv.date ? format(new Date(inv.date), "MMM d, yyyy") : "N/A"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={inv.days > 60 ? "destructive" : "outline"} className="text-[10px]">
                            {inv.days} Days
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                          ₹{inv.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AP AGING */}
        <TabsContent value="ap" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {apBuckets.map((bucket, idx) => (
              <Card key={bucket.period} className="shadow-sm border-t-4 border-t-rose-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {bucket.period}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-xl font-black ${idx === 3 ? "text-rose-600" : "text-slate-900"}`}>
                    ₹{bucket.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{bucket.count} bills pending</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 dark:bg-slate-900 py-3 border-b">
              <CardTitle className="text-xs font-bold uppercase tracking-wider">Outstanding Supplier Payables</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold">Bill #</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Supplier Name</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Bill Date</TableHead>
                    <TableHead className="text-center text-[10px] uppercase font-bold">Days Pending</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold">Payable (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apBuckets.flatMap(b => b.items).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                        Zero outstanding supplier bills.
                      </TableCell>
                    </TableRow>
                  ) : (
                    apBuckets.flatMap(b => b.items).map((b: any) => (
                      <TableRow key={b.id} className="hover:bg-slate-50">
                        <TableCell className="font-mono text-xs font-bold text-slate-900">{b.bill_number}</TableCell>
                        <TableCell className="text-xs font-semibold text-slate-800">{b.supplier_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {b.date ? format(new Date(b.date), "MMM d, yyyy") : "N/A"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={b.days > 60 ? "destructive" : "outline"} className="text-[10px]">
                            {b.days} Days
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-rose-700">
                          ₹{b.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
