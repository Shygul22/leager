import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Mail, Phone, MapPin, Edit, Globe, History, Receipt } from "lucide-react";
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
};

export default function Clients() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [historyClient, setHistoryClient] = useState<Client | null>(null);

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

    const { data: clients = [], isLoading } = useQuery({
        queryKey: ["clients", user?.id],
        queryFn: async () => {
            if (!user) return [];
            // 1. Fetch Clients
            const { data: clientsData, error: clientsError } = await supabase
                .from("clients")
                .select("*")
                .eq("user_id", user.id)
                .order("name", { ascending: true });

            if (clientsError) throw clientsError;

            // 2. Fetch Invoices with items to calculate spend
            const { data: invoicesData, error: invoicesError } = await supabase
                .from("invoices")
                .select("*, invoice_items(*)")
                .eq("user_id", user.id);

            if (invoicesError) throw invoicesError;

            // 3. Map spend to clients
            return (clientsData as Client[]).map(client => {
                const clientInvoices = (invoicesData || []).filter(inv => 
                    inv.client_id === client.id || inv.client_name === client.name
                );
                
                const totalSpent = clientInvoices.reduce((sum, inv) => {
                    const invTotal = (inv.invoice_items as any[] || []).reduce((s, i) => 
                        s + (i.quantity * i.rate * (1 + (i.gst || 0) / 100)), 0
                    );
                    return sum + invTotal;
                }, 0);

                return { ...client, total_spent: totalSpent };
            });
        },
        enabled: !!user,
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
                user_id: user.id
            };

            if (editingId) {
                const { error } = await supabase.from("clients").update(payload).eq("id", editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("clients").insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            setOpen(false);
            setEditingId(null);
            toast.success(editingId ? "Client updated!" : "Client added successfully!");
        },
        onError: (e) => toast.error(e.message),
    });

    const deleteClient = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("clients").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            toast.success("Client deleted");
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
                    <p className="text-muted-foreground text-sm mt-1">Manage your customer address book for faster invoicing.</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Add Client
                </Button>
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
                                <TableHead className="text-right">Total Spent</TableHead>
                                <TableHead className="w-32 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {clients.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                                        {isLoading ? "Loading clients..." : "No clients found. Click 'Add Client' to build your CRM."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                clients.map((client) => (
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
                                            <div className="font-bold text-primary">
                                                {client.currency || "INR"} {client.total_spent?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" title="Transaction History" onClick={() => setHistoryClient(client)}>
                                                    <History className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(client)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => deleteClient.mutate(client.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

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
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" />
                            Transaction History: {historyClient?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Review all financial exchanges, invoices, and payments for this account.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Card className="bg-primary/5 border-primary/20">
                                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                                    <div className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center">
                                        <Receipt className="h-3.5 w-3.5 mr-2" /> Total Invoiced
                                    </div>
                                </CardHeader>
                                <CardContent className="py-2 px-4 pb-4">
                                    <div className="text-3xl font-bold tracking-tight">
                                        <span className="text-sm font-medium mr-1 text-muted-foreground">{historyClient?.currency || "INR"}</span>
                                        {historyClient?.total_spent?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
                                            const clientTxs = (queryClient.getQueryData(["transactions", user?.id]) as any[] || [])
                                                .filter(t => t.client_id === historyClient?.id);
                                            
                                            const clientInvoices = (queryClient.getQueryData(["invoices", user?.id]) as any[] || [])
                                                .filter(inv => inv.client_id === historyClient?.id || inv.client_name === historyClient?.name);

                                            const combined = [
                                                ...clientTxs.map(t => ({ ...t, source: 'transaction' })),
                                                ...clientInvoices.map(inv => ({
                                                    id: inv.id,
                                                    date: inv.date,
                                                    description: `Invoice ${inv.invoice_number}`,
                                                    type: 'income',
                                                    amount: (inv.invoice_items || []).reduce((s, i) => s + (i.quantity * i.rate * (1 + (i.gst || 0) / 100)), 0),
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
                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" onClick={() => setHistoryClient(null)} className="w-full sm:w-auto">Close Ledger</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
