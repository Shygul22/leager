import { useState, useMemo, useEffect } from "react";
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
import { numberToWords } from "@/utils/numberToWords";

const parseBankDetails = (details: string | null) => {
  const defaultDetails = {
    holder: "ZenJourney Private Limited",
    bank: "State Bank of India (SBI)",
    accNum: "45505327860",
    branch: "Ulundurpet",
    ifsc: "SBIN0011071"
  };
  if (!details) return defaultDetails;
  
  const lines = details.split('\n');
  const parsed = { ...defaultDetails };
  
  lines.forEach(line => {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim().toLowerCase();
      const val = parts.slice(1).join(':').trim();
      if (key.includes("holder") || key.includes("account name") || key.includes("account holder")) parsed.holder = val;
      else if (key.includes("bank name") || key.includes("bank")) parsed.bank = val;
      else if (key.includes("account number") || key.includes("account no") || key.includes("acc")) parsed.accNum = val;
      else if (key.includes("branch")) parsed.branch = val;
      else if (key.includes("ifsc")) parsed.ifsc = val;
    }
  });
  return parsed;
};

const getPlaceOfSupply = (gstin?: string | null, address?: string | null) => {
  if (gstin && gstin.length >= 2) {
    const code = gstin.substring(0, 2);
    // Ensure the first two characters are digits (valid GSTIN state code)
    if (/^\d{2}$/.test(code)) {
      if (code === "33") return "TAMIL NADU (33)";
      return code;
    }
  }
  if (address) {
    const addr = address.toLowerCase();
    if (addr.includes("tamil nadu") || addr.includes(", tn") || addr.includes("pudukottai") || addr.includes("kallakurichi") || addr.includes("chennai")) {
      return "TAMIL NADU (33)";
    }
  }
  return "TAMIL NADU (33)";
};

const cleanAddress = (address?: string | null) => {
  if (!address) return "";
  return address
    .split('\n')
    .filter(line => {
      const lower = line.toLowerCase();
      return !lower.includes("contact name") && 
             !lower.includes("contact person") && 
             !lower.includes("email") && 
             !lower.includes("mobile") &&
             !lower.includes("phone");
    })
    .join('\n');
};

const getCompanyName = (name?: string | null) => {
  if (!name || name === "Your Business Name" || name.toUpperCase() === "ZENJOURNEY PRIVATE LIMITED") {
    return "ZenJourney InfoTech";
  }
  return name;
};

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

export default function Invoices() {
  const { user, role, account } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // Renamed from editing to editingId to avoid conflict with Transaction type
  const [selectedRange, setSelectedRange] = useState<string>(format(new Date(), "MMM yyyy"));
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [bulkPreview, setBulkPreview] = useState<Invoice[] | null>(null);
  const [bulkIncludeSignature, setBulkIncludeSignature] = useState(true);
  const [bulkIncludeLogo, setBulkIncludeLogo] = useState(true);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [form, setForm] = useState({
    invoice_number: "", client_id: "", client_name: "", client_email: "", client_phone: "", client_address: "", client_gstin: "", client_msme_number: "", client_num: "", client_project_id: "", date: format(new Date(), "yyyy-MM-dd"), due_date: "", notes: "", payment_reference: "", include_signature: true, include_background: true, currency: "INR", exchange_rate: 1,
    discount_percentage: 0,
    paid_amount: 0,
    status: "draft",
    items: [{ description: "", quantity: 1, rate: 0, gst: 0, mrp: 0, discount: 0 }] as InvoiceItem[],
  });

  useEffect(() => {
    if (form.status === "paid") {
      const total = getTotal(form.items, form.discount_percentage);
      if (form.paid_amount !== total) {
        setForm(prev => ({ ...prev, paid_amount: total }));
      }
    }
  }, [form.items, form.discount_percentage, form.status]);

  const handleStatusChange = (val: string) => {
    const total = getTotal(form.items, form.discount_percentage);
    setForm(prev => ({
      ...prev,
      status: val,
      paid_amount: val === "paid" ? total : (val === "draft" || val === "sent" ? 0 : prev.paid_amount)
    }));
  };

  const handlePaidAmountChange = (val: number) => {
    const total = getTotal(form.items, form.discount_percentage);
    let newStatus = form.status;
    if (val >= total && total > 0) newStatus = "paid";
    else if (val > 0 && val < total) newStatus = "partially_paid";
    else if (val === 0) newStatus = "draft";
    setForm(prev => ({ ...prev, paid_amount: val, status: newStatus }));
  };


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
    queryKey: ["clients", user?.id, role, account?.id],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase.from("clients").select("*");
      if (account?.id) {
        query = query.or(`account_id.eq.${account.id},user_id.eq.${user.id}`);
      } else {
        query = query.eq("user_id", user.id);
      }
      let { data, error } = await query.order("name", { ascending: true });
      if (error && (error.message?.includes("account_id") || error.code === "42703")) {
        const fallback = await supabase.from("clients").select("*").eq("user_id", user.id).order("name", { ascending: true });
        data = fallback.data;
        error = fallback.error;
      }
      if (error) throw error;
      return data;
    },
    enabled: !!user,
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
      let { data, error } = await query.order("created_at", { ascending: false });
      if (error && (error.message?.includes("account_id") || error.code === "42703")) {
        const fallback = await supabase.from("invoices").select("*, invoice_items(*)").eq("user_id", user.id).order("created_at", { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }
      if (error) throw error;
      return data as unknown as Invoice[];
    },
    enabled: !!user,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", user?.id, role, account?.id],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase.from("products").select("*");
      if (account?.id) {
        query = query.or(`account_id.eq.${account.id},user_id.eq.${user.id}`);
      } else {
        query = query.eq("user_id", user.id);
      }
      let { data, error } = await query.order("name", { ascending: true });
      if (error && (error.message?.includes("account_id") || error.code === "42703")) {
        const fallback = await supabase.from("products").select("*").eq("user_id", user.id).order("name", { ascending: true });
        data = fallback.data;
        error = fallback.error;
      }
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", user?.id, role],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase.from("transactions").select("*");
      const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
      if (!isStaffOrAbove) {
        query = query.eq("user_id", user.id);
      }
      const { data, error } = await query.order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!role,
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
      return data as unknown as any[];
    },
    enabled: !!user && !!role,
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

  const clientInvoices = useMemo(() => {
    if (!form.client_id) return [];
    return invoices.filter(inv => inv.client_id === form.client_id);
  }, [invoices, form.client_id]);

  const clientStats = useMemo(() => {
    if (!form.client_id || clientInvoices.length === 0) return null;
    let totalInvoiced = 0;
    
    clientInvoices.forEach(inv => {
      const invTotal = getTotal(inv.invoice_items, inv.discount_percentage);
      totalInvoiced += invTotal;
    });

    const clientTxs = (transactions || []).filter(t => 
      t.client_id === form.client_id || 
      (t.description && t.description.toLowerCase().includes(form.client_name.toLowerCase()))
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

    const totalPaid = invoiceTxPaidAmount + generalPayments;
    
    // Total quotations for this client (incl. Tax, excl. draft/rejected)
    const clientQuotations = (quotations || []).filter((q: any) =>
      (q.client_id === form.client_id ||
       q.client_name?.trim().toLowerCase() === form.client_name?.trim().toLowerCase()) &&
      q.status !== "draft" && q.status !== "rejected"
    );
    const totalQuotations = clientQuotations.reduce((sum: number, q: any) => {
      const subtotal = (q.quotation_items as any[] || []).reduce((s: number, i: any) =>
        s + (i.quantity * i.rate * (1 + (i.gst || 0) / 100)), 0
      );
      const discountPercentage = q.discount_percentage || 0;
      return sum + subtotal * (1 - discountPercentage / 100);
    }, 0);

    const sortedByDate = [...clientInvoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastPaidInvoice = sortedByDate.find(inv => (inv.paid_amount || 0) > 0);

    return {
      totalInvoiced,
      totalPaid,
      totalQuotations,
      balanceDue: totalInvoiced - totalPaid,
      quotationBalance: Math.max(0, totalQuotations - totalPaid),
      lastPayment: lastPaidInvoice ? {
        amount: lastPaidInvoice.paid_amount,
        date: lastPaidInvoice.date,
        invoice_number: lastPaidInvoice.invoice_number
      } : null,
      invoicesHistory: sortedByDate.slice(0, 5)
    };
  }, [clientInvoices, form.client_id, form.client_name, transactions, quotations]);

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

        // 4. Auto-save or update Client to Address Book
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
        } else {
          await supabase.from("clients").update({
            email: form.client_email || existingClient.email,
            phone: form.client_phone || existingClient.phone,
            address: form.client_address || existingClient.address,
            gstin: form.client_gstin || existingClient.gstin,
            msme_number: form.client_msme_number || existingClient.msme_number,
            client_number: form.client_num || existingClient.client_number
          }).eq("id", existingClient.id);
          queryClient.invalidateQueries({ queryKey: ["clients"] });
        }

        // 5. Auto-log Transaction to Ledger if enabled and status is paid
        if (profile?.auto_log_invoices !== false && form.status === "paid") {
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
      const inv = invoices.find(i => i.id === id);
      if (!inv) throw new Error("Invoice not found");

      const total = getTotal(inv.invoice_items, inv.discount_percentage);
      const paidAmount = status === "paid" ? total : (status === "draft" || status === "sent" ? 0 : inv.paid_amount || 0);

      const { error } = await supabase
        .from("invoices")
        .update({ status, paid_amount: paidAmount })
        .eq("id", id);
      if (error) throw error;

      // If status changed to "paid", auto-log income transaction for cash flow sync
      if (status === "paid") {
        if (user) {
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
      try {
        await supabase.from("invoice_items").delete().eq("invoice_id", id);
      } catch (e) {
        console.warn("Pre-delete invoice items warning:", e);
      }
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Invoice deleted successfully"); },
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
      const hasGstin = !!(client.gstin && client.gstin.trim());
      const updatedItems = form.items.map(item => ({
        ...item,
        gst: hasGstin ? 18 : 0
      }));
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
        currency: client.currency || profile?.default_currency || "INR",
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

            {clientStats && (
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 space-y-3 print:hidden">
                <div className="flex items-center justify-between border-b pb-2 border-primary/10">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Client Payment History ({form.client_name})</h4>
                  {clientStats.lastPayment && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                      Last Payment: {getCurrencySymbol(form.currency)}{clientStats.lastPayment.amount?.toLocaleString("en-IN")} on {format(new Date(clientStats.lastPayment.date), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
                  <div className="bg-background/50 p-2 rounded border border-border/40">
                    <p className="text-[9px] text-muted-foreground uppercase font-semibold">Total Invoiced</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{getCurrencySymbol(form.currency)}{clientStats.totalInvoiced.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-2 rounded border border-emerald-100/50 dark:border-emerald-900/20">
                    <p className="text-[9px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold">Total Paid</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{getCurrencySymbol(form.currency)}{clientStats.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className={`p-2 rounded border ${clientStats.balanceDue > 0 ? 'bg-destructive/5 border-destructive/10 text-destructive' : 'bg-background/50 border-border/40'}`}>
                    <p className="text-[9px] uppercase font-semibold">Balance Due</p>
                    <p className="text-sm font-bold">{getCurrencySymbol(form.currency)}{clientStats.balanceDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-violet-50/50 dark:bg-violet-950/20 p-2 rounded border border-violet-100/50 dark:border-violet-900/20">
                    <p className="text-[9px] text-violet-700 dark:text-violet-400 uppercase font-semibold">Total Quotations</p>
                    <p className="text-sm font-bold text-violet-600 dark:text-violet-400">{getCurrencySymbol(form.currency)}{clientStats.totalQuotations.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    <p className="text-[8px] text-muted-foreground">incl. Tax</p>
                  </div>
                  <div className={`p-2 rounded border ${ clientStats.quotationBalance > 0 ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30' : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100/50 dark:border-emerald-900/20'}`}>
                    <p className={`text-[9px] uppercase font-semibold ${ clientStats.quotationBalance > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>Quotation Balance</p>
                    <p className={`text-sm font-bold ${ clientStats.quotationBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{getCurrencySymbol(form.currency)}{clientStats.quotationBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    <p className="text-[8px] text-muted-foreground">{clientStats.quotationBalance > 0 ? '⚠ Unpaid' : '✓ Settled'}</p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recent Invoices History</p>
                  <div className="divide-y divide-border/40 max-h-[120px] overflow-y-auto pr-1">
                    {clientStats.invoicesHistory.map((inv) => {
                      const invTotal = getTotal(inv.invoice_items, inv.discount_percentage);
                      return (
                        <div key={inv.id} className="flex items-center justify-between py-1.5 text-xs">
                          <span className="font-mono text-muted-foreground">{inv.invoice_number} ({format(new Date(inv.date), "MMM d, yyyy")})</span>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground">Paid: <strong className="text-emerald-600 font-semibold">{getCurrencySymbol(inv.currency)}{inv.paid_amount?.toLocaleString("en-IN")}</strong> / {getCurrencySymbol(inv.currency)}{invTotal.toLocaleString("en-IN")}</span>
                            <Badge className="text-[9px] px-1.5 py-0 capitalize" variant={statusColor(inv.status)}>{inv.status.replace('_', ' ')}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1"><Label>Invoice Number</Label><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} placeholder="e.g. ZENIN015" /></div>
              <div className="md:col-span-2"><Label>Company / Client Name *</Label><Input value={form.client_name} onChange={(e) => handleClientNameChange(e.target.value)} placeholder="e.g. Acme Corporation" /></div>
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
              <div className={form.status === "partially_paid" ? "md:col-span-2" : "md:col-span-4"}>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={handleStatusChange}>
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
              {form.status === "partially_paid" && (
                <div className="md:col-span-2">
                  <Label>Amount Already Paid ({getCurrencySymbol(form.currency)})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.paid_amount}
                    onChange={(e) => handlePaidAmountChange(parseFloat(e.target.value) || 0)}
                    className="bg-emerald-50 border-emerald-200 text-emerald-900 font-medium"
                  />
                </div>
              )}
            </div>


            {/* 3. Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b">
                <Label className="text-base font-semibold">Line Items</Label>
                <Button variant="secondary" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
              </div>
              <div className="space-y-3">
                {/* Desktop Header */}
                <div className="hidden lg:grid grid-cols-[1fr_64px_96px_80px_96px_96px_112px_40px] gap-2 text-sm font-medium text-muted-foreground mb-2 px-1">
                  <div>Product / Description</div>
                  <div className="text-center">Qty</div>
                  <div className="text-center">MRP</div>
                  <div className="text-center">Disc (%)</div>
                  <div className="text-center">Net Rate</div>
                  <div className="text-center">GST</div>
                  <div className="text-right">Amount</div>
                  <div></div>
                </div>
                {form.items.map((item, i) => (
                  <div key={i} className="flex flex-col lg:grid lg:grid-cols-[1fr_64px_96px_80px_96px_96px_112px_40px] gap-2 bg-muted/20 p-3 lg:p-1 rounded-md border lg:border-none relative items-center">
                    {/* Column 1: Product / Description */}
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
                      <Input placeholder="Description" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} className="w-full" />
                    </div>

                    {/* Column 2: Qty */}
                    <div className="w-full">
                      <Label className="text-[10px] text-muted-foreground uppercase lg:hidden">Qty</Label>
                      <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)} className="w-full text-center" />
                    </div>

                    {/* Column 3: MRP */}
                    <div className="w-full">
                      <Label className="text-[10px] text-muted-foreground uppercase lg:hidden">MRP</Label>
                      <Input type="number" step="0.01" placeholder="MRP" value={item.mrp} onChange={(e) => updateItem(i, "mrp", parseFloat(e.target.value) || 0)} className="w-full text-center" />
                    </div>

                    {/* Column 4: Disc % */}
                    <div className="w-full">
                      <Label className="text-[10px] text-muted-foreground uppercase lg:hidden">Disc %</Label>
                      <Input type="number" step="0.1" placeholder="Disc %" value={item.discount} onChange={(e) => updateItem(i, "discount", parseFloat(e.target.value) || 0)} className="w-full text-center" />
                    </div>

                    {/* Column 5: Net Rate */}
                    <div className="w-full">
                      <Label className="text-[10px] text-muted-foreground uppercase lg:hidden">Net Rate</Label>
                      <Input type="number" step="0.01" placeholder="Rate" value={item.rate} onChange={(e) => updateItem(i, "rate", parseFloat(e.target.value) || 0)} className="w-full text-center" />
                    </div>

                    {/* Column 6: GST */}
                    <div className="w-full">
                      <Label className="text-[10px] text-muted-foreground uppercase lg:hidden">GST</Label>
                      <Select value={String(item.gst)} onValueChange={(v) => updateItem(i, "gst", parseFloat(v))}>
                        <SelectTrigger className="h-10 bg-background w-full"><SelectValue placeholder="GST" /></SelectTrigger>
                        <SelectContent>
                          {[0, 5, 12, 18, 28].map(rate => <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Column 7: Amount */}
                    <div className="w-full flex items-center justify-between lg:justify-end mt-2 lg:mt-0">
                      <span className="lg:hidden text-sm text-muted-foreground mr-2">Amount:</span>
                      <div className="text-right font-medium lg:w-full">{getCurrencySymbol(form.currency)}{(item.quantity * item.rate * (1 + item.gst / 100)).toFixed(2)}</div>
                    </div>

                    {/* Column 8: Remove */}
                    <div className="w-full flex justify-end mt-2 lg:mt-0">
                      {form.items.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeItem(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
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
        <DialogContent className="max-w-[95vw] md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between print:hidden border-b pb-4">
            <DialogTitle>Invoice Preview</DialogTitle>
            <DialogDescription className="sr-only">Invoice Preview Details</DialogDescription>
            <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
              <Printer className="mr-2 h-4 w-4" /> Print Invoice
            </Button>
          </DialogHeader>
          {preview && (
            <div className="relative space-y-6 p-8 border rounded-lg bg-background print:border-0 print:p-0 font-sans" id="print-area">
              {/* Background Watermark */}
              {(preview.include_background !== false && profile?.background_logo_url?.trim()) && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
                  style={{ opacity: (profile.background_logo_opacity ?? 5) / 100 }}
                >
                  <img src={profile.background_logo_url} alt="Watermark" className="w-[80%] max-h-[80%] object-contain mix-blend-multiply filter grayscale" />
                </div>
              )}

              {/* Copy Label */}
              <div className="relative z-10 text-right text-[10px] text-slate-500 font-sans italic tracking-wide pb-1">
                Original for recipient
              </div>

              {/* Paytm Style Bordered Header Box */}
              <div className="relative z-10 border border-slate-700 text-slate-800 text-left font-sans rounded-sm overflow-hidden bg-white shadow-sm">
                {/* 1. Seller Info Header */}
                <div className="p-4 text-center border-b border-slate-700 bg-slate-50/50">
                  <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
                    {getCompanyName(profile?.company_name)}
                  </h1>
                  {getCompanyName(profile?.company_name).toLowerCase().includes("infotech") && (
                    <p className="text-[10px] text-slate-500 font-bold italic tracking-wide mt-0.5">
                      (ZenJourney Infotech is operated by ZenJourney Private Limited)
                    </p>
                  )}
                  <p className="text-xs mt-1 text-slate-600 whitespace-pre-line leading-relaxed">
                    {cleanAddress(profile?.address)}
                  </p>
                </div>

                {/* 2. Document title & dates grid */}
                <div className="grid grid-cols-3 border-b border-slate-700 text-xs">
                  <div className="col-span-2 p-3 border-r border-slate-700 flex items-center justify-center bg-slate-50/80 font-black tracking-widest text-sm text-[#1e3a8a] uppercase">
                    TAX INVOICE
                  </div>
                  <div className="p-3 space-y-1 font-medium text-slate-700">
                    <div className="flex justify-between"><span>Invoice No:</span> <span className="font-bold text-slate-900 font-mono">{preview.invoice_number}</span></div>
                    <div className="flex justify-between"><span>Place Of Supply:</span> <span className="font-bold text-slate-900 uppercase">{getPlaceOfSupply(preview.client_gstin, preview.client_address)}</span></div>
                    <div className="flex justify-between"><span>Invoice Date:</span> <span className="font-bold text-slate-900">{format(new Date(preview.date), "dd.MM.yyyy")}</span></div>
                    <div className="flex justify-between"><span>Due Date:</span> <span className="font-bold text-slate-900">{format(new Date(preview.due_date), "dd.MM.yyyy")}</span></div>
                  </div>
                </div>

                {/* 3. Bill To vs From Details */}
                <div className="grid grid-cols-2 text-xs">
                  {/* Left Column: Bill To */}
                  <div className="p-3 border-r border-slate-700 space-y-1 text-left">
                    <h3 className="font-extrabold border-b border-slate-200 pb-1 uppercase tracking-wider text-[10px] text-slate-400">Bill To</h3>
                    <p className="font-black text-slate-800 text-sm mt-1">{preview.client_name}</p>
                    <p className="text-slate-600 whitespace-pre-wrap leading-relaxed mt-0.5">{preview.client_address}</p>
                    {preview.client_phone && <p className="text-slate-600 mt-1">Ph: {preview.client_phone}</p>}
                    {preview.client_email && <p className="text-slate-600 mt-0.5">Email: {preview.client_email}</p>}
                    
                    <div className="pt-1.5 space-y-0.5 text-slate-700 font-medium">
                      {preview.client_num && <div><span className="text-slate-400">Client ID:</span> <span className="font-bold font-mono">{preview.client_num}</span></div>}
                      {preview.client_project_id && <div><span className="text-slate-400">Project ID:</span> <span className="font-bold font-mono">{preview.client_project_id}</span></div>}
                      {preview.client_gstin && <div><span className="text-slate-400">GSTIN:</span> <span className="font-bold font-mono uppercase">{preview.client_gstin}</span></div>}
                      {preview.client_msme_number && <div><span className="text-slate-400">MSME Number:</span> <span className="font-bold font-mono uppercase">{preview.client_msme_number}</span></div>}
                    </div>
                  </div>

                  {/* Right Column: From */}
                  <div className="p-3 space-y-1 text-left">
                    <h3 className="font-extrabold border-b border-slate-200 pb-1 uppercase tracking-wider text-[10px] text-slate-400">From ({getCompanyName(profile?.company_name)})</h3>
                    <p className="font-black text-slate-800 text-sm mt-1">{getCompanyName(profile?.company_name)}</p>
                    <p className="text-slate-600 whitespace-pre-wrap leading-relaxed mt-0.5">{cleanAddress(profile?.address)}</p>
                    
                    <div className="pt-1.5 space-y-0.5 text-slate-700 font-medium">
                      {profile?.gstin && profile.gstin !== "NIL" && <div><span className="text-slate-400">GSTIN/ISD:</span> <span className="font-bold font-mono uppercase">{profile.gstin}</span></div>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Items Table */}
              <div className="relative z-10 overflow-x-auto border border-slate-200 rounded-sm">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-[#1e3a8a] text-white uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <th className="py-2.5 px-2 text-center font-bold border-r border-slate-300 w-12">S.No</th>
                      <th className="py-2.5 px-3 font-bold border-r border-slate-300">Item Description</th>
                      <th className="py-2.5 px-2 text-center font-bold border-r border-slate-300 w-20">HSN/SAC</th>
                      <th className="py-2.5 px-2 text-center font-bold border-r border-slate-300 w-16">Qty UoM</th>
                      <th className="py-2.5 px-2 text-right font-bold border-r border-slate-300 w-24">Price ({getCurrencySymbol(preview.currency)})</th>
                      <th className="py-2.5 px-2 text-right font-bold border-r border-slate-300 w-24">Taxable Val ({getCurrencySymbol(preview.currency)})</th>
                      <th className="py-2.5 px-2 text-right font-bold border-r border-slate-300 w-24">CGST ({getCurrencySymbol(preview.currency)})</th>
                      <th className="py-2.5 px-2 text-right font-bold border-r border-slate-300 w-24">SGST ({getCurrencySymbol(preview.currency)})</th>
                      <th className="py-2.5 px-3 text-right font-bold w-28">Amount ({getCurrencySymbol(preview.currency)})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.invoice_items || []).map((item, i) => {
                      const qty = Number(item.quantity || 0);
                      const rate = Number(item.rate || 0);
                      const gstRate = Number(item.gst || 0);
                      const taxable = qty * rate;
                      const gstAmount = taxable * (gstRate / 100);
                      const halfGstAmount = gstAmount / 2;
                      const halfGstRate = gstRate / 2;
                      const amount = taxable + gstAmount;

                      const getHsnCode = (desc: string, prodId?: string | null) => {
                        if (prodId) {
                          const p = products.find(prod => prod.id === prodId);
                          if (p?.hsn_sac_code) return p.hsn_sac_code;
                        }
                        return "9983";
                      };
                      const hsnCode = getHsnCode(item.description, item.product_id);

                      return (
                        <tr key={i} className="border-b border-slate-200 hover:bg-slate-50/50">
                          <td className="py-2 px-2 text-center border-r border-slate-200">{i + 1}</td>
                          <td className="py-2 px-3 border-r border-slate-200 font-medium leading-relaxed">
                            {item.description}
                          </td>
                          <td className="py-2 px-2 text-center border-r border-slate-200 font-mono">{hsnCode}</td>
                          <td className="py-2 px-2 text-center border-r border-slate-200 font-medium">{qty} NOS</td>
                          <td className="py-2 px-2 text-right border-r border-slate-200">{rate.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right border-r border-slate-200">{taxable.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right border-r border-slate-200 text-[10px]">
                            {halfGstAmount.toFixed(2)}
                            <div className="text-[8px] text-slate-500 font-bold">{halfGstRate}%</div>
                          </td>
                          <td className="py-2 px-2 text-right border-r border-slate-200 text-[10px]">
                            {halfGstAmount.toFixed(2)}
                            <div className="text-[8px] text-slate-500 font-bold">{halfGstRate}%</div>
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">{amount.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    {/* Totals Summary Row */}
                    {(() => {
                      const items = preview.invoice_items || [];
                      const subtotal = getSubtotal(items);
                      const discountPercentage = preview.discount_percentage || 0;
                      const discountedSubtotal = subtotal * (1 - discountPercentage / 100);
                      const gstTotal = getGSTTotal(items, discountPercentage);
                      const grandTotal = discountedSubtotal + gstTotal;

                      // Display aggregate tax rates in table footer
                      const avgGst = items.length > 0 ? (items.reduce((s, i) => s + (i.gst || 0), 0) / items.length) : 18;

                      return (
                        <>
                          {discountPercentage > 0 ? (
                            <>
                              <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                                <td colSpan={5} className="py-2 px-3 text-right border-r border-slate-200">
                                  Subtotal
                                </td>
                                <td className="py-2 px-2 text-right border-r border-slate-200">
                                  {subtotal.toFixed(2)}
                                </td>
                                <td colSpan={2} className="border-r border-slate-200"></td>
                                <td className="py-2 px-3 text-right text-slate-900">
                                  {subtotal.toFixed(2)}
                                </td>
                              </tr>
                              <tr className="bg-slate-50 font-bold border-t border-slate-200 text-red-600">
                                <td colSpan={5} className="py-2 px-3 text-right border-r border-slate-200">
                                  Discount ({discountPercentage}%)
                                </td>
                                <td className="py-2 px-2 text-right border-r border-slate-200">
                                  -{(subtotal * (discountPercentage / 100)).toFixed(2)}
                                </td>
                                <td colSpan={2} className="border-r border-slate-200"></td>
                                <td className="py-2 px-3 text-right font-bold">
                                  -{(subtotal * (discountPercentage / 100)).toFixed(2)}
                                </td>
                              </tr>
                            </>
                          ) : null}
                          <tr className={`${discountPercentage > 0 ? 'border-t border-slate-200' : 'border-t-2 border-slate-300'} bg-slate-50 font-bold`}>
                            <td colSpan={5} className="py-2 px-3 text-right border-r border-slate-200">
                              {discountPercentage > 0 ? "Total (Taxable Value) @" : "Total @"}{avgGst.toFixed(0)}%
                            </td>
                            <td className="py-2 px-2 text-right border-r border-slate-200">
                              {discountedSubtotal.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right border-r border-slate-200">
                              {(gstTotal / 2).toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right border-r border-slate-200">
                              {(gstTotal / 2).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-900">
                              {grandTotal.toFixed(2)}
                            </td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary Column */}
              <div className="relative z-10 flex justify-end pt-4">
                <div className="w-full sm:w-80 space-y-2">
                  <div className="flex justify-between items-center text-xs border-b pb-1 font-sans">
                    <span className="text-slate-500 font-semibold uppercase">Subtotal</span>
                    <span className="font-bold text-slate-800">
                      {getCurrencySymbol(preview.currency)}{" "}
                      {getSubtotal(preview.invoice_items).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {preview.discount_percentage ? (
                    <div className="flex justify-between items-center text-xs border-b pb-1 font-sans text-red-600 font-medium">
                      <span>Discount ({preview.discount_percentage}%)</span>
                      <span>
                        -{getCurrencySymbol(preview.currency)}{" "}
                        {(getSubtotal(preview.invoice_items) * (preview.discount_percentage / 100)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex justify-between items-center text-xs border-b pb-1 font-sans">
                    <span className="text-slate-500 font-semibold uppercase">Total Taxable Value</span>
                    <span className="font-bold text-slate-800">
                      {getCurrencySymbol(preview.currency)}{" "}
                      {(getSubtotal(preview.invoice_items) * (1 - (preview.discount_percentage || 0) / 100)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {getGSTTotal(preview.invoice_items, preview.discount_percentage) > 0 && (
                    <>
                      <div className="flex justify-between items-center text-xs border-b pb-1 font-sans">
                        <span className="text-slate-500 font-semibold uppercase">CGST</span>
                        <span className="font-bold text-slate-800">
                          {getCurrencySymbol(preview.currency)}{" "}
                          {(getGSTTotal(preview.invoice_items, preview.discount_percentage) / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-b pb-1 font-sans">
                        <span className="text-slate-500 font-semibold uppercase">SGST</span>
                        <span className="font-bold text-slate-800">
                          {getCurrencySymbol(preview.currency)}{" "}
                          {(getGSTTotal(preview.invoice_items, preview.discount_percentage) / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between items-center text-sm border-b pb-2 font-sans font-bold">
                    <span className="text-slate-900 uppercase">Grand Total</span>
                    <span className="text-primary text-base">
                      {getCurrencySymbol(preview.currency)}{" "}
                      {getTotal(preview.invoice_items, preview.discount_percentage).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="bg-[#1e3a8a]/5 border border-[#1e3a8a]/10 p-3 rounded font-sans">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Total Value (in words)</span>
                    <span className="font-extrabold text-[#1e3a8a] text-xs leading-relaxed">
                      {getCurrencySymbol(preview.currency) === "₹" || preview.currency === "INR" ? "INR" : getCurrencySymbol(preview.currency)}{" "}
                      {numberToWords(getTotal(preview.invoice_items, preview.discount_percentage))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Paytm Style Bordered Footer Box */}
              <div className="relative z-10 border border-slate-700 mt-6 text-xs text-slate-800 font-sans rounded-sm overflow-hidden bg-white shadow-sm">
                <div className="grid grid-cols-2">
                  {/* Left Column: Company Metadata */}
                  <div className="p-3 border-r border-slate-700 space-y-1.5 text-slate-700 font-mono text-[11px] flex flex-col justify-center">
                    {profile?.gstin && profile.gstin !== "NIL" && (
                      <div className="flex"><span className="w-28 text-slate-400 font-sans">Company GSTIN</span> <span>: {profile.gstin}</span></div>
                    )}
                    {profile?.pan && (
                      <div className="flex"><span className="w-28 text-slate-400 font-sans">PAN</span> <span className="uppercase">: {profile.pan}</span></div>
                    )}
                    {profile?.cin && (
                      <div className="flex"><span className="w-28 text-slate-400 font-sans">CIN</span> <span className="uppercase">: {profile.cin}</span></div>
                    )}
                    <div className="flex"><span className="w-28 text-slate-400 font-sans">Terms</span> <span>: {preview.notes || "ALL PAYMENTS ONLY BY NET TRANSFER"}</span></div>
                  </div>

                  {/* Right Column: Authorized Signature */}
                  {preview.include_signature !== false ? (
                    <div className="p-3 text-center flex flex-col justify-between min-h-[100px]">
                      <div className="font-bold text-slate-900 text-[11px]">FOR {profile?.company_name || "Your Business Name"}</div>
                      {profile?.signature_url?.trim() ? (
                        <div className="flex justify-center my-1">
                          <img src={profile.signature_url} alt="Signature" className="h-10 object-contain mix-blend-multiply" />
                        </div>
                      ) : (
                        <div className="h-10"></div>
                      )}
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Authorised Signatory</div>
                        {profile?.auth_person_name && (
                          <div className="text-[10px] text-slate-600 font-bold">{profile.auth_person_name}</div>
                        )}
                        {profile?.auth_designation && (
                          <div className="text-[9px] text-slate-400 italic">{profile.auth_designation}</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 text-center flex items-center justify-center min-h-[100px] text-slate-400 italic">
                      Signature Not Included
                    </div>
                  )}
                </div>

                {/* Bottom Banner Info */}
                <div className="border-t border-slate-700 p-3 bg-slate-50/50 text-[10px] text-slate-500 leading-relaxed text-center font-medium font-sans">
                  <div className="font-bold text-slate-700">{profile?.company_name}</div>
                  <div>Corporate Office: {cleanAddress(profile?.address)}</div>
                  {profile?.phone || profile?.email || profile?.website ? (
                    <div className="mt-0.5 space-x-3">
                      {profile?.phone && <span>Ph No. {profile.phone}</span>}
                      {profile?.email && <span>Email Id - {profile.email}</span>}
                      {profile?.website && <span>Website - {profile.website}</span>}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Print Preview Dialog */}
      <Dialog open={!!bulkPreview} onOpenChange={() => setBulkPreview(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[95vh] overflow-y-auto print:overflow-visible">
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
          <div id="print-area" className="space-y-8">
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

                {/* Copy Label */}
                <div className="relative z-10 text-right text-[10px] text-slate-500 font-sans italic tracking-wide pb-1">
                  Original for recipient
                </div>

                {/* Paytm Style Bordered Header Box */}
                <div className="relative z-10 border border-slate-700 text-slate-800 text-left font-sans rounded-sm overflow-hidden bg-white shadow-sm">
                  {/* 1. Seller Info Header */}
                  <div className="p-4 text-center border-b border-slate-700 bg-slate-50/50">
                    <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
                      {getCompanyName(profile?.company_name)}
                    </h1>
                    {getCompanyName(profile?.company_name).toLowerCase().includes("infotech") && (
                      <p className="text-[10px] text-slate-500 font-bold italic tracking-wide mt-0.5">
                        (ZenJourney Infotech is operated by ZenJourney Private Limited)
                      </p>
                    )}
                    <p className="text-xs mt-1 text-slate-600 whitespace-pre-line leading-relaxed">
                      {cleanAddress(profile?.address)}
                    </p>
                  </div>

                  {/* 2. Document title & dates grid */}
                  <div className="grid grid-cols-3 border-b border-slate-700 text-xs">
                    <div className="col-span-2 p-3 border-r border-slate-700 flex items-center justify-center bg-slate-50/80 font-black tracking-widest text-sm text-[#1e3a8a] uppercase">
                      TAX INVOICE
                    </div>
                    <div className="p-3 space-y-1 font-medium text-slate-700">
                      <div className="flex justify-between"><span>Invoice No:</span> <span className="font-bold text-slate-900 font-mono">{inv.invoice_number}</span></div>
                      <div className="flex justify-between"><span>Place Of Supply:</span> <span className="font-bold text-slate-900 uppercase">{getPlaceOfSupply(inv.client_gstin, inv.client_address)}</span></div>
                      <div className="flex justify-between"><span>Invoice Date:</span> <span className="font-bold text-slate-900">{format(new Date(inv.date), "dd.MM.yyyy")}</span></div>
                      <div className="flex justify-between"><span>Due Date:</span> <span className="font-bold text-slate-900">{format(new Date(inv.due_date), "dd.MM.yyyy")}</span></div>
                    </div>
                  </div>

                  {/* 3. Bill To vs From Details */}
                  <div className="grid grid-cols-2 text-xs">
                    {/* Left Column: Bill To */}
                    <div className="p-3 border-r border-slate-700 space-y-1 text-left">
                      <h3 className="font-extrabold border-b border-slate-200 pb-1 uppercase tracking-wider text-[10px] text-slate-400">Bill To</h3>
                      <p className="font-black text-slate-800 text-sm mt-1">{inv.client_name}</p>
                      <p className="text-slate-600 whitespace-pre-wrap leading-relaxed mt-0.5">{inv.client_address}</p>
                      {inv.client_phone && <p className="text-slate-600 mt-1">Ph: {inv.client_phone}</p>}
                      {inv.client_email && <p className="text-slate-600 mt-0.5">Email: {inv.client_email}</p>}
                      
                      <div className="pt-1.5 space-y-0.5 text-slate-700 font-medium">
                        {inv.client_num && <div><span className="text-slate-400">Client ID:</span> <span className="font-bold font-mono">{inv.client_num}</span></div>}
                        {inv.client_project_id && <div><span className="text-slate-400">Project ID:</span> <span className="font-bold font-mono">{inv.client_project_id}</span></div>}
                        {inv.client_gstin && <div><span className="text-slate-400">GSTIN:</span> <span className="font-bold font-mono uppercase">{inv.client_gstin}</span></div>}
                        {inv.client_msme_number && <div><span className="text-slate-400">MSME Number:</span> <span className="font-bold font-mono uppercase">{inv.client_msme_number}</span></div>}
                      </div>
                    </div>

                    {/* Right Column: From */}
                    <div className="p-3 space-y-1 text-left">
                      <h3 className="font-extrabold border-b border-slate-200 pb-1 uppercase tracking-wider text-[10px] text-slate-400">From ({getCompanyName(profile?.company_name)})</h3>
                      <p className="font-black text-slate-800 text-sm mt-1">{getCompanyName(profile?.company_name)}</p>
                      <p className="text-slate-600 whitespace-pre-wrap leading-relaxed mt-0.5">{cleanAddress(profile?.address)}</p>
                      
                      <div className="pt-1.5 space-y-0.5 text-slate-700 font-medium">
                        {profile?.gstin && profile.gstin !== "NIL" && <div><span className="text-slate-400">GSTIN/ISD:</span> <span className="font-bold font-mono uppercase">{profile.gstin}</span></div>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Items Table */}
                <div className="relative z-10 overflow-x-auto border border-slate-200 rounded-sm">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-[#1e3a8a] text-white uppercase text-[10px] tracking-wider border-b border-slate-200">
                        <th className="py-2.5 px-2 text-center font-bold border-r border-slate-300 w-12">S.No</th>
                        <th className="py-2.5 px-3 font-bold border-r border-slate-300">Item Description</th>
                        <th className="py-2.5 px-2 text-center font-bold border-r border-slate-300 w-20">HSN/SAC</th>
                        <th className="py-2.5 px-2 text-center font-bold border-r border-slate-300 w-16">Qty UoM</th>
                        <th className="py-2.5 px-2 text-right font-bold border-r border-slate-300 w-24">Price ({getCurrencySymbol(inv.currency)})</th>
                        <th className="py-2.5 px-2 text-right font-bold border-r border-slate-300 w-24">Taxable Val ({getCurrencySymbol(inv.currency)})</th>
                        <th className="py-2.5 px-2 text-right font-bold border-r border-slate-300 w-24">CGST ({getCurrencySymbol(inv.currency)})</th>
                        <th className="py-2.5 px-2 text-right font-bold border-r border-slate-300 w-24">SGST ({getCurrencySymbol(inv.currency)})</th>
                        <th className="py-2.5 px-3 text-right font-bold w-28">Amount ({getCurrencySymbol(inv.currency)})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(inv.invoice_items || []).map((item, i) => {
                        const qty = Number(item.quantity || 0);
                        const rate = Number(item.rate || 0);
                        const gstRate = Number(item.gst || 0);
                        const taxable = qty * rate;
                        const gstAmount = taxable * (gstRate / 100);
                        const halfGstAmount = gstAmount / 2;
                        const halfGstRate = gstRate / 2;
                        const amount = taxable + gstAmount;

                        const getHsnCode = (desc: string, prodId?: string | null) => {
                          if (prodId) {
                            const p = products.find(prod => prod.id === prodId);
                            if (p?.hsn_sac_code) return p.hsn_sac_code;
                          }
                          return "9983";
                        };
                        const hsnCode = getHsnCode(item.description, item.product_id);

                        return (
                          <tr key={i} className="border-b border-slate-200 hover:bg-slate-50/50">
                            <td className="py-2 px-2 text-center border-r border-slate-200">{i + 1}</td>
                            <td className="py-2 px-3 border-r border-slate-200 font-medium leading-relaxed">
                              {item.description}
                            </td>
                            <td className="py-2 px-2 text-center border-r border-slate-200 font-mono">{hsnCode}</td>
                            <td className="py-2 px-2 text-center border-r border-slate-200 font-medium">{qty} NOS</td>
                            <td className="py-2 px-2 text-right border-r border-slate-200">{rate.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right border-r border-slate-200">{taxable.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right border-r border-slate-200 text-[10px]">
                              {halfGstAmount.toFixed(2)}
                              <div className="text-[8px] text-slate-500 font-bold">{halfGstRate}%</div>
                            </td>
                            <td className="py-2 px-2 text-right border-r border-slate-200 text-[10px]">
                              {halfGstAmount.toFixed(2)}
                              <div className="text-[8px] text-slate-500 font-bold">{halfGstRate}%</div>
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">{amount.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                      {/* Totals Summary Row */}
                      {(() => {
                        const items = inv.invoice_items || [];
                        const subtotal = getSubtotal(items);
                        const discountPercentage = inv.discount_percentage || 0;
                        const discountedSubtotal = subtotal * (1 - discountPercentage / 100);
                        const gstTotal = getGSTTotal(items, discountPercentage);
                        const grandTotal = discountedSubtotal + gstTotal;

                        // Display aggregate tax rates in table footer
                        const avgGst = items.length > 0 ? (items.reduce((s, i) => s + (i.gst || 0), 0) / items.length) : 18;

                        return (
                          <>
                            {discountPercentage > 0 ? (
                              <>
                                <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                                  <td colSpan={5} className="py-2 px-3 text-right border-r border-slate-200">
                                    Subtotal
                                  </td>
                                  <td className="py-2 px-2 text-right border-r border-slate-200">
                                    {subtotal.toFixed(2)}
                                  </td>
                                  <td colSpan={2} className="border-r border-slate-200"></td>
                                  <td className="py-2 px-3 text-right text-slate-900">
                                    {subtotal.toFixed(2)}
                                  </td>
                                </tr>
                                <tr className="bg-slate-50 font-bold border-t border-slate-200 text-red-600">
                                  <td colSpan={5} className="py-2 px-3 text-right border-r border-slate-200">
                                    Discount ({discountPercentage}%)
                                  </td>
                                  <td className="py-2 px-2 text-right border-r border-slate-200">
                                    -{(subtotal * (discountPercentage / 100)).toFixed(2)}
                                  </td>
                                  <td colSpan={2} className="border-r border-slate-200"></td>
                                  <td className="py-2 px-3 text-right font-bold">
                                    -{(subtotal * (discountPercentage / 100)).toFixed(2)}
                                  </td>
                                </tr>
                              </>
                            ) : null}
                            <tr className={`${discountPercentage > 0 ? 'border-t border-slate-200' : 'border-t-2 border-slate-300'} bg-slate-50 font-bold`}>
                              <td colSpan={5} className="py-2 px-3 text-right border-r border-slate-200">
                                {discountPercentage > 0 ? "Total (Taxable Value) @" : "Total @"}{avgGst.toFixed(0)}%
                              </td>
                              <td className="py-2 px-2 text-right border-r border-slate-200">
                                {discountedSubtotal.toFixed(2)}
                              </td>
                              <td className="py-2 px-2 text-right border-r border-slate-200">
                                {(gstTotal / 2).toFixed(2)}
                              </td>
                              <td className="py-2 px-2 text-right border-r border-slate-200">
                                {(gstTotal / 2).toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-900">
                                {grandTotal.toFixed(2)}
                              </td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Totals Summary Column */}
                <div className="relative z-10 flex justify-end pt-4">
                  <div className="w-full sm:w-80 space-y-2">
                    <div className="flex justify-between items-center text-xs border-b pb-1 font-sans">
                      <span className="text-slate-500 font-semibold uppercase">Subtotal</span>
                      <span className="font-bold text-slate-800">
                        {getCurrencySymbol(inv.currency)}{" "}
                        {getSubtotal(inv.invoice_items).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {inv.discount_percentage ? (
                      <div className="flex justify-between items-center text-xs border-b pb-1 font-sans text-red-600 font-medium">
                        <span>Discount ({inv.discount_percentage}%)</span>
                        <span>
                          -{getCurrencySymbol(inv.currency)}{" "}
                          {(getSubtotal(inv.invoice_items) * (inv.discount_percentage / 100)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ) : null}

                    <div className="flex justify-between items-center text-xs border-b pb-1 font-sans">
                      <span className="text-slate-500 font-semibold uppercase">Total Taxable Value</span>
                      <span className="font-bold text-slate-800">
                        {getCurrencySymbol(inv.currency)}{" "}
                        {(getSubtotal(inv.invoice_items) * (1 - (inv.discount_percentage || 0) / 100)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {getGSTTotal(inv.invoice_items, inv.discount_percentage) > 0 && (
                      <>
                        <div className="flex justify-between items-center text-xs border-b pb-1 font-sans">
                          <span className="text-slate-500 font-semibold uppercase">CGST</span>
                          <span className="font-bold text-slate-800">
                            {getCurrencySymbol(inv.currency)}{" "}
                            {(getGSTTotal(inv.invoice_items, inv.discount_percentage) / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs border-b pb-1 font-sans">
                          <span className="text-slate-500 font-semibold uppercase">SGST</span>
                          <span className="font-bold text-slate-800">
                            {getCurrencySymbol(inv.currency)}{" "}
                            {(getGSTTotal(inv.invoice_items, inv.discount_percentage) / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between items-center text-sm border-b pb-2 font-sans font-bold">
                      <span className="text-slate-900 uppercase">Grand Total</span>
                      <span className="text-primary text-base">
                        {getCurrencySymbol(inv.currency)}{" "}
                        {getTotal(inv.invoice_items, inv.discount_percentage).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="bg-[#1e3a8a]/5 border border-[#1e3a8a]/10 p-3 rounded font-sans">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Total Value (in words)</span>
                      <span className="font-extrabold text-[#1e3a8a] text-xs leading-relaxed">
                        {getCurrencySymbol(inv.currency) === "₹" || inv.currency === "INR" ? "INR" : getCurrencySymbol(inv.currency)}{" "}
                        {numberToWords(getTotal(inv.invoice_items, inv.discount_percentage))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Paytm Style Bordered Footer Box */}
                <div className="relative z-10 border border-slate-700 mt-6 text-xs text-slate-800 font-sans rounded-sm overflow-hidden bg-white shadow-sm">
                  <div className="grid grid-cols-2">
                    {/* Left Column: Company Metadata */}
                    <div className="p-3 border-r border-slate-700 space-y-1.5 text-slate-700 font-mono text-[11px] flex flex-col justify-center">
                      {profile?.gstin && profile.gstin !== "NIL" && (
                        <div className="flex"><span className="w-28 text-slate-400 font-sans">Company GSTIN</span> <span>: {profile.gstin}</span></div>
                      )}
                      {profile?.pan && (
                        <div className="flex"><span className="w-28 text-slate-400 font-sans">PAN</span> <span className="uppercase">: {profile.pan}</span></div>
                      )}
                      {profile?.cin && (
                        <div className="flex"><span className="w-28 text-slate-400 font-sans">CIN</span> <span className="uppercase">: {profile.cin}</span></div>
                      )}
                      <div className="flex"><span className="w-28 text-slate-400 font-sans">Terms</span> <span>: {inv.notes || "ALL PAYMENTS ONLY BY NET TRANSFER"}</span></div>
                    </div>

                    {/* Right Column: Authorized Signature */}
                    {(bulkIncludeSignature && inv.include_signature !== false) ? (
                      <div className="p-3 text-center flex flex-col justify-between min-h-[100px]">
                        <div className="font-bold text-slate-900 text-[11px]">FOR {profile?.company_name || "Your Business Name"}</div>
                        {profile?.signature_url?.trim() ? (
                          <div className="flex justify-center my-1">
                            <img src={profile.signature_url} alt="Signature" className="h-10 object-contain mix-blend-multiply" />
                          </div>
                        ) : (
                          <div className="h-10"></div>
                        )}
                        <div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Authorised Signatory</div>
                          {profile?.auth_person_name && (
                            <div className="text-[10px] text-slate-600 font-bold">{profile.auth_person_name}</div>
                          )}
                          {profile?.auth_designation && (
                            <div className="text-[9px] text-slate-400 italic">{profile.auth_designation}</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 text-center flex items-center justify-center min-h-[100px] text-slate-400 italic">
                        Signature Not Included
                      </div>
                    )}
                  </div>

                  {/* Bottom Banner Info */}
                  <div className="border-t border-slate-700 p-3 bg-slate-50/50 text-[10px] text-slate-500 leading-relaxed text-center font-medium font-sans">
                    <div className="font-bold text-slate-700">{profile?.company_name}</div>
                    <div>Corporate Office: {cleanAddress(profile?.address)}</div>
                    {profile?.phone || profile?.email || profile?.website ? (
                      <div className="mt-0.5 space-x-3">
                        {profile?.phone && <span>Ph No. {profile.phone}</span>}
                        {profile?.email && <span>Email Id - {profile.email}</span>}
                        {profile?.website && <span>Website - {profile.website}</span>}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}
