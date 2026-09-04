import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import EntityDocumentsSection from "@/components/documents/EntityDocumentsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Mail, Phone, MapPin, Edit, Globe, History, Receipt, CheckCircle2, Clock, Search, Eye, TrendingUp, FileText, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Client = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    gstin: string | null;
    msme_number: string | null;
    client_number: string | null;
    currency: string | null;
    created_at: string;
    total_spent?: number;
    paid_amount?: number;
    balance_due?: number;
    total_quotations?: number;
};

export default function Clients() {
    const { user, role, account } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [historyClient, setHistoryClient] = useState<Client | null>(null);
    const [previewClient, setPreviewClient] = useState<Client | null>(null);
    const [search, setSearch] = useState("");

    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        address: "",
        gstin: "",
        msme_number: "",
        client_number: "",
        currency: "INR"
    });

    const { data: transactions = [] } = useQuery({
        queryKey: ["transactions", user?.id, role, account?.id],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("transactions").select("*");
            if (account?.id) {
                query = query.or(`account_id.eq.${account.id},user_id.eq.${user.id}`);
            } else {
                query = query.eq("user_id", user.id);
            }
            const { data, error } = await query.order("date", { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!user && !!role,
    });

    const { data: invoices = [] } = useQuery({
        queryKey: ["invoices", user?.id, role, account?.id],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("invoices").select("*, invoice_items(*)");
            if (account?.id) {
                query = query.or(`account_id.eq.${account.id},user_id.eq.${user.id}`);
            } else {
                query = query.eq("user_id", user.id);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
        enabled: !!user && !!role,
    });

    const { data: quotations = [] } = useQuery({
        queryKey: ["quotations", user?.id, role, account?.id],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("quotations").select("*, quotation_items(*)");
            if (account?.id) {
                query = query.or(`account_id.eq.${account.id},user_id.eq.${user.id}`);
            } else {
                query = query.eq("user_id", user.id);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
        enabled: !!user && !!role,
    });

    const { data: clients = [], isLoading } = useQuery({
        queryKey: ["clients", user?.id, role, account?.id],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("clients").select("*");
            if (account?.id) {
                query = query.or(`account_id.eq.${account.id},user_id.eq.${user.id}`);
            } else {
                query = query.eq("user_id", user.id);
            }
            
            const { data: clientsData, error: clientsError } = await query;

            if (clientsError) throw clientsError;

            // Sort naturally by client_number, fallback to name, empty/null IDs go to the end
            const sortedClients = (clientsData as Client[]).sort((a, b) => {
                const idA = a.client_number?.trim() || "";
                const idB = b.client_number?.trim() || "";
                if (!idA && !idB) return a.name.localeCompare(b.name);
                if (!idA) return 1;
                if (!idB) return -1;
                return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
            });

            // 2. Map spend and quotations to clients
            return sortedClients.map(client => {
                const clientInvoices = (invoices || []).filter(inv => 
                    (inv.client_id === client.id || 
                    (inv.client_name?.trim().toLowerCase() === client.name?.trim().toLowerCase())) &&
                    inv.status !== "draft" && inv.status !== "cancelled"
                );
                
                const totalSpent = clientInvoices.reduce((sum, inv) => {
                    const subtotal = (inv.invoice_items as any[] || []).reduce((s, i) => 
                        s + (i.quantity * i.rate), 0
                    );
                    const discountPercentage = inv.discount_percentage || 0;
                    const discountAmount = subtotal * (discountPercentage / 100);
                    const totalWithDiscount = subtotal - discountAmount;
                    return sum + totalWithDiscount;
                }, 0);

                const clientTxs = (transactions || []).filter(t => 
                    t.client_id === client.id || 
                    (t.description && t.description.toLowerCase().includes(client.name.toLowerCase()))
                );

                // Calculate paid amount by checking each invoice and its corresponding transactions
                const invoiceTxPaidAmount = clientInvoices.reduce((sum, inv) => {
                    const invTxSum = clientTxs
                        .filter(t => t.type === "income" && 
                            t.description && 
                            t.description.includes(inv.invoice_number) &&
                            !t.description.startsWith("Invoice ")
                        )
                        .reduce((s, t) => s + (t.amount || 0), 0);
                    return sum + Math.max(inv.paid_amount || 0, invTxSum);
                }, 0);
                
                // Plus any general payments not linked to a specific invoice
                const generalPayments = clientTxs
                    .filter(t => t.type === "income" && 
                        !t.description?.startsWith("Invoice ") && 
                        !clientInvoices.some(inv => t.description && t.description.includes(inv.invoice_number))
                    )
                    .reduce((s, t) => s + (t.amount || 0), 0);
                
                const paidAmount = invoiceTxPaidAmount + generalPayments;

                // Invoice total WITH GST (to deduct from quotation balance)
                const totalSpentWithGST = clientInvoices.reduce((sum, inv) => {
                    const subtotal = (inv.invoice_items as any[] || []).reduce((s, i) =>
                        s + (i.quantity * i.rate * (1 + (i.gst || 0) / 100)), 0
                    );
                    const discountPercentage = inv.discount_percentage || 0;
                    const discountAmount = subtotal * (discountPercentage / 100);
                    return sum + (subtotal - discountAmount);
                }, 0);

                // Pending = all active quotations (sent, accepted, invoiced — excludes only draft/rejected)
                const clientQuotations = (quotations || []).filter(q => 
                    (q.client_id === client.id || 
                    (q.client_name?.trim().toLowerCase() === client.name?.trim().toLowerCase())) &&
                    q.status !== "draft" && q.status !== "rejected"
                );

                const totalQuotations = clientQuotations.reduce((sum, q) => {
                    const subtotal = (q.quotation_items as any[] || []).reduce((s, i) => 
                        s + (i.quantity * i.rate), 0
                    );
                    const discountPercentage = q.discount_percentage || 0;
                    const discountAmount = subtotal * (discountPercentage / 100);
                    const totalWithDiscount = subtotal - discountAmount;
                    return sum + totalWithDiscount;
                }, 0);

                // All quotations excluding rejected/draft
                const allClientQuotations = (quotations || []).filter(q => 
                    (q.client_id === client.id || 
                    (q.client_name?.trim().toLowerCase() === client.name?.trim().toLowerCase())) &&
                    q.status !== "rejected" && q.status !== "draft"
                );

                const totalAllQuotationsVal = allClientQuotations.reduce((sum, q) => {
                    const subtotal = (q.quotation_items as any[] || []).reduce((s, i) => 
                        s + (i.quantity * i.rate), 0
                    );
                    const discountPercentage = q.discount_percentage || 0;
                    const discountAmount = subtotal * (discountPercentage / 100);
                    const totalWithDiscount = subtotal - discountAmount;
                    return sum + totalWithDiscount;
                }, 0);

                // GST-inclusive total for all active quotations
                const totalAllQuotationsWithGST = allClientQuotations.reduce((sum, q) => {
                    const subtotal = (q.quotation_items as any[] || []).reduce((s, i) =>
                        s + (i.quantity * i.rate * (1 + (i.gst || 0) / 100)), 0
                    );
                    const discountPercentage = q.discount_percentage || 0;
                    const discountAmount = subtotal * (discountPercentage / 100);
                    return sum + (subtotal - discountAmount);
                }, 0);

                // Remaining Balance = Quotations - Invoiced
                const remaining_balance_with_gst = Math.max(0, totalAllQuotationsWithGST - totalSpentWithGST);
                const remaining_balance_excl_gst = Math.max(0, totalAllQuotationsVal - totalSpent);

                return { 
                    ...client, 
                    total_spent: totalSpent, 
                    paid_amount: paidAmount, 
                    balance_due: totalQuotations, // base excl. GST pending quotations
                    total_quotations: totalAllQuotationsVal, // total quotations represents all active estimates (excluding GST)
                    total_quotations_with_gst: totalAllQuotationsWithGST, // GST-inclusive total for display
                    total_spent_with_gst: totalSpentWithGST, // invoiced with GST
                    remaining_balance_with_gst, // invoiced (incl. tax) minus payments received (from transactions)
                    remaining_balance_excl_gst // invoiced (excl. GST) minus payments received (excl. GST)
                };
            });
        },
        enabled: !!user && !!role && !!invoices && !!quotations && !!transactions,
    });

    const upsertClient = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("User not authenticated");

            const payload = {
                name: form.name,
                email: form.email || null,
                phone: form.phone || null,
                address: form.address || null,
                gstin: form.gstin || null,
                msme_number: form.msme_number || null,
                client_number: form.client_number || null,
                currency: form.currency || "INR",
            };

            if (editingId) {
                // Fetch original client details first
                const { data: originalClient } = await supabase
                    .from("clients")
                    .select("*")
                    .eq("id", editingId)
                    .single();

                const origNum = originalClient?.client_number;
                const origName = originalClient?.name;

                const { error } = await supabase.from("clients").update(payload).eq("id", editingId);
                if (error) throw error;

                // Sync all records matching this Client ID (client_number) if set
                const targetClientNum = payload.client_number || origNum;
                if (targetClientNum) {
                    // Sync other client address book entries with the same ID
                    await supabase.from("clients").update({
                        name: payload.name,
                        email: payload.email,
                        phone: payload.phone,
                        address: payload.address,
                        gstin: payload.gstin,
                        msme_number: payload.msme_number,
                        currency: payload.currency
                    }).eq("client_number", targetClientNum);

                    // Sync all invoices with the same client ID
                    await supabase.from("invoices").update({
                        client_name: payload.name,
                        client_email: payload.email,
                        client_phone: payload.phone,
                        client_address: payload.address,
                        client_gstin: payload.gstin,
                        client_msme_number: payload.msme_number,
                        currency: payload.currency
                    }).eq("client_num", targetClientNum);

                    // Sync all quotations with the same client ID
                    await supabase.from("quotations").update({
                        client_name: payload.name,
                        client_email: payload.email,
                        client_phone: payload.phone,
                        client_address: payload.address,
                        client_gstin: payload.gstin,
                        client_msme_number: payload.msme_number,
                        currency: payload.currency
                    }).eq("client_num", targetClientNum);
                }

                // Additional fallback: Cascade changes to existing invoices using client_id
                await supabase.from("invoices").update({
                    client_name: payload.name,
                    client_email: payload.email,
                    client_phone: payload.phone,
                    client_address: payload.address,
                    client_gstin: payload.gstin,
                    client_msme_number: payload.msme_number,
                    client_num: payload.client_number,
                    currency: payload.currency
                }).eq("client_id", editingId);

                // Additional fallback: Cascade changes to existing quotations using client_id
                await supabase.from("quotations").update({
                    client_name: payload.name,
                    client_email: payload.email,
                    client_phone: payload.phone,
                    client_address: payload.address,
                    client_gstin: payload.gstin,
                    client_msme_number: payload.msme_number,
                    client_num: payload.client_number,
                    currency: payload.currency
                }).eq("client_id", editingId);

                // Sync transaction descriptions if name changed
                if (origName && payload.name !== origName) {
                    const { data: txs } = await supabase
                        .from("transactions")
                        .select("*")
                        .eq("client_id", editingId);
                    
                    if (txs && txs.length > 0) {
                        for (const tx of txs) {
                            if (tx.description && tx.description.includes(origName)) {
                                const newDesc = tx.description.replace(origName, payload.name);
                                await supabase
                                    .from("transactions")
                                    .update({ description: newDesc })
                                    .eq("id", tx.id);
                            }
                        }
                    }
                }
            } else {
                const { error } = await supabase.from("clients").insert({ ...payload, user_id: user.id });
                if (error) throw error;
            }
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            queryClient.invalidateQueries({ queryKey: ["quotations"] });
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
            setOpen(false);
            setEditingId(null);
            toast.success(editingId ? "Client updated and synced!" : "Client added successfully!");
        },
        onError: (e) => toast.error(e.message),
    });

    const deleteClient = useMutation({
        mutationFn: async (id: string) => {
            // Unlink dependent financial & operational records before deleting client
            try {
                await supabase.from("invoices").update({ client_id: null }).eq("client_id", id);
                await supabase.from("quotations").update({ client_id: null }).eq("client_id", id);
                await supabase.from("transactions").update({ client_id: null }).eq("client_id", id);
                await supabase.from("projects").update({ client_id: null }).eq("client_id", id);
                await supabase.from("tickets").update({ client_id: null }).eq("client_id", id);
            } catch (e) {
                console.warn("Client pre-delete cleanup warning:", e);
            }

            const { error } = await supabase.from("clients").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            toast.success("Client deleted successfully");
        },
        onError: (e) => toast.error(e.message),
    });

    const openCreate = () => {
        setEditingId(null);
        setForm({ name: "", email: "", phone: "", address: "", gstin: "", msme_number: "", client_number: "", currency: "INR" });
        setOpen(true);
    };

    const openEdit = (client: Client) => {
        setEditingId(client.id);
        setForm({
            name: client.name,
            email: client.email || "",
            phone: client.phone || "",
            address: client.address || "",
            gstin: client.gstin || "",
            msme_number: client.msme_number || "",
            client_number: client.client_number || "",
            currency: client.currency || "INR"
        });
        setOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
                    <p className="text-muted-foreground text-sm mt-1">Manage your customer address book for faster invoicing.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search by name, ID or email..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Button onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Add Client
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Client Name</TableHead>
                                <TableHead>Contact Info</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Currency</TableHead>
                                <TableHead>Client No. / Tax IDs</TableHead>
                                <TableHead className="text-right">Total Invoiced <span className="text-[9px] text-muted-foreground font-normal">(excl. GST)</span></TableHead>
                                <TableHead className="text-right">Total Invoiced <span className="text-[9px] text-muted-foreground font-normal">(incl. Tax)</span></TableHead>
                                <TableHead className="text-right">Total Quotations <span className="text-[9px] text-muted-foreground font-normal">(incl. Tax)</span></TableHead>
                                <TableHead className="text-right">Remaining Balance <span className="text-[9px] text-muted-foreground font-normal">(excl. GST)</span></TableHead>
                                <TableHead className="text-right">Remaining Balance <span className="text-[9px] text-muted-foreground font-normal">(incl. Tax)</span></TableHead>
                                <TableHead className="w-32 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(() => {
                                const filteredClients = clients.filter(c => 
                                    c.name.toLowerCase().includes(search.toLowerCase()) ||
                                    c.email?.toLowerCase().includes(search.toLowerCase()) ||
                                    c.client_number?.toLowerCase().includes(search.toLowerCase())
                                );

                                if (filteredClients.length === 0 && clients.length > 0) {
                                    return (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                                                No clients found matching "{search}"
                                            </TableCell>
                                        </TableRow>
                                    );
                                }

                                if (clients.length === 0) {
                                    return (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                                                {isLoading ? "Loading clients..." : "No clients found. Click 'Add Client' to build your CRM."}
                                            </TableCell>
                                        </TableRow>
                                    );
                                }

                                return filteredClients.map((client) => (
                                    <TableRow key={client.id}>
                                        <TableCell className="font-medium">{client.name}</TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                {client.email && (
                                                    <div className="flex items-center text-sm text-muted-foreground">
                                                        <Mail className="h-3 w-3 mr-1.5" /> {client.email}
                                                    </div>
                                                )}
                                                {client.phone && (
                                                    <div className="flex items-center text-sm text-muted-foreground">
                                                        <Phone className="h-3 w-3 mr-1.5" /> {client.phone}
                                                    </div>
                                                )}
                                                {!client.email && !client.phone && <span className="text-muted-foreground text-xs italic">No contact info</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {client.address ? (
                                                <div className="flex items-start text-sm text-muted-foreground max-w-[200px] truncate">
                                                    <MapPin className="h-3 w-3 mr-1.5 mt-0.5 shrink-0" />
                                                    <span className="truncate">{client.address}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs italic">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">{client.currency || "INR"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1 text-sm">
                                                {client.client_number && <div><span className="font-semibold text-xs uppercase text-muted-foreground mr-1">ID:</span>{client.client_number}</div>}
                                                {client.gstin && <div><span className="font-semibold text-xs uppercase text-muted-foreground mr-1">GST:</span>{client.gstin}</div>}
                                                {client.msme_number && <div><span className="font-semibold text-xs uppercase text-muted-foreground mr-1">MSME:</span>{client.msme_number}</div>}
                                                {!client.client_number && !client.gstin && !client.msme_number && <span className="text-muted-foreground text-xs italic">-</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="font-bold text-slate-900">
                                                {client.currency || "INR"} {client.total_spent?.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="font-bold text-slate-800">
                                                {client.currency || "INR"} {(client as any).total_spent_with_gst?.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="font-bold text-violet-600">
                                                {client.currency || "INR"} {(client as any).total_quotations_with_gst?.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className={`font-bold ${ (client as any).remaining_balance_excl_gst > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                {client.currency || "INR"} {(client as any).remaining_balance_excl_gst?.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className={`font-bold text-lg ${ (client as any).remaining_balance_with_gst > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {client.currency || "INR"} {(client as any).remaining_balance_with_gst?.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">
                                                {(client as any).remaining_balance_with_gst > 0 ? "⚠ Balance Pending" : "✓ Settled"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" title="View Client Dashboard" onClick={() => setPreviewClient(client)}>
                                                    <Eye className="h-4 w-4 text-indigo-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" title="Open Client Portal" onClick={() => { sessionStorage.setItem("active_portal_client", JSON.stringify(client)); window.open(`/portal/${client.client_number || client.id}`, '_blank'); }}>
                                                    <Globe className="h-4 w-4 text-blue-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" title="Transaction History" onClick={() => setHistoryClient(client)}>
                                                    <History className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(client)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                {(role === "admin" || role === "accounts_manager") && (
                                                    <Button variant="ghost" size="icon" onClick={() => deleteClient.mutate(client.id)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ));
                            })()}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* ── Admin: Client Dashboard Preview ── */}
            <Dialog open={!!previewClient} onOpenChange={(o) => !o && setPreviewClient(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
                     {previewClient && (() => {
                        // Exclude draft/cancelled invoices from all totals (consistent with CRM table)
                        const cInvoices = invoices.filter(inv => 
                            (inv.client_id === previewClient.id || 
                            (inv.client_name?.trim().toLowerCase() === previewClient.name?.trim().toLowerCase())) &&
                            inv.status !== "draft" && inv.status !== "cancelled"
                        );
                        const cAllInvoices = invoices.filter(inv => 
                            inv.client_id === previewClient.id || 
                            (inv.client_name?.trim().toLowerCase() === previewClient.name?.trim().toLowerCase())
                        );
                        const cQuotations = quotations.filter(q => 
                            (q.client_id === previewClient.id || 
                            (q.client_name?.trim().toLowerCase() === previewClient.name?.trim().toLowerCase())) &&
                            q.status !== "rejected" && q.status !== "draft"
                        );
                        // Pending = sent, accepted, invoiced — excludes only draft/rejected
                        const cPendingQuotations = quotations.filter(q => 
                            (q.client_id === previewClient.id || 
                            (q.client_name?.trim().toLowerCase() === previewClient.name?.trim().toLowerCase())) &&
                            q.status !== "draft" && q.status !== "rejected"
                        );
                        const fmt = (n: number) => n.toLocaleString("en-IN", { style: "currency", currency: previewClient.currency || "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        // Base-only total (no GST) to stay consistent with CRM table
                        const totalValue = cInvoices.reduce((s, inv) => {
                            const base = (inv.invoice_items as any[] || []).reduce((a: number, i: any) => a + i.quantity * i.rate, 0);
                            return s + base * (1 - (inv.discount_percentage || 0) / 100);
                        }, 0);

                        const clientTxs = (transactions || []).filter(t => 
                            t.client_id === previewClient.id || 
                            (t.description && t.description.toLowerCase().includes(previewClient.name.toLowerCase()))
                        );

                        // Calculate paid amount by checking each invoice and its corresponding transactions
                        const invoiceTxPaidAmount = cInvoices.reduce((sum, inv) => {
                            const invTxSum = clientTxs
                                .filter(t => t.type === "income" && 
                                    t.description && 
                                    t.description.includes(inv.invoice_number) &&
                                    !t.description.startsWith("Invoice ")
                                )
                                .reduce((s, t) => s + (t.amount || 0), 0);
                            return sum + Math.max(inv.paid_amount || 0, invTxSum);
                        }, 0);
                        
                        // Plus any general payments not linked to a specific invoice
                        const generalPayments = clientTxs
                            .filter(t => t.type === "income" && 
                                !t.description?.startsWith("Invoice ") && 
                                !cInvoices.some(inv => t.description && t.description.includes(inv.invoice_number))
                            )
                            .reduce((s, t) => s + (t.amount || 0), 0);

                        const totalPaid = invoiceTxPaidAmount + generalPayments;
                        // Total Invoiced WITH GST
                        const totalInvoicedWithGST = cInvoices.reduce((s, inv) => {
                            const base = (inv.invoice_items as any[] || []).reduce((a: number, i: any) => a + i.quantity * i.rate * (1 + (i.gst || 0) / 100), 0);
                            return s + base * (1 - (inv.discount_percentage || 0) / 100);
                        }, 0);
                        // Total Quotations = all non-rejected/draft (base only, excl. GST)
                        const totalQuoteValue = cQuotations.reduce((s, q) => {
                            const base = (q.quotation_items as any[] || []).reduce((a: number, i: any) => a + i.quantity * i.rate, 0);
                            return s + base * (1 - (q.discount_percentage || 0) / 100);
                        }, 0);
                        // Quotations incl. GST
                        const totalQuoteWithGST = cQuotations.reduce((s, q) => {
                            const base = (q.quotation_items as any[] || []).reduce((a: number, i: any) => a + i.quantity * i.rate * (1 + (i.gst || 0) / 100), 0);
                            return s + base * (1 - (q.discount_percentage || 0) / 100);
                        }, 0);
                        // Remaining Balance = Quotations (incl. Tax) - Invoiced (incl. Tax) - Extra Payments
                        const remainingBalanceWithGST = Math.max(0, totalQuoteWithGST - totalInvoicedWithGST - generalPayments);
                        const pending = cAllInvoices.filter(i => i.status !== "paid" && i.status !== "draft");

                        return (
                            <div className="min-h-[400px]">
                                {/* Header */}
                                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-6 py-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-0.5">Admin View — Read Only</p>
                                            <h2 className="text-xl font-extrabold text-white">{previewClient.name}</h2>
                                            <p className="text-blue-200 text-xs mt-0.5">{previewClient.client_number} {previewClient.email && `· ${previewClient.email}`}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="bg-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-bold uppercase tracking-widest print:hidden">Dashboard Preview</div>
                                            <Button variant="outline" size="sm" onClick={() => window.print()} className="bg-white/10 text-white hover:bg-white/20 border-white/20 print:hidden">
                                                <Printer className="h-4 w-4 mr-1.5" /> Print
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 space-y-6">
                                    {/* Stats */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Total Invoiced</p>
                                            <p className="text-xl font-extrabold text-gray-900">{fmt(totalValue)}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{cInvoices.length} invoice{cInvoices.length !== 1 ? 's' : ''} · excl. GST</p>
                                        </div>
                                        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm border-l-4 border-l-blue-400">
                                            <p className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-2">Invoiced (incl. Tax)</p>
                                            <p className="text-xl font-extrabold text-blue-700">{fmt(totalInvoicedWithGST)}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{cInvoices.length} invoice{cInvoices.length !== 1 ? 's' : ''} · +GST deducted</p>
                                        </div>
                                        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm border-l-4 border-l-violet-400">
                                            <p className="text-xs font-bold uppercase tracking-widest text-violet-500 mb-2">Quotations (incl. Tax)</p>
                                            <p className="text-xl font-extrabold text-violet-600">{fmt(totalQuoteWithGST)}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{cQuotations.length} quotation{cQuotations.length !== 1 ? 's' : ''} · +GST</p>
                                        </div>
                                        <div className={`rounded-2xl border p-4 shadow-sm border-l-4 ${ remainingBalanceWithGST > 0 ? 'bg-rose-50 border-rose-300 border-l-rose-500' : 'bg-emerald-50 border-emerald-200 border-l-emerald-500'}`}>
                                            <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${ remainingBalanceWithGST > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>Remaining Balance</p>
                                            <p className={`text-xl font-extrabold ${ remainingBalanceWithGST > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmt(remainingBalanceWithGST)}</p>
                                            <p className={`text-xs mt-0.5 ${ remainingBalanceWithGST > 0 ? 'text-rose-400' : 'text-emerald-500'}`}>
                                                {remainingBalanceWithGST > 0 ? '⚠ Quotations − Invoiced' : '✓ Fully invoiced'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Invoices Table */}
                                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                                        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-bold text-gray-900">Invoices</h3>
                                                <p className="text-xs text-gray-400">{cInvoices.length} total records</p>
                                            </div>
                                            <FileText className="h-4 w-4 text-gray-300" />
                                        </div>
                                        {cInvoices.length === 0 ? (
                                            <div className="p-8 text-center">
                                                <FileText className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                                <p className="text-sm text-gray-400">No invoices found for this client.</p>
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Invoice #</TableHead>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead className="text-right">Amount</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {cAllInvoices.slice(0, 10).map(inv => {
                                                        const base = (inv.invoice_items as any[] || []).reduce((a: number, i: any) => a + i.quantity * i.rate, 0);
                                                        const total = base * (1 - (inv.discount_percentage || 0) / 100);
                                                        return (
                                                            <TableRow key={inv.id}>
                                                                <TableCell className="font-mono text-xs font-bold">{inv.invoice_number}</TableCell>
                                                                <TableCell className="text-xs text-gray-500">{inv.date ? format(new Date(inv.date), "MMM d, yyyy") : "—"}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'draft' ? 'secondary' : 'outline'} className="text-[10px] uppercase">
                                                                        {inv.status}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold text-sm">{fmt(total)}</TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </div>

                                    {/* Quotations Table */}
                                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                                        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-bold text-gray-900">Quotations</h3>
                                                <p className="text-xs text-gray-400">{cQuotations.length} total records</p>
                                            </div>
                                            <TrendingUp className="h-4 w-4 text-gray-300" />
                                        </div>
                                        {cQuotations.length === 0 ? (
                                            <div className="p-8 text-center">
                                                <TrendingUp className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                                <p className="text-sm text-gray-400">No quotations found for this client.</p>
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Quotation #</TableHead>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead className="text-right">Amount</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {cQuotations.slice(0, 10).map(q => {
                                                        const base = (q.quotation_items as any[] || []).reduce((a: number, i: any) => a + i.quantity * i.rate * (1 + (i.gst || 0) / 100), 0);
                                                        const total = base * (1 - (q.discount_percentage || 0) / 100);
                                                        return (
                                                            <TableRow key={q.id}>
                                                                <TableCell className="font-mono text-xs font-bold">{q.quotation_number}</TableCell>
                                                                <TableCell className="text-xs text-gray-500">{q.date ? format(new Date(q.date), "MMM d, yyyy") : "—"}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant={q.status === 'invoiced' ? 'default' : q.status === 'sent' ? 'outline' : 'secondary'} className="text-[10px] uppercase">
                                                                        {q.status}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold text-sm">{fmt(total)}</TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </div>

                                    {/* Quick Info */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {previewClient.phone && (
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Phone className="h-4 w-4 text-gray-400" />
                                                {previewClient.phone}
                                            </div>
                                        )}
                                        {previewClient.address && (
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <MapPin className="h-4 w-4 text-gray-400" />
                                                {previewClient.address}
                                            </div>
                                        )}
                                        {previewClient.gstin && (
                                            <div className="text-sm text-gray-600"><span className="font-bold text-gray-400 text-xs uppercase mr-1">GSTIN:</span>{previewClient.gstin}</div>
                                        )}
                                        {previewClient.msme_number && (
                                            <div className="text-sm text-gray-600"><span className="font-bold text-gray-400 text-xs uppercase mr-1">MSME:</span>{previewClient.msme_number}</div>
                                        )}
                                    </div>

                                    {/* Attached Documents */}
                                    <div className="pt-4 border-t border-slate-800">
                                        <EntityDocumentsSection 
                                            entityId={previewClient.id} 
                                            entityType="client"
                                            title="Client Agreements & KYC"
                                            description="Manage compliance records, onboarding forms, and service contracts for this client."
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* ── Add/Edit Client Dialog ── */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Client" : "Add New Client"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Company / Client Name <span className="text-destructive">*</span></Label>
                            <Input
                                id="name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Acme Corporation"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="billing@acme.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    placeholder="+1 234 567 890"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="client_number">Client ID (Internal)</Label>
                                <Input
                                    id="client_number"
                                    value={form.client_number}
                                    onChange={(e) => setForm({ ...form, client_number: e.target.value })}
                                    placeholder="e.g. ACME-001"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gstin">GSTIN</Label>
                                <Input
                                    id="gstin"
                                    value={form.gstin}
                                    onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                                    placeholder="Optional"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="msme_number">MSME Num</Label>
                                <Input
                                    id="msme_number"
                                    value={form.msme_number}
                                    onChange={(e) => setForm({ ...form, msme_number: e.target.value })}
                                    placeholder="Optional"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="currency">Preferred Currency</Label>
                            <Select
                                value={form.currency}
                                onValueChange={(val) => setForm({ ...form, currency: val })}
                            >
                                <SelectTrigger id="currency">
                                    <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="INR">INR (₹)</SelectItem>
                                    <SelectItem value="USD">USD ($)</SelectItem>
                                    <SelectItem value="EUR">EUR (€)</SelectItem>
                                    <SelectItem value="GBP">GBP (£)</SelectItem>
                                    <SelectItem value="AED">AED (د.إ)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="address">Billing Address</Label>
                            <Textarea
                                id="address"
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                placeholder="Full address for invoices..."
                                className="h-20"
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => upsertClient.mutate()}
                            disabled={upsertClient.isPending || !form.name.trim()}
                        >
                            {upsertClient.isPending ? "Saving..." : "Save Client"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!historyClient} onOpenChange={() => setHistoryClient(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto font-sans">
                    <DialogHeader className="flex flex-row items-center justify-between print:hidden">
                        <div>
                            <DialogTitle className="flex items-center gap-2">
                                <History className="h-5 w-5 text-primary" />
                                Transaction History: {historyClient?.name}
                            </DialogTitle>
                            <DialogDescription>
                                Review all financial exchanges, invoices, and payments for this account.
                            </DialogDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => window.print()} className="shrink-0">
                            <Printer className="h-4 w-4 mr-1.5" /> Print Ledger
                        </Button>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Card className="bg-emerald-50 border-emerald-200">
                                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                                    <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center">
                                        <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Paid Amount
                                    </div>
                                </CardHeader>
                                <CardContent className="py-2 px-4 pb-4">
                                    <div className="text-3xl font-bold tracking-tight text-emerald-700">
                                        <span className="text-sm font-medium mr-1 opacity-70">{historyClient?.currency || "INR"}</span>
                                        {historyClient?.paid_amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="bg-amber-50 border-amber-200">
                                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                                    <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center">
                                        <Clock className="h-3.5 w-3.5 mr-2" /> Balance Due
                                    </div>
                                </CardHeader>
                                <CardContent className="py-2 px-4 pb-4">
                                    <div className="text-3xl font-bold tracking-tight text-amber-700">
                                        <span className="text-sm font-medium mr-1 opacity-70">{historyClient?.currency || "INR"}</span>
                                        {historyClient?.balance_due?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-widest border-l-2 border-primary pl-3">Combined Activity Ledger</h3>
                            </div>
                            <div className="border rounded-xl overflow-hidden shadow-sm bg-card">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
                                            <TableHead className="w-32 font-semibold">Date</TableHead>
                                            <TableHead className="w-24 font-semibold">Type</TableHead>
                                            <TableHead className="font-semibold">Description</TableHead>
                                            <TableHead className="text-right font-semibold">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(() => {
                                            const clientTxs = (transactions as any[] || [])
                                                .filter(t => t.client_id === historyClient?.id);
                                            
                                            const clientInvoices = (invoices as any[] || [])
                                                .filter(inv => inv.client_id === historyClient?.id || inv.client_name === historyClient?.name);

                                            const combined = [
                                                ...clientTxs.map(t => ({ ...t, source: 'transaction' })),
                                                ...clientInvoices.map(inv => ({
                                                    id: inv.id,
                                                    date: inv.date,
                                                    description: `Invoice ${inv.invoice_number}`,
                                                    type: 'income',
                                                    amount: (inv.invoice_items || []).reduce((s: number, i: any) => s + (i.quantity * i.rate * (1 + (i.gst || 0) / 100)), 0),
                                                    source: 'invoice'
                                                }))
                                            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                                            if (combined.length === 0) {
                                                return (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">
                                                            No transaction history found for this client.
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            }

                                            return combined.map((item, idx) => (
                                                <TableRow key={`${item.source}-${item.id}-${idx}`} className="group transition-colors hover:bg-muted/30">
                                                    <TableCell className="text-xs font-medium whitespace-nowrap text-muted-foreground">
                                                        {format(new Date(item.date), "MMM d, yyyy")}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge 
                                                            variant={item.source === 'invoice' ? "secondary" : (item.type === 'income' ? "default" : "destructive")} 
                                                            className="text-[9px] uppercase font-bold px-1.5 py-0 h-4"
                                                        >
                                                            {item.source === 'invoice' ? 'Invoice' : item.type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm font-medium">
                                                        {item.description}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-sm">
                                                        <span className="text-[10px] font-normal text-muted-foreground mr-1">{historyClient?.currency || "INR"}</span>
                                                        {item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                </TableRow>
                                            ));
                                        })()}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="border-t pt-4 print:hidden">
                        <Button variant="outline" onClick={() => setHistoryClient(null)} className="w-full sm:w-auto">Close Ledger</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
