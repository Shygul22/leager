import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, isToday, isThisWeek, parseISO } from "date-fns";
import { Plus, Eye, Trash2, X, Edit, Printer, Search, Package } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type InvoiceItem = { id?: string; product_id?: string; description: string; quantity: number; rate: number; gst: number; mrp?: number; discount?: number };
type Invoice = {
  id: string; invoice_number: string; client_id: string | null; client_name: string; client_email: string | null; client_phone: string | null; client_address: string | null; client_gstin: string | null; client_msme_number: string | null; client_num: string | null; client_project_id: string | null; date: string; due_date: string; status: string; notes: string | null; payment_reference: string | null; include_signature: boolean; include_background: boolean; currency: string | null; exchange_rate: number | null; created_at: string;
  discount_percentage?: number;
  paid_amount?: number;
  invoice_items?: InvoiceItem[];
};


// Define Transaction type based on the provided diff's context for transactions
type Transaction = {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  employee_id?: string | null;
  client_id?: string | null;
  created_at: string;
  employees?: { name: string };
  clients?: { name: string };
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

export default function Invoices() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // Renamed from editing to editingId to avoid conflict with Transaction type
  const [selectedRange, setSelectedRange] = useState<string>(format(new Date(), "MMM yyyy"));
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [bulkPreview, setBulkPreview] = useState<Invoice[] | null>(null);
  const [bulkIncludeSignature, setBulkIncludeSignature] = useState(true);
  const [bulkIncludeLogo, setBulkIncludeLogo] = useState(true);
  const [form, setForm] = useState({
    invoice_number: "", client_id: "", client_name: "", client_email: "", client_phone: "", client_address: "", client_gstin: "", client_msme_number: "", client_num: "", client_project_id: "", date: format(new Date(), "yyyy-MM-dd"), due_date: "", notes: "", payment_reference: "", include_signature: true, include_background: true, currency: "INR", exchange_rate: 1,
    discount_percentage: 0,
    paid_amount: 0,
    status: "draft",
    items: [{ description: "", quantity: 1, rate: 0, gst: 0, mrp: 0, discount: 0 }] as InvoiceItem[],
  });


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

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", user?.id, role],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase.from("clients").select("*");
      const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
      if (!isStaffOrAbove) {
        query = query.eq("user_id", user.id);
      }
      const { data, error } = await query.order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // This query was changed in the diff to fetch transactions, but the file is Invoices.tsx.
  // Reverting to fetch invoices as per original context, but keeping the Transaction type definition.
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", user?.id, role],
    queryFn: async () => {
      if (!user) return [];
      // Hierarchy: All staff see shared company invoices
      const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
      let query = supabase.from("invoices").select("*, invoice_items(*)");
      if (!isStaffOrAbove) {
        query = query.eq("user_id", user.id);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Invoice[];
    },
    enabled: !!user && !!role,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", user?.id, role],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase.from("products").select("*");
      const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
      if (!isStaffOrAbove) {
        query = query.eq("user_id", user.id);
      }
      const { data, error } = await query.order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(format(new Date(), "MMM yyyy")); // Ensure current month is always an option
    invoices.forEach((inv: any) => months.add(format(new Date(inv.date), "MMM yyyy")));
    return Array.from(months);
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    if (selectedRange === "all") return invoices;
    if (selectedRange === "today") return invoices.filter((inv: any) => isToday(parseISO(inv.date)));
    if (selectedRange === "this-week") return invoices.filter((inv: any) => isThisWeek(parseISO(inv.date)));
    return invoices.filter((inv: any) => format(new Date(inv.date), "MMM yyyy") === selectedRange);
  }, [invoices, selectedRange]);

  const createInvoice = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const invNum = form.invoice_number;

      const invPayload = {
        invoice_number: invNum, client_id: form.client_id || null, client_name: form.client_name, client_email: form.client_email || null, client_phone: form.client_phone || null, client_address: form.client_address || null, client_gstin: form.client_gstin || null, client_msme_number: form.client_msme_number || null, client_num: form.client_num || null, client_project_id: form.client_project_id || null, date: form.date, due_date: form.due_date, notes: form.notes || null, payment_reference: form.payment_reference || null, include_signature: form.include_signature, include_background: form.include_background, currency: form.currency || "INR", exchange_rate: form.exchange_rate || 1,
        discount_percentage: form.discount_percentage || 0,
        paid_amount: form.paid_amount || 0,
        status: form.status || "draft",
      };


      let invoiceId = editingId;

      if (editingId) {
        // Update existing invoice
        const { error } = await supabase.from("invoices").update(invPayload).eq("id", editingId);
        if (error) throw error;

        // Remove old items to replace with new ones
        await supabase.from("invoice_items").delete().eq("invoice_id", editingId);
      } else {
        // 1. Insert New Invoice
        const { data, error } = await supabase.from("invoices").insert({ ...invPayload, user_id: user.id }).select().single();
        if (error) throw error;
        invoiceId = data.id;

        // 2. Increment Sequence
        const expectedAutoNum = `${profile?.invoice_prefix || "INV-"}${String(profile?.invoice_next_sequence || 1).padStart(3, '0')}`;
        if (invNum === expectedAutoNum && profile) {
          await supabase
            .from("profiles")
            .update({ invoice_next_sequence: (profile.invoice_next_sequence || 1) + 1 })
            .eq("id", user.id);
          queryClient.invalidateQueries({ queryKey: ["profile"] });
        }

        // 4. Auto-save Client to Address Book if it doesn't already exist
        const existingClient = clients.find(c => c.name.toLowerCase() === form.client_name.toLowerCase());
        if (!existingClient) {
          await supabase.from("clients").insert({
            user_id: user.id,
            name: form.client_name,
            email: form.client_email || null,
            phone: form.client_phone || null,
            address: form.client_address || null,
            gstin: form.client_gstin || null,
            msme_number: form.client_msme_number || null,
            client_number: form.client_num || null
          });
          queryClient.invalidateQueries({ queryKey: ["clients"] });
        }

        // 5. Auto-log Transaction to Ledger if enabled
        if (profile?.auto_log_invoices !== false) {
          const invoiceTotal = getTotal(form.items);
          if (invoiceTotal > 0) {
            await supabase.from("transactions").insert({
              user_id: user.id,
              date: form.date,
              description: `Invoice ${invNum} - ${form.client_name}`,
              category: "Sales",
              amount: invoiceTotal,
              type: "income",
              client_id: form.client_id || null
            });
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
          }
        }
      }

      // 3. Insert Invoice Line Items
      const items = form.items.filter((i) => i.description).map((i) => ({ 
        invoice_id: invoiceId, 
        description: i.description, 
        quantity: i.quantity, 
        rate: i.rate, 
        gst: i.gst,
        mrp: i.mrp || 0,
        discount: i.discount || 0
      }));
      if (items.length > 0) {
        const { error: itemErr } = await supabase.from("invoice_items").insert(items);
        if (itemErr) throw itemErr;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoices"] }); setOpen(false); toast.success(editingId ? "Invoice updated" : "Invoice created"); },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
      if (error) throw error;

      // If status changed to "paid", auto-log income transaction for cash flow sync
      if (status === "paid") {
        const inv = invoices.find(i => i.id === id);
        if (inv && user) {
          const total = getTotal(inv.invoice_items, inv.discount_percentage);
          await supabase.from("transactions").insert({
            user_id: user.id,
            date: format(new Date(), "yyyy-MM-dd"),
            description: `Payment Received - Invoice ${inv.invoice_number} - ${inv.client_name}`,
            category: "Sales",
            amount: total,
            type: "income"
          });
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
        }
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Status updated and synced with ledger"); },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Invoice deleted"); },
  });

  const addItem = () => setForm({ ...form, items: [...form.items, { description: "", quantity: 1, rate: 0, gst: 0, mrp: 0, discount: 0 }] });
  const removeItem = (i: number) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i: number, field: keyof InvoiceItem, value: string | number) => {
    const items = [...form.items];
    const item = { ...items[i] } as any;
    item[field] = value;

    if (field === "mrp" || field === "discount") {
      const mrp = field === "mrp" ? Number(value) : (item.mrp || 0);
      const disc = field === "discount" ? Number(value) : (item.discount || 0);
      item.rate = mrp * (1 - disc / 100);
    } else if (field === "rate") {
      const rate = Number(value);
      const mrp = item.mrp || 0;
      if (mrp > 0) {
        item.discount = ((mrp - rate) / mrp) * 100;
      }
    }

    items[i] = item;
    setForm({ ...form, items });
  };

  const handleSelectProduct = (index: number, product: any) => {
    const items = [...form.items];
    items[index] = {
      ...items[index],
      product_id: product.id,
      description: product.name + (product.description ? ` - ${product.description}` : ""),
      rate: Number(product.rate || 0),
      mrp: Number(product.rate || 0),
      discount: 0,
      gst: Number(product.gst_rate || 0)
    };
    setForm({ ...form, items });
  };

  const openCreate = () => {
    setEditingId(null);
    let initialItems = [{ description: "", quantity: 1, rate: 0, gst: 0, mrp: 0, discount: 0 }];

    if (profile?.default_items) {
      try {
        const parsed = typeof profile.default_items === "string"
          ? JSON.parse(profile.default_items)
          : profile.default_items;

        if (Array.isArray(parsed) && parsed.length > 0) {
          initialItems = parsed;
        }
      } catch (e) {
        console.error("Failed to parse default items", e);
      }
    }

    const prefix = profile?.invoice_prefix || "INV-";
    const nextSeq = profile?.invoice_next_sequence || 1;
    const autoNum = `${prefix}${String(nextSeq).padStart(3, '0')}`;

    setForm({
      ...form,
      invoice_number: autoNum,
      client_name: "",
      client_id: "",
      client_email: "",
      client_phone: "",
      client_address: "",
      client_gstin: "",
      client_msme_number: "",
      client_num: "",
      client_project_id: "",
      date: format(new Date(), "yyyy-MM-dd"),
      due_date: "",
      notes: "",
      payment_reference: "",
      include_signature: true,
      include_background: true,
      currency: profile?.default_currency || "INR",
      exchange_rate: 1,
      discount_percentage: 0,
      paid_amount: 0,
      status: "draft",
      items: initialItems
    });
    setOpen(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditingId(inv.id);
    setForm({
      invoice_number: inv.invoice_number,
      client_id: inv.client_id || "",
      client_name: inv.client_name,
      client_email: inv.client_email || "",
      client_phone: inv.client_phone || "",
      client_address: inv.client_address || "",
      client_gstin: inv.client_gstin || "",
      client_msme_number: inv.client_msme_number || "",
      client_num: inv.client_num || "",
      client_project_id: inv.client_project_id || "",
      date: inv.date,
      due_date: inv.due_date,
      notes: inv.notes || "",
      payment_reference: inv.payment_reference || "",
      include_signature: inv.include_signature ?? true,
      include_background: inv.include_background ?? true,
      currency: inv.currency || "INR",
      exchange_rate: inv.exchange_rate || 1,
      discount_percentage: inv.discount_percentage || 0,
      paid_amount: inv.paid_amount || 0,
      status: inv.status || "draft",
      items: inv.invoice_items && inv.invoice_items.length > 0 ? inv.invoice_items.map(i => ({ ...i })) : [{ description: "", quantity: 1, rate: 0, gst: 0, mrp: 0, discount: 0 }],
    });
    setOpen(true);
  };

  const handleSelectClient = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setForm({
        ...form,
        client_id: client.id,
        client_name: client.name,
        client_email: client.email || "",
        client_phone: client.phone || "",
        client_address: client.address || "",
        client_gstin: client.gstin || "",
        client_msme_number: client.msme_number || "",
        client_num: client.client_number || "",
        currency: client.currency || profile?.default_currency || "INR"
      });
    }
  };

    const statusColor = (s: string) => {
      if (s === "paid") return "default";
      if (s === "partially_paid") return "secondary";
      if (s === "sent") return "outline";
      return "outline";
    };

  const getSubtotal = (items?: InvoiceItem[]) => (items || []).reduce((s, i) => s + i.quantity * i.rate, 0);
  const getGSTTotal = (items?: InvoiceItem[], discountPercentage?: number) => {
    const totalGst = (items || []).reduce((s, i) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
    return totalGst * (1 - (discountPercentage || 0) / 100);
  };
  const getTotal = (items?: InvoiceItem[], discountPercentage?: number) => {
    const sub = getSubtotal(items);
    const disc = sub * ((discountPercentage || 0) / 100);
    return (sub - disc) + getGSTTotal(items, discountPercentage);
  };

  const handlePrint = () => {
    const originalTitle = document.title;

    if (preview) {
      const month = format(new Date(preview.date), "MMM_yyyy");
      const clientStr = preview.client_name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      document.title = `Invoice_${preview.invoice_number}_${clientStr}_${month}`;
    } else if (bulkPreview && bulkPreview.length > 0) {
      const month = format(new Date(), "MMM_yyyy");
      document.title = `Bulk_Invoices_${bulkPreview.length}_${month}`;
    }

    // Attach event to restore title after printing
    const handleAfterPrint = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', handleAfterPrint);
    };
    window.addEventListener('afterprint', handleAfterPrint);

    // Short timeout to ensure title updates in DOM before browser print dialog captures it
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(filteredInvoices.map((inv: Invoice) => inv.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedInvoices(prev =>
      prev.includes(id) ? prev.filter(invId => invId !== id) : [...prev, id]
    );
  };

  const handleBulkPrint = () => {
    const selected = invoices.filter((inv: Invoice) => selectedInvoices.includes(inv.id));
    setBulkPreview(selected);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <Select value={selectedRange} onValueChange={setSelectedRange}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Select Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              {uniqueMonths.map(month => (
                <SelectItem key={month} value={month}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          {selectedInvoices.length > 0 && (
            <Button variant="secondary" onClick={handleBulkPrint} className="w-full sm:w-auto">
              <Printer className="mr-2 h-4 w-4" /> Print ({selectedInvoices.length})
            </Button>
          )}
          <Button onClick={openCreate} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Create Invoice</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[800px] md:min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"><Checkbox checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0} onCheckedChange={(checked) => setSelectedInvoices(checked ? filteredInvoices.map(i => i.id) : [])} /></TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No invoices yet.</TableCell></TableRow>
              ) : filteredInvoices.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell><Checkbox checked={selectedInvoices.includes(inv.id)} onCheckedChange={() => toggleSelect(inv.id)} /></TableCell>
                  <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.client_name}</TableCell>
                  <TableCell>{format(new Date(inv.date), "MMM d, yyyy")}</TableCell>
                  <TableCell>{format(new Date(inv.due_date), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <Select value={inv.status} onValueChange={(v) => updateStatus.mutate({ id: inv.id, status: v })}>
                      <SelectTrigger className="w-32 h-8 text-xs font-medium"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="partially_paid">Partially Paid</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {getCurrencySymbol(inv.currency)}
                    {getTotal(inv.invoice_items, inv.discount_percentage).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right text-emerald-600 font-medium">
                    {getCurrencySymbol(inv.currency)}
                    {(inv.paid_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right text-destructive font-bold">
                    {getCurrencySymbol(inv.currency)}
                    {(getTotal(inv.invoice_items, inv.discount_percentage) - (inv.paid_amount || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => setPreview(inv)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(inv)}><Edit className="h-4 w-4" /></Button>
                      {(role === "admin" || role === "accounts_manager") && (
                        <Button variant="ghost" size="icon" onClick={() => deleteInvoice.mutate(inv.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      )}
                    </div>
                  </TableCell>

                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle>{editingId ? "Edit Invoice" : "Create New Invoice"}</DialogTitle>
            <DialogDescription className="sr-only">Fill out the form below to create a new invoice for a client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-8">
            {/* 1. Quick Fill */}
            {clients.length > 0 && (
              <div className="bg-secondary/30 p-4 rounded-lg border border-border/50">
                <Label className="text-muted-foreground mb-2 block font-medium">Quick Fill from Address Book</Label>
                <Select onValueChange={handleSelectClient}>
                  <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Select a saved client..." /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 2. Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1"><Label>Invoice Number</Label><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} placeholder="e.g. ZENIN015" /></div>
              <div className="md:col-span-2"><Label>Company / Client Name *</Label><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="e.g. Acme Corporation" /></div>
              <div className="md:col-span-1"><Label>Client ID (Internal)</Label><Input value={form.client_num} onChange={(e) => setForm({ ...form, client_num: e.target.value })} placeholder="e.g. ACME-001" /></div>

              <div className="md:col-span-2"><Label>Email Address</Label><Input type="email" value={form.client_email || ""} onChange={(e) => setForm({ ...form, client_email: e.target.value })} placeholder="billing@acme.com" /></div>
              <div className="md:col-span-2"><Label>Phone Number</Label><Input type="text" value={form.client_phone || ""} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} placeholder="+1 234 567 890" /></div>

              <div className="md:col-span-2"><Label>Billing Address</Label><Input type="text" value={form.client_address || ""} onChange={(e) => setForm({ ...form, client_address: e.target.value })} placeholder="Optional" /></div>
              <div className="md:col-span-1"><Label>GSTIN</Label><Input type="text" value={form.client_gstin || ""} onChange={(e) => setForm({ ...form, client_gstin: e.target.value })} placeholder="Optional" /></div>
              <div className="md:col-span-1"><Label>MSME Num</Label><Input type="text" value={form.client_msme_number || ""} onChange={(e) => setForm({ ...form, client_msme_number: e.target.value })} placeholder="Optional" /></div>

              <div className="md:col-span-1"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="md:col-span-1"><Label>Due Date *</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              <div className="md:col-span-1"><Label>Client Project ID</Label><Input value={form.client_project_id || ""} onChange={(e) => setForm({ ...form, client_project_id: e.target.value })} placeholder="Optional" /></div>
              <div className="md:col-span-1"><Label>Payment Reference</Label><Input value={form.payment_reference || ""} onChange={(e) => setForm({ ...form, payment_reference: e.target.value })} placeholder="e.g. UPI, Check" /></div>
              <div className="md:col-span-2">
                <Label>Currency</Label>
                <Select
                  value={form.currency}
                  onValueChange={(val) => setForm({ ...form, currency: val })}
                >
                  <SelectTrigger className="bg-background">
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
              <div className="md:col-span-2">
                <Label>Exchange Rate (to {profile?.default_currency || "INR"})</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={form.exchange_rate}
                  onChange={(e) => setForm({ ...form, exchange_rate: parseFloat(e.target.value) || 1 })}
                  disabled={form.currency === (profile?.default_currency || "INR")}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="partially_paid">Partially Paid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Amount Already Paid ({getCurrencySymbol(form.currency)})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.paid_amount}
                  onChange={(e) => setForm({ ...form, paid_amount: parseFloat(e.target.value) || 0 })}
                  className="bg-emerald-50 border-emerald-200 text-emerald-900 font-medium"
                />
              </div>
            </div>


            {/* 3. Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b">
                <Label className="text-base font-semibold">Line Items</Label>
                <Button variant="secondary" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
              </div>
              <div className="space-y-3">
                {/* Desktop Header */}
                <div className="hidden md:flex gap-2 text-sm font-medium text-muted-foreground mb-2 px-1">
                  <div className="flex-1">Product / Description</div>
                  <div className="w-16 text-center">Qty</div>
                  <div className="w-20 text-center">MRP</div>
                  <div className="w-16 text-center">Disc (%)</div>
                  <div className="w-20 text-center">Net Rate</div>
                  <div className="w-20 text-center">GST</div>
                  <div className="w-24 text-right">Amount</div>
                  <div className="w-10"></div>
                </div>
                {form.items.map((item, i) => (
                  <div key={i} className="flex flex-col lg:flex-row gap-2 lg:items-start bg-muted/20 p-3 lg:p-1 rounded-md border lg:border-none relative">
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-[140px] justify-between text-left font-normal shrink-0">
                              <Package className="mr-2 h-4 w-4" />
                              Catalog...
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search services/products..." />
                              <CommandList>
                                <CommandEmpty>No products found.</CommandEmpty>
                                <CommandGroup>
                                  {products.map((product) => (
                                    <CommandItem
                                      key={product.id}
                                      value={product.name}
                                      onSelect={() => handleSelectProduct(i, product)}
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium">{product.name}</span>
                                        <span className="text-xs text-muted-foreground">₹{product.rate} | GST: {product.gst_rate}%</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <Input placeholder="Description" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
                      </div>
                    </div>
                    <div className="flex flex-wrap sm:flex-nowrap gap-2 items-end">
                      <div className="w-16">
                        <Label className="text-[10px] text-muted-foreground uppercase lg:hidden">Qty</Label>
                        <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="w-24">
                        <Label className="text-[10px] text-muted-foreground uppercase lg:hidden">MRP</Label>
                        <Input type="number" step="0.01" placeholder="MRP" value={item.mrp} onChange={(e) => updateItem(i, "mrp", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="w-20">
                        <Label className="text-[10px] text-muted-foreground uppercase lg:hidden">Disc %</Label>
                        <Input type="number" step="0.1" placeholder="Disc %" value={item.discount} onChange={(e) => updateItem(i, "discount", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="w-24">
                        <Label className="text-[10px] text-muted-foreground uppercase lg:hidden">Net Rate</Label>
                        <Input type="number" step="0.01" placeholder="Rate" value={item.rate} onChange={(e) => updateItem(i, "rate", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="w-24">
                        <Label className="text-[10px] text-muted-foreground uppercase lg:hidden">GST</Label>
                        <Select value={String(item.gst)} onValueChange={(v) => updateItem(i, "gst", parseFloat(v))}>
                          <SelectTrigger className="h-10 bg-background w-full"><SelectValue placeholder="GST" /></SelectTrigger>
                          <SelectContent>
                            {[0, 5, 12, 18, 28].map(rate => <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between lg:justify-end mt-2 lg:mt-0">
                      <span className="lg:hidden text-sm text-muted-foreground mr-2">Amount:</span>
                      <div className="w-28 text-right font-medium">{getCurrencySymbol(form.currency)}{(item.quantity * item.rate * (1 + item.gst / 100)).toFixed(2)}</div>
                      <div className="w-10 flex justify-end">
                        {form.items.length > 1 && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeItem(i)}><X className="h-4 w-4" /></Button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Notes & Totals */}
            <div className="grid md:grid-cols-2 gap-6 pt-4 border-t">
              <div className="space-y-4">
                <div>
                  <Label>Notes</Label>
                  <Textarea className="h-28 resize-none mt-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Add any special instructions or notes to the client..." />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 bg-muted/40 p-3 rounded-md border">
                    <Checkbox
                      id="include_signature"
                      checked={form.include_signature}
                      onCheckedChange={(checked) => setForm({ ...form, include_signature: checked === true })}
                    />
                    <Label htmlFor="include_signature" className="font-medium cursor-pointer">
                      Include E-Signature on this invoice
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 bg-muted/40 p-3 rounded-md border">
                    <Checkbox
                      id="include_background"
                      checked={form.include_background}
                      onCheckedChange={(checked) => setForm({ ...form, include_background: checked === true })}
                    />
                    <Label htmlFor="include_background" className="font-medium cursor-pointer">
                      Include Background Logo on this invoice
                    </Label>
                  </div>
                </div>
              </div>
              <div className="space-y-3 bg-secondary/10 p-5 rounded-lg border border-border/50 self-start">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{getCurrencySymbol(form.currency)}{getSubtotal(form.items).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-red-500 font-medium">
                  <div className="flex items-center gap-2">
                    <span>Discount (%)</span>
                    <Input type="number" className="h-7 w-16 text-xs bg-white text-black" value={form.discount_percentage} onChange={(e) => setForm({ ...form, discount_percentage: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <span>-{getCurrencySymbol(form.currency)}{(getSubtotal(form.items) * (form.discount_percentage / 100)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>GST Total</span>
                  <span>{getCurrencySymbol(form.currency)}{getGSTTotal(form.items, form.discount_percentage).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-xl font-bold pt-3 border-t border-border mt-2">
                  <span>Total</span>
                  <span className="text-primary">{getCurrencySymbol(form.currency)}{getTotal(form.items, form.discount_percentage).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm text-emerald-600 font-medium pt-1">
                  <span>Paid Amount</span>
                  <span>{getCurrencySymbol(form.currency)}{form.paid_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-destructive pt-1 border-t border-dashed mt-1">
                  <span>Balance Due</span>
                  <span>{getCurrencySymbol(form.currency)}{(getTotal(form.items, form.discount_percentage) - form.paid_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

            </div>
          </div>
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createInvoice.mutate()} disabled={createInvoice.isPending || !form.client_name || !form.due_date}>{editingId ? "Save Changes" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Preview Dialog */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between print:hidden">
            <DialogTitle>Invoice Preview</DialogTitle>
            <DialogDescription className="sr-only">Invoice Preview Details</DialogDescription>
            <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">Print Invoice</Button>
          </DialogHeader>
          {preview && (
            <div className="relative space-y-6 p-8 border rounded-lg bg-background print:border-0 print:p-0" id="print-area">
              {/* Background Watermark */}
              {(preview.include_background !== false && profile?.background_logo_url?.trim()) && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
                  style={{ opacity: (profile.background_logo_opacity ?? 5) / 100 }}
                >
                  <img src={profile.background_logo_url} alt="Watermark" className="w-[80%] max-h-[80%] object-contain mix-blend-multiply filter grayscale" />
                </div>
              )}

              <div className="relative z-10 flex justify-between items-start border-b pb-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-primary">TAX INVOICE</h2>
                  <p className="text-lg font-mono mt-1">{preview.invoice_number}</p>
                </div>
                <div className="text-right">
                  <Badge variant={statusColor(preview.status)} className="mb-2 capitalize">{preview.status}</Badge>
                  {preview.payment_reference && (
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                      Ref: {preview.payment_reference}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">Date: {format(new Date(preview.date), "MMM d, yyyy")}</p>
                  <p className="text-sm text-muted-foreground font-medium">Due: {format(new Date(preview.due_date), "MMM d, yyyy")}</p>
                </div>
              </div>

              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-8 print:grid-cols-2">
                <div>
                  <h3 className="font-semibold text-muted-foreground mb-2">Billed To:</h3>
                  <div className="space-y-1">
                    <p className="font-bold text-lg">{preview.client_name}</p>
                    {preview.client_address && <p className="text-muted-foreground whitespace-pre-wrap">{preview.client_address}</p>}
                    <div className="text-sm text-muted-foreground mt-1">
                      {preview.client_email && <p>{preview.client_email}</p>}
                      {preview.client_phone && <p>{preview.client_phone}</p>}
                    </div>
                    {(preview.client_gstin || preview.client_msme_number) && (
                      <div className="text-sm mt-2">
                        {preview.client_gstin && <p><span className="text-muted-foreground">GSTIN:</span> {preview.client_gstin}</p>}
                        {preview.client_msme_number && <p><span className="text-muted-foreground">MSME:</span> {preview.client_msme_number}</p>}
                      </div>
                    )}
                    {(preview.client_num || preview.client_project_id) && (
                      <div className="text-xs text-muted-foreground mt-2 border-t pt-1 inline-block">
                        {preview.client_num && <span className="mr-3">ID: {preview.client_num}</span>}
                        {preview.client_project_id && <span>Project: {preview.client_project_id}</span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-1">From</p>
                  <p className="font-bold text-lg">{profile?.company_name || "Your Business Name"}</p>
                  {profile?.gstin && <p className="text-sm text-muted-foreground">GSTIN: {profile.gstin}</p>}
                  {profile?.address && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.address}</p>}
                </div>
              </div>

              <Table className="relative z-10">
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">MRP</TableHead>
                    <TableHead className="text-right">Disc (%)</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(preview.invoice_items || []).map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{getCurrencySymbol(preview.currency)}{Number(item.mrp || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{Number(item.discount || 0).toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{getCurrencySymbol(preview.currency)}{Number(item.rate).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-xs">{(item.gst || 0)}%</TableCell>
                      <TableCell className="text-right font-bold">{getCurrencySymbol(preview.currency)}{(Number(item.quantity) * Number(item.rate) * (1 + (item.gst || 0) / 100)).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="relative z-10 flex flex-col sm:flex-row justify-end pt-4 border-t print:flex-row">
                <div className="w-full sm:w-64 space-y-2 print:w-64">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{getCurrencySymbol(preview.currency)}{getSubtotal(preview.invoice_items).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  {preview.discount_percentage && preview.discount_percentage > 0 ? (
                    <div className="flex justify-between text-sm text-red-500 font-medium">
                      <span className="text-muted-foreground">Discount ({preview.discount_percentage}%)</span>
                      <span>-{getCurrencySymbol(preview.currency)}{(getSubtotal(preview.invoice_items) * (preview.discount_percentage / 100)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Tax (GST)</span>
                    <span>{getCurrencySymbol(preview.currency)}{getGSTTotal(preview.invoice_items, preview.discount_percentage).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold border-t pt-2">
                    <span>Grand Total</span>
                    <span className="text-primary">{getCurrencySymbol(preview.currency)}{getTotal(preview.invoice_items, preview.discount_percentage).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {preview.notes && (
                <div className="relative z-10 mt-8 pt-6 border-t">
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Notes</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{preview.notes}</p>
                </div>
              )}

              {preview.include_signature !== false && (
                <div className="relative z-10 mt-16 pt-8 flex justify-start items-end">
                  <div className="text-center">
                    <div className="w-48 border-b border-foreground mb-2"></div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">E-sign & Approval by</p>
                    {profile?.signature_url?.trim() ? (
                      <div className="flex justify-center mb-1">
                        <img src={profile.signature_url} alt="Signature" className="h-12 object-contain mix-blend-multiply" />
                      </div>
                    ) : null}
                    <p className="font-bold mt-1">{profile?.company_name || "Your Business Name"}</p>
                    {(profile?.auth_person_name || profile?.auth_designation) && (
                      <div className="mt-2 leading-tight">
                        {profile?.auth_person_name && <p className="text-sm font-semibold">{profile.auth_person_name}</p>}
                        {profile?.auth_designation && <p className="text-xs text-muted-foreground">{profile.auth_designation}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Print Preview Dialog */}
      <Dialog open={!!bulkPreview} onOpenChange={() => setBulkPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto print:overflow-visible">
          <DialogHeader className="space-y-4 pb-4 print:hidden border-b">
            <div className="flex flex-row items-center justify-between">
              <DialogTitle>Bulk Invoice Print Preview</DialogTitle>
              <DialogDescription className="sr-only">Preview of selected invoices for bulk printing</DialogDescription>
              <div className="flex gap-2 items-center">
                <span className="text-sm font-medium bg-muted px-3 py-1 rounded-full text-muted-foreground mr-2">{bulkPreview?.length} Invoices</span>
                <Button onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print All
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6 bg-muted/30 p-3 rounded-lg border text-sm">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="bulk_sign"
                  checked={bulkIncludeSignature}
                  onCheckedChange={(c) => setBulkIncludeSignature(c === true)}
                />
                <Label htmlFor="bulk_sign" className="cursor-pointer font-medium">Include Signatures</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="bulk_logo"
                  checked={bulkIncludeLogo}
                  onCheckedChange={(c) => setBulkIncludeLogo(c === true)}
                />
                <Label htmlFor="bulk_logo" className="cursor-pointer font-medium">Include Background Logos</Label>
              </div>
            </div>
          </DialogHeader>
          <div id="print-area">
            {bulkPreview && bulkPreview.map((inv, index) => (
              <div
                key={inv.id}
                className={`relative space-y-6 p-8 border rounded-lg bg-background print:border-0 print:p-0 ${index !== bulkPreview.length - 1 ? 'mb-8 print:mb-0 print:break-after-page' : ''}`}
              >
                {/* Background Watermark */}
                {(bulkIncludeLogo && inv.include_background !== false && profile?.background_logo_url?.trim()) && (
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
                    style={{ opacity: (profile.background_logo_opacity ?? 5) / 100 }}
                  >
                    <img src={profile.background_logo_url} alt="Watermark" className="w-[80%] max-h-[80%] object-contain mix-blend-multiply filter grayscale" />
                  </div>
                )}

                <div className="relative z-10 flex justify-between items-start border-b pb-6">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-primary">TAX INVOICE</h2>
                    <p className="text-lg font-mono mt-1">{inv.invoice_number}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={statusColor(inv.status)} className="mb-2 capitalize print:hidden">{inv.status}</Badge>
                    {inv.payment_reference && (
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                        Ref: {inv.payment_reference}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">Date: {format(new Date(inv.date), "MMM d, yyyy")}</p>
                    <p className="text-sm text-muted-foreground font-medium">Due: {format(new Date(inv.due_date), "MMM d, yyyy")}</p>
                  </div>
                </div>

                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-8 print:grid-cols-2">
                  <div>
                    <h3 className="font-semibold text-muted-foreground mb-2">Billed To:</h3>
                    <div className="space-y-1">
                      <p className="font-bold text-lg">{inv.client_name}</p>
                      {inv.client_address && <p className="text-muted-foreground whitespace-pre-wrap">{inv.client_address}</p>}
                      <div className="text-sm text-muted-foreground mt-1">
                        {inv.client_email && <p>{inv.client_email}</p>}
                        {inv.client_phone && <p>{inv.client_phone}</p>}
                      </div>
                      {(inv.client_gstin || inv.client_msme_number) && (
                        <div className="text-sm mt-2">
                          {inv.client_gstin && <p><span className="text-muted-foreground">GSTIN:</span> {inv.client_gstin}</p>}
                          {inv.client_msme_number && <p><span className="text-muted-foreground">MSME:</span> {inv.client_msme_number}</p>}
                        </div>
                      )}
                      {(inv.client_num || inv.client_project_id) && (
                        <div className="text-xs text-muted-foreground mt-2 border-t pt-1 inline-block">
                          {inv.client_num && <span className="mr-3">ID: {inv.client_num}</span>}
                          {inv.client_project_id && <span>Project: {inv.client_project_id}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase text-muted-foreground mb-1">From</p>
                    <p className="font-bold text-lg">{profile?.company_name || "Your Business Name"}</p>
                    {profile?.gstin && <p className="text-sm text-muted-foreground">GSTIN: {profile.gstin}</p>}
                    {profile?.address && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.address}</p>}
                  </div>
                </div>

                <Table className="relative z-10">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">GST</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(inv.invoice_items || []).map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{getCurrencySymbol(inv.currency)}{Number(item.rate).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-xs">{(item.gst || 0)}%</TableCell>
                        <TableCell className="text-right font-bold">{getCurrencySymbol(inv.currency)}{(Number(item.quantity) * Number(item.rate) * (1 + (item.gst || 0) / 100)).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="relative z-10 flex flex-col sm:flex-row justify-end pt-4 border-t print:flex-row">
                  <div className="w-full sm:w-64 space-y-2 print:w-64">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{getCurrencySymbol(inv.currency)}{getSubtotal(inv.invoice_items).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Tax (GST)</span>
                      <span>{getCurrencySymbol(inv.currency)}{getGSTTotal(inv.invoice_items).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold pt-3 border-t-2 border-primary mt-2">
                      <span>Total Amount</span>
                      <span className="text-primary">{getCurrencySymbol(inv.currency)}{getTotal(inv.invoice_items, inv.discount_percentage).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    {(inv.paid_amount || 0) > 0 && (
                      <>
                        <div className="flex justify-between text-sm text-emerald-600 font-medium pt-2">
                          <span>Amount Paid</span>
                          <span>{getCurrencySymbol(inv.currency)}{(inv.paid_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold text-destructive pt-2 border-t border-dashed mt-2">
                          <span>Balance Due</span>
                          <span>{getCurrencySymbol(inv.currency)}{(getTotal(inv.invoice_items, inv.discount_percentage) - (inv.paid_amount || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {inv.notes && (
                  <div className="relative z-10 mt-8 pt-6 border-t">
                    <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Notes</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{inv.notes}</p>
                  </div>
                )}

                {(bulkIncludeSignature && inv.include_signature !== false) && (
                  <div className="relative z-10 mt-16 pt-8 flex justify-start items-end">
                    <div className="text-center">
                      <div className="w-48 border-b border-foreground mb-2"></div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">E-sign & Approval by</p>
                      {profile?.signature_url?.trim() ? (
                        <div className="flex justify-center mb-1">
                          <img src={profile.signature_url} alt="Signature" className="h-12 object-contain mix-blend-multiply" />
                        </div>
                      ) : null}
                      <p className="font-bold mt-1">{profile?.company_name || "Your Business Name"}</p>
                      {(profile?.auth_person_name || profile?.auth_designation) && (
                        <div className="mt-2 leading-tight">
                          {profile?.auth_person_name && <p className="text-sm font-semibold">{profile.auth_person_name}</p>}
                          {profile?.auth_designation && <p className="text-xs text-muted-foreground">{profile.auth_designation}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}
