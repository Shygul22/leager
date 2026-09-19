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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCheck, Calendar, Clock, Plus, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AttendanceAndLeave() {
  const { user, account } = useAuth();
  const queryClient = useQueryClient();
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);

  // Leave Form
  const [employeeId, setEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState<"casual" | "sick" | "paid" | "unpaid">("paid");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [daysCount, setDaysCount] = useState<number>(1);
  const [reason, setReason] = useState("");

  const activeAccountId = account?.id;

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-hr", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, name, designation, department");
      if (error || !data || data.length === 0) {
        return [
          { id: "e1", name: "Shygul Akbar", designation: "Founder & Executive Director", department: "Executive" },
          { id: "e2", name: "Senior Full-Stack Engineer", designation: "Lead Developer", department: "Engineering" },
          { id: "e3", name: "Accounts & Compliance Lead", designation: "Finance Manager", department: "Finance" }
        ];
      }
      return data;
    }
  });

  // Attendance Records
  const { data: attendanceList = [] } = useQuery({
    queryKey: ["attendance-records", activeAccountId],
    queryFn: async () => {
      let query = supabase.from("employee_attendance").select("*, employees(name, designation)").order("date", { ascending: false });
      if (activeAccountId) query = query.eq("account_id", activeAccountId);
      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return [
          {
            id: "att-1",
            date: format(new Date(), "yyyy-MM-dd"),
            check_in: "09:30 AM",
            check_out: "06:30 PM",
            working_hours: 8.5,
            overtime_hours: 0.5,
            status: "present",
            employees: { name: "Shygul Akbar", designation: "Founder & Executive Director" }
          },
          {
            id: "att-2",
            date: format(new Date(), "yyyy-MM-dd"),
            check_in: "09:45 AM",
            check_out: "06:45 PM",
            working_hours: 8.0,
            overtime_hours: 0.0,
            status: "present",
            employees: { name: "Senior Full-Stack Engineer", designation: "Lead Developer" }
          }
        ];
      }
      return data;
    }
  });

  // Leave Requests
  const { data: leaveRequests = [] } = useQuery({
    queryKey: ["leave-requests", activeAccountId],
    queryFn: async () => {
      let query = supabase.from("leave_requests").select("*, employees(name, designation)").order("created_at", { ascending: false });
      if (activeAccountId) query = query.eq("account_id", activeAccountId);
      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return [
          {
            id: "lr-1",
            leave_type: "paid",
            start_date: "2026-09-24",
            end_date: "2026-09-25",
            days_count: 2,
            reason: "Personal family event",
            status: "approved",
            employees: { name: "Senior Full-Stack Engineer", designation: "Lead Developer" }
          }
        ];
      }
      return data;
    }
  });

  const createLeaveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        employee_id: employeeId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        days_count: daysCount,
        reason,
        status: "pending",
        account_id: activeAccountId || null
      };
      const { error } = await supabase.from("leave_requests").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave application submitted");
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      setIsLeaveOpen(false);
      setReason("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to apply for leave");
    }
  });

  const updateLeaveStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leave_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave request status updated");
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-primary" />
            Attendance & Leave Management
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Biometric check-in/out, working hours, leave balances, and managerial approvals
          </p>
        </div>
        <Dialog open={isLeaveOpen} onOpenChange={setIsLeaveOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold text-xs">
              <Plus className="h-4 w-4 mr-1.5" />
              Apply for Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Submit Leave Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-3.5 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Employee</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger><SelectValue placeholder="Select Employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.name} ({e.department})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Leave Type</Label>
                  <Select value={leaveType} onValueChange={(val: any) => setLeaveType(val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid Leave</SelectItem>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="casual">Casual Leave</SelectItem>
                      <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Total Days</Label>
                  <Input type="number" step="0.5" value={daysCount} onChange={(e) => setDaysCount(parseFloat(e.target.value) || 1)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Reason</Label>
                <Input placeholder="Reason for leave..." value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsLeaveOpen(false)}>Cancel</Button>
              <Button onClick={() => createLeaveMutation.mutate()} disabled={!employeeId || !reason}>
                Submit Application
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="attendance" className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <TabsTrigger value="attendance" className="text-xs font-bold px-4 py-2">
            Daily Attendance Log
          </TabsTrigger>
          <TabsTrigger value="leave" className="text-xs font-bold px-4 py-2">
            Leave Applications & Balances
          </TabsTrigger>
        </TabsList>

        {/* Attendance Log */}
        <TabsContent value="attendance">
          <Card className="shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900">
                  <TableRow>
                    <TableHead className="w-28 text-[10px] uppercase font-bold">Date</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Employee</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Check-In</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Check-Out</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold">Hours Worked</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold">Overtime</TableHead>
                    <TableHead className="text-center text-[10px] uppercase font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceList.map((att: any) => (
                    <TableRow key={att.id} className="hover:bg-slate-50">
                      <TableCell className="text-xs font-medium text-slate-700">{att.date}</TableCell>
                      <TableCell className="text-xs font-semibold text-slate-900">{att.employees?.name || "Employee"}</TableCell>
                      <TableCell className="text-xs text-slate-600">{att.check_in || "09:30 AM"}</TableCell>
                      <TableCell className="text-xs text-slate-600">{att.check_out || "06:30 PM"}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold">{att.working_hours || 8.0} hrs</TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-600 font-bold">{att.overtime_hours || 0} hrs</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-emerald-600 text-white text-[10px] uppercase">
                          {att.status || "Present"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave Requests */}
        <TabsContent value="leave">
          <Card className="shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold">Employee</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Leave Type</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Dates</TableHead>
                    <TableHead className="text-center text-[10px] uppercase font-bold">Days</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Reason</TableHead>
                    <TableHead className="text-center text-[10px] uppercase font-bold">Status</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveRequests.map((lr: any) => (
                    <TableRow key={lr.id} className="hover:bg-slate-50">
                      <TableCell className="text-xs font-semibold text-slate-900">{lr.employees?.name || "Employee"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {lr.leave_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{lr.start_date} to {lr.end_date}</TableCell>
                      <TableCell className="text-center font-bold text-xs">{lr.days_count}</TableCell>
                      <TableCell className="text-xs text-slate-700">{lr.reason}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={lr.status === "approved" ? "bg-emerald-600 text-white" : lr.status === "rejected" ? "bg-rose-600 text-white" : "bg-amber-600 text-white"}>
                          {lr.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {lr.status === "pending" && (
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600 font-bold" onClick={() => updateLeaveStatusMutation.mutate({ id: lr.id, status: "approved" })}>
                              Approve
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-600" onClick={() => updateLeaveStatusMutation.mutate({ id: lr.id, status: "rejected" })}>
                              Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
