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
import { Plus, FileText, CheckCircle2, Truck, Printer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function PurchaseOrders() {
  const { user, account } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [poNumber, setPoNumber] = useState(`PO-${format(new Date(), "yyyyMM")}-001`);
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [orderDate, setOrderDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expectedDate, setExpectedDate] = useState("");
  const [subtotal, setSubtotal] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const activeAccountId = account?.id;

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-po", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name");
      if (error) return [];
      return data || [];
    }
  });

  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ["purchase-orders", activeAccountId],
    queryFn: async () => {
      let query = supabase.from("purchase_orders").select("*").order("created_at", { ascending: false });
      if (activeAccountId) {
        query = query.eq("account_id", activeAccountId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn("Could not fetch purchase orders:", error.message);
        return [];
      }
      return data || [];
    }
  });

  const createPOMutation = useMutation({
    mutationFn: async () => {
      const taxAmount = subtotal * 0.18;
      const totalAmount = subtotal + taxAmount;
      const payload = {
        po_number: poNumber,
        supplier_id: supplierId || null,
        supplier_name: supplierName,
        order_date: orderDate,
        expected_delivery_date: expectedDate || null,
        status: "issued",
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes,
        account_id: activeAccountId || null,
        user_id: user?.id || null
      };
      const { error } = await supabase.from("purchase_orders").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Purchase Order issued to supplier");
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setIsCreateOpen(false);
      setSubtotal(0);
      setNotes("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to issue PO");
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            Purchase Orders (POs)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Vendor procurement orders, tax invoices & delivery commitments
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold text-xs">
              <Plus className="h-4 w-4 mr-1.5" />
              Issue Purchase Order
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">New Supplier Purchase Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-3.5 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">PO #</Label>
                  <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Order Date</Label>
                  <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Vendor / Supplier</Label>
                <Select
                  value={supplierId}
                  onValueChange={(val) => {
                    setSupplierId(val);
                    const sel = suppliers.find(s => s.id === val);
                    if (sel) setSupplierName(sel.name);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select Supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Expected Delivery</Label>
                  <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Subtotal (₹)</Label>
                  <Input
                    type="number"
                    value={subtotal || ""}
                    onChange={(e) => setSubtotal(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Terms & Notes</Label>
                <Input placeholder="Payment terms and shipping address..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createPOMutation.mutate()} disabled={!supplierName || subtotal <= 0}>
                Issue PO
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
                <TableHead className="w-28 text-[10px] uppercase font-bold">PO #</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Supplier Name</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Order Date</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Expected Delivery</TableHead>
                <TableHead className="text-center text-[10px] uppercase font-bold">Status</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold">Total Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">Loading Purchase Orders...</TableCell></TableRow>
              ) : purchaseOrders.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">No purchase orders issued.</TableCell></TableRow>
              ) : (
                purchaseOrders.map((po: any) => (
                  <TableRow key={po.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-xs font-bold text-slate-900">{po.po_number}</TableCell>
                    <TableCell className="text-xs font-semibold">{po.supplier_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{po.order_date}</TableCell>
                    <TableCell className="text-xs text-slate-700">{po.expected_delivery_date || "Pending"}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-blue-600 text-white text-[10px] uppercase">
                        {po.status || "Issued"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                      ₹{Number(po.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
