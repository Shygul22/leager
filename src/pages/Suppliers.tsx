import { useState, useMemo } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
    Plus, Trash2, Mail, Phone, MapPin, Edit, User, Banknote, 
    ArrowUpRight, CheckCircle2, Building2, CreditCard, Search, 
    Filter, RefreshCw, Eye, Printer, PieChart, TrendingUp, AlertCircle 
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

import { SupplierExtended, VendorPayout, PayoutStatus, PaymentMethod } from "@/types/supplierPayout";
import SupplierProfileModal from "@/components/suppliers/SupplierProfileModal";
import VendorPayoutCreateModal from "@/components/suppliers/VendorPayoutCreateModal";
import VendorPayoutDetailsModal from "@/components/suppliers/VendorPayoutDetailsModal";

export default function Suppliers() {
    const { user, role } = useAuth();
    const queryClient = useQueryClient();

    // UI state
    const [mainTab, setMainTab] = useState<string>("suppliers");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [methodFilter, setMethodFilter] = useState<string>("all");

    // Modal states
    const [addSupplierOpen, setAddSupplierOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<SupplierExtended | null>(null);

    const [profileModalSupplier, setProfileModalSupplier] = useState<SupplierExtended | null>(null);
    const [profileModalOpen, setProfileModalOpen] = useState(false);

    const [createPayoutOpen, setCreatePayoutOpen] = useState(false);
    const [payoutInitialSupplierId, setPayoutInitialSupplierId] = useState<string | null>(null);

    const [detailsPayout, setDetailsPayout] = useState<VendorPayout | null>(null);
    const [detailsPayoutOpen, setDetailsPayoutOpen] = useState(false);

    // Supplier Form State
    const [supplierForm, setSupplierForm] = useState({
        name: "",
        contact_name: "",
        email: "",
        phone: "",
        address: "",
        gstin: "",
        category: "",
        status: "active" as "active" | "inactive",
        payment_terms: "Net 30",
        bank_name: "",
        account_number: "",
        ifsc_code: "",
        swift_code: "",
        upi_id: "",
        notes: ""
    });

    // Fetch All Suppliers
    const { data: suppliers = [], isLoading: isLoadingSuppliers, error: supplierError, refetch: refetchSuppliers } = useQuery({
        queryKey: ["suppliers", user?.id, role],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("suppliers").select("*");
            const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
            if (!isStaffOrAbove) {
                query = query.eq("user_id", user.id);
            }
            const { data, error } = await query.order("created_at", { ascending: false });
            if (error) throw error;
            return (data || []) as SupplierExtended[];
        },
        enabled: !!user,
    });

    // Fetch All Vendor Payouts
    const { data: payouts = [], isLoading: isLoadingPayouts } = useQuery({
        queryKey: ["vendor-payouts", user?.id, role],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("vendor_payouts").select("*, supplier:suppliers(*)");
            const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
            if (!isStaffOrAbove) {
                query = query.eq("user_id", user.id);
            }
            const { data, error } = await query.order("created_at", { ascending: false });
            if (error) return [];
            return (data || []) as VendorPayout[];
        },
        enabled: !!user,
    });

    // Fetch All Purchase Bills for analytics
    const { data: allBills = [] } = useQuery({
        queryKey: ["all-bills-analytics"],
        queryFn: async () => {
            const { data, error } = await supabase.from("bills").select("*, bill_items(*)");
            if (error) return [];
            return data || [];
        }
    });

    // Add / Edit Supplier Mutation
    const upsertSupplierMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Not authenticated");
            if (!supplierForm.name.trim()) throw new Error("Supplier Name is required");

            const payload = {
                name: supplierForm.name,
                contact_name: supplierForm.contact_name || null,
                email: supplierForm.email || null,
                phone: supplierForm.phone || null,
                address: supplierForm.address || null,
                gstin: supplierForm.gstin || null,
                category: supplierForm.category || null,
                status: supplierForm.status,
                payment_terms: supplierForm.payment_terms || "Net 30",
                bank_name: supplierForm.bank_name || null,
                account_number: supplierForm.account_number || null,
                ifsc_code: supplierForm.ifsc_code || null,
                swift_code: supplierForm.swift_code || null,
                upi_id: supplierForm.upi_id || null,
                notes: supplierForm.notes || null,
            };

            if (editingSupplier) {
                const { error } = await supabase.from("suppliers").update(payload).eq("id", editingSupplier.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("suppliers").insert({ ...payload, user_id: user.id });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["suppliers"] });
            setAddSupplierOpen(false);
            setEditingSupplier(null);
            toast.success(editingSupplier ? "Supplier details updated!" : "New supplier added successfully!");
        },
        onError: (err) => toast.error((err as Error).message),
    });

    // Delete Supplier Mutation (with FK Cascade & Deactivation Fallback)
    const deleteSupplierMutation = useMutation({
        mutationFn: async (id: string) => {
            // 1. Pre-delete cleanup attempt
            try {
                await supabase.from("vendor_payout_audit_logs").delete().eq("supplier_id", id);
                await supabase.from("vendor_payouts").delete().eq("supplier_id", id);
                await supabase.from("bills").update({ supplier_id: null }).eq("supplier_id", id);
            } catch (e) {
                console.warn("Pre-delete cleanup error:", e);
            }

            // 2. Direct supplier deletion
            const { error } = await supabase.from("suppliers").delete().eq("id", id);

            // 3. Fallback to deactivation if FK constraint / 409 conflict blocks hard delete
            if (error) {
                const errStr = JSON.stringify(error);
                if (error.code === "23503" || errStr.includes("foreign key constraint") || errStr.includes("409")) {
                    const { error: softErr } = await supabase.from("suppliers").update({ status: "inactive" }).eq("id", id);
                    if (softErr) throw softErr;
                    return { softDeleted: true };
                }
                throw error;
            }
            return { softDeleted: false };
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ["suppliers"] });
            queryClient.invalidateQueries({ queryKey: ["vendor-payouts"] });
            if (res?.softDeleted) {
                toast.success("Supplier set to Inactive (protected financial payment records preserved)");
            } else {
                toast.success("Supplier deleted successfully");
            }
        },
        onError: (err) => toast.error((err as Error).message),
    });

    // Open Modal Handlers
    const handleOpenCreateSupplier = () => {
        setEditingSupplier(null);
        setSupplierForm({
            name: "",
            contact_name: "",
            email: "",
            phone: "",
            address: "",
            gstin: "",
            category: "",
            status: "active",
            payment_terms: "Net 30",
            bank_name: "",
            account_number: "",
            ifsc_code: "",
            swift_code: "",
            upi_id: "",
            notes: ""
        });
        setAddSupplierOpen(true);
    };

    const handleOpenEditSupplier = (supplier: SupplierExtended) => {
        setEditingSupplier(supplier);
        setSupplierForm({
            name: supplier.name,
            contact_name: supplier.contact_name || "",
            email: supplier.email || "",
            phone: supplier.phone || "",
            address: supplier.address || "",
            gstin: supplier.gstin || "",
            category: supplier.category || "",
            status: supplier.status || "active",
            payment_terms: supplier.payment_terms || "Net 30",
            bank_name: supplier.bank_name || "",
            account_number: supplier.account_number || "",
            ifsc_code: supplier.ifsc_code || "",
            swift_code: supplier.swift_code || "",
            upi_id: supplier.upi_id || "",
            notes: supplier.notes || ""
        });
        setAddSupplierOpen(true);
    };

    const handleOpenPayoutWizard = (supplier?: SupplierExtended) => {
        setPayoutInitialSupplierId(supplier?.id || null);
        setCreatePayoutOpen(true);
    };

    const handleOpenProfileModal = (supplier: SupplierExtended) => {
        setProfileModalSupplier(supplier);
        setProfileModalOpen(true);
    };

    const handleOpenPayoutDetails = (payout: VendorPayout) => {
        setDetailsPayout(payout);
        setDetailsPayoutOpen(true);
    };

    // Filtered Suppliers List
    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(s => {
            const matchesSearch = 
                s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.contact_name && s.contact_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (s.gstin && s.gstin.toLowerCase().includes(searchQuery.toLowerCase()));
            
            const matchesStatus = statusFilter === "all" || s.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [suppliers, searchQuery, statusFilter]);

    // Filtered Payouts List
    const filteredPayouts = useMemo(() => {
        return payouts.filter(p => {
            const sName = p.supplier?.name || "";
            const matchesSearch = 
                p.payout_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                sName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.reference_number && p.reference_number.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesStatus = statusFilter === "all" || p.status === statusFilter;
            const matchesMethod = methodFilter === "all" || p.payment_method === methodFilter;
            return matchesSearch && matchesStatus && matchesMethod;
        });
    }, [payouts, searchQuery, statusFilter, methodFilter]);

    // Financial Analytics Summary Calculations
    const analytics = useMemo(() => {
        const totalBillsSum = allBills.reduce((acc, bill) => {
            const items = bill.bill_items || [];
            const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.rate), 0);
            const gst = items.reduce((s: number, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
            const disc = subtotal * ((bill.discount_percentage || 0) / 100);
            return acc + (subtotal - disc + gst);
        }, 0);

        const totalPayoutsPaidSum = payouts.filter(p => p.status === 'paid').reduce((acc, p) => acc + Number(p.amount), 0);
        const totalBillsPaidSum = allBills.reduce((acc, bill) => acc + (bill.paid_amount || 0), 0);
        const totalPaid = Math.max(totalBillsPaidSum, totalPayoutsPaidSum);
        const outstandingPayable = Math.max(0, totalBillsSum - totalPaid);
        const pendingPayoutsCount = payouts.filter(p => p.status === 'pending' || p.status === 'processing').length;
        const activeCount = suppliers.filter(s => s.status === 'active').length;

        return {
            totalBillsSum,
            totalPaid,
            outstandingPayable,
            pendingPayoutsCount,
            activeCount
        };
    }, [allBills, payouts, suppliers]);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Suppliers & Vendor Payouts</h1>
                    <p className="text-muted-foreground text-sm mt-1">Manage vendor accounts, track outstanding payables, and record payouts.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <Button 
                        onClick={() => handleOpenPayoutWizard()} 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
                    >
                        <Banknote className="mr-2 h-4 w-4" /> Record Vendor Payout
                    </Button>
                    <Button onClick={handleOpenCreateSupplier} variant="outline">
                        <Plus className="mr-2 h-4 w-4" /> Add Supplier
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="bg-muted/20">
                    <CardContent className="p-4">
                        <span className="text-xs font-medium text-muted-foreground">Total Supplier Payable</span>
                        <div className="text-2xl font-extrabold text-foreground mt-1">
                            ₹{analytics.totalBillsSum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1 block">Total purchases recorded</span>
                    </CardContent>
                </Card>

                <Card className="bg-emerald-50/50 border-emerald-200/60 dark:bg-emerald-950/20">
                    <CardContent className="p-4">
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Total Paid</span>
                        <div className="text-2xl font-extrabold text-emerald-600 mt-1">
                            ₹{analytics.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        <span className="text-[10px] text-emerald-600/80 mt-1 block">Cleared payouts & payments</span>
                    </CardContent>
                </Card>

                <Card className="bg-rose-50/50 border-rose-200/60 dark:bg-rose-950/20">
                    <CardContent className="p-4">
                        <span className="text-xs font-medium text-rose-700 dark:text-rose-400">Outstanding Balance</span>
                        <div className="text-2xl font-extrabold text-rose-600 mt-1">
                            ₹{analytics.outstandingPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        <span className="text-[10px] text-rose-600/80 mt-1 block">Net balance due</span>
                    </CardContent>
                </Card>

                <Card className="bg-blue-50/50 border-blue-200/60 dark:bg-blue-950/20">
                    <CardContent className="p-4">
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Active Suppliers</span>
                        <div className="text-2xl font-extrabold text-blue-600 mt-1">
                            {analytics.activeCount} <span className="text-sm font-normal text-muted-foreground">/ {suppliers.length}</span>
                        </div>
                        <span className="text-[10px] text-blue-600/80 mt-1 block">{analytics.pendingPayoutsCount} pending payouts</span>
                    </CardContent>
                </Card>
            </div>

            {/* Main Tabs Workspace */}
            <Tabs value={mainTab} onValueChange={setMainTab} className="w-full space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-2">
                    <TabsList className="bg-muted/40">
                        <TabsTrigger value="suppliers" className="font-semibold">Suppliers Directory ({suppliers.length})</TabsTrigger>
                        <TabsTrigger value="payouts" className="font-semibold">Vendor Payouts ({payouts.length})</TabsTrigger>
                        <TabsTrigger value="analytics" className="font-semibold">Analytics & Trends</TabsTrigger>
                    </TabsList>

                    {/* Filter controls */}
                    {mainTab !== "analytics" && (
                        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder={mainTab === "suppliers" ? "Search suppliers, email, GST..." : "Search Payout #, supplier, Ref..."}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 h-9 text-xs"
                                />
                            </div>

                            {mainTab === "suppliers" ? (
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-28 h-9 text-xs">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : (
                                <>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-28 h-9 text-xs">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Status</SelectItem>
                                            <SelectItem value="paid">Paid</SelectItem>
                                            <SelectItem value="processing">Processing</SelectItem>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Select value={methodFilter} onValueChange={setMethodFilter}>
                                        <SelectTrigger className="w-32 h-9 text-xs">
                                            <SelectValue placeholder="Method" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Methods</SelectItem>
                                            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                            <SelectItem value="UPI">UPI</SelectItem>
                                            <SelectItem value="Cheque">Cheque</SelectItem>
                                            <SelectItem value="Cash">Cash</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Tab 1: Suppliers Directory */}
                <TabsContent value="suppliers">
                    <Card>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table className="min-w-[800px] md:min-w-full text-xs">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Supplier Name</TableHead>
                                        <TableHead>Contact Person</TableHead>
                                        <TableHead>Contact Info</TableHead>
                                        <TableHead>Bank / GST Info</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-36 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingSuppliers ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                                                Loading suppliers directory...
                                            </TableCell>
                                        </TableRow>
                                    ) : supplierError ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-12 text-destructive">
                                                <div className="space-y-2">
                                                    <p className="font-semibold">Unable to load suppliers: {(supplierError as Error).message}</p>
                                                    <Button variant="outline" size="sm" onClick={() => refetchSuppliers()}>
                                                        Retry Fetching
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredSuppliers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                                                No suppliers found matching your filters.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredSuppliers.map((supplier) => (
                                            <TableRow key={supplier.id} className="hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                                            {supplier.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <button 
                                                                onClick={() => handleOpenProfileModal(supplier)}
                                                                className="font-bold text-foreground hover:text-primary transition-colors text-left"
                                                            >
                                                                {supplier.name}
                                                            </button>
                                                            {supplier.category && (
                                                                <span className="ml-2 text-[9px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground uppercase font-semibold">
                                                                    {supplier.category}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {supplier.contact_name ? (
                                                        <div className="flex items-center text-xs">
                                                            <User className="h-3 w-3 mr-1 text-muted-foreground" /> {supplier.contact_name}
                                                        </div>
                                                    ) : <span className="text-muted-foreground italic">-</span>}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-0.5 text-[11px]">
                                                        {supplier.email && <div className="text-muted-foreground truncate max-w-[150px]">{supplier.email}</div>}
                                                        {supplier.phone && <div className="text-muted-foreground font-mono">{supplier.phone}</div>}
                                                        {!supplier.email && !supplier.phone && <span className="text-muted-foreground italic">-</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-0.5 text-[11px]">
                                                        {supplier.bank_name ? (
                                                            <div className="font-semibold">{supplier.bank_name} <span className="font-mono text-muted-foreground font-normal">({supplier.account_number ? `...${supplier.account_number.slice(-4)}` : ''})</span></div>
                                                        ) : null}
                                                        {supplier.gstin && <div className="text-[10px] font-mono text-muted-foreground uppercase">GST: {supplier.gstin}</div>}
                                                        {!supplier.bank_name && !supplier.gstin && <span className="text-muted-foreground italic">No details</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge 
                                                        variant={supplier.status === "active" ? "default" : "secondary"}
                                                        className={supplier.status === "active" ? "bg-emerald-600 text-white text-[10px]" : "text-[10px]"}
                                                    >
                                                        {supplier.status === "active" ? "Active" : "Inactive"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end items-center gap-1">
                                                        <Button 
                                                            variant="outline" 
                                                            size="xs" 
                                                            className="h-7 text-[11px] text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 font-medium"
                                                            onClick={() => handleOpenPayoutWizard(supplier)}
                                                            title="Record Payout"
                                                        >
                                                            <Banknote className="h-3 w-3 mr-1" /> Payout
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-7 w-7"
                                                            onClick={() => handleOpenProfileModal(supplier)}
                                                            title="View Profile"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-7 w-7" 
                                                            onClick={() => handleOpenEditSupplier(supplier)}
                                                            title="Edit Details"
                                                        >
                                                            <Edit className="h-3.5 w-3.5" />
                                                        </Button>
                                                        {(role === "admin" || role === "accounts_manager") && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-7 w-7 text-destructive"
                                                                onClick={() => {
                                                                    if (confirm(`Are you sure you want to delete ${supplier.name}?`)) {
                                                                        deleteSupplierMutation.mutate(supplier.id);
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
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
                </TabsContent>

                {/* Tab 2: Vendor Payouts Hub */}
                <TabsContent value="payouts">
                    <Card>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table className="min-w-[800px] md:min-w-full text-xs">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Payout # / Date</TableHead>
                                        <TableHead>Supplier / Vendor</TableHead>
                                        <TableHead>Method & Ref</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Payout Amount</TableHead>
                                        <TableHead className="w-24 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingPayouts ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                                                Loading vendor payouts...
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredPayouts.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                                                No vendor payouts found matching your filter criteria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredPayouts.map((payout) => (
                                            <TableRow key={payout.id} className="hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-medium">
                                                    <button 
                                                        onClick={() => handleOpenPayoutDetails(payout)}
                                                        className="font-mono font-bold text-emerald-600 hover:underline text-left block"
                                                    >
                                                        {payout.payout_number}
                                                    </button>
                                                    <span className="text-[10px] text-muted-foreground block">{format(parseISO(payout.payment_date), "dd MMM yyyy")}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-bold">{payout.supplier?.name || "Vendor"}</div>
                                                    <div className="text-[10px] text-muted-foreground">{payout.supplier?.category || "Supplier"}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{payout.payment_method}</div>
                                                    <div className="font-mono text-[10px] text-muted-foreground">{payout.reference_number || "No Ref"}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge 
                                                        variant="outline"
                                                        className={
                                                            payout.status === "paid" ? "bg-emerald-500/10 text-emerald-600 border-emerald-300" :
                                                            payout.status === "processing" ? "bg-blue-500/10 text-blue-600 border-blue-300" :
                                                            payout.status === "pending" ? "bg-amber-500/10 text-amber-600 border-amber-300" :
                                                            "bg-rose-500/10 text-rose-600 border-rose-300"
                                                        }
                                                    >
                                                        {payout.status.toUpperCase()}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-extrabold text-emerald-600 text-sm">
                                                    ₹{Number(payout.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-7 text-xs"
                                                        onClick={() => handleOpenPayoutDetails(payout)}
                                                    >
                                                        <Eye className="h-3.5 w-3.5 mr-1" /> Voucher
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 3: Analytics & Trends */}
                <TabsContent value="analytics">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="py-3 px-4 bg-muted/20 border-b">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <PieChart className="h-4 w-4 text-emerald-600" /> Payment Methods Breakdown
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                                {["Bank Transfer", "UPI", "Cheque", "Cash", "Other"].map((method) => {
                                    const methodPayouts = payouts.filter(p => p.payment_method === method);
                                    const sum = methodPayouts.reduce((acc, p) => acc + Number(p.amount), 0);
                                    const percent = analytics.totalPaid > 0 ? (sum / analytics.totalPaid) * 100 : 0;

                                    return (
                                        <div key={method} className="space-y-1">
                                            <div className="flex justify-between text-xs font-semibold">
                                                <span>{method}</span>
                                                <span>₹{sum.toLocaleString("en-IN")} ({percent.toFixed(1)}%)</span>
                                            </div>
                                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.min(100, percent)}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="py-3 px-4 bg-muted/20 border-b">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-blue-600" /> Top Paid Vendors Leaderboard
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                                {suppliers.slice(0, 5).map((sup) => {
                                    const supPayouts = payouts.filter(p => p.supplier_id === sup.id && p.status === 'paid');
                                    const totalPaidToSup = supPayouts.reduce((acc, p) => acc + Number(p.amount), 0);

                                    return (
                                        <div key={sup.id} className="flex items-center justify-between text-xs border-b last:border-0 pb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="h-7 w-7 rounded bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                                                    {sup.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <span className="font-bold block">{sup.name}</span>
                                                    <span className="text-[10px] text-muted-foreground">{sup.category || "Supplier"}</span>
                                                </div>
                                            </div>
                                            <span className="font-extrabold text-emerald-600 text-sm">
                                                ₹{totalPaidToSup.toLocaleString("en-IN")}
                                            </span>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Add / Edit Supplier Dialog Modal */}
            <Dialog open={addSupplierOpen} onOpenChange={setAddSupplierOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingSupplier ? "Edit Supplier Details" : "Add New Supplier"}</DialogTitle>
                        <DialogDescription className="text-xs">
                            Store company info, tax/GST metadata, and settlement bank details.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2 text-xs">
                        {/* Company & Contact */}
                        <div className="space-y-3">
                            <h4 className="font-bold text-foreground border-b pb-1">Vendor & Contact Info</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1 col-span-2">
                                    <Label htmlFor="s-name">Supplier / Company Name <span className="text-destructive">*</span></Label>
                                    <Input 
                                        id="s-name" 
                                        value={supplierForm.name}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                                        placeholder="e.g. AWS Cloud, Office Depot"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="s-contact">Contact Person</Label>
                                    <Input 
                                        id="s-contact" 
                                        value={supplierForm.contact_name}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, contact_name: e.target.value })}
                                        placeholder="Full name"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="s-category">Category</Label>
                                    <Input 
                                        id="s-category" 
                                        value={supplierForm.category}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
                                        placeholder="e.g. IT, Office Supplies, Utility"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="s-email">Email Address</Label>
                                    <Input 
                                        id="s-email" 
                                        type="email"
                                        value={supplierForm.email}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                                        placeholder="vendor@company.com"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="s-phone">Phone Number</Label>
                                    <Input 
                                        id="s-phone" 
                                        value={supplierForm.phone}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                                        placeholder="+91 9876543210"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Tax & Terms */}
                        <div className="space-y-3 border-t pt-3">
                            <h4 className="font-bold text-foreground border-b pb-1">Tax & Payment Terms</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="s-gstin">GSTIN / Tax ID</Label>
                                    <Input 
                                        id="s-gstin" 
                                        value={supplierForm.gstin}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value })}
                                        placeholder="29ABCDE1234F1Z5"
                                        className="font-mono"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="s-terms">Payment Terms</Label>
                                    <Select 
                                        value={supplierForm.payment_terms}
                                        onValueChange={(val) => setSupplierForm({ ...supplierForm, payment_terms: val })}
                                    >
                                        <SelectTrigger id="s-terms">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                                            <SelectItem value="Net 15">Net 15 Days</SelectItem>
                                            <SelectItem value="Net 30">Net 30 Days</SelectItem>
                                            <SelectItem value="Net 60">Net 60 Days</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Bank Details */}
                        <div className="space-y-3 border-t pt-3">
                            <h4 className="font-bold text-foreground border-b pb-1">Settlement Bank Account Details</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="s-bank">Bank Name</Label>
                                    <Input 
                                        id="s-bank" 
                                        value={supplierForm.bank_name}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, bank_name: e.target.value })}
                                        placeholder="HDFC Bank, ICICI Bank"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="s-acc">Account Number</Label>
                                    <Input 
                                        id="s-acc" 
                                        value={supplierForm.account_number}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, account_number: e.target.value })}
                                        placeholder="50100012345678"
                                        className="font-mono"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="s-ifsc">IFSC Code</Label>
                                    <Input 
                                        id="s-ifsc" 
                                        value={supplierForm.ifsc_code}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, ifsc_code: e.target.value })}
                                        placeholder="HDFC0001234"
                                        className="font-mono uppercase"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="s-upi">UPI ID</Label>
                                    <Input 
                                        id="s-upi" 
                                        value={supplierForm.upi_id}
                                        onChange={(e) => setSupplierForm({ ...supplierForm, upi_id: e.target.value })}
                                        placeholder="vendor@upi"
                                        className="font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Address & Notes */}
                        <div className="space-y-3 border-t pt-3">
                            <div className="space-y-1">
                                <Label htmlFor="s-address">Postal / Business Address</Label>
                                <Textarea 
                                    id="s-address" 
                                    value={supplierForm.address}
                                    onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                                    placeholder="Street, City, State, ZIP..."
                                    className="h-16 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="s-notes">Vendor Notes</Label>
                                <Textarea 
                                    id="s-notes" 
                                    value={supplierForm.notes}
                                    onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                                    placeholder="Internal memo..."
                                    className="h-16 text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t pt-3">
                        <Button variant="outline" onClick={() => setAddSupplierOpen(false)}>Cancel</Button>
                        <Button 
                            onClick={() => upsertSupplierMutation.mutate()}
                            disabled={upsertSupplierMutation.isPending || !supplierForm.name.trim()}
                            className="bg-primary text-primary-foreground font-bold"
                        >
                            {upsertSupplierMutation.isPending ? "Saving..." : "Save Supplier"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Supplier 360 Profile Modal */}
            <SupplierProfileModal 
                supplier={profileModalSupplier}
                open={profileModalOpen}
                onOpenChange={setProfileModalOpen}
                onRecordPayout={(sup) => handleOpenPayoutWizard(sup)}
                onEditSupplier={(sup) => handleOpenEditSupplier(sup)}
            />

            {/* Payout Creation Wizard Modal */}
            <VendorPayoutCreateModal 
                open={createPayoutOpen}
                onOpenChange={setCreatePayoutOpen}
                suppliers={suppliers}
                initialSupplierId={payoutInitialSupplierId}
            />

            {/* Payout Details & Printable Voucher Modal */}
            <VendorPayoutDetailsModal 
                payout={detailsPayout}
                open={detailsPayoutOpen}
                onOpenChange={setDetailsPayoutOpen}
            />
        </div>
    );
}
