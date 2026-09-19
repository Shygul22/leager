import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, PackageCheck, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function GoodsReceived() {
  const { user, account } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [grnNumber, setGrnNumber] = useState(`GRN-${format(new Date(), "yyyyMM")}-001`);
  const [supplierName, setSupplierName] = useState("");
  const [receivedDate, setReceivedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");

  const activeAccountId = account?.id;

  const { data: grnList = [], isLoading } = useQuery({
    queryKey: ["goods-receipts", activeAccountId],
    queryFn: async () => {
      let query = supabase.from("goods_receipts").select("*").order("created_at", { ascending: false });
      if (activeAccountId) {
        query = query.eq("account_id", activeAccountId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn("Could not fetch goods receipts:", error.message);
        return [];
      }
      return data || [];
    }
  });

  const createGRNMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        grn_number: grnNumber,
        supplier_name: supplierName,
        received_date: receivedDate,
        status: "accepted",
        notes,
        account_id: activeAccountId || null,
        user_id: user?.id || null
      };
      const { error } = await supabase.from("goods_receipts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Goods Receipt Note (GRN) created & goods verified");
      queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      setIsCreateOpen(false);
      setSupplierName("");
      setNotes("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to record GRN");
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <PackageCheck className="h-6 w-6 text-primary" />
            Goods Received Notes (GRN)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Physical hardware/service delivery verification prior to supplier bill clearance
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold text-xs">
              <Plus className="h-4 w-4 mr-1.5" />
              New GRN Receipt
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Log Goods Received</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">GRN #</Label>
                <Input value={grnNumber} onChange={(e) => setGrnNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Supplier Name</Label>
                <Input placeholder="Vendor name" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Received Date</Label>
                <Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Inspection Notes</Label>
                <Input placeholder="Serial numbers, physical condition..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createGRNMutation.mutate()} disabled={!supplierName}>
                Record Delivery
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
                <TableHead className="w-28 text-[10px] uppercase font-bold">GRN #</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Supplier Name</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Delivery Date</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Inspection & Verification Notes</TableHead>
                <TableHead className="text-center text-[10px] uppercase font-bold">Quality Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">Loading GRNs...</TableCell></TableRow>
              ) : grnList.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">No Goods Received Notes recorded.</TableCell></TableRow>
              ) : (
                grnList.map((grn: any) => (
                  <TableRow key={grn.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-xs font-bold text-slate-900">{grn.grn_number}</TableCell>
                    <TableCell className="text-xs font-semibold">{grn.supplier_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{grn.received_date}</TableCell>
                    <TableCell className="text-xs text-slate-700">{grn.notes || "Verified by storekeeper"}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-emerald-600 text-white text-[10px] uppercase">
                        {grn.status || "Accepted"}
                      </Badge>
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
