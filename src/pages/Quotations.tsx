import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Eye, Trash2, X, Edit, Printer, FileText, Package, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type QuotationItem = { id?: string; product_id?: string; description: string; quantity: number; rate: number; gst: number; mrp?: number; discount?: number };
type Quotation = {
  id: string; quotation_number: string; client_id: string | null; client_name: string; client_email: string | null; client_phone: string | null; client_address: string | null; client_gstin: string | null; client_msme_number: string | null; client_num: string | null; client_project_id: string | null; date: string; valid_until: string | null; status: string; notes: string | null; include_signature: boolean; include_background: boolean; currency: string | null; exchange_rate: number | null; created_at: string;
  discount_percentage?: number;
  is_published?: boolean;
  is_paid?: boolean;
  quotation_items?: QuotationItem[];
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

export default function Quotations() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<string>("all");
  const [selectedQuotations, setSelectedQuotations] = useState<string[]>([]);
  const [bulkPreview, setBulkPreview] = useState<Quotation[] | null>(null);
  const [bulkIncludeSignature, setBulkIncludeSignature] = useState(true);
  const [bulkIncludeLogo, setBulkIncludeLogo] = useState(true);
  const [preview, setPreview] = useState<Quotation | null>(null);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [form, setForm] = useState({
    quotation_number: "", client_id: "", client_name: "", client_email: "", client_phone: "", client_address: "", client_gstin: "", client_msme_number: "", client_num: "", client_project_id: "", date: format(new Date(), "yyyy-MM-dd"), valid_until: "", notes: "", include_signature: true, include_background: true, currency: "INR", exchange_rate: 1,
    discount_percentage: 0,
    status: "draft",
    items: [{ description: "", quantity: 1, rate: 0, gst: 0, mrp: 0, discount: 0 }] as QuotationItem[],
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

  const { data: quotations = [] } = useQuery({
    queryKey: ["quotations", user?.id, role],
    queryFn: async () => {
      if (!user) return [];
      const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
      let query = supabase.from("quotations").select("*, quotation_items(*)");
      if (!isStaffOrAbove) {
        query = query.eq("user_id", user.id);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Quotation[];
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
    months.add(format(new Date(), "MMM yyyy"));
    quotations.forEach((q: any) => months.add(format(new Date(q.date), "MMM yyyy")));
    return Array.from(months);
  }, [quotations]);

  const filteredQuotations = useMemo(() => {
    if (selectedRange === "all") return quotations;
    if (selectedRange === "today") return quotations.filter((q: any) => isToday(parseISO(q.date)));
    if (selectedRange === "this-week") return quotations.filter((q: any) => isThisWeek(parseISO(q.date)));
    return quotations.filter((q: any) => format(new Date(q.date), "MMM yyyy") === selectedRange);
  }, [quotations, selectedRange]);

  const createOrUpdateQuotation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const payload = {
        quotation_number: form.quotation_number, client_id: form.client_id || null, client_name: form.client_name, client_email: form.client_email || null, client_phone: form.client_phone || null, client_address: form.client_address || null, client_gstin: form.client_gstin || null, client_msme_number: form.client_msme_number || null, client_num: form.client_num || null, client_project_id: form.client_project_id || null, date: form.date, valid_until: form.valid_until || null, notes: form.notes || null, include_signature: form.include_signature, include_background: form.include_background, currency: form.currency || "INR", exchange_rate: form.exchange_rate || 1,
        discount_percentage: form.discount_percentage || 0,
        status: form.status || "draft",
      };

      let quotationId = editingId;

      if (editingId) {
        const { error } = await supabase.from("quotations").update(payload).eq("id", editingId);
        if (error) throw error;
        await supabase.from("quotation_items").delete().eq("quotation_id", editingId);
      } else {
        const { data, error } = await supabase.from("quotations").insert({ ...payload, user_id: user.id }).select().single();
        if (error) throw error;
        quotationId = data.id;

        // Auto-save Client to Address Book if it doesn't already exist
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
      }

      const items = form.items.filter((i) => i.description).map((i) => ({ 
        quotation_id: quotationId, 
        description: i.description, 
        quantity: i.quantity, 
        rate: i.rate, 
        gst: i.gst,
        mrp: i.mrp || 0,
        discount: i.discount || 0
      }));

      if (items.length > 0) {
        const { error: itemErr } = await supabase.from("quotation_items").insert(items);
        if (itemErr) throw itemErr;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["quotations"] }); setOpen(false); toast.success(editingId ? "Quotation updated" : "Quotation created"); },
    onError: (e) => toast.error(e.message),
  });

  const convertToInvoice = useMutation({
    mutationFn: async (quote: Quotation) => {
      if (!user) throw new Error("User not authenticated");

      // Generate invoice number based on prefix and sequence
      const prefix = profile?.invoice_prefix || "INV-";
      const nextSeq = profile?.invoice_next_sequence || 1;
      const invoiceNum = `${prefix}${String(nextSeq).padStart(3, '0')}`;

      // 1. Create invoice
      const invoicePayload = {
        invoice_number: invoiceNum,
        client_id: quote.client_id,
        client_name: quote.client_name,
        client_email: quote.client_email,
        client_phone: quote.client_phone,
        client_address: quote.client_address,
        client_gstin: quote.client_gstin,
        client_msme_number: quote.client_msme_number,
        client_num: quote.client_num,
        client_project_id: quote.client_project_id,
        date: format(new Date(), "yyyy-MM-dd"),
        due_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"), // default 30 days due
        status: "draft",
        notes: quote.notes,
        include_signature: quote.include_signature,
        include_background: quote.include_background,
        currency: quote.currency || "INR",
        exchange_rate: quote.exchange_rate || 1,
        discount_percentage: quote.discount_percentage || 0,
        user_id: user.id
      };

      const { data: invData, error: invErr } = await supabase.from("invoices").insert(invoicePayload).select().single();
      if (invErr) throw invErr;

      // 2. Increment prefix sequence
      if (profile) {
        await supabase
          .from("profiles")
          .update({ invoice_next_sequence: (profile.invoice_next_sequence || 1) + 1 })
          .eq("id", user.id);
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      }

      // 3. Create invoice items
      if (quote.quotation_items && quote.quotation_items.length > 0) {
        const invoiceItems = quote.quotation_items.map(item => ({
          invoice_id: invData.id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          gst: item.gst,
          mrp: item.mrp || 0,
          discount: item.discount || 0
        }));
        const { error: itemsErr } = await supabase.from("invoice_items").insert(invoiceItems);
        if (itemsErr) throw itemsErr;
      }

      // 4. Update quotation status to "invoiced"
      const { error: quoteUpdateErr } = await supabase.from("quotations").update({ status: "invoiced" }).eq("id", quote.id);
      if (quoteUpdateErr) throw quoteUpdateErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setPreview(null);
      toast.success("Converted successfully to tax invoice!");
    },
    onError: (e) => toast.error("Failed to convert: " + e.message)
  });

  const deleteQuotation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["quotations"] }); toast.success("Quotation deleted"); },
  });

  const migrateInvoices = useMutation({
    mutationFn: async () => {
      toast.loading("Fetching invoices...", { id: "migration" });
      const { data: invs, error: invsErr } = await supabase
        .from("invoices")
        .select("*, invoice_items(*)");
      if (invsErr) throw invsErr;

      if (!invs || invs.length === 0) {
        toast.info("No invoices found to migrate.", { id: "migration" });
        return;
      }

      toast.loading("Migrating data...", { id: "migration" });

      for (const inv of invs) {
        const qtnNumber = `QTN-${inv.invoice_number}`;
        const { data: existingQuote } = await supabase
          .from("quotations")
          .select("id")
          .eq("quotation_number", qtnNumber)
          .maybeSingle();

        if (existingQuote) continue;

        const { data: newQuote, error: qErr } = await supabase
          .from("quotations")
          .insert({
            quotation_number: qtnNumber,
            client_id: inv.client_id,
            client_name: inv.client_name,
            client_email: inv.client_email,
            client_phone: inv.client_phone,
            client_address: inv.client_address,
            client_gstin: inv.client_gstin,
            client_msme_number: inv.client_msme_number,
            client_num: inv.client_num,
            client_project_id: inv.client_project_id,
            date: inv.date,
            valid_until: inv.due_date,
            status: "draft",
            notes: inv.notes,
            include_signature: inv.include_signature,
            include_background: inv.include_background,
            currency: inv.currency,
            exchange_rate: inv.exchange_rate,
            discount_percentage: inv.discount_percentage,
            user_id: inv.user_id,
            created_at: inv.created_at
          })
          .select()
          .single();

        if (qErr) throw qErr;

        if (inv.invoice_items && inv.invoice_items.length > 0) {
          const qItems = inv.invoice_items.map((item: any) => ({
            quotation_id: newQuote.id,
            product_id: item.product_id,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            gst: item.gst
          }));

          const { error: itemsErr } = await supabase
            .from("quotation_items")
            .insert(qItems);
          
          if (itemsErr) throw itemsErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Successfully copied all invoices into quotations!", { id: "migration" });
    },
    onError: (e: any) => {
      toast.error("Migration failed: " + e.message, { id: "migration" });
    }
  });

  const bulkUpdateStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase.from("quotations").update({ status }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      setSelectedQuotations([]);
      toast.success("Quotations updated in bulk");
    },
    onError: (e) => toast.error("Failed bulk update: " + e.message)
  });

  const addItem = () => setForm({ ...form, items: [...form.items, { description: "", quantity: 1, rate: 0, gst: 0, mrp: 0, discount: 0 }] });
  const removeItem = (i: number) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i: number, field: keyof QuotationItem, value: string | number) => {
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
    setForm({
      quotation_number: `QTN-${format(new Date(), "yyyyMMdd")}-${Math.floor(100 + Math.random() * 900)}`,
      client_name: "", client_id: "", client_email: "", client_phone: "", client_address: "", client_gstin: "", client_msme_number: "", client_num: "", client_project_id: "",
      date: format(new Date(), "yyyy-MM-dd"), valid_until: "", notes: "", include_signature: true, include_background: true, currency: profile?.default_currency || "INR", exchange_rate: 1, discount_percentage: 0, status: "draft",
      items: [{ description: "", quantity: 1, rate: 0, gst: 0, mrp: 0, discount: 0 }]
    });
    setOpen(true);
  };

  const openEdit = (quote: Quotation) => {
    setEditingId(quote.id);
    setForm({
      quotation_number: quote.quotation_number, client_id: quote.client_id || "", client_name: quote.client_name, client_email: quote.client_email || "", client_phone: quote.client_phone || "", client_address: quote.client_address || "", client_gstin: quote.client_gstin || "", client_msme_number: quote.client_msme_number || "", client_num: quote.client_num || "", client_project_id: quote.client_project_id || "", date: quote.date, valid_until: quote.valid_until || "", notes: quote.notes || "", include_signature: quote.include_signature ?? true, include_background: quote.include_background ?? true, currency: quote.currency || "INR", exchange_rate: quote.exchange_rate || 1, discount_percentage: quote.discount_percentage || 0, status: quote.status || "draft",
      items: quote.quotation_items && quote.quotation_items.length > 0 ? quote.quotation_items.map(i => ({ ...i })) : [{ description: "", quantity: 1, rate: 0, gst: 0, mrp: 0, discount: 0 }]
    });
    setOpen(true);
  };

  const handleSelectClient = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      const hasGstin = !!(client.gstin && client.gstin.trim());
      const updatedItems = form.items.map(item => ({
        ...item,
        gst: hasGstin ? 18 : 0
      }));
      setForm({
        ...form,
        client_id: client.id, client_name: client.name, client_email: client.email || "", client_phone: client.phone || "", client_address: client.address || "", client_gstin: client.gstin || "", client_msme_number: client.msme_number || "", client_num: client.client_number || "", currency: client.currency || profile?.default_currency || "INR",
        items: updatedItems
      });
    }
  };

  const handleClientNameChange = (name: string) => {
    setForm(prev => {
      const updated = { ...prev, client_name: name };
      const matchedClient = clients.find(c => c.name.trim().toLowerCase() === name.trim().toLowerCase());
      if (matchedClient) {
        const hasGstin = !!(matchedClient.gstin && matchedClient.gstin.trim());
        updated.client_id = matchedClient.id;
        updated.client_email = matchedClient.email || "";
        updated.client_phone = matchedClient.phone || "";
        updated.client_address = matchedClient.address || "";
        updated.client_gstin = matchedClient.gstin || "";
        updated.client_msme_number = matchedClient.msme_number || "";
        updated.client_num = matchedClient.client_number || "";
        updated.currency = matchedClient.currency || profile?.default_currency || "INR";
        updated.items = prev.items.map(item => ({
          ...item,
          gst: hasGstin ? 18 : 0
        }));
      }
      return updated;
    });
  };

  const getSubtotal = (items?: QuotationItem[]) => (items || []).reduce((s, i) => s + i.quantity * i.rate, 0);
  const getGSTTotal = (items?: QuotationItem[], discountPercentage?: number) => {
    const totalGst = (items || []).reduce((s, i) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
    return totalGst * (1 - (discountPercentage || 0) / 100);
  };
  const getTotal = (items?: QuotationItem[], discountPercentage?: number) => {
    const sub = getSubtotal(items);
    const disc = sub * ((discountPercentage || 0) / 100);
    return (sub - disc) + getGSTTotal(items, discountPercentage);
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleSelectAll = () => {
    if (selectedQuotations.length === filteredQuotations.length && filteredQuotations.length > 0) {
      setSelectedQuotations([]);
    } else {
      setSelectedQuotations(filteredQuotations.map((q: Quotation) => q.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedQuotations(prev =>
      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
    );
  };

  const handleBulkPrint = () => {
    const selected = quotations.filter((q: Quotation) => selectedQuotations.includes(q.id));
    setBulkPreview(selected);
  };

  const statusColor = (s: string) => {
    if (s === "accepted" || s === "invoiced") return "default";
    if (s === "sent") return "secondary";
    if (s === "rejected") return "destructive";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
          <h1 className="text-2xl font-bold tracking-tight">Quotations</h1>
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
          {selectedQuotations.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select onValueChange={(val) => bulkUpdateStatus.mutate({ ids: selectedQuotations, status: val })}>
                <SelectTrigger className="w-[150px] bg-secondary text-secondary-foreground border-none">
                  <SelectValue placeholder="Bulk Status Edit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="invoiced">Invoiced</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="secondary" onClick={handleBulkPrint} className="w-full sm:w-auto">
                <Printer className="mr-2 h-4 w-4" /> Print ({selectedQuotations.length})
              </Button>
            </div>
          )}
          <Button variant="secondary" onClick={() => migrateInvoices.mutate()} disabled={migrateInvoices.isPending} className="w-full sm:w-auto">
            Migrate Invoices to Quotations
          </Button>
          <Button onClick={openCreate} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Create Quotation</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[800px] md:min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"><Checkbox checked={selectedQuotations.length === filteredQuotations.length && filteredQuotations.length > 0} onCheckedChange={(checked) => setSelectedQuotations(checked ? filteredQuotations.map(q => q.id) : [])} /></TableHead>
                <TableHead>Quotation #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotations.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No quotations yet.</TableCell></TableRow>
              ) : filteredQuotations.map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell><Checkbox checked={selectedQuotations.includes(q.id)} onCheckedChange={() => toggleSelect(q.id)} /></TableCell>
                  <TableCell className="font-mono text-sm">{q.quotation_number}</TableCell>
                  <TableCell>{q.client_name}</TableCell>
                  <TableCell>{format(new Date(q.date), "MMM d, yyyy")}</TableCell>
                  <TableCell>{q.valid_until ? format(new Date(q.valid_until), "MMM d, yyyy") : "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant={statusColor(q.status)} className="capitalize">{q.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {getCurrencySymbol(q.currency)}
                    {getTotal(q.quotation_items, q.discount_percentage).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => setPreview(q)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(q)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteQuotation.mutate(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Quotation Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Quotation" : "Create New Quotation"}</DialogTitle>
            <DialogDescription className="sr-only">Fill details to manage quotations.</DialogDescription>
          </DialogHeader>
          <div className="space-y-8">
            {clients.length > 0 && (
              <div className="bg-secondary/30 p-4 rounded-lg border border-border/50">
                <Label className="text-muted-foreground mb-2 block font-medium">Quick Fill from Address Book</Label>
                <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between text-left bg-background font-normal">
                      <span>Select a saved client...</span>
                      <Search className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search by name, ID, email, phone..." />
                      <CommandList>
                        <CommandEmpty>No client found.</CommandEmpty>
                        <CommandGroup>
                          {clients.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.client_number || ""} ${c.name} ${c.email || ""} ${c.phone || ""}`}
                              onSelect={() => {
                                handleSelectClient(c.id);
                                setClientSearchOpen(false);
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="font-semibold text-sm">
                                  {c.client_number ? `[${c.client_number}] ` : ""}{c.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {c.email ? `Email: ${c.email}` : ""} {c.phone ? ` | Phone: ${c.phone}` : ""}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1"><Label>Quotation Number</Label><Input value={form.quotation_number} onChange={(e) => setForm({ ...form, quotation_number: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Company / Client Name *</Label><Input value={form.client_name} onChange={(e) => handleClientNameChange(e.target.value)} /></div>
              <div className="md:col-span-1"><Label>Client ID (Internal)</Label><Input value={form.client_num} onChange={(e) => setForm({ ...form, client_num: e.target.value })} /></div>

              <div className="md:col-span-2"><Label>Email Address</Label><Input type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Phone Number</Label><Input type="text" value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} /></div>

              <div className="md:col-span-2"><Label>Billing Address</Label><Input type="text" value={form.client_address} onChange={(e) => setForm({ ...form, client_address: e.target.value })} /></div>
              <div className="md:col-span-1"><Label>GSTIN</Label><Input type="text" value={form.client_gstin} onChange={(e) => setForm({ ...form, client_gstin: e.target.value })} /></div>
              <div className="md:col-span-1"><Label>MSME Num</Label><Input type="text" value={form.client_msme_number} onChange={(e) => setForm({ ...form, client_msme_number: e.target.value })} /></div>

              <div className="md:col-span-1"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="md:col-span-1"><Label>Valid Until</Label><Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
              <div className="md:col-span-1"><Label>Client Project ID</Label><Input value={form.client_project_id} onChange={(e) => setForm({ ...form, client_project_id: e.target.value })} /></div>
              <div className="md:col-span-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="invoiced">Invoiced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(val) => setForm({ ...form, currency: val })}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
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
                <Label>Exchange Rate</Label>
                <Input type="number" step="0.0001" value={form.exchange_rate} onChange={(e) => setForm({ ...form, exchange_rate: parseFloat(e.target.value) || 1 })} disabled={form.currency === "INR"} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b">
                <Label className="text-base font-semibold">Line Items</Label>
                <Button variant="secondary" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
              </div>
              <div className="space-y-3">
                {/* Desktop Header */}
                <div className="hidden lg:grid grid-cols-[1fr_64px_96px_80px_96px_96px_112px_40px] gap-2 text-sm font-medium text-muted-foreground mb-2 px-1 text-center">
                  <div className="text-left">Product / Description</div>
                  <div>Qty</div>
                  <div>MRP</div>
                  <div>Disc (%)</div>
                  <div>Net Rate</div>
                  <div>GST</div>
                  <div className="text-right">Amount</div>
                  <div></div>
                </div>

                {form.items.map((item, i) => (
                  <div key={i} className="flex flex-col lg:grid lg:grid-cols-[1fr_64px_96px_80px_96px_96px_112px_40px] gap-2 items-start lg:items-center bg-muted/20 p-3 lg:p-1 rounded-md border lg:border-none relative">
                    <div className="w-full flex flex-col sm:flex-row gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full sm:w-10 p-0 justify-center shrink-0" title="Select from Catalog">
                            <Package className="h-4 w-4" />
                            <span className="sm:hidden ml-2">Catalog...</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search catalog..." />
                            <CommandList>
                              <CommandEmpty>No products found.</CommandEmpty>
                              <CommandGroup>
                                {products.map((product) => (
                                  <CommandItem key={product.id} value={product.name} onSelect={() => handleSelectProduct(i, product)}>
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
                      <Input placeholder="Description" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} className="w-full" />
                    </div>

                    <div className="w-full">
                      <Label className="text-[10px] text-muted-foreground uppercase lg:hidden">Qty</Label>
                      <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)} className="w-full text-center" />
                    </div>
                    <div className="w-full">
                      <Label className="text-[10px] text-muted-foreground uppercase lg:hidden">MRP</Label>
                      <Input type="number" step="0.01" placeholder="MRP" value={item.mrp || 0} onChange={(e) => updateItem(i, "mrp", parseFloat(e.target.value) || 0)} className="w-full text-center" />
                    </div>
                    <div className="w-full">
                      <Label className="text-[10px] text-muted-foreground uppercase lg:hidden">Disc %</Label>
                      <Input type="number" step="0.1" placeholder="Disc %" value={item.discount || 0} onChange={(e) => updateItem(i, "discount", parseFloat(e.target.value) || 0)} className="w-full text-center" />
                    </div>
                    <div className="w-full">
                      <Label className="text-[10px] text-muted-foreground uppercase lg:hidden">Net Rate</Label>
                      <Input type="number" step="0.01" placeholder="Rate" value={item.rate} onChange={(e) => updateItem(i, "rate", parseFloat(e.target.value) || 0)} className="w-full text-center" />
                    </div>
                    <div className="w-full">
                      <Label className="text-[10px] text-muted-foreground uppercase lg:hidden">GST</Label>
                      <Select value={String(item.gst)} onValueChange={(v) => updateItem(i, "gst", parseFloat(v))}>
                        <SelectTrigger className="h-10 bg-background w-full"><SelectValue placeholder="GST" /></SelectTrigger>
                        <SelectContent>
                          {[0, 5, 12, 18, 28].map(rate => <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-full flex items-center justify-between lg:justify-end mt-2 lg:mt-0">
                      <span className="lg:hidden text-sm text-muted-foreground mr-2">Amount:</span>
                      <div className="text-right font-medium w-full">{getCurrencySymbol(form.currency)}{(item.quantity * item.rate * (1 + item.gst / 100)).toFixed(2)}</div>
                    </div>
                    <div className="w-full flex justify-end">
                      {form.items.length > 1 && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeItem(i)}><X className="h-4 w-4" /></Button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 pt-4 border-t">
              <div className="space-y-4">
                <div>
                  <Label>Notes</Label>
                  <Textarea className="h-28 resize-none mt-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Quotation terms, notes or validities..." />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 bg-muted/40 p-3 rounded-md border">
                    <Checkbox id="q_sig" checked={form.include_signature} onCheckedChange={(c) => setForm({ ...form, include_signature: c === true })} />
                    <Label htmlFor="q_sig">Include E-Signature</Label>
                  </div>
                  <div className="flex items-center space-x-2 bg-muted/40 p-3 rounded-md border">
                    <Checkbox id="q_bg" checked={form.include_background} onCheckedChange={(c) => setForm({ ...form, include_background: c === true })} />
                    <Label htmlFor="q_bg">Include Watermark Background</Label>
                  </div>
                </div>
              </div>
              <div className="space-y-3 bg-secondary/10 p-5 rounded-lg border self-start">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{getCurrencySymbol(form.currency)}{getSubtotal(form.items).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-red-500 font-medium">
                  <div className="flex items-center gap-2">
                    <span>Discount (%)</span>
                    <Input type="number" className="h-7 w-16 text-xs bg-white text-black text-center" value={form.discount_percentage} onChange={(e) => setForm({ ...form, discount_percentage: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <span>-{getCurrencySymbol(form.currency)}{(getSubtotal(form.items) * (form.discount_percentage / 100)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>GST Total</span>
                  <span>{getCurrencySymbol(form.currency)}{getGSTTotal(form.items, form.discount_percentage).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-xl font-bold pt-3 border-t mt-2">
                  <span>Total Est.</span>
                  <span className="text-primary">{getCurrencySymbol(form.currency)}{getTotal(form.items, form.discount_percentage).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createOrUpdateQuotation.mutate()} disabled={createOrUpdateQuotation.isPending || !form.client_name}>{editingId ? "Save Changes" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quotation Preview Dialog */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between print:hidden">
            <DialogTitle>Quotation Preview</DialogTitle>
            <div className="flex gap-2">
              {preview && preview.status !== "invoiced" && (
                <Button variant="default" size="sm" onClick={() => convertToInvoice.mutate(preview)}>Convert to Invoice</Button>
              )}
              <Button variant="outline" size="sm" onClick={handlePrint}>Print</Button>
            </div>
          </DialogHeader>
          {preview && (
            <div className="relative space-y-6 p-8 border rounded-lg bg-background print:border-0 print:p-0" id="print-area">
              {preview.include_background && profile?.background_logo_url && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0" style={{ opacity: (profile.background_logo_opacity ?? 5) / 100 }}>
                  <img src={profile.background_logo_url} alt="" className="w-[80%] max-h-[80%] object-contain filter grayscale" />
                </div>
              )}
              <div className="relative z-10 flex justify-between items-start border-b pb-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-primary">SALES QUOTATION</h2>
                  <p className="text-lg font-mono mt-1">{preview.quotation_number}</p>
                </div>
                <div className="text-right">
                  <Badge variant={statusColor(preview.status)} className="capitalize">{preview.status}</Badge>
                  <p className="text-sm text-muted-foreground mt-2">Date: {format(new Date(preview.date), "MMM d, yyyy")}</p>
                  {preview.valid_until && <p className="text-sm text-muted-foreground font-medium">Valid Until: {format(new Date(preview.valid_until), "MMM d, yyyy")}</p>}
                </div>
              </div>

              <div className="relative z-10 grid grid-cols-2 gap-8">
                <div>
                  <h3 className="font-semibold text-muted-foreground mb-2">Prepared For:</h3>
                  <p className="font-bold text-lg">{preview.client_name}</p>
                  {preview.client_address && <p className="text-muted-foreground whitespace-pre-wrap">{preview.client_address}</p>}
                  <div className="text-sm text-muted-foreground mt-1">
                    {preview.client_email && <p>{preview.client_email}</p>}
                    {preview.client_phone && <p>{preview.client_phone}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-1">From</p>
                  <p className="font-bold text-lg">{profile?.company_name || "Your Business Name"}</p>
                  {profile?.gstin && profile.gstin !== "NIL" && (
                    <p className="text-sm text-muted-foreground">GSTIN: {profile.gstin}</p>
                  )}
                  {profile?.pan && (
                    <p className="text-sm text-muted-foreground">PAN: <span className="uppercase">{profile.pan}</span></p>
                  )}
                  {profile?.cin && (
                    <p className="text-sm text-muted-foreground">CIN: <span className="uppercase">{profile.cin}</span></p>
                  )}
                  {profile?.address && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.address}</p>}
                  {profile?.website && <p className="text-sm text-muted-foreground">Website: {profile.website}</p>}
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
                  {(preview.quotation_items || []).map((item, i) => (
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

              <div className="relative z-10 flex justify-end pt-4 border-t">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{getCurrencySymbol(preview.currency)}{getSubtotal(preview.quotation_items).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  {preview.discount_percentage && preview.discount_percentage > 0 ? (
                    <div className="flex justify-between text-sm text-red-500 font-medium">
                      <span>Discount ({preview.discount_percentage}%)</span>
                      <span>-{getCurrencySymbol(preview.currency)}{(getSubtotal(preview.quotation_items) * (preview.discount_percentage / 100)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Tax (GST)</span>
                    <span>{getCurrencySymbol(preview.currency)}{getGSTTotal(preview.quotation_items, preview.discount_percentage).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold border-t pt-2">
                    <span>Grand Total</span>
                    <span className="text-primary">{getCurrencySymbol(preview.currency)}{getTotal(preview.quotation_items, preview.discount_percentage).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions / Notes */}
              <div className="relative z-10 mt-8 pt-6 border-t grid grid-cols-2 gap-8">
                {/* Notes Left Column */}
                <div className="space-y-1.5 text-left font-sans">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Notes</h4>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {preview.notes || "Thank you for your business."}
                  </p>
                </div>
                {/* Terms Right Column */}
                <div className="space-y-1.5 text-left font-sans">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Terms & Conditions</h4>
                  <ul className="list-disc pl-4 text-[11px] text-slate-500 leading-relaxed space-y-0.5">
                    <li>Prices are in INR.</li>
                    <li>Taxes extra if applicable.</li>
                    <li>Payment before project commencement.</li>
                    <li>No refund after work has started.</li>
                    <li>Deliverables as per agreed scope.</li>
                    <li>Additional work will be charged separately.</li>
                  </ul>
                </div>
              </div>

              {preview.include_signature && profile?.signature_url && (
                <div className="relative z-10 mt-16 pt-8 flex justify-start items-end">
                  <div className="text-center">
                    <div className="w-48 border-b border-foreground mb-2 animate-pulse"></div>
                    <img src={profile.signature_url} alt="Signature" className="h-12 object-contain mix-blend-multiply ml-auto mr-auto" />
                    <p className="font-bold mt-1 text-sm">{profile.company_name}</p>
                    {profile?.auth_person_name && (
                      <p className="text-xs text-slate-600 mt-0.5 font-medium">{profile.auth_person_name}</p>
                    )}
                    {profile?.auth_designation && (
                      <p className="text-[10px] text-slate-500 italic">{profile.auth_designation}</p>
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
              <DialogTitle>Bulk Quotation Print Preview</DialogTitle>
              <DialogDescription className="sr-only">Preview of selected quotations for bulk printing</DialogDescription>
              <div className="flex gap-2 items-center">
                <span className="text-sm font-medium bg-muted px-3 py-1 rounded-full text-muted-foreground mr-2">{bulkPreview?.length} Quotations</span>
                <Button onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print All
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6 bg-muted/30 p-3 rounded-lg border text-sm">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="bulk_q_sign"
                  checked={bulkIncludeSignature}
                  onCheckedChange={(c) => setBulkIncludeSignature(c === true)}
                />
                <Label htmlFor="bulk_q_sign" className="cursor-pointer font-medium">Include Signatures</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="bulk_q_logo"
                  checked={bulkIncludeLogo}
                  onCheckedChange={(c) => setBulkIncludeLogo(c === true)}
                />
                <Label htmlFor="bulk_q_logo" className="cursor-pointer font-medium">Include Background Logos</Label>
              </div>
            </div>
          </DialogHeader>
          <div id="print-area">
            {bulkPreview && bulkPreview.map((q, index) => (
              <div
                key={q.id}
                className={`relative space-y-6 p-8 border rounded-lg bg-background print:border-0 print:p-0 ${index !== bulkPreview.length - 1 ? 'mb-8 print:mb-0 print:break-after-page' : ''}`}
              >
                {/* Background Watermark */}
                {(bulkIncludeLogo && q.include_background !== false && profile?.background_logo_url?.trim()) && (
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
                    style={{ opacity: (profile.background_logo_opacity ?? 5) / 100 }}
                  >
                    <img src={profile.background_logo_url} alt="Watermark" className="w-[80%] max-h-[80%] object-contain mix-blend-multiply filter grayscale" />
                  </div>
                )}

                <div className="relative z-10 flex justify-between items-start border-b pb-6">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-primary">SALES QUOTATION</h2>
                    <p className="text-lg font-mono mt-1">{q.quotation_number}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={statusColor(q.status)} className="mb-2 capitalize print:hidden">{q.status}</Badge>
                    <p className="text-sm text-muted-foreground">Date: {format(new Date(q.date), "MMM d, yyyy")}</p>
                    {q.valid_until && <p className="text-sm text-muted-foreground font-medium">Valid Until: {format(new Date(q.valid_until), "MMM d, yyyy")}</p>}
                  </div>
                </div>

                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-8 print:grid-cols-2">
                  <div>
                    <h3 className="font-semibold text-muted-foreground mb-2">Prepared For:</h3>
                    <div className="space-y-1">
                      <p className="font-bold text-lg">{q.client_name}</p>
                      {q.client_address && <p className="text-muted-foreground whitespace-pre-wrap">{q.client_address}</p>}
                      <div className="text-sm text-muted-foreground mt-1">
                        {q.client_email && <p>{q.client_email}</p>}
                        {q.client_phone && <p>{q.client_phone}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase text-muted-foreground mb-1">From</p>
                    <p className="font-bold text-lg">{profile?.company_name || "Your Business Name"}</p>
                    {profile?.gstin && profile.gstin !== "NIL" && (
                      <p className="text-sm text-muted-foreground">GSTIN: {profile.gstin}</p>
                    )}
                    {profile?.pan && (
                      <p className="text-sm text-muted-foreground">PAN: <span className="uppercase">{profile.pan}</span></p>
                    )}
                    {profile?.cin && (
                      <p className="text-sm text-muted-foreground">CIN: <span className="uppercase">{profile.cin}</span></p>
                    )}
                    {profile?.address && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.address}</p>}
                    {profile?.website && <p className="text-sm text-muted-foreground">Website: {profile.website}</p>}
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
                    {(q.quotation_items || []).map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{getCurrencySymbol(q.currency)}{Number(item.rate).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-xs">{(item.gst || 0)}%</TableCell>
                        <TableCell className="text-right font-bold">{getCurrencySymbol(q.currency)}{(Number(item.quantity) * Number(item.rate) * (1 + (item.gst || 0) / 100)).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="relative z-10 flex flex-col sm:flex-row justify-end pt-4 border-t print:flex-row">
                  <div className="w-full sm:w-64 space-y-2 print:w-64">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{getCurrencySymbol(q.currency)}{getSubtotal(q.quotation_items).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    {q.discount_percentage && q.discount_percentage > 0 ? (
                      <div className="flex justify-between text-sm text-red-500 font-medium">
                        <span className="text-muted-foreground">Discount ({q.discount_percentage}%)</span>
                        <span>-{getCurrencySymbol(q.currency)}{(getSubtotal(q.quotation_items) * (q.discount_percentage / 100)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Tax (GST)</span>
                      <span>{getCurrencySymbol(q.currency)}{getGSTTotal(q.quotation_items, q.discount_percentage).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold pt-3 border-t-2 border-primary mt-2">
                      <span>Total Est.</span>
                      <span className="text-primary">{getCurrencySymbol(q.currency)}{getTotal(q.quotation_items, q.discount_percentage).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* Terms & Conditions / Notes */}
                <div className="relative z-10 mt-8 pt-6 border-t grid grid-cols-2 gap-8">
                  {/* Notes Left Column */}
                  <div className="space-y-1.5 text-left font-sans">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Notes</h4>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {q.notes || "Thank you for your business."}
                    </p>
                  </div>
                  {/* Terms Right Column */}
                  <div className="space-y-1.5 text-left font-sans">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Terms & Conditions</h4>
                    <ul className="list-disc pl-4 text-[11px] text-slate-500 leading-relaxed space-y-0.5">
                      <li>Prices are in INR.</li>
                      <li>Taxes extra if applicable.</li>
                      <li>Payment before project commencement.</li>
                      <li>No refund after work has started.</li>
                      <li>Deliverables as per agreed scope.</li>
                      <li>Additional work will be charged separately.</li>
                    </ul>
                  </div>
                </div>

                {(bulkIncludeSignature && q.include_signature !== false) && (
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
                      {profile?.auth_person_name && (
                        <p className="text-xs text-slate-600 mt-0.5 font-medium">{profile.auth_person_name}</p>
                      )}
                      {profile?.auth_designation && (
                        <p className="text-[10px] text-slate-500 italic">{profile.auth_designation}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
