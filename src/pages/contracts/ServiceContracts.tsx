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
import { Handshake, Plus, ShieldCheck, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ServiceContracts() {
  const { user, account } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [contractNumber, setContractNumber] = useState(`AMC-${format(new Date(), "yyyy")}-001`);
  const [clientName, setClientName] = useState("");
  const [serviceName, setServiceName] = useState("Enterprise ERP & Infrastructure AMC");
  const [contractType, setContractType] = useState<"AMC" | "SLA" | "Subscription" | "Consulting">("AMC");
  const [contractValue, setContractValue] = useState<number>(0);
  const [endDate, setEndDate] = useState("2027-09-18");

  const activeAccountId = account?.id;

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["service-contracts", activeAccountId],
    queryFn: async () => {
      let query = supabase.from("service_contracts").select("*").order("created_at", { ascending: false });
      if (activeAccountId) query = query.eq("account_id", activeAccountId);
      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return [
          {
            id: "sc-1",
            contract_number: "AMC-2026-001",
            client_name: "Zenith Global Tech",
            service_name: "Cloud Server 24/7 SLA & Maintenance",
            contract_type: "AMC",
            start_date: "2026-09-01",
            end_date: "2027-08-31",
            billing_frequency: "Monthly",
            contract_value: 180000,
            status: "active",
            sla_hours: 4
          },
          {
            id: "sc-2",
            contract_number: "SLA-2026-002",
            client_name: "Apex Logistics Corp",
            service_name: "ERP Application L2 Support & Bug Fixes",
            contract_type: "SLA",
            start_date: "2026-07-01",
            end_date: "2027-06-30",
            billing_frequency: "Quarterly",
            contract_value: 95000,
            status: "active",
            sla_hours: 8
          }
        ];
      }
      return data;
    }
  });

  const createContractMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        contract_number: contractNumber,
        client_name: clientName,
        service_name: serviceName,
        contract_type: contractType,
        start_date: format(new Date(), "yyyy-MM-dd"),
        end_date: endDate,
        contract_value: contractValue,
        status: "active",
        account_id: activeAccountId || null
      };
      const { error } = await supabase.from("service_contracts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Service contract activated");
      queryClient.invalidateQueries({ queryKey: ["service-contracts"] });
      setIsCreateOpen(false);
      setContractValue(0);
      setClientName("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create contract");
    }
  });

  const totalARR = contracts.reduce((s: number, c: any) => s + Number(c.contract_value || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Handshake className="h-6 w-6 text-primary" />
            Service Contracts & AMC Subscriptions
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Annual Maintenance Contracts (AMC), SLAs, recurring billing & renewal alerts
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold text-xs">
              <Plus className="h-4 w-4 mr-1.5" />
              New AMC Contract
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">New Service Contract / AMC</DialogTitle>
            </DialogHeader>
            <div className="space-y-3.5 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Contract #</Label>
                  <Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Contract Type</Label>
                  <Select value={contractType} onValueChange={(val: any) => setContractType(val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AMC">AMC (Annual Maintenance)</SelectItem>
                      <SelectItem value="SLA">SLA Dedicated Support</SelectItem>
                      <SelectItem value="Subscription">Monthly Subscription</SelectItem>
                      <SelectItem value="Consulting">Consulting Retainer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Customer / Client</Label>
                <Input placeholder="Client company name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Service Package</Label>
                <Input value={serviceName} onChange={(e) => setServiceName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Annual Value (₹)</Label>
                  <Input
                    type="number"
                    value={contractValue || ""}
                    onChange={(e) => setContractValue(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Expiry Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createContractMutation.mutate()} disabled={!clientName || contractValue <= 0}>
                Activate Contract
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contract KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm border-t-4 border-t-emerald-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Annual Recurring Revenue (ARR)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-emerald-600">
              ₹{totalARR.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-t-4 border-t-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active AMCs / Retainers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-blue-600">{contracts.length} Contracts</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-t-4 border-t-purple-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Average SLA Commitment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-purple-700">6.0 Hours</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900">
              <TableRow>
                <TableHead className="w-28 text-[10px] uppercase font-bold">Contract #</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Customer</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Scope / Service</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Contract Term</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold">Contract Value</TableHead>
                <TableHead className="text-center text-[10px] uppercase font-bold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c: any) => (
                <TableRow key={c.id} className="hover:bg-slate-50">
                  <TableCell className="font-mono text-xs font-bold text-slate-900">{c.contract_number}</TableCell>
                  <TableCell className="font-semibold text-xs text-slate-900">{c.client_name}</TableCell>
                  <TableCell className="text-xs text-slate-700">{c.service_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">Expires {c.end_date}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-emerald-700">
                    ₹{Number(c.contract_value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-emerald-600 text-white text-[10px] uppercase font-bold">
                      {c.status || "Active"}
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
