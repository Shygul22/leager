import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit, Search, Loader2, DollarSign, Calendar, Clock, UserPlus, Phone, Mail, FileText, Target, Globe, Copy, Check, Zap, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type LeadTrackingRecord = {
    id: string;
    lead_id_code: string;
    lead_name: string;
    phone: string | null;
    gmail: string | null;
    service_interested: string | null;
    notes: string | null;
    lead_status: "new" | "contacted" | "qualified" | "proposal_sent" | "negotiation" | "won" | "lost";
    next_follow_up_date: string | null;
    probability: number;
    quotation_no: string | null;
    value: number;
    outstanding_value: number;
    first_contact_date: string | null;
    created_at: string;
};

export default function LeadTracking() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [metaModalOpen, setMetaModalOpen] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [copiedToken, setCopiedToken] = useState(false);

    const [editingRecord, setEditingRecord] = useState<LeadTrackingRecord | null>(null);
    const [search, setSearch] = useState("");

    // Meta Ads Config State
    const [metaForm, setMetaForm] = useState({
        page_id: "",
        page_name: "",
        page_access_token: "",
        verify_token: "zenjourney_meta_lead_verify_token_2026"
    });
    const [metaTestLeadId, setMetaTestLeadId] = useState("");
    const [isTestingLead, setIsTestingLead] = useState(false);

    const webhookEndpoint = "https://mtxmbjuqttztdsadkigl.supabase.co/functions/v1/facebook-lead-webhook";

    const [form, setForm] = useState({
        lead_name: "",
        phone: "",
        gmail: "",
        service_interested: "",
        notes: "",
        lead_status: "new",
        next_follow_up_date: "",
        probability: 50,
        quotation_no: "",
        value: 0,
        outstanding_value: 0,
        first_contact_date: new Date().toISOString().split("T")[0],
    });

    const { data: records = [], isLoading } = useQuery({
        queryKey: ["lead_tracking", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from("lead_tracking")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as LeadTrackingRecord[];
        },
        enabled: !!user,
    });

    // Fetch Meta Lead Integration Config
    const { data: metaConfig } = useQuery({
        queryKey: ["facebook_lead_configs", user?.id],
        queryFn: async () => {
            if (!user) return null;
            const { data, error } = await supabase
                .from("facebook_lead_configs")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) return null;
            if (data) {
                setMetaForm({
                    page_id: data.page_id || "",
                    page_name: data.page_name || "",
                    page_access_token: data.page_access_token || "",
                    verify_token: data.verify_token || "zenjourney_meta_lead_verify_token_2026"
                });
            }
            return data;
        },
        enabled: !!user,
    });

    const saveMetaConfigMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Unauthenticated");
            const payload = {
                user_id: user.id,
                page_id: metaForm.page_id,
                page_name: metaForm.page_name || "Facebook Ads Page",
                page_access_token: metaForm.page_access_token,
                verify_token: metaForm.verify_token,
                is_active: true,
            };

            if (metaConfig?.id) {
                const { error } = await supabase
                    .from("facebook_lead_configs")
                    .update(payload)
                    .eq("id", metaConfig.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("facebook_lead_configs")
                    .insert([payload]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["facebook_lead_configs"] });
            toast.success("Meta Lead Ads Integration settings saved!");
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to save Meta configuration");
        }
    });

    const handleImportMetaLead = async () => {
        if (!metaTestLeadId) {
            toast.error("Please enter a Meta Leadgen ID");
            return;
        }
        setIsTestingLead(true);
        try {
            const token = metaForm.page_access_token || metaConfig?.page_access_token;
            let leadName = "Meta Lead " + metaTestLeadId.slice(-6);
            let phone = "";
            let email = "";
            let serviceInterested = "Facebook Lead Ads";
            let apiNotice = "";

            if (token) {
                try {
                    let graphRes = await fetch(`https://graph.facebook.com/v26.0/${metaTestLeadId}?access_token=${token}`);
                    let data = await graphRes.json();

                    if (data.error) {
                        graphRes = await fetch(`https://graph.facebook.com/v19.0/${metaTestLeadId}?access_token=${token}`);
                        data = await graphRes.json();
                    }

                    if (data.error) {
                        console.warn("Meta Graph API Notice:", data.error);
                        apiNotice = data.error.message || "Permissions required for auto-field mapping";
                    } else if (data.field_data) {
                        for (const f of data.field_data) {
                            const fname = (f.name || "").toLowerCase();
                            const val = Array.isArray(f.values) ? f.values[0] : f.values;
                            if (fname.includes("full_name") || fname.includes("name")) leadName = val;
                            else if (fname.includes("email")) email = val;
                            else if (fname.includes("phone")) phone = val;
                            else if (fname.includes("service") || fname.includes("product")) serviceInterested = val;
                        }
                    }
                } catch (fetchErr) {
                    console.warn("Meta fetch error:", fetchErr);
                }
            }

            const { error: insErr } = await supabase.from("lead_tracking").insert([{
                user_id: user?.id,
                lead_name: leadName,
                phone: phone || null,
                gmail: email || null,
                service_interested: serviceInterested,
                notes: `Imported from Meta Ads Manager (Lead ID: ${metaTestLeadId})${apiNotice ? ` - [Note: ${apiNotice}]` : ''}`,
                lead_status: "new",
                probability: 60,
                value: 0,
                outstanding_value: 0,
                first_contact_date: new Date().toISOString().split("T")[0],
            }]);

            if (insErr) throw insErr;

            queryClient.invalidateQueries({ queryKey: ["lead_tracking"] });
            toast.success(`Lead created for Meta ID: ${metaTestLeadId}`);
            setMetaTestLeadId("");
        } catch (err: any) {
            toast.error(err.message || "Error importing Meta lead");
        } finally {
            setIsTestingLead(false);
        }
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Unauthenticated");
            const payload = {
                user_id: user.id,
                lead_name: form.lead_name,
                phone: form.phone || null,
                gmail: form.gmail || null,
                service_interested: form.service_interested || null,
                notes: form.notes || null,
                lead_status: form.lead_status as any,
                next_follow_up_date: form.next_follow_up_date || null,
                probability: Number(form.probability) || 0,
                quotation_no: form.quotation_no || null,
                value: Number(form.value) || 0,
                outstanding_value: Number(form.outstanding_value) || 0,
                first_contact_date: form.first_contact_date || null,
            };

            if (editingRecord) {
                const { error } = await supabase
                    .from("lead_tracking")
                    .update(payload)
                    .eq("id", editingRecord.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("lead_tracking")
                    .insert([payload]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead_tracking"] });
            toast.success(editingRecord ? "Lead updated successfully" : "New lead added");
            handleClose();
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to save lead");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("lead_tracking").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead_tracking"] });
            toast.success("Lead deleted successfully");
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to delete lead");
        }
    });

    const handleOpen = (record?: LeadTrackingRecord) => {
        if (record) {
            setEditingRecord(record);
            setForm({
                lead_name: record.lead_name,
                phone: record.phone || "",
                gmail: record.gmail || "",
                service_interested: record.service_interested || "",
                notes: record.notes || "",
                lead_status: record.lead_status,
                next_follow_up_date: record.next_follow_up_date || "",
                probability: record.probability,
                quotation_no: record.quotation_no || "",
                value: record.value,
                outstanding_value: record.outstanding_value,
                first_contact_date: record.first_contact_date || "",
            });
        } else {
            setEditingRecord(null);
            setForm({
                lead_name: "",
                phone: "",
                gmail: "",
                service_interested: "",
                notes: "",
                lead_status: "new",
                next_follow_up_date: "",
                probability: 50,
                quotation_no: "",
                value: 0,
                outstanding_value: 0,
                first_contact_date: new Date().toISOString().split("T")[0],
            });
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditingRecord(null);
    };

    const filteredRecords = records.filter(r =>
        r.lead_name.toLowerCase().includes(search.toLowerCase()) ||
        (r.gmail && r.gmail.toLowerCase().includes(search.toLowerCase())) ||
        (r.lead_id_code && r.lead_id_code.toLowerCase().includes(search.toLowerCase())) ||
        (r.service_interested && r.service_interested.toLowerCase().includes(search.toLowerCase())) ||
        (r.notes && r.notes.toLowerCase().includes(search.toLowerCase()))
    );

    const totalPipelineValue = records.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
    const wonLeadsCount = records.filter(r => r.lead_status === "won").length;
    const totalOutstanding = records.reduce((acc, curr) => acc + (Number(curr.outstanding_value) || 0), 0);

    const getLeadStatusBadge = (status: string) => {
        switch (status) {
            case "won": return <Badge className="bg-emerald-600 text-white">Won</Badge>;
            case "lost": return <Badge className="bg-red-600 text-white">Lost</Badge>;
            case "negotiation": return <Badge className="bg-purple-500 text-white">Negotiation</Badge>;
            case "proposal_sent": return <Badge className="bg-blue-500 text-white">Proposal Sent</Badge>;
            case "qualified": return <Badge className="bg-indigo-500 text-white">Qualified</Badge>;
            case "contacted": return <Badge className="bg-amber-500 text-white">Contacted</Badge>;
            case "new": default: return <Badge variant="secondary">New</Badge>;
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Lead Tracking</h1>
                    <p className="text-sm text-muted-foreground">Track prospective sales leads, automated Meta Ads lead ingestion, follow-ups, and deal values.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setMetaModalOpen(true)} className="gap-2 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50">
                        <Zap className="h-4 w-4 text-blue-500 fill-blue-500" /> Meta Ads Manager Auto-Leads
                    </Button>
                    <Button onClick={() => handleOpen()} className="gap-2 shadow-sm">
                        <Plus className="h-4 w-4" /> Add Lead
                    </Button>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-slate-900 text-white">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Pipeline Leads</CardTitle>
                        <UserPlus className="h-4 w-4 text-blue-400" />
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                        <div className="text-2xl font-bold">{records.length}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pipeline Value</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                        <div className="text-2xl font-bold text-emerald-600">₹{totalPipelineValue.toLocaleString("en-IN")}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Won Deals</CardTitle>
                        <Target className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                        <div className="text-2xl font-bold text-blue-600">{wonLeadsCount}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outstanding Value</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                        <div className="text-2xl font-bold text-amber-600">₹{totalOutstanding.toLocaleString("en-IN")}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Table Search & Controls */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search lead name, email, code..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">Showing {filteredRecords.length} leads</p>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                <TableRow>
                                    <TableHead className="w-[110px]">Lead ID</TableHead>
                                    <TableHead>Lead & Contact</TableHead>
                                    <TableHead>Service Interested</TableHead>
                                    <TableHead>Status & Probability</TableHead>
                                    <TableHead>Dates & Follow-up</TableHead>
                                    <TableHead>Source / Notes</TableHead>
                                    <TableHead className="text-right">Deal Value</TableHead>
                                    <TableHead className="text-right">Outstanding</TableHead>
                                    <TableHead className="text-center w-[90px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground mt-2 block">Loading lead tracking data...</span>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredRecords.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                            No lead tracking records found. Click "Add Lead" or configure Meta Ads Integration to get auto-leads.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRecords.map((r) => (
                                        <TableRow key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                            <TableCell className="font-mono text-xs font-semibold text-purple-600">{r.lead_id_code}</TableCell>
                                            <TableCell>
                                                <div className="font-medium text-sm text-slate-900 dark:text-slate-100">{r.lead_name}</div>
                                                {r.gmail && <div className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{r.gmail}</div>}
                                                {r.phone && <div className="text-xs text-slate-400 flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</div>}
                                            </TableCell>
                                            <TableCell className="text-xs font-medium">{r.service_interested || "N/A"}</TableCell>
                                            <TableCell className="space-y-1">
                                                <div>{getLeadStatusBadge(r.lead_status)}</div>
                                                <div className="text-xs text-muted-foreground font-medium">{r.probability}% probability</div>
                                            </TableCell>
                                            <TableCell className="text-xs space-y-0.5">
                                                <div><span className="text-slate-400">First Contact:</span> {r.first_contact_date || "-"}</div>
                                                {r.next_follow_up_date && (
                                                    <div className="text-amber-600 font-medium">
                                                        <span className="text-slate-400">Next Follow-up:</span> {r.next_follow_up_date}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs max-w-[200px] truncate" title={r.notes || ""}>
                                                {r.notes?.includes("Meta") ? (
                                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
                                                        <Zap className="h-3 w-3 mr-1 fill-blue-500 text-blue-500" /> Meta Ads Auto
                                                    </Badge>
                                                ) : (
                                                    r.notes || "-"
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-xs text-emerald-600">₹{Number(r.value).toLocaleString("en-IN")}</TableCell>
                                            <TableCell className="text-right font-semibold text-xs text-amber-600">₹{Number(r.outstanding_value).toLocaleString("en-IN")}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpen(r)}>
                                                        <Edit className="h-4 w-4 text-blue-600" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                                        if (confirm("Are you sure you want to delete this lead tracking record?")) {
                                                            deleteMutation.mutate(r.id);
                                                        }
                                                    }}>
                                                        <Trash2 className="h-4 w-4 text-red-600" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Meta Lead Ads Webhook Setup Dialog */}
            <Dialog open={metaModalOpen} onOpenChange={setMetaModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <Zap className="h-5 w-5 text-blue-600 fill-blue-600" />
                            Meta Ads Manager Automated Lead Ingestion (`adsmanager.facebook.com`)
                        </DialogTitle>
                        <DialogDescription>
                            Automatically capture leads generated from Facebook & Instagram Lead Ads directly into your Lead Tracking table in real-time.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Step 1: Webhook URL */}
                        <div className="bg-slate-900 text-white p-4 rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs uppercase tracking-wider font-bold text-blue-400">Step 1: Copy Webhook Callback URL</Label>
                                <Badge className="bg-blue-500/20 text-blue-300">Live Webhook</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                <Input
                                    readOnly
                                    value={webhookEndpoint}
                                    className="bg-slate-950 border-slate-800 text-xs font-mono text-slate-200"
                                />
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        navigator.clipboard.writeText(webhookEndpoint);
                                        setCopiedUrl(true);
                                        toast.success("Webhook URL copied to clipboard!");
                                        setTimeout(() => setCopiedUrl(false), 2000);
                                    }}
                                >
                                    {copiedUrl ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                                <Label className="text-xs uppercase tracking-wider font-bold text-slate-400">Verify Token</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Input
                                    readOnly
                                    value={metaForm.verify_token}
                                    className="bg-slate-950 border-slate-800 text-xs font-mono text-slate-200"
                                />
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        navigator.clipboard.writeText(metaForm.verify_token);
                                        setCopiedToken(true);
                                        toast.success("Verify Token copied!");
                                        setTimeout(() => setCopiedToken(false), 2000);
                                    }}
                                >
                                    {copiedToken ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                            <p className="text-[11px] text-slate-400">Paste these in <strong>Meta Developers Console &gt; Webhooks &gt; Leadgen</strong>.</p>
                        </div>

                        {/* Step 2: Page Credentials */}
                        <Card className="border border-blue-500/20">
                            <CardHeader className="py-3">
                                <CardTitle className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Step 2: Save Meta Page Access Token</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-semibold">Facebook Page ID</Label>
                                        <Input
                                            placeholder="e.g. 102938475610"
                                            value={metaForm.page_id}
                                            onChange={(e) => setMetaForm({ ...metaForm, page_id: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs font-semibold">Page Name (Optional)</Label>
                                        <Input
                                            placeholder="e.g. ZenJourney Official Page"
                                            value={metaForm.page_name}
                                            onChange={(e) => setMetaForm({ ...metaForm, page_name: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold">Facebook Page Access Token</Label>
                                    <Textarea
                                        placeholder="Paste Meta Page Access Token (EAAB...)"
                                        value={metaForm.page_access_token}
                                        onChange={(e) => setMetaForm({ ...metaForm, page_access_token: e.target.value })}
                                        rows={2}
                                        className="font-mono text-xs"
                                    />
                                    <p className="text-[11px] text-muted-foreground">Required by Meta API to extract lead field details (Name, Phone, Email).</p>
                                </div>

                                <Button
                                    onClick={() => saveMetaConfigMutation.mutate()}
                                    disabled={!metaForm.page_id || !metaForm.page_access_token || saveMetaConfigMutation.isPending}
                                    className="w-full"
                                >
                                    {saveMetaConfigMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Meta Integration Credentials
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Step 3: Test Lead Import */}
                        <Card>
                            <CardHeader className="py-3">
                                <CardTitle className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Step 3: Manual Lead Import / Test ID</CardTitle>
                                <CardDescription className="text-xs">Have a Lead ID from Ads Manager (`adsmanager.facebook.com`)? Enter it below to fetch and auto-import instantly.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="e.g. 109283746501"
                                        value={metaTestLeadId}
                                        onChange={(e) => setMetaTestLeadId(e.target.value)}
                                        className="font-mono"
                                    />
                                    <Button
                                        onClick={handleImportMetaLead}
                                        disabled={!metaTestLeadId || isTestingLead}
                                        variant="secondary"
                                    >
                                        {isTestingLead ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch & Import"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMetaModalOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manual Create / Edit Lead Modal */}
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingRecord ? "Edit Lead Tracking" : "New Lead Record"}</DialogTitle>
                        <DialogDescription>Enter prospective lead details, contact info, win probability, and deal value.</DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Lead Name *</Label>
                            <Input
                                placeholder="e.g. Jane Smith"
                                value={form.lead_name}
                                onChange={(e) => setForm({ ...form, lead_name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">GMail / Email</Label>
                            <Input
                                type="email"
                                placeholder="e.g. jane@example.com"
                                value={form.gmail}
                                onChange={(e) => setForm({ ...form, gmail: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Phone</Label>
                            <Input
                                placeholder="+91 98765 43210"
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Service Interested</Label>
                            <Input
                                placeholder="e.g. Mobile App / Cloud Migration"
                                value={form.service_interested}
                                onChange={(e) => setForm({ ...form, service_interested: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">First Contact Date</Label>
                            <Input
                                type="date"
                                value={form.first_contact_date}
                                onChange={(e) => setForm({ ...form, first_contact_date: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Next Follow-up Date</Label>
                            <Input
                                type="date"
                                value={form.next_follow_up_date}
                                onChange={(e) => setForm({ ...form, next_follow_up_date: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Lead Status</Label>
                            <Select
                                value={form.lead_status}
                                onValueChange={(val) => setForm({ ...form, lead_status: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select lead status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new">New</SelectItem>
                                    <SelectItem value="contacted">Contacted</SelectItem>
                                    <SelectItem value="qualified">Qualified</SelectItem>
                                    <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                                    <SelectItem value="negotiation">Negotiation</SelectItem>
                                    <SelectItem value="won">Won</SelectItem>
                                    <SelectItem value="lost">Lost</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Probability (%)</Label>
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                value={form.probability}
                                onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Quotation No</Label>
                            <Input
                                placeholder="e.g. QT-1002"
                                value={form.quotation_no}
                                onChange={(e) => setForm({ ...form, quotation_no: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Deal Value (₹)</Label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={form.value}
                                onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                            />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                            <Label className="text-xs font-semibold">Outstanding Value (₹)</Label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={form.outstanding_value}
                                onChange={(e) => setForm({ ...form, outstanding_value: Number(e.target.value) })}
                            />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                            <Label className="text-xs font-semibold">Notes & Interaction History</Label>
                            <Textarea
                                placeholder="Add notes about conversations, requirements, or client feedback..."
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={handleClose}>Cancel</Button>
                        <Button
                            onClick={() => saveMutation.mutate()}
                            disabled={!form.lead_name || saveMutation.isPending}
                        >
                            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingRecord ? "Save Changes" : "Create Lead"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
