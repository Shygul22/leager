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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Mail, Phone, MapPin, Edit, User } from "lucide-react";
import { toast } from "sonner";

type Supplier = {
    id: string;
    name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    gstin: string | null;
    category: string | null;
    created_at: string;
};

export default function Suppliers() {
    const { user, role } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: "",
        contact_name: "",
        email: "",
        phone: "",
        address: "",
        gstin: "",
        category: ""
    });

    const { data: suppliers = [], isLoading } = useQuery({
        queryKey: ["suppliers", user?.id, role],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("suppliers").select("*");
            
            // Hierarchy: All staff see shared company suppliers
            const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
            
            if (!isStaffOrAbove) {
                query = query.eq("user_id", user.id);
            }
            
            const { data, error } = await query.order("name", { ascending: true });

            if (error) throw error;
            return data as Supplier[];
        },
        enabled: !!user,
    });

    const upsertSupplier = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("User not authenticated");

            const payload = {
                name: form.name,
                contact_name: form.contact_name || null,
                email: form.email || null,
                phone: form.phone || null,
                address: form.address || null,
                gstin: form.gstin || null,
                category: form.category || null,
            };

            if (editingId) {
                const { error } = await supabase.from("suppliers").update(payload).eq("id", editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("suppliers").insert({ ...payload, user_id: user.id });
                if (error) throw error;
            }
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["suppliers"] });
            setOpen(false);
            setEditingId(null);
            toast.success(editingId ? "Supplier updated!" : "Supplier added successfully!");
        },
        onError: (e) => toast.error(e.message),
    });

    const deleteSupplier = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("suppliers").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["suppliers"] });
            toast.success("Supplier deleted");
        },
        onError: (e) => toast.error(e.message),
    });

    const openCreate = () => {
        setEditingId(null);
        setForm({ name: "", contact_name: "", email: "", phone: "", address: "", gstin: "", category: "" });
        setOpen(true);
    };

    const openEdit = (supplier: Supplier) => {
        setEditingId(supplier.id);
        setForm({
            name: supplier.name,
            contact_name: supplier.contact_name || "",
            email: supplier.email || "",
            phone: supplier.phone || "",
            address: supplier.address || "",
            gstin: supplier.gstin || "",
            category: supplier.category || ""
        });
        setOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
                    <p className="text-muted-foreground text-sm mt-1">Manage your vendors and service providers.</p>
                </div>
                <Button onClick={openCreate} className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" /> Add Supplier
                </Button>
            </div>

            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    <Table className="min-w-[800px] md:min-w-full">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Supplier Name</TableHead>
                                <TableHead>Contact Person</TableHead>
                                <TableHead>Contact Info</TableHead>
                                <TableHead>Location / GST</TableHead>
                                <TableHead className="w-24 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {suppliers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                                        {isLoading ? "Loading suppliers..." : "No suppliers found. Add your first vendor."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                suppliers.map((supplier) => (
                                    <TableRow key={supplier.id}>
                                        <TableCell className="font-medium">
                                            <div>
                                                {supplier.name}
                                                {supplier.category && <span className="ml-2 text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground uppercase">{supplier.category}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {supplier.contact_name ? (
                                                <div className="flex items-center text-sm">
                                                    <User className="h-3 w-3 mr-1.5 text-muted-foreground" /> {supplier.contact_name}
                                                </div>
                                            ) : <span className="text-muted-foreground text-xs italic">-</span>}
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                {supplier.email && (
                                                    <div className="flex items-center text-sm text-muted-foreground">
                                                        <Mail className="h-3 w-3 mr-1.5" /> {supplier.email}
                                                    </div>
                                                )}
                                                {supplier.phone && (
                                                    <div className="flex items-center text-sm text-muted-foreground">
                                                        <Phone className="h-3 w-3 mr-1.5" /> {supplier.phone}
                                                    </div>
                                                )}
                                                {!supplier.email && !supplier.phone && <span className="text-muted-foreground text-xs italic">No contact info</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                {supplier.address ? (
                                                    <div className="flex items-start text-xs text-muted-foreground max-w-[200px] truncate">
                                                        <MapPin className="h-3 w-3 mr-1.5 mt-0.5 shrink-0" />
                                                        <span className="truncate">{supplier.address}</span>
                                                    </div>
                                                ) : null}
                                                {supplier.gstin && <div className="text-[10px] font-mono text-muted-foreground uppercase">GST: {supplier.gstin}</div>}
                                                {!supplier.address && !supplier.gstin && <span className="text-muted-foreground text-xs italic">-</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(supplier)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                {(role === "admin" || role === "accounts_manager") && (
                                                    <Button variant="ghost" size="icon" onClick={() => deleteSupplier.mutate(supplier.id)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                )}
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
                        <DialogTitle>{editingId ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="name">Supplier / Company Name <span className="text-destructive">*</span></Label>
                                <Input
                                    id="name"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g. AWS, Stationery Shop"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="contact_name">Contact Person</Label>
                                <Input
                                    id="contact_name"
                                    value={form.contact_name}
                                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                                    placeholder="Full name"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="category">Category</Label>
                                <Input
                                    id="category"
                                    value={form.category}
                                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                                    placeholder="e.g. IT, Legal, Rent"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="support@vendor.com"
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
                            <Label htmlFor="address">Address</Label>
                            <Textarea
                                id="address"
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                placeholder="Vendor address..."
                                className="h-20"
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => upsertSupplier.mutate()}
                            disabled={upsertSupplier.isPending || !form.name.trim()}
                        >
                            {upsertSupplier.isPending ? "Saving..." : "Save Supplier"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
