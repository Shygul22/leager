import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
    Calendar, CheckCircle2, Clock, AlertTriangle, ShieldCheck, 
    Building2, FileText, Check, ArrowUpRight, RefreshCw 
} from "lucide-react";
import { toast } from "sonner";

export type AuthorityType = "Income Tax" | "GST" | "TDS" | "MCA / ROC";
export type ComplianceStatus = "Completed" | "Upcoming" | "Overdue" | "Pending";

export interface ComplianceItem {
    id: string;
    authority: AuthorityType;
    formName: string;
    title: string;
    dueDate: string;
    period: string;
    status: ComplianceStatus;
    penaltyRule: string;
}

const initialCompliances: ComplianceItem[] = [
    // Incorporation & MCA / ROC Compliances for ZENJOURNEY PRIVATE LIMITED (Inc: 07 April 2026)
    { id: "mca-inc-1", authority: "MCA / ROC", formName: "Form ADT-1", title: "Appointment of First Statutory Auditor (Within 30 Days)", dueDate: "2026-05-07", period: "First FY 2026-27", status: "Completed", penaltyRule: "₹300/month late fee" },
    { id: "mca-inc-2", authority: "MCA / ROC", formName: "Form INC-20A", title: "Declaration of Commencement of Business (Within 180 Days)", dueDate: "2026-10-04", period: "First FY 2026-27", status: "Upcoming", penaltyRule: "Flat ₹50,000 company penalty + ₹1,000/day for directors" },
    { id: "mca-1", authority: "MCA / ROC", formName: "Form DPT-3", title: "Return of Deposits & Non-Deposit Loans", dueDate: "2026-06-30", period: "FY 2025-26", status: "Completed", penaltyRule: "₹5,000 + ₹500/day after due date" },
    { id: "mca-2", authority: "MCA / ROC", formName: "DIR-3 KYC", title: "Annual KYC of Directors", dueDate: "2026-09-30", period: "FY 2025-26", status: "Upcoming", penaltyRule: "Flat ₹5,000 penalty per director" },
    { id: "mca-3", authority: "MCA / ROC", formName: "Form AOC-4", title: "Filing of Audited Financial Statements", dueDate: "2026-10-30", period: "FY 2025-26", status: "Upcoming", penaltyRule: "₹100 per day of delay" },
    { id: "mca-4", authority: "MCA / ROC", formName: "Form MGT-7A", title: "Annual Return of Small Company", dueDate: "2026-11-29", period: "FY 2025-26", status: "Upcoming", penaltyRule: "₹100 per day of delay" },

    // Income Tax
    { id: "it-1", authority: "Income Tax", formName: "Advance Tax Q1", title: "15% Advance Tax Payment (Challan 280)", dueDate: "2026-06-15", period: "Q1 FY 26", status: "Upcoming", penaltyRule: "1% interest per month under Sec 234C" },
    { id: "it-2", authority: "Income Tax", formName: "Advance Tax Q2", title: "45% Advance Tax Payment", dueDate: "2026-09-15", period: "Q2 FY 26", status: "Upcoming", penaltyRule: "1% interest per month under Sec 234C" },
    { id: "it-3", authority: "Income Tax", formName: "Form 3CD / 3CA", title: "Tax Audit Report Filing", dueDate: "2026-09-30", period: "AY 2026-27", status: "Upcoming", penaltyRule: "0.5% of turnover (Max ₹1.5 Lakhs)" },
    { id: "it-4", authority: "Income Tax", formName: "ITR-6", title: "Corporate Income Tax Return Filing", dueDate: "2026-10-31", period: "AY 2026-27", status: "Upcoming", penaltyRule: "Interest under Sec 234A + ₹5,000 fee" },

    // GST
    { id: "gst-1", authority: "GST", formName: "GSTR-1", title: "Monthly Outward Supplies Return", dueDate: "2026-09-11", period: "August 2026", status: "Pending", penaltyRule: "₹50/day late fee (NIL return ₹20/day)" },
    { id: "gst-2", authority: "GST", formName: "GSTR-3B", title: "Monthly Summary & Tax Payment Return", dueDate: "2026-09-20", period: "August 2026", status: "Pending", penaltyRule: "₹50/day + 18% p.a. interest" },
    { id: "gst-3", authority: "GST", formName: "GSTR-9 / 9C", title: "Annual GST Return & Reconciliation Statement", dueDate: "2026-12-31", period: "FY 2025-26", status: "Upcoming", penaltyRule: "₹200 per day (0.5% turnover cap)" },

    // TDS
    { id: "tds-1", authority: "TDS", formName: "Form 26Q Q1", title: "Quarterly TDS Statement (Non-Salary)", dueDate: "2026-07-31", period: "Q1 FY 26", status: "Completed", penaltyRule: "₹200 per day under Sec 234E" },
    { id: "tds-2", authority: "TDS", formName: "Form 26Q Q2", title: "Quarterly TDS Statement (Non-Salary)", dueDate: "2026-10-31", period: "Q2 FY 26", status: "Upcoming", penaltyRule: "₹200 per day under Sec 234E" },
];

export default function ComplianceDashboard() {
    const [compliances, setCompliances] = useState<ComplianceItem[]>(initialCompliances);
    const [authorityFilter, setAuthorityFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const toggleStatus = (id: string) => {
        setCompliances(prev => prev.map(item => {
            if (item.id === id) {
                const nextStatus: ComplianceStatus = item.status === "Completed" ? "Pending" : "Completed";
                toast.success(`${item.formName} marked as ${nextStatus}`);
                return { ...item, status: nextStatus };
            }
            return item;
        }));
    };

    const filtered = compliances
        .filter(c => {
            const matchesAuth = authorityFilter === "all" || c.authority === authorityFilter;
            const matchesStatus = statusFilter === "all" || c.status === statusFilter;
            return matchesAuth && matchesStatus;
        })
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const counts = {
        total: compliances.length,
        completed: compliances.filter(c => c.status === "Completed").length,
        pending: compliances.filter(c => c.status === "Pending").length,
        upcoming: compliances.filter(c => c.status === "Upcoming").length,
        overdue: compliances.filter(c => c.status === "Overdue").length,
    };

    return (
        <div className="space-y-6">
            {/* Company Incorporation Summary Banner */}
            <Card className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-md border-0">
                <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-indigo-400" />
                                <h2 className="text-base font-bold tracking-tight text-white">ZENJOURNEY PRIVATE LIMITED</h2>
                                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] uppercase font-mono">
                                    Active Statutory Profile
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-300 font-mono flex items-center gap-4 flex-wrap">
                                <span>CIN: <strong className="text-white">U62013TN2026PTC191867</strong></span>
                                <span>•</span>
                                <span>Incorporated: <strong className="text-emerald-300">07 April 2026</strong></span>
                                <span>•</span>
                                <span>First FY: <strong className="text-indigo-200">07 Apr 2026 – 31 Mar 2027</strong></span>
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="bg-white/10 rounded-lg px-3 py-1.5 text-center">
                                <span className="text-[9px] uppercase tracking-widest text-slate-300 block font-bold">Commencement (INC-20A)</span>
                                <span className="text-xs font-mono font-bold text-amber-300">Due: 04 Oct 2026 (180 Days)</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* KPI Summary Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20">
                    <CardContent className="p-4">
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 block">Completed Compliances</span>
                        <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                            {counts.completed} <span className="text-xs font-normal text-muted-foreground">/ {counts.total}</span>
                        </div>
                        <span className="text-[10px] text-emerald-600/80 mt-1 block">Filed & satisfied</span>
                    </CardContent>
                </Card>

                <Card className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20">
                    <CardContent className="p-4">
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Upcoming Due Dates</span>
                        <div className="text-2xl font-extrabold text-blue-600 mt-1">
                            {counts.upcoming}
                        </div>
                        <span className="text-[10px] text-blue-600/80 mt-1 block">Next 30-90 days</span>
                    </CardContent>
                </Card>

                <Card className="bg-amber-50/50 border-amber-200 dark:bg-amber-950/20">
                    <CardContent className="p-4">
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Pending Actions</span>
                        <div className="text-2xl font-extrabold text-amber-600 mt-1">
                            {counts.pending}
                        </div>
                        <span className="text-[10px] text-amber-600/80 mt-1 block">Immediate attention required</span>
                    </CardContent>
                </Card>

                <Card className="bg-rose-50/50 border-rose-200 dark:bg-rose-950/20">
                    <CardContent className="p-4">
                        <span className="text-xs font-medium text-rose-700 dark:text-rose-400">Overdue Filings</span>
                        <div className="text-2xl font-extrabold text-rose-600 mt-1">
                            {counts.overdue}
                        </div>
                        <span className="text-[10px] text-rose-600/80 mt-1 block">Late fee / interest active</span>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Toolbar */}
            <div className="flex items-center justify-between border-b pb-3 flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <Select value={authorityFilter} onValueChange={setAuthorityFilter}>
                        <SelectTrigger className="w-40 h-9 text-xs">
                            <SelectValue placeholder="Authority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Authorities</SelectItem>
                            <SelectItem value="Income Tax">Income Tax</SelectItem>
                            <SelectItem value="GST">GST Authority</SelectItem>
                            <SelectItem value="TDS">TDS / TCS</SelectItem>
                            <SelectItem value="MCA / ROC">MCA / ROC</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-36 h-9 text-xs">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Upcoming">Upcoming</SelectItem>
                            <SelectItem value="Overdue">Overdue</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                    Indian Private Limited Company Statutory Calendar
                </Badge>
            </div>

            {/* Compliance Items Table */}
            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    <Table className="text-xs">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Authority</TableHead>
                                <TableHead>Form & Filing Title</TableHead>
                                <TableHead>Applicable Period</TableHead>
                                <TableHead>Statutory Due Date</TableHead>
                                <TableHead>Late Fee / Penalty Rule</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-24 text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                        No statutory compliances match your filter selection.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map(item => (
                                    <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell>
                                            <Badge variant="secondary" className="font-semibold text-[10px]">
                                                {item.authority}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-bold text-foreground font-mono">{item.formName}</div>
                                            <div className="text-[11px] text-muted-foreground">{item.title}</div>
                                        </TableCell>
                                        <TableCell className="font-medium">{item.period}</TableCell>
                                        <TableCell className="font-bold font-mono text-primary">{item.dueDate}</TableCell>
                                        <TableCell className="text-muted-foreground text-[10px] max-w-[200px]">{item.penaltyRule}</TableCell>
                                        <TableCell>
                                            <Badge 
                                                variant="outline"
                                                className={
                                                    item.status === "Completed" ? "bg-emerald-500/10 text-emerald-600 border-emerald-300" :
                                                    item.status === "Pending" ? "bg-amber-500/10 text-amber-600 border-amber-300" :
                                                    item.status === "Overdue" ? "bg-rose-500/10 text-rose-600 border-rose-300" :
                                                    "bg-blue-500/10 text-blue-600 border-blue-300"
                                                }
                                            >
                                                {item.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                size="xs" 
                                                variant={item.status === "Completed" ? "outline" : "default"}
                                                className={item.status === "Completed" ? "text-emerald-600" : "bg-emerald-600 hover:bg-emerald-700"}
                                                onClick={() => toggleStatus(item.id)}
                                            >
                                                {item.status === "Completed" ? <Check className="h-3 w-3 mr-1" /> : null}
                                                {item.status === "Completed" ? "Done" : "Mark Done"}
                                            </Button>
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
