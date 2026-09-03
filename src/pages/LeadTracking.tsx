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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Edit, Search, Loader2, DollarSign, Calendar, Clock, UserPlus, Phone, Mail, FileText, Target, Globe, Copy, Check, Zap, ShieldCheck, FileSpreadsheet, Download, UserCheck, ArrowRightLeft, Eye, Paperclip, History, MessageSquare, Send, Sparkles, Tag, Layers } from "lucide-react";
import { toast } from "sonner";
import EntityDocumentsSection from "@/components/documents/EntityDocumentsSection";
import DocumentUploadModal from "@/components/documents/DocumentUploadModal";

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
    const [sheetModalOpen, setSheetModalOpen] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [copiedToken, setCopiedToken] = useState(false);

    const [editingRecord, setEditingRecord] = useState<LeadTrackingRecord | null>(null);
    const [previewLead, setPreviewLead] = useState<LeadTrackingRecord | null>(null);
    const [uploadLead, setUploadLead] = useState<LeadTrackingRecord | null>(null);
    
    // Activity History Log State
    const [newLogNote, setNewLogNote] = useState("");
    const [newLogStatus, setNewLogStatus] = useState<string>("");
    const [newLogFollowUp, setNewLogFollowUp] = useState<string>("");
    
    const [search, setSearch] = useState("");
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

    // Meta Ads Config State
    const [metaForm, setMetaForm] = useState({
        page_id: "1104650452121764",
        page_name: "ZenJourney Official Meta Ads Page",
        page_access_token: "EAAkFBp3ZAKPsBSXH4mmBaKNUP4k2C5ZBDf0qjtThDo79gE9z3srkiZBVzQ1AezU8wvLfXVVME0pF7DZC3VMDvuYQeT2x0TFZATbYk5NZAfhTBFshqqOL4lSHE6R9Ls9einGHJk6ffT4DJ79WykT8JnZCbGLAChkcw4PdGedWD8418S2FNAxbMZAJQjUkC3GKywkNCwZDZD",
        verify_token: "zenjourney_meta_lead_verify_token_2026"
    });
    const [metaTestLeadId, setMetaTestLeadId] = useState("");
    const [isTestingLead, setIsTestingLead] = useState(false);

    // Google Sheets Import State
    const [sheetUrl, setSheetUrl] = useState("https://docs.google.com/spreadsheets/d/152MTeyvxbjTCj4-tOpGTTPrWm-M31kHclkqy-hwEFWU/edit?usp=sharing");
    const [isSyncingSheet, setIsSyncingSheet] = useState(false);

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
                    page_id: data.page_id || "1104650452121764",
                    page_name: data.page_name || "ZenJourney Official Meta Ads Page",
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

    const handleSyncGoogleSheet = async () => {
        if (!sheetUrl) {
            toast.error("Please enter a valid Google Sheets URL");
            return;
        }
        setIsSyncingSheet(true);
        try {
            const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            const sheetId = match ? match[1] : "";

            const sheetNamesToTry = ["Sheet1", "Sheet2", "Sheet3", "Sheet4", "Leads"];
            let totalInserted = 0;

            for (const sName of sheetNamesToTry) {
                try {
                    let fetchUrl = "";
                    if (sheetId) {
                        fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sName)}`;
                    } else {
                        fetchUrl = sheetUrl.includes("/edit") 
                            ? sheetUrl.replace(/\/edit.*$/, "/export?format=csv") 
                            : sheetUrl;
                    }

                    const res = await fetch(fetchUrl);
                    const text = await res.text();

                    if (!text || text.includes("<!DOCTYPE html") || text.includes("<html")) continue;

                    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
                    if (lines.length <= 1) continue;

                    const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());
                    const rows = lines.slice(1);

                    for (const rowStr of rows) {
                        const rowValues = rowStr.split(",").map(v => v.replace(/^"|"$/g, "").trim());
                        const rowObj: Record<string, string> = {};
                        headers.forEach((h, i) => { rowObj[h] = rowValues[i] || ""; });

                        let leadName = rowObj["full_name"] || rowObj["lead_name"] || rowObj["name"] || "";
                        if (!leadName || leadName.includes("<test lead") || leadName.includes("dummy data")) continue;

                        const email = rowObj["email"] || rowObj["gmail"] || null;
                        const phone = (rowObj["phone_number"] || rowObj["phone"] || "").replace(/^p:/, "") || null;
                        const adName = rowObj["ad_name"] || rowObj["campaign_name"] || "";
                        const formName = rowObj["form_name"] || rowObj["service_interested"] || rowObj["what_type_of_development_are_you_primarily_interested_in?"] || "Google Sheet Lead";
                        const city = rowObj["city"] ? ` - ${rowObj["city"]}` : "";
                        const leadId = rowObj["id"] || rowObj["lead_id"] || "";

                        const payload = {
                            user_id: user?.id,
                            lead_name: leadName,
                            phone: phone,
                            gmail: email,
                            service_interested: formName + city + (adName ? ` (${adName})` : ""),
                            notes: `Imported from Google Sheet [Tab: ${sName}] (Lead ID: ${leadId}, Platform: ${rowObj["platform"] || 'Meta Ads'})`,
                            lead_status: "new",
                            probability: 60,
                            value: 0,
                            outstanding_value: 0,
                            first_contact_date: rowObj["created_time"] ? rowObj["created_time"].split("T")[0] : new Date().toISOString().split("T")[0],
                        };

                        const { error: insErr } = await supabase.from("lead_tracking").insert([payload]);
                        if (!insErr) totalInserted++;
                    }
                } catch (tabErr) {
                    console.warn(`Error reading sheet tab ${sName}:`, tabErr);
                }
            }

            queryClient.invalidateQueries({ queryKey: ["lead_tracking"] });
            if (totalInserted > 0) {
                toast.success(`Successfully imported ${totalInserted} lead(s) across all Google Sheet tabs!`);
            } else {
                toast.info("Sync complete. All leads across tabs are up to date.");
            }
            setSheetModalOpen(false);
        } catch (err: any) {
            toast.error(err.message || "Error syncing Google Sheet");
        } finally {
            setIsSyncingSheet(false);
        }
    };

    // Bulk Delete Mutation
    const bulkDeleteMutation = useMutation({
        mutationFn: async (idsToDelete?: string[]) => {
            const targets = idsToDelete || selectedLeadIds;
            if (targets.length === 0) return;
            const { error } = await supabase.from("lead_tracking").delete().in("id", targets);
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["lead_tracking"] });
            const count = variables ? variables.length : selectedLeadIds.length;
            toast.success(`Deleted ${count} lead record(s)`);
            setSelectedLeadIds([]);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to delete selected leads");
        }
    });

    // Convert / Move Lead(s) to Client Book & Client Tracking
    const convertToClientMutation = useMutation({
        mutationFn: async (leadList: LeadTrackingRecord[]) => {
            if (!user) throw new Error("Unauthenticated");

            for (const lead of leadList) {
                // 1. Insert into public.clients (Client Book)
                const { data: newClient } = await supabase.from("clients").insert([{
                    user_id: user.id,
                    name: lead.lead_name,
                    email: lead.gmail || null,
                    phone: lead.phone || null,
                    notes: lead.notes || "Converted from Lead Tracking",
                    category: "General",
                    status: "active"
                }]).select().maybeSingle();

                // 2. Insert into public.client_tracking
                await supabase.from("client_tracking").insert([{
                    user_id: user.id,
                    client_id: newClient?.id || null,
                    client_name: lead.lead_name,
                    phone: lead.phone || null,
                    service_type: lead.service_interested || "Software Services",
                    project_status: "in_progress",
                    payment_status: "unpaid",
                    total_budget: Number(lead.value) || 0,
                    amount_paid: 0,
                    last_contact_date: new Date().toISOString().split("T")[0]
                }]);

                // 3. Mark lead status as "won"
                await supabase.from("lead_tracking").update({ lead_status: "won" }).eq("id", lead.id);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lead_tracking"] });
            queryClient.invalidateQueries({ queryKey: ["client_tracking"] });
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            toast.success("Lead(s) moved to Client Book & Client Tracking!");
            setSelectedLeadIds([]);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to convert lead(s)");
        }
    });

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
            toast.success("Lead tracking record deleted.");
            queryClient.invalidateQueries({ queryKey: ["lead_tracking"] });
        },
        onError: (err) => toast.error("Failed to delete record: " + (err as Error).message),
    });

    // Mutation to add Interaction / Follow-up History Log
    const addActivityLogMutation = useMutation({
        mutationFn: async () => {
            if (!previewLead || !newLogNote.trim()) return;
            const timestamp = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
            const logHeader = `[${timestamp}] ${user?.email?.split('@')[0] || "User"}: ${newLogNote.trim()}`;
            const updatedNotes = previewLead.notes 
                ? `${logHeader}\n\n${previewLead.notes}` 
                : logHeader;

            const updatePayload: any = { notes: updatedNotes };
            if (newLogStatus) updatePayload.lead_status = newLogStatus;
            if (newLogFollowUp) updatePayload.next_follow_up_date = newLogFollowUp;

            const { error } = await supabase
                .from("lead_tracking")
                .update(updatePayload)
                .eq("id", previewLead.id);

            if (error) throw error;
            return {
                updatedNotes,
                status: newLogStatus || previewLead.lead_status,
                followUp: newLogFollowUp || previewLead.next_follow_up_date
            };
        },
        onSuccess: (res) => {
            if (res && previewLead) {
                setPreviewLead({
                    ...previewLead,
                    notes: res.updatedNotes,
                    lead_status: res.status as any,
                    next_follow_up_date: res.followUp
                });
            }
            setNewLogNote("");
            setNewLogStatus("");
            setNewLogFollowUp("");
            toast.success("Interaction history log added!");
            queryClient.invalidateQueries({ queryKey: ["lead_tracking"] });
        },
        onError: (err) => {
            toast.error("Failed to save interaction log: " + (err as Error).message);
        }
    });

    // Helper to parse notes for metadata badges and history entries
    const parseLeadNotesData = (notesStr: string | null) => {
        if (!notesStr) return { badges: [], historyEntries: [], rawText: "" };

        const badges: { label: string; value: string }[] = [];
        const historyEntries: { timestamp?: string; author?: string; text: string }[] = [];
        const remainingText: string[] = [];

        const lines = notesStr.split("\n");

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            if (line.startsWith("[") && line.includes("]")) {
                const closingIdx = line.indexOf("]");
                const timeStr = line.substring(1, closingIdx);
                const rest = line.substring(closingIdx + 1).trim();
                let author = "Staff";
                let text = rest;
                if (rest.includes(":")) {
                    const [auth, ...txtParts] = rest.split(":");
                    author = auth.trim();
                    text = txtParts.join(":").trim();
                }
                historyEntries.push({ timestamp: timeStr, author, text });
            } else if (line.includes("|")) {
                const parts = line.split("|");
                for (const part of parts) {
                    if (part.includes(":")) {
                        const [k, ...v] = part.split(":");
                        badges.push({ label: k.trim(), value: v.join(":").trim() });
                    }
                }
            } else if (line.includes(":") && (
                line.toLowerCase().startsWith("timeline:") || 
                line.toLowerCase().startsWith("fee:") || 
                line.toLowerCase().startsWith("meta campaign:") ||
                line.toLowerCase().startsWith("platform:")
            )) {
                const [k, ...v] = line.split(":");
                badges.push({ label: k.trim(), value: v.join(":").trim() });
            } else {
                remainingText.push(line);
            }
        }

        return { badges, historyEntries, rawText: remainingText.join("\n") };
    };

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

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedLeadIds(filteredRecords.map(r => r.id));
        } else {
            setSelectedLeadIds([]);
        }
    };

    const handleToggleSelect = (id: string) => {
        setSelectedLeadIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

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
                    <p className="text-sm text-muted-foreground">Track prospective sales leads, automated Meta Ads lead ingestion, Google Sheets sync, follow-ups, and deal values.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" onClick={() => setSheetModalOpen(true)} className="gap-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Google Sheets Sync
                    </Button>
                    <Button variant="outline" onClick={() => setMetaModalOpen(true)} className="gap-2 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50">
                        <Zap className="h-4 w-4 text-blue-500 fill-blue-500" /> Meta Ads Auto-Leads
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

                        {/* Bulk Action Controls */}
                        {selectedLeadIds.length > 0 ? (
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                <span className="text-xs font-semibold px-2 text-slate-700 dark:text-slate-300">
                                    {selectedLeadIds.length} Selected
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        const selectedObjs = records.filter(r => selectedLeadIds.includes(r.id));
                                        convertToClientMutation.mutate(selectedObjs);
                                    }}
                                    disabled={convertToClientMutation.isPending}
                                    className="h-8 text-xs gap-1 border-emerald-500/40 text-emerald-600 hover:bg-emerald-50"
                                >
                                    {convertToClientMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5 text-emerald-600" />}
                                    Move to Client Book & Tracking
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                        if (confirm(`Are you sure you want to delete ${selectedLeadIds.length} selected lead(s)?`)) {
                                            bulkDeleteMutation.mutate();
                                        }
                                    }}
                                    disabled={bulkDeleteMutation.isPending}
                                    className="h-8 text-xs gap-1 bg-red-600 hover:bg-red-700"
                                >
                                    {bulkDeleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                    Bulk Delete ({selectedLeadIds.length})
                                </Button>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">Showing {filteredRecords.length} leads</p>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                <TableRow>
                                    <TableHead className="w-[40px] text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedLeadIds.length === filteredRecords.length && filteredRecords.length > 0}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            className="rounded border-slate-300 h-4 w-4 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                        />
                                    </TableHead>
                                    <TableHead className="w-[110px]">Lead ID</TableHead>
                                    <TableHead>Lead & Contact</TableHead>
                                    <TableHead>Service Interested</TableHead>
                                    <TableHead>Status & Probability</TableHead>
                                    <TableHead>Dates & Follow-up</TableHead>
                                    <TableHead>Source / Notes</TableHead>
                                    <TableHead className="text-right">Deal Value</TableHead>
                                    <TableHead className="text-right">Outstanding</TableHead>
                                    <TableHead className="text-center w-[120px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground mt-2 block">Loading lead tracking data...</span>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredRecords.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                                            No lead tracking records found. Click "Add Lead" or import from Google Sheets / Meta Ads.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRecords.map((r) => {
                                        const isSelected = selectedLeadIds.includes(r.id);
                                        return (
                                            <TableRow key={r.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/30 ${isSelected ? 'bg-purple-50/40 dark:bg-purple-950/20' : ''}`}>
                                                <TableCell className="text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleSelect(r.id)}
                                                        className="rounded border-slate-300 h-4 w-4 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                                    />
                                                </TableCell>
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
                                                            <Zap className="h-3 w-3 mr-1 fill-blue-500 text-blue-500" /> Meta Ads
                                                        </Badge>
                                                    ) : r.notes?.includes("Google Sheet") ? (
                                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                                                            <FileSpreadsheet className="h-3 w-3 mr-1 text-emerald-600" /> Google Sheet
                                                        </Badge>
                                                    ) : (
                                                        r.notes || "-"
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-xs text-emerald-600">₹{Number(r.value).toLocaleString("en-IN")}</TableCell>
                                                <TableCell className="text-right font-semibold text-xs text-amber-600">₹{Number(r.outstanding_value).toLocaleString("en-IN")}</TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                                                            title="View Lead Details & Documents"
                                                            onClick={() => setPreviewLead(r)}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                                                            title="Upload Document for Lead"
                                                            onClick={() => setUploadLead(r)}
                                                        >
                                                            <Paperclip className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                                                            title="Move to Client Book & Client Tracking"
                                                            onClick={() => convertToClientMutation.mutate([r])}
                                                        >
                                                            <UserCheck className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpen(r)} title="Edit Lead">
                                                            <Edit className="h-4 w-4 text-purple-600" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Delete Lead" onClick={() => {
                                                            if (confirm("Are you sure you want to delete this lead tracking record?")) {
                                                                deleteMutation.mutate(r.id);
                                                            }
                                                        }}>
                                                            <Trash2 className="h-4 w-4 text-red-600" />
                                                        </Button>
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

            {/* Google Sheets Sync Dialog */}
            <Dialog open={sheetModalOpen} onOpenChange={setSheetModalOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                            Import Leads from Google Sheets
                        </DialogTitle>
                        <DialogDescription>
                            Paste the link to your public Google Sheet to import lead forms directly into your Lead Tracking database.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Google Sheets Link</Label>
                            <Input
                                placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                                value={sheetUrl}
                                onChange={(e) => setSheetUrl(e.target.value)}
                            />
                            <p className="text-[11px] text-muted-foreground">Make sure link sharing is set to <strong>"Anyone with the link can view"</strong>.</p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSheetModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSyncGoogleSheet} disabled={!sheetUrl || isSyncingSheet} className="bg-emerald-600 hover:bg-emerald-700">
                            {isSyncingSheet && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Sync & Import Leads
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                                        <Label className="text-xs font-semibold">Facebook Page / Dataset ID</Label>
                                        <Input
                                            placeholder="e.g. 1104650452121764"
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
                                        placeholder="Paste Meta Page Access Token (EAAk...)"
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

            {/* View Lead Details & Documents Modal */}
            <Dialog open={!!previewLead} onOpenChange={(open) => !open && setPreviewLead(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {previewLead && (() => {
                        const { badges, historyEntries, rawText } = parseLeadNotesData(previewLead.notes);
                        return (
                            <>
                                <DialogHeader className="border-b pb-4">
                                    <div className="flex items-center justify-between pr-6">
                                        <div>
                                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                                {previewLead.lead_name}
                                                <span className="font-mono text-xs font-semibold text-purple-600 px-2 py-0.5 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 rounded">
                                                    {previewLead.lead_id_code}
                                                </span>
                                            </DialogTitle>
                                            <DialogDescription className="mt-1">
                                                Comprehensive lead profile, contact details, interaction history, and attached documents.
                                            </DialogDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {getLeadStatusBadge(previewLead.lead_status)}
                                        </div>
                                    </div>
                                </DialogHeader>

                                <Tabs defaultValue="overview" className="w-full mt-2">
                                    <TabsList className="grid grid-cols-3 w-full max-w-md">
                                        <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs">
                                            <FileText className="h-3.5 w-3.5" />
                                            Overview & Details
                                        </TabsTrigger>
                                        <TabsTrigger value="history" className="flex items-center gap-1.5 text-xs">
                                            <History className="h-3.5 w-3.5" />
                                            Activity History ({historyEntries.length})
                                        </TabsTrigger>
                                        <TabsTrigger value="documents" className="flex items-center gap-1.5 text-xs">
                                            <Paperclip className="h-3.5 w-3.5" />
                                            Documents
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* TAB 1: OVERVIEW & DETAILS */}
                                    <TabsContent value="overview" className="space-y-6 pt-4">
                                        {/* Quick Stats Grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900 rounded-lg">
                                                <span className="text-xs text-muted-foreground block font-medium">Deal Value</span>
                                                <span className="text-lg font-bold text-emerald-600">₹{Number(previewLead.value).toLocaleString("en-IN")}</span>
                                            </div>
                                            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-lg">
                                                <span className="text-xs text-muted-foreground block font-medium">Outstanding Value</span>
                                                <span className="text-lg font-bold text-amber-600">₹{Number(previewLead.outstanding_value).toLocaleString("en-IN")}</span>
                                            </div>
                                            <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-lg">
                                                <span className="text-xs text-muted-foreground block font-medium">Conversion Probability</span>
                                                <span className="text-lg font-bold text-blue-600">{previewLead.probability}%</span>
                                            </div>
                                            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                                                <span className="text-xs text-muted-foreground block font-medium">Next Follow-up</span>
                                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{previewLead.next_follow_up_date || "Not Scheduled"}</span>
                                            </div>
                                        </div>

                                        {/* Detailed Lead Info Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border">
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                                                    <UserPlus className="h-4 w-4" /> Contact & Interest
                                                </h4>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between border-b pb-1.5">
                                                        <span className="text-muted-foreground">Lead Name:</span>
                                                        <span className="font-semibold">{previewLead.lead_name}</span>
                                                    </div>
                                                    <div className="flex justify-between border-b pb-1.5">
                                                        <span className="text-muted-foreground">Phone Number:</span>
                                                        <span className="font-medium">
                                                            {previewLead.phone ? (
                                                                <a href={`tel:${previewLead.phone}`} className="text-purple-600 hover:underline flex items-center gap-1">
                                                                    <Phone className="h-3 w-3" /> {previewLead.phone}
                                                                </a>
                                                            ) : "N/A"}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between border-b pb-1.5">
                                                        <span className="text-muted-foreground">Email / Gmail:</span>
                                                        <span className="font-medium">
                                                            {previewLead.gmail ? (
                                                                <a href={`mailto:${previewLead.gmail}`} className="text-purple-600 hover:underline flex items-center gap-1">
                                                                    <Mail className="h-3 w-3" /> {previewLead.gmail}
                                                                </a>
                                                            ) : "N/A"}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between pb-1">
                                                        <span className="text-muted-foreground">Service Interested:</span>
                                                        <span className="font-medium text-slate-800 dark:text-slate-200">{previewLead.service_interested || "N/A"}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                                                    <Target className="h-4 w-4" /> Deal Meta & Dates
                                                </h4>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between border-b pb-1.5">
                                                        <span className="text-muted-foreground">First Contact Date:</span>
                                                        <span className="font-medium">{previewLead.first_contact_date || "N/A"}</span>
                                                    </div>
                                                    <div className="flex justify-between border-b pb-1.5">
                                                        <span className="text-muted-foreground">Quotation No:</span>
                                                        <span className="font-mono text-purple-600">{previewLead.quotation_no || "None"}</span>
                                                    </div>
                                                    <div className="flex justify-between border-b pb-1.5">
                                                        <span className="text-muted-foreground">Lead Created Date:</span>
                                                        <span className="font-medium">{new Date(previewLead.created_at).toLocaleDateString("en-IN")}</span>
                                                    </div>
                                                    <div className="flex justify-between pb-1">
                                                        <span className="text-muted-foreground">Lead Source:</span>
                                                        <span className="font-medium text-purple-700 dark:text-purple-300">
                                                            {previewLead.notes?.includes("Meta") ? "Meta Lead Ads" : previewLead.notes?.includes("Google Sheet") ? "Google Sheet Import" : "Manual Entry"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Parsed Requirements & Meta Campaign Card */}
                                        {badges.length > 0 && (
                                            <div className="p-4 bg-purple-50/40 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900 rounded-xl space-y-3">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                                                    <Sparkles className="h-4 w-4 text-purple-600" /> Parsed Requirements & Campaign Metadata
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {badges.map((b, idx) => (
                                                        <Badge key={idx} variant="outline" className="bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-normal border-purple-200 shadow-sm flex items-center gap-1.5">
                                                            <span className="font-semibold text-purple-800 dark:text-purple-300">{b.label}:</span>
                                                            <span className="text-slate-700 dark:text-slate-200">{b.value}</span>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Raw Notes / Interaction History Summary */}
                                        {rawText && (
                                            <div className="p-4 bg-slate-50 dark:bg-slate-900 border rounded-xl space-y-2">
                                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Source / Notes Summary</span>
                                                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                                    {rawText}
                                                </p>
                                            </div>
                                        )}
                                    </TabsContent>

                                    {/* TAB 2: ACTIVITY & INTERACTION HISTORY */}
                                    <TabsContent value="history" className="space-y-6 pt-4">
                                        {/* Log New Interaction Form */}
                                        <Card className="border-purple-200 dark:border-purple-900 bg-purple-50/30 dark:bg-purple-950/10 shadow-sm">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-purple-900 dark:text-purple-200">
                                                    <MessageSquare className="h-4 w-4 text-purple-600" /> Add Follow-up & Interaction Note
                                                </CardTitle>
                                                <CardDescription className="text-xs">
                                                    Record client conversations, call feedback, demo updates, or schedule future follow-ups.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <Textarea
                                                    placeholder="Type follow-up details (e.g. Called client, interested in demo next week, requested quotation)..."
                                                    value={newLogNote}
                                                    onChange={(e) => setNewLogNote(e.target.value)}
                                                    rows={3}
                                                    className="bg-white dark:bg-slate-900 text-xs"
                                                />
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs font-semibold text-slate-600">Update Lead Status (Optional)</Label>
                                                        <Select value={newLogStatus} onValueChange={setNewLogStatus}>
                                                            <SelectTrigger className="bg-white dark:bg-slate-900 text-xs h-9">
                                                                <SelectValue placeholder={`Current: ${previewLead.lead_status}`} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="new">New Lead</SelectItem>
                                                                <SelectItem value="contacted">Contacted</SelectItem>
                                                                <SelectItem value="qualified">Qualified</SelectItem>
                                                                <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                                                                <SelectItem value="negotiation">Negotiation</SelectItem>
                                                                <SelectItem value="won">Won Deal</SelectItem>
                                                                <SelectItem value="lost">Lost</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs font-semibold text-slate-600">Set Next Follow-up Date (Optional)</Label>
                                                        <Input
                                                            type="date"
                                                            value={newLogFollowUp}
                                                            onChange={(e) => setNewLogFollowUp(e.target.value)}
                                                            className="bg-white dark:bg-slate-900 text-xs h-9"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end">
                                                    <Button
                                                        size="sm"
                                                        className="bg-purple-600 hover:bg-purple-700 text-white"
                                                        disabled={!newLogNote.trim() || addActivityLogMutation.isPending}
                                                        onClick={() => addActivityLogMutation.mutate()}
                                                    >
                                                        {addActivityLogMutation.isPending ? (
                                                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                                        ) : (
                                                            <Send className="h-4 w-4 mr-1.5" />
                                                        )}
                                                        Save History Log
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Activity Log Feed */}
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                                <History className="h-4 w-4" /> Activity History Timeline
                                            </h4>
                                            {historyEntries.length === 0 ? (
                                                <div className="text-center py-8 border rounded-xl bg-slate-50/50 dark:bg-slate-900/20 text-muted-foreground text-xs">
                                                    No specific interaction log entries recorded yet. Add your first note above!
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {historyEntries.map((entry, idx) => (
                                                        <div key={idx} className="p-3.5 bg-white dark:bg-slate-900 border rounded-xl shadow-xs space-y-1.5">
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                                                                    <UserCheck className="h-3.5 w-3.5 text-purple-500" />
                                                                    {entry.author || "Team Member"}
                                                                </span>
                                                                {entry.timestamp && (
                                                                    <span className="text-[11px] font-mono text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                                        {entry.timestamp}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed pl-5 border-l-2 border-purple-300">
                                                                {entry.text}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </TabsContent>

                                    {/* TAB 3: DOCUMENTS */}
                                    <TabsContent value="documents" className="pt-4">
                                        <EntityDocumentsSection 
                                            entityId={previewLead.id} 
                                            entityType="lead" 
                                            title="Lead Documents & Attachments" 
                                            description="Upload proposals, requirements, agreement drafts, or KYC documents specific to this lead." 
                                        />
                                    </TabsContent>
                                </Tabs>

                                <DialogFooter className="flex items-center justify-between border-t pt-4">
                                    <div className="flex items-center gap-2">
                                        <Button 
                                            variant="outline" 
                                            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                            onClick={() => {
                                                convertToClientMutation.mutate([previewLead]);
                                                setPreviewLead(null);
                                            }}
                                        >
                                            <UserCheck className="h-4 w-4 mr-2" />
                                            Convert to Client
                                        </Button>
                                        <Button 
                                            variant="outline"
                                            onClick={() => {
                                                handleOpen(previewLead);
                                                setPreviewLead(null);
                                            }}
                                        >
                                            <Edit className="h-4 w-4 mr-2 text-purple-600" />
                                            Edit Lead Details
                                        </Button>
                                    </div>
                                    <Button variant="secondary" onClick={() => setPreviewLead(null)}>
                                        Close
                                    </Button>
                                </DialogFooter>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Direct Document Upload Modal for Lead */}
            {uploadLead && (
                <DocumentUploadModal
                    open={!!uploadLead}
                    onOpenChange={(open) => !open && setUploadLead(null)}
                    onUploadSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ["documents", "lead", uploadLead.id] });
                        queryClient.invalidateQueries({ queryKey: ["all-documents"] });
                        toast.success(`Document uploaded for lead "${uploadLead.lead_name}"`);
                    }}
                    initialEntityType="lead"
                    initialEntityId={uploadLead.id}
                />
            )}
        </div>
    );
}
