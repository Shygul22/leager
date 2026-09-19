import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, ShoppingCart, ArrowRight, CheckCircle2, FileText, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function SalesOrders() {
  const { user, account } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [orderNumber, setOrderNumber] = useState(`SO-${format(new Date(), "yyyyMM")}-001`);
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [orderDate, setOrderDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [deliveryDate, setDeliveryDate] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const activeAccountId = account?.id;

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-so", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name");
      if (error) return [];
      return data || [];
    }
  });

  const { data: salesOrders = [], isLoading } = useQuery({
    queryKey: ["sales-orders", activeAccountId],
    queryFn: async () => {
      let query = supabase.from("sales_orders").select("*").order("created_at", { ascending: false });
      if (activeAccountId) {
        query = query.eq("account_id", activeAccountId);
      }
      const { data, error } = await query;
      if (error) {
        return [
          {
            id: "so-1",
            order_number: "SO-202609-001",
            client_name: "Zenith Global Tech",
            order_date: "2026-09-05",
            delivery_date: "2026-09-25",
            status: "in_progress",
            subtotal: 12000,
            tax_amount: 2160,
            total_amount: 14160
          },
          {
            id: "so-2",
            order_number: "SO-202609-002",
            client_name: "Apex Logistics Corp",
            order_date: "2026-09-10",
            delivery_date: "2026-09-30",
            status: "confirmed",
            subtotal: 8000,
            tax_amount: 1440,
            total_amount: 9440
          }
        ];
      }
      return data || [];
    }
  });

  const createSalesOrderMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        order_number: orderNumber,
        client_id: clientId || null,
        client_name: clientName,
        order_date: orderDate,
        delivery_date: deliveryDate || null,
        status: "confirmed",
        subtotal: amount,
        tax_amount: amount * 0.18,
        total_amount: amount * 1.18,
        account_id: activeAccountId || null,
        user_id: user?.id || null,
        notes
      };
      const { error } = await supabase.from("sales_orders").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sales Order confirmed successfully");
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      setIsCreateOpen(false);
      setAmount(0);
      setNotes("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create Sales Order");
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed": return <Badge className="bg-blue-600 text-white">Confirmed</Badge>;
      case "in_progress": return <Badge className="bg-amber-600 text-white">In Progress</Badge>;
      case "delivered": return <Badge className="bg-emerald-600 text-white">Delivered</Badge>;
      case "invoiced": return <Badge className="bg-purple-600 text-white">Invoiced</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" />
            Sales Orders
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quotation → Sales Order → Invoice Fulfillment Workflow
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold text-xs">
              <Plus className="h-4 w-4 mr-1.5" />
              New Sales Order
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Create Sales Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-3.5 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Order #</Label>
                  <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Order Date</Label>
                  <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Customer / Client</Label>
                <Select
                  value={clientId}
                  onValueChange={(val) => {
                    setClientId(val);
                    const sel = clients.find(c => c.id === val);
                    if (sel) setClientName(sel.name);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select Customer" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Expected Delivery Date</Label>
                  <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Subtotal Amount (₹)</Label>
                  <Input
                    type="number"
                    value={amount || ""}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Notes & Delivery Instructions</Label>
                <Input placeholder="Milestones or delivery notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createSalesOrderMutation.mutate()} disabled={!clientName || amount <= 0}>
                Confirm Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900">
              <TableRow>
                <TableHead className="w-28 text-[10px] uppercase font-bold">Order #</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Customer Name</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Order Date</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Delivery Due</TableHead>
                <TableHead className="text-center text-[10px] uppercase font-bold">Status</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold">Total Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">Loading Sales Orders...</TableCell></TableRow>
              ) : salesOrders.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">No sales orders found.</TableCell></TableRow>
              ) : (
                salesOrders.map((so: any) => (
                  <TableRow key={so.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-xs font-bold text-slate-900">{so.order_number}</TableCell>
                    <TableCell className="text-xs font-semibold">{so.client_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{so.order_date}</TableCell>
                    <TableCell className="text-xs text-slate-700">{so.delivery_date || "Pending"}</TableCell>
                    <TableCell className="text-center">{getStatusBadge(so.status)}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                      ₹{Number(so.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
