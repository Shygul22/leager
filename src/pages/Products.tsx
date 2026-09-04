import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Package } from "lucide-react";

type Product = {
    id: string;
    name: string;
    description: string | null;
    rate: number | null;
    gst_rate: number | null;
    hsn_sac_code: string | null;
    type: string | null;
};

const getCurrencySymbol = (currency?: string | null) => {
    switch (currency) {
        case "USD": return "$";
        case "EUR": return "€";
        case "GBP": return "£";
        case "AED": return "AED ";
        default: return "₹";
    }
};

export default function Products() {
    const { user, role, account } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: async () => {
            if (!user) return null;
            const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
            if (error) throw error;
            return data;
        },
        enabled: !!user,
    });

    const formatAmount = (amount: number) => {
        return amount.toLocaleString(profile?.default_currency === "INR" ? "en-IN" : "en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };
    const [form, setForm] = useState<Partial<Product>>({
        name: "", description: "", rate: 0, gst_rate: 0, hsn_sac_code: "", type: "service",
    });

    const { data: products = [], isLoading } = useQuery({
        queryKey: ["products", user?.id, role, account?.id],
        queryFn: async () => {
            if (!user) return [];
            
            let query = supabase.from("products").select("*");
            if (account?.id) {
                query = query.or(`account_id.eq.${account.id},user_id.eq.${user.id}`);
            } else {
                query = query.eq("user_id", user.id);
            }
            
            const { data, error } = await query.order("name", { ascending: true });
            if (error) throw error;
            return data as Product[];
        },
        enabled: !!user,
    });

    const saveProduct = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Not authenticated");
            const payload = {
                name: form.name!,
                description: form.description || null,
                rate: form.rate || 0,
                gst_rate: form.gst_rate || 0,
                hsn_sac_code: form.hsn_sac_code || null,
                type: form.type || "service",
                ...(account?.id ? { account_id: account.id } : {}),
            };

            if (editingId) {
                const { error } = await supabase.from("products").update(payload).eq("id", editingId);
                if (error) throw error;
            } else {
                // Auto-generate HSN if empty
                let finalHsn = payload.hsn_sac_code;
                if (!finalHsn && profile) {
                    const nextSeq = profile.hsn_next_sequence || 1;
                    const prefix = profile.hsn_prefix || "ZEN-";
                    finalHsn = `${prefix}${String(nextSeq).padStart(3, '0')}`;

                    // Increment sequence in profile
                    await supabase.from("profiles")
                        .update({ hsn_next_sequence: nextSeq + 1 })
                        .eq("id", user.id);
                }

                const { error } = await supabase.from("products").insert([{ ...payload, hsn_sac_code: finalHsn, user_id: user.id }]);
                if (error) throw error;
            }
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["products"] });
            queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
            setOpen(false);
            toast.success(editingId ? "Item updated" : "Item created");
        },
        onError: (e) => toast.error(e.message),
    });

    const deleteProduct = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("products").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["products"] });
            toast.success("Item deleted");
        },
        onError: (e) => toast.error(e.message),
    });

    const openCreate = () => {
        setEditingId(null);
        setForm({ name: "", description: "", rate: 0, gst_rate: 0, hsn_sac_code: "", type: "service" });
        setOpen(true);
    };

    const openEdit = (p: Product) => {
        setEditingId(p.id);
        setForm({ ...p });
        setOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Service Catalog</h1>
                <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>M/N / Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>HSN/SAC Code</TableHead>
                                <TableHead className="text-right">Default Rate</TableHead>
                                <TableHead className="text-right">GST %</TableHead>
                                <TableHead className="w-24 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                            ) : products.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                                        <Package className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                                        No services or products found. Add items to your catalog to quickly insert them into invoices.
                                    </TableCell>
                                </TableRow>
                            ) : products.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <div className="font-medium">{p.name}</div>
                                        {p.description && <div className="text-xs text-muted-foreground line-clamp-1">{p.description}</div>}
                                    </TableCell>
                                    <TableCell className="capitalize">{p.type}</TableCell>
                                    <TableCell className="font-mono text-sm">{p.hsn_sac_code || "-"}</TableCell>
                                    <TableCell className="text-right font-medium">
                                        {getCurrencySymbol(profile?.default_currency)}
                                        {formatAmount(Number(p.rate || 0))}
                                    </TableCell>
                                    <TableCell className="text-right">{p.gst_rate}%</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                                        {(role === "admin" || role === "accounts_manager") && (
                                            <Button variant="ghost" size="icon" onClick={() => deleteProduct.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Item" : "New Item"}</DialogTitle>
                        <DialogDescription className="sr-only">Add a product or service to your catalog.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <Label>Item Name *</Label>
                                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Web Development" />
                            </div>
                            <div>
                                <Label>Type</Label>
                                <Select value={form.type || "service"} onValueChange={(v) => setForm({ ...form, type: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="service">Service</SelectItem>
                                        <SelectItem value="product">Product</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>HSN/SAC Code</Label>
                                <Input value={form.hsn_sac_code || ""} onChange={e => setForm({ ...form, hsn_sac_code: e.target.value })} placeholder="Optional" />
                            </div>
                            <div className="col-span-2">
                                <Label>Description</Label>
                                <Textarea value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Detailed description to show on invoices..." />
                            </div>
                            <div>
                                <Label>Default Rate</Label>
                                <Input type="number" step="0.01" value={form.rate || ""} onChange={e => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div>
                                <Label>Default GST %</Label>
                                <Select value={String(form.gst_rate || 0)} onValueChange={(v) => setForm({ ...form, gst_rate: parseFloat(v) })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {[0, 5, 12, 18, 28].map(rate => <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={() => saveProduct.mutate()} disabled={!form.name || saveProduct.isPending}>
                            {editingId ? "Save Changes" : "Create Item"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
