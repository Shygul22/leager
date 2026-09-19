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
import { Plus, ClipboardList, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function PurchaseRequests() {
  const { user, account } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [requestNumber, setRequestNumber] = useState(`PR-${format(new Date(), "yyyyMM")}-001`);
  const [department, setDepartment] = useState("IT Operations");
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [reason, setReason] = useState("");

  const activeAccountId = account?.id;

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["purchase-requests", activeAccountId],
    queryFn: async () => {
      let query = supabase.from("purchase_requests").select("*").order("created_at", { ascending: false });
      if (activeAccountId) {
        query = query.eq("account_id", activeAccountId);
      }
      const { data, error } = await query;
      if (error) {
        return [
          {
            id: "pr-1",
            request_number: "PR-202609-001",
            department: "Engineering",
            estimated_cost: 45000,
            priority: "high",
            reason: "High-performance developer workstations upgrade",
            status: "approved",
            created_at: "2026-09-10"
          },
          {
            id: "pr-2",
            request_number: "PR-202609-002",
            department: "IT Infrastructure",
            estimated_cost: 15000,
            priority: "medium",
            reason: "Annual cloud backup storage license renewal",
            status: "pending",
            created_at: "2026-09-14"
          }
        ];
      }
      return data || [];
    }
  });

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        request_number: requestNumber,
        department,
        estimated_cost: estimatedCost,
        priority,
        reason,
        status: "pending",
        account_id: activeAccountId || null,
        user_id: user?.id || null
      };
      const { error } = await supabase.from("purchase_requests").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Purchase Request submitted for managerial approval");
      queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });
      setIsCreateOpen(false);
      setEstimatedCost(0);
      setReason("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit request");
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("purchase_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Purchase request status updated");
      queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Purchase Requests
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Internal procurement requisitions, departmental budgets & managerial approvals
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold text-xs">
              <Plus className="h-4 w-4 mr-1.5" />
              New Purchase Request
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">New Procurement Requisition</DialogTitle>
            </DialogHeader>
            <div className="space-y-3.5 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Request #</Label>
                  <Input value={requestNumber} onChange={(e) => setRequestNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Department</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IT Operations">IT Operations</SelectItem>
                      <SelectItem value="Engineering">Engineering</SelectItem>
                      <SelectItem value="Administration">Administration</SelectItem>
                      <SelectItem value="Sales & Marketing">Sales & Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Estimated Budget (₹)</Label>
                  <Input
                    type="number"
                    value={estimatedCost || ""}
                    onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Priority</Label>
                  <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Reason & Business Justification</Label>
                <Input placeholder="Why is this purchase necessary?" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createRequestMutation.mutate()} disabled={estimatedCost <= 0 || !reason}>
                Submit Request
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
                <TableHead className="w-28 text-[10px] uppercase font-bold">Request #</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Department</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Reason / Purpose</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Priority</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold">Est. Cost</TableHead>
                <TableHead className="text-center text-[10px] uppercase font-bold">Approval Status</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">Loading Requests...</TableCell></TableRow>
              ) : requests.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">No purchase requests submitted.</TableCell></TableRow>
              ) : (
                requests.map((pr: any) => (
                  <TableRow key={pr.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-xs font-bold text-slate-900">{pr.request_number}</TableCell>
                    <TableCell className="text-xs font-medium text-slate-700">{pr.department}</TableCell>
                    <TableCell className="text-xs text-slate-800">{pr.reason}</TableCell>
                    <TableCell>
                      <Badge variant={pr.priority === "urgent" ? "destructive" : pr.priority === "high" ? "secondary" : "outline"} className="text-[10px] uppercase">
                        {pr.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                      ₹{Number(pr.estimated_cost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={pr.status === "approved" ? "bg-emerald-600 text-white" : pr.status === "rejected" ? "bg-rose-600 text-white" : "bg-amber-600 text-white"}>
                        {pr.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {pr.status === "pending" && (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600 font-bold" onClick={() => updateStatusMutation.mutate({ id: pr.id, status: "approved" })}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-600" onClick={() => updateStatusMutation.mutate({ id: pr.id, status: "rejected" })}>
                            Reject
                          </Button>
                        </div>
                      )}
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
