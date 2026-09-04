import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Key, Building2, ShieldCheck, Check, Copy, RefreshCw, Loader2, Search, Trash2, Calendar, Lock, AlertCircle, Ban, Eye } from "lucide-react";
import { toast } from "sonner";
import { format, addMonths } from "date-fns";

type AccountRecord = {
    id: string;
    company_name: string;
    admin_email: string;
    plan: string;
    user_limit: number;
    status: "active" | "suspended" | "expired";
    created_at: string;
};

type LicenseRecord = {
    id: string;
    account_id: string;
    license_key: string;
    status: "pending" | "active" | "suspended" | "expired";
    duration_months: number;
    start_date: string | null;
    expiry_date: string | null;
    created_at: string;
    accounts?: AccountRecord;
};

// Utility to generate unique license key in format LIC-XXXX-XXXX-XXXX
const generateLicenseKey = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const segment = (len: number) => Array.from({ length: len }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join("");
    return `LIC-${segment(4)}-${segment(4)}-${segment(4)}`;
};

export default function LicenseManagement() {
    const { user, role } = useAuth();
    const queryClient = useQueryClient();
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const [form, setForm] = useState({
        company_name: "",
        account_code: "",
        company_email: "",
        phone: "",
        address: "",
        country: "United States",
        tax_id: "",
        plan: "Professional",
        billing_cycle: "Annual",
        user_limit: 5,
        duration_months: 12,
        admin_name: "",
        admin_email: "",
        admin_phone: ""
    });

    // Fetch all accounts and associated license details
    const { data: licenses = [], isLoading } = useQuery({
        queryKey: ["super_admin_licenses"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("licenses")
                .select("*, accounts(*)")
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as LicenseRecord[];
        },
        enabled: !!user,
    });

    // Generate Account & License Key Mutation
    const createAccountMutation = useMutation({
        mutationFn: async () => {
            if (!form.company_name || !form.admin_email) {
                throw new Error("Company name and admin email are required.");
            }

            // 1. Create Account
            const { data: newAccount, error: accError } = await supabase
                .from("accounts")
                .insert([{
                    company_name: form.company_name,
                    admin_email: form.admin_email,
                    plan: form.plan,
                    user_limit: Number(form.user_limit) || 5,
                    status: "active"
                }])
                .select()
                .single();

            if (accError) throw accError;

            // 2. Create License Key with "pending" status
            const newKey = generateLicenseKey();
            const { error: licError } = await supabase
                .from("licenses")
                .insert([{
                    account_id: newAccount.id,
                    license_key: newKey,
                    status: "pending",
                    duration_months: Number(form.duration_months) || 12,
                    start_date: null,
                    expiry_date: null,
                }]);

            if (licError) throw licError;

            // 3. Log Audit Trail
            await supabase.from("audit_logs").insert([{
                account_id: newAccount.id,
                actor_id: user?.id || null,
                actor_email: user?.email || "super_admin",
                action: "Generate Account & License",
                module: "Account & License",
                target: form.company_name,
                details: { license_key: newKey, plan: form.plan, user_limit: form.user_limit }
            }]);

            return newKey;
        },
        onSuccess: (newKey) => {
            queryClient.invalidateQueries({ queryKey: ["super_admin_licenses"] });
            toast.success(`Account & License Key ${newKey} generated successfully!`);
            setCreateModalOpen(false);
            setForm({
                company_name: "",
                admin_email: "",
                plan: "Professional",
                user_limit: 5,
                duration_months: 12,
            });
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to create account and license");
        }
    });

    // Activate License Mutation (Sets start_date to now and calculates expiry_date)
    const activateLicenseMutation = useMutation({
        mutationFn: async (lic: LicenseRecord) => {
            const startDate = new Date();
            const expiryDate = addMonths(startDate, lic.duration_months || 12);

            const { error: licErr } = await supabase
                .from("licenses")
                .update({
                    status: "active",
                    start_date: startDate.toISOString(),
                    expiry_date: expiryDate.toISOString(),
                })
                .eq("id", lic.id);

            if (licErr) throw licErr;

            // Ensure Account status is active
            if (lic.account_id) {
                await supabase.from("accounts").update({ status: "active" }).eq("id", lic.account_id);
            }

            // Log Audit Trail
            await supabase.from("audit_logs").insert([{
                account_id: lic.account_id,
                actor_id: user?.id || null,
                actor_email: user?.email || "super_admin",
                action: "Activate License",
                module: "License",
                target: lic.license_key,
                details: { company: lic.accounts?.company_name, expiry_date: expiryDate.toISOString() }
            }]);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["super_admin_licenses"] });
            toast.success("License activated successfully!");
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to activate license");
        }
    });

    // Toggle Suspend Status Mutation
    const toggleSuspendMutation = useMutation({
        mutationFn: async ({ licId, accId, currentStatus }: { licId: string; accId?: string; currentStatus: string }) => {
            const nextStatus = currentStatus === "suspended" ? "active" : "suspended";
            const { error: licErr } = await supabase.from("licenses").update({ status: nextStatus }).eq("id", licId);
            if (licErr) throw licErr;

            if (accId) {
                await supabase.from("accounts").update({ status: nextStatus }).eq("id", accId);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["super_admin_licenses"] });
            toast.success("Status updated successfully!");
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to update status");
        }
    });

    // Extend / Renew License Mutation (+12 Months)
    const extendLicenseMutation = useMutation({
        mutationFn: async (lic: LicenseRecord) => {
            const currentExpiry = lic.expiry_date ? new Date(lic.expiry_date) : new Date();
            const newExpiry = addMonths(currentExpiry > new Date() ? currentExpiry : new Date(), 12);

            const { error } = await supabase
                .from("licenses")
                .update({
                    status: "active",
                    expiry_date: newExpiry.toISOString()
                })
                .eq("id", lic.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["super_admin_licenses"] });
            toast.success("License extended by 12 months!");
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to extend license");
        }
    });

    // Delete Account & License
    const deleteAccountMutation = useMutation({
        mutationFn: async (accId: string) => {
            const { error } = await supabase.from("accounts").delete().eq("id", accId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["super_admin_licenses"] });
            toast.success("Account deleted.");
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to delete account");
        }
    });

    const handleCopyKey = (key: string) => {
        navigator.clipboard.writeText(key);
        setCopiedKey(key);
        toast.success("License key copied to clipboard!");
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const filteredLicenses = licenses.filter(l => 
        l.license_key.toLowerCase().includes(search.toLowerCase()) ||
        l.accounts?.company_name.toLowerCase().includes(search.toLowerCase()) ||
        l.accounts?.admin_email.toLowerCase().includes(search.toLowerCase())
    );

    const totalAccounts = licenses.length;
    const activeLicenses = licenses.filter(l => l.status === "active").length;
    const pendingLicenses = licenses.filter(l => l.status === "pending").length;
    const totalUsers = licenses.reduce((sum, l) => sum + (l.accounts?.user_limit || 0), 0);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "active":
                return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1"><ShieldCheck className="h-3 w-3" /> Active</Badge>;
            case "pending":
                return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1"><AlertCircle className="h-3 w-3" /> Pending Activation</Badge>;
            case "suspended":
                return <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 gap-1"><Ban className="h-3 w-3" /> Suspended</Badge>;
            case "expired":
                return <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30 gap-1"><Lock className="h-3 w-3" /> Expired</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Key className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        License & Account Management
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Generate tenant accounts, manage unique license keys (`LIC-XXXX-XXXX-XXXX`), and control portal access.
                    </p>
                </div>
                <Button onClick={() => setCreateModalOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20 gap-2">
                    <Plus className="h-4 w-4" /> Generate Account & License
                </Button>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Accounts</CardTitle>
                        <Building2 className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalAccounts}</div>
                        <p className="text-xs text-muted-foreground">Tenant organizations</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Licenses</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{activeLicenses}</div>
                        <p className="text-xs text-muted-foreground">Authorized & active</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Activation</CardTitle>
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{pendingLicenses}</div>
                        <p className="text-xs text-muted-foreground">Awaiting license activation</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 dark:border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Allocated Users</CardTitle>
                        <Key className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{totalUsers}</div>
                        <p className="text-xs text-muted-foreground">Total seats granted</p>
                    </CardContent>
                </Card>
            </div>

            {/* License & Account List */}
            <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg">Company Accounts & License Keys</CardTitle>
                            <CardDescription>View, activate, suspend, or renew license subscriptions</CardDescription>
                        </div>
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search company, email, key..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                <TableRow>
                                    <TableHead>Company & Admin</TableHead>
                                    <TableHead>License Key</TableHead>
                                    <TableHead>Subscription Plan</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>User Limit</TableHead>
                                    <TableHead>Start / Expiry</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground mt-2 block">Loading account & license records...</span>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLicenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            No account or license key records found. Click "Generate Account & License" to create one.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredLicenses.map((lic) => {
                                        const acc = lic.accounts;
                                        return (
                                            <TableRow key={lic.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                                <TableCell>
                                                    <div className="font-medium text-sm text-slate-900 dark:text-slate-100">{acc?.company_name || "N/A"}</div>
                                                    <div className="text-xs text-muted-foreground">{acc?.admin_email || "N/A"}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40">
                                                            {lic.license_key}
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            onClick={() => handleCopyKey(lic.license_key)}
                                                            title="Copy License Key"
                                                        >
                                                            {copiedKey === lic.license_key ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-medium text-xs">
                                                        {acc?.plan || "Professional"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {getStatusBadge(lic.status)}
                                                </TableCell>
                                                <TableCell className="text-xs font-medium">
                                                    {acc?.user_limit || 5} Users
                                                </TableCell>
                                                <TableCell className="text-xs space-y-0.5">
                                                    {lic.start_date ? (
                                                        <div><span className="text-muted-foreground">Start:</span> {format(new Date(lic.start_date), "dd MMM yyyy")}</div>
                                                    ) : (
                                                        <div className="text-amber-600 font-medium">Not activated</div>
                                                    )}
                                                    {lic.expiry_date && (
                                                        <div className="text-slate-600 dark:text-slate-400">
                                                            <span className="text-muted-foreground">Expires:</span> {format(new Date(lic.expiry_date), "dd MMM yyyy")}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {acc && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    impersonateAccount(acc);
                                                                    toast.success(`Direct View active for ${acc.company_name}`);
                                                                    window.location.href = "/dashboard";
                                                                }}
                                                                className="h-7 text-xs bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 gap-1 hover:bg-purple-100 font-medium"
                                                                title="Super Admin Direct View without Password"
                                                            >
                                                                <Eye className="h-3 w-3" /> Direct View
                                                            </Button>
                                                        )}
                                                        {lic.status === "pending" && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => activateLicenseMutation.mutate(lic)}
                                                                disabled={activateLicenseMutation.isPending}
                                                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                                            >
                                                                <Check className="h-3 w-3" /> Activate
                                                            </Button>
                                                        )}
                                                        {lic.status === "active" && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => toggleSuspendMutation.mutate({ licId: lic.id, accId: lic.account_id, currentStatus: lic.status })}
                                                                disabled={toggleSuspendMutation.isPending}
                                                                className="h-7 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border-red-200"
                                                            >
                                                                <Ban className="h-3 w-3 mr-1" /> Suspend
                                                            </Button>
                                                        )}
                                                        {lic.status === "suspended" && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => toggleSuspendMutation.mutate({ licId: lic.id, accId: lic.account_id, currentStatus: lic.status })}
                                                                disabled={toggleSuspendMutation.isPending}
                                                                className="h-7 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-200"
                                                            >
                                                                <Check className="h-3 w-3 mr-1" /> Reactivate
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => extendLicenseMutation.mutate(lic)}
                                                            disabled={extendLicenseMutation.isPending}
                                                            className="h-7 text-xs text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                                                            title="Extend +12 Months"
                                                        >
                                                            <RefreshCw className="h-3 w-3 mr-1" /> +1 yr
                                                        </Button>
                                                        {lic.account_id && (
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                onClick={() => {
                                                                    if (confirm(`Delete account ${acc?.company_name} and its license key?`)) {
                                                                        deleteAccountMutation.mutate(lic.account_id);
                                                                    }
                                                                }}
                                                                className="h-7 w-7 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                                                                title="Delete Account"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Generate Account Modal */}
            <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
                <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Building2 className="h-5 w-5 text-purple-600" />
                            + Generate Enterprise Account & License Key
                        </DialogTitle>
                        <DialogDescription>
                            Provision a new multi-tenant company account, assign subscription plan, and generate a unique `LIC-XXXX-XXXX-XXXX` license key.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-xs">
                        <div className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px] border-b pb-1">1. Company & Account Details</div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Company / Account Name *</Label>
                                <Input
                                    placeholder="e.g. Acme Corp"
                                    value={form.company_name}
                                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Account ID Code (Optional)</Label>
                                <Input
                                    placeholder="e.g. ACC-ACME-001"
                                    value={form.account_code}
                                    onChange={(e) => setForm({ ...form, account_code: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Company Email</Label>
                                <Input
                                    type="email"
                                    placeholder="contact@acme.com"
                                    value={form.company_email}
                                    onChange={(e) => setForm({ ...form, company_email: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Phone</Label>
                                <Input
                                    placeholder="+1 (555) 000-0000"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Tax / VAT / GST ID</Label>
                                <Input
                                    placeholder="e.g. GSTIN27AAAAA0000A1Z5"
                                    value={form.tax_id}
                                    onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Country</Label>
                                <Input
                                    placeholder="United States / India"
                                    value={form.country}
                                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px] border-b pb-1 mt-4">2. Subscription & License Configuration</div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <Label>Subscription Plan</Label>
                                <Select value={form.plan} onValueChange={(val) => setForm({ ...form, plan: val })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Starter">Starter (₹2,999/mo)</SelectItem>
                                        <SelectItem value="Professional">Professional (₹7,999/mo)</SelectItem>
                                        <SelectItem value="Enterprise">Enterprise (₹19,999/mo)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Billing Cycle</Label>
                                <Select value={form.billing_cycle} onValueChange={(val) => setForm({ ...form, billing_cycle: val })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Monthly">Monthly</SelectItem>
                                        <SelectItem value="Annual">Annual (20% Discount)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>License Duration</Label>
                                <Select value={String(form.duration_months)} onValueChange={(val) => setForm({ ...form, duration_months: Number(val) })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">1 Month</SelectItem>
                                        <SelectItem value="3">3 Months</SelectItem>
                                        <SelectItem value="6">6 Months</SelectItem>
                                        <SelectItem value="12">12 Months (1 Year)</SelectItem>
                                        <SelectItem value="24">24 Months (2 Years)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>User Seat Limit</Label>
                            <Input
                                type="number"
                                min={1}
                                max={500}
                                value={form.user_limit}
                                onChange={(e) => setForm({ ...form, user_limit: Number(e.target.value) || 5 })}
                            />
                        </div>

                        <div className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px] border-b pb-1 mt-4">3. Primary Account Administrator</div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Primary Admin Name</Label>
                                <Input
                                    placeholder="John Doe"
                                    value={form.admin_name}
                                    onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Primary Admin Email *</Label>
                                <Input
                                    type="email"
                                    placeholder="admin@company.com"
                                    value={form.admin_email}
                                    onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => createAccountMutation.mutate()}
                            disabled={createAccountMutation.isPending}
                            className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                        >
                            {createAccountMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                            Generate Account & License Key
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
