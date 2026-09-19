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
import { Plus, Clock, CheckCircle2, User, Calendar, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Timesheets() {
  const { user, account } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [projectId, setProjectId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [hours, setHours] = useState<number>(8);
  const [billable, setBillable] = useState<boolean>(true);
  const [hourlyRate, setHourlyRate] = useState<number>(850);
  const [description, setDescription] = useState("");

  const activeAccountId = account?.id;

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-ts", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, title");
      if (error || !data || data.length === 0) {
        return [
          { id: "p1", title: "Enterprise ERP Cloud Migration" },
          { id: "p2", title: "Mobile Banking & Payments App" }
        ];
      }
      return data;
    }
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-ts", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, name, designation");
      if (error || !data || data.length === 0) {
        return [
          { id: "e1", name: "Shygul Akbar", designation: "Founder & Lead Architect" },
          { id: "e2", name: "Senior Full-Stack Engineer", designation: "Staff Developer" }
        ];
      }
      return data;
    }
  });

  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ["timesheets", activeAccountId],
    queryFn: async () => {
      let query = supabase.from("timesheets").select("*, projects(title), employees(name)").order("date", { ascending: false });
      if (activeAccountId) {
        query = query.eq("account_id", activeAccountId);
      }
      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return [
          {
            id: "ts-1",
            date: "2026-09-15",
            hours: 8.0,
            billable: true,
            hourly_rate: 1200,
            description: "Database architecture and double-entry ledger integration",
            status: "approved",
            projects: { title: "Enterprise ERP Cloud Migration" },
            employees: { name: "Shygul Akbar" }
          },
          {
            id: "ts-2",
            date: "2026-09-16",
            hours: 6.5,
            billable: true,
            hourly_rate: 850,
            description: "Frontend UI components and reconciliation reports",
            status: "approved",
            projects: { title: "Enterprise ERP Cloud Migration" },
            employees: { name: "Senior Full-Stack Engineer" }
          }
        ];
      }
      return data;
    }
  });

  const createTimesheetMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        project_id: projectId,
        employee_id: employeeId,
        date,
        hours,
        billable,
        hourly_rate: hourlyRate,
        description,
        status: "approved",
        account_id: activeAccountId || null
      };
      const { error } = await supabase.from("timesheets").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Timesheet entry logged successfully");
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      setIsCreateOpen(false);
      setDescription("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to log timesheet");
    }
  });

  const totalLoggedHours = timesheets.reduce((sum: number, ts: any) => sum + Number(ts.hours || 0), 0);
  const billableHours = timesheets.filter((ts: any) => ts.billable).reduce((sum: number, ts: any) => sum + Number(ts.hours || 0), 0);
  const billableUtilization = totalLoggedHours > 0 ? (billableHours / totalLoggedHours) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            Project Timesheets
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Billable engineering hours, employee utilization & client project cost allocation
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold text-xs">
              <Plus className="h-4 w-4 mr-1.5" />
              Log Hours
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Log Project Working Hours</DialogTitle>
            </DialogHeader>
            <div className="space-y-3.5 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger><SelectValue placeholder="Select Project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Employee / Engineer</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger><SelectValue placeholder="Select Team Member" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.name} ({e.designation})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Hours</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={hours || ""}
                    onChange={(e) => setHours(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Hourly Rate (₹)</Label>
                  <Input
                    type="number"
                    value={hourlyRate || ""}
                    onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Description of Work Performed</Label>
                <Input placeholder="Tasks accomplished..." value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createTimesheetMutation.mutate()} disabled={!projectId || !employeeId || hours <= 0}>
                Submit Timesheet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Timesheet KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm border-t-4 border-t-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Hours Logged</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-blue-600">{totalLoggedHours.toFixed(1)} hrs</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-t-4 border-t-emerald-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Billable Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-emerald-600">{billableHours.toFixed(1)} hrs</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-t-4 border-t-purple-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Billable Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-purple-700">{billableUtilization.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Timesheet Table */}
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900">
              <TableRow>
                <TableHead className="w-28 text-[10px] uppercase font-bold">Date</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Team Member</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Project</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Task Narration</TableHead>
                <TableHead className="text-center text-[10px] uppercase font-bold">Billable</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold">Hours</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold">Allocated Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">Loading Timesheets...</TableCell></TableRow>
              ) : timesheets.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">No timesheets logged.</TableCell></TableRow>
              ) : (
                timesheets.map((ts: any) => (
                  <TableRow key={ts.id} className="hover:bg-slate-50">
                    <TableCell className="text-xs font-medium text-slate-700">{ts.date}</TableCell>
                    <TableCell className="text-xs font-semibold text-slate-900">{ts.employees?.name || "Staff Engineer"}</TableCell>
                    <TableCell className="text-xs text-blue-700 font-semibold">{ts.projects?.title || "Project"}</TableCell>
                    <TableCell className="text-xs text-slate-700">{ts.description}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={ts.billable ? "default" : "outline"} className="text-[10px]">
                        {ts.billable ? "Billable" : "Non-billable"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs">{Number(ts.hours).toFixed(1)} hrs</TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-slate-900">
                      ₹{(Number(ts.hours) * Number(ts.hourly_rate || 850)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
