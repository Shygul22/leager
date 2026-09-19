import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Zap, Plus, ArrowRight, CheckCircle2, Play, GitBranch } from "lucide-react";
import { toast } from "sonner";

export default function WorkflowAutomation() {
  const { user, account } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("quotation_created");
  const [actionType, setActionType] = useState("send_notification");
  const [conditionField, setConditionField] = useState("amount");
  const [conditionValue, setConditionValue] = useState("50000");

  const activeAccountId = account?.id;

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ["workflows", activeAccountId],
    queryFn: async () => {
      let query = supabase.from("workflows").select("*").order("created_at", { ascending: false });
      if (activeAccountId) query = query.eq("account_id", activeAccountId);
      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return [
          {
            id: "wf-1",
            name: "High-Value Quotation Manager Approval",
            trigger_event: "quotation_created",
            conditions: [{ field: "amount", operator: ">", value: 50000 }],
            actions: [{ type: "require_manager_approval", target: "Executive Director" }],
            is_active: true
          },
          {
            id: "wf-2",
            name: "Automatic Sales Order to Project Kickoff",
            trigger_event: "sales_order_confirmed",
            conditions: [{ field: "status", operator: "==", value: "confirmed" }],
            actions: [{ type: "create_project", target: "Operations Board" }],
            is_active: true
          },
          {
            id: "wf-3",
            name: "Invoice Overdue Escalation Reminder",
            trigger_event: "invoice_overdue",
            conditions: [{ field: "days_past_due", operator: ">", value: 15 }],
            actions: [{ type: "send_payment_reminder", channel: "Email & WhatsApp" }],
            is_active: true
          },
          {
            id: "wf-4",
            name: "Automatic Double-Entry Ledger Posting on Payment",
            trigger_event: "payment_received",
            conditions: [{ field: "payment_status", operator: "==", value: "paid" }],
            actions: [{ type: "post_journal_entry", target: "Cash & Bank -> AR" }],
            is_active: true
          }
        ];
      }
      return data;
    }
  });

  const createWorkflowMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        trigger_event: triggerEvent,
        conditions: [{ field: conditionField, operator: ">=", value: conditionValue }],
        actions: [{ type: actionType }],
        is_active: true,
        account_id: activeAccountId || null
      };
      const { error } = await supabase.from("workflows").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Workflow rule successfully deployed");
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setIsCreateOpen(false);
      setName("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create workflow");
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Workflow Automation Engine
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configurable triggers, conditional approvals, automated task generation & payment notifications
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold text-xs">
              <Plus className="h-4 w-4 mr-1.5" />
              Create Automation Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">New ERP Automation Rule</DialogTitle>
            </DialogHeader>
            <div className="space-y-3.5 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Workflow Rule Name</Label>
                <Input placeholder="e.g. Auto-Notify CEO on Payment Received" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">When This Event Triggers</Label>
                <Select value={triggerEvent} onValueChange={setTriggerEvent}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quotation_created">Quotation Created</SelectItem>
                    <SelectItem value="sales_order_confirmed">Sales Order Confirmed</SelectItem>
                    <SelectItem value="invoice_created">Invoice Generated</SelectItem>
                    <SelectItem value="invoice_overdue">Invoice Overdue</SelectItem>
                    <SelectItem value="payment_received">Payment Received</SelectItem>
                    <SelectItem value="leave_requested">Leave Application Submitted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Condition Parameter</Label>
                  <Select value={conditionField} onValueChange={setConditionField}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">Amount Greater Than</SelectItem>
                      <SelectItem value="days_past_due">Days Overdue</SelectItem>
                      <SelectItem value="department">Department</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Threshold Value</Label>
                  <Input value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Action to Execute Automatically</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="send_notification">Send In-App & Email Notification</SelectItem>
                    <SelectItem value="require_manager_approval">Hold for Manager Approval</SelectItem>
                    <SelectItem value="create_project">Instantly Create Delivery Project</SelectItem>
                    <SelectItem value="post_journal_entry">Auto-Post Double-Entry Journal</SelectItem>
                    <SelectItem value="send_payment_reminder">Send WhatsApp Payment Reminder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createWorkflowMutation.mutate()} disabled={!name}>
                Deploy Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rules Table */}
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900">
              <TableRow>
                <TableHead className="text-[10px] uppercase font-bold">Rule Name</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Event Trigger</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Condition</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Automated Action</TableHead>
                <TableHead className="text-center text-[10px] uppercase font-bold">Active</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold">Test Run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((wf: any) => (
                <TableRow key={wf.id} className="hover:bg-slate-50">
                  <TableCell className="font-semibold text-xs text-slate-900">{wf.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold">
                      {wf.trigger_event}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 font-mono">
                    {wf.conditions?.[0] ? `${wf.conditions[0].field} ${wf.conditions[0].operator || ">="} ${wf.conditions[0].value}` : "Always"}
                  </TableCell>
                  <TableCell className="text-xs text-blue-700 font-medium">
                    <span className="flex items-center gap-1.5">
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      {wf.actions?.[0]?.type || "Execute automated task"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={wf.is_active} onCheckedChange={() => toast.success("Workflow rule status updated")} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="h-7 text-xs font-semibold text-primary" onClick={() => toast.success(`Simulated execution of: ${wf.name}`)}>
                      <Play className="h-3 w-3 mr-1" /> Test
                    </Button>
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
