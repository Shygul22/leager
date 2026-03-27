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
import { format, isToday, isThisWeek, parseISO, addDays } from "date-fns";
import { Plus, Eye, Trash2, X, Edit, Printer, Search, Package, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { generatePaytmLink, getPaytmEmailBody } from "@/utils/paytm";

type QuotationItem = { id?: string; product_id?: string; description: string; quantity: number; rate: number; gst: number };
type Quotation = {
  id: string; quotation_number: string; client_id: string | null; client_name: string; client_email: string | null; client_phone: string | null; client_address: string | null; client_gstin: string | null; client_msme_number: string | null; client_num: string | null; client_project_id: string | null; date: string; valid_until: string | null; status: string; notes: string | null; include_signature: boolean; include_background: boolean; currency: string | null; exchange_rate: number | null; created_at: string;
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<string>(format(new Date(), "MMM yyyy"));
  const [preview, setPreview] = useState<Quotation | null>(null);
  const [form, setForm] = useState({
    quotation_number: "", client_id: "", client_name: "", client_email: "", client_phone: "", client_address: "", client_gstin: "", client_msme_number: "", client_num: "", client_project_id: "", date: format(new Date(), "yyyy-MM-dd"), valid_until: format(addDays(new Date(), 30), "yyyy-MM-dd"), notes: "", include_signature: true, include_background: true, currency: "INR", exchange_rate: 1,
    items: [{ description: "", quantity: 1, rate: 0, gst: 0 }] as QuotationItem[],
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
    queryKey: ["clients", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("clients").select("*").eq("user_id", user.id).order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ["quotations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("quotations").select("*, quotation_items(*)").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Quotation[];
    },
    enabled: !!user,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("products").select("*").eq("user_id", user.id).order("name", { ascending: true });
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

  const upsertQuotation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const payload = {
        quotation_number: form.quotation_number,
        client_id: form.client_id || null,
        client_name: form.client_name,
        client_email: form.client_email || null,
        client_phone: form.client_phone || null,
        client_address: form.client_address || null,
        client_gstin: form.client_gstin || null,
        client_msme_number: form.client_msme_number || null,
        client_num: form.client_num || null,
        client_project_id: form.client_project_id || null,
        date: form.date,
        valid_until: form.valid_until || null,
        notes: form.notes || null,
        include_signature: form.include_signature,
        include_background: form.include_background,
        currency: form.currency || "INR",
        exchange_rate: form.exchange_rate || 1,
        user_id: user.id
      };

      let quotationId = editingId;

      if (editingId) {
        const { error } = await supabase.from("quotations").update(payload).eq("id", editingId);
        if (error) throw error;
        await supabase.from("quotation_items").delete().eq("quotation_id", editingId);
      } else {
        const { data, error } = await supabase.from("quotations").insert(payload).select().single();
        if (error) throw error;
        quotationId = data.id;
      }

      const items = form.items.filter((i) => i.description).map((i) => ({ 
        quotation_id: quotationId, 
        description: i.description, 
        quantity: i.quantity, 
        rate: i.rate, 
        gst: i.gst 
      }));
      if (items.length > 0) {
        const { error: itemErr } = await supabase.from("quotation_items").insert(items);
        if (itemErr) throw itemErr;
      }
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["quotations"] }); 
      setOpen(false); 
      toast.success(editingId ? "Quotation updated" : "Quotation created"); 
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("quotations").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["quotations"] }); toast.success("Status updated"); },
  });

  const deleteQuotation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["quotations"] }); toast.success("Quotation deleted"); },
  });

  const addItem = () => setForm({ ...form, items: [...form.items, { description: "", quantity: 1, rate: 0, gst: 0 }] });
  const removeItem = (i: number) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i: number, field: keyof QuotationItem, value: string | number) => {
    const items = [...form.items];
    (items[i] as any)[field] = value;
    setForm({ ...form, items });
  };

  const handleSelectProduct = (index: number, product: any) => {
    const items = [...form.items];
    items[index] = {
      ...items[index],
      product_id: product.id,
      description: product.name + (product.description ? ` - ${product.description}` : ""),
      rate: Number(product.rate || 0),
      gst: Number(product.gst_rate || 0)
    };
    setForm({ ...form, items });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...form,
      quotation_number: `QUO-${format(new Date(), "yyyyMMdd")}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
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
      valid_until: format(addDays(new Date(), 30), "yyyy-MM-dd"),
      notes: "",
      include_signature: true,
      include_background: true,
      currency: profile?.default_currency || "INR",
      exchange_rate: 1,
      items: [{ description: "", quantity: 1, rate: 0, gst: 0 }]
    });
    setOpen(true);
  };

  const openEdit = (q: Quotation) => {
    setEditingId(q.id);
    setForm({
      quotation_number: q.quotation_number,
      client_id: q.client_id || "",
      client_name: q.client_name,
      client_email: q.client_email || "",
      client_phone: q.client_phone || "",
      client_address: q.client_address || "",
      client_gstin: q.client_gstin || "",
      client_msme_number: q.client_msme_number || "",
      client_num: q.client_num || "",
      client_project_id: q.client_project_id || "",
      date: q.date,
      valid_until: q.valid_until || "",
      notes: q.notes || "",
      include_signature: q.include_signature ?? true,
      include_background: q.include_background ?? true,
      currency: q.currency || "INR",
      exchange_rate: q.exchange_rate || 1,
      items: q.quotation_items && q.quotation_items.length > 0 ? q.quotation_items.map(i => ({ ...i })) : [{ description: "", quantity: 1, rate: 0, gst: 0 }],
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

  const getSubtotal = (items?: QuotationItem[]) => (items || []).reduce((s, i) => s + i.quantity * i.rate, 0);
  const getGSTTotal = (items?: QuotationItem[]) => (items || []).reduce((s, i) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
  const getTotal = (items?: QuotationItem[]) => getSubtotal(items) + getGSTTotal(items);

  const handleSendEmail = async (q: Quotation) => {
    if (!profile?.paytm_merchant_id) {
      toast.error("Please configure Paytm settings in Settings page first.");
      return;
    }

    try {
      // Mark as published
      const { error } = await supabase.from("quotations").update({ is_published: true }).eq("id", q.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["quotations"] });

      const amount = getTotal(q.quotation_items);
      // Link to the public review page instead of raw Paytm link
      const publicLink = window.location.origin + "/public/quotation/" + q.id;
      const body = `Dear ${q.client_name},

Please find the quotation ${q.quotation_number} for your review.

Total Amount: ${q.currency || "INR"} ${amount.toFixed(2)}

You can review the details and proceed with the payment using the link below:
${publicLink}

Regards,
${profile.company_name || "Accounting Team"}`;
      
      const mailtoUrl = `mailto:${q.client_email || ""}?subject=Quotation ${q.quotation_number}&body=${encodeURIComponent(body)}`;
      window.open(mailtoUrl);
      toast.success("Quotation published and email client opened!");
    } catch (err: any) {
      toast.error("Error publishing quotation: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Quotations</h1>
        <Button onClick={openCreate} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Create Quotation</Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[800px] md:min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Quotation #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-48 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotations.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No quotations yet.</TableCell></TableRow>
              ) : filteredQuotations.map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-sm">{q.quotation_number}</TableCell>
                  <TableCell>{q.client_name}</TableCell>
                  <TableCell>{format(new Date(q.date), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <Select value={q.status} onValueChange={(v) => updateStatus.mutate({ id: q.id, status: v })}>
                      <SelectTrigger className="w-28 h-8 capitalize"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="invoiced">Invoiced</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {getCurrencySymbol(q.currency)}
                    {getTotal(q.quotation_items).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setPreview(q)} title="Preview"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleSendEmail(q)} title="Send Email"><Mail className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(q)} title="Edit"><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteQuotation.mutate(q.id)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Quotation Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Quotation" : "Create New Quotation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="bg-secondary/30 p-4 rounded-lg border">
              <Label className="mb-2 block">Quick Fill from Address Book</Label>
              <Select onValueChange={handleSelectClient}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Select a saved client..." /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1"><Label>Quotation #</Label><Input value={form.quotation_number} onChange={(e) => setForm({ ...form, quotation_number: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Client Name *</Label><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
              <div className="md:col-span-1"><Label>Client Email</Label><Input type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} /></div>
              <div className="md:col-span-1"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="md:col-span-1"><Label>Valid Until</Label><Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
              <div className="md:col-span-2">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(val) => setForm({ ...form, currency: val })}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["INR", "USD", "EUR", "GBP", "AED"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <Label className="text-base font-semibold">Line Items</Label>
                <Button variant="secondary" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
              </div>
              {form.items.map((item, i) => (
                <div key={i} className="flex flex-col lg:flex-row gap-2 bg-muted/20 p-3 rounded-md border lg:border-none">
                  <div className="flex-1 flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild><Button variant="outline"><Package className="h-4 w-4" /></Button></PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandInput placeholder="Search catalog..." />
                          <CommandList>
                            <CommandEmpty>No products found.</CommandEmpty>
                            <CommandGroup>
                              {products.map(p => (
                                <CommandItem key={p.id} value={p.name} onSelect={() => handleSelectProduct(i, p)}>
                                  {p.name} (₹{p.rate})
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Input className="flex-1" placeholder="Description" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <div className="w-20"><Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)} /></div>
                    <div className="w-24"><Input type="number" step="0.01" placeholder="Rate" value={item.rate} onChange={(e) => updateItem(i, "rate", parseFloat(e.target.value) || 0)} /></div>
                    <div className="w-24">
                      <Select value={String(item.gst)} onValueChange={(v) => updateItem(i, "gst", parseFloat(v))}>
                        <SelectTrigger className="h-10 border-none bg-background shadow-sm hover:shadow transition-all"><SelectValue placeholder="GST" /></SelectTrigger>
                        <SelectContent className="border-none shadow-xl">
                          {[0, 5, 12, 18, 28].map(rate => (
                            <SelectItem key={rate} value={String(rate)} className="hover:bg-primary/10 transition-colors">
                              {rate}%
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {form.items.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem(i)}><X className="h-4 w-4" /></Button>}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t">
              <div className="w-64 space-y-2 bg-secondary/10 p-4 rounded-lg">
                <div className="flex justify-between text-sm"><span>Subtotal</span><span>{getCurrencySymbol(form.currency)}{getSubtotal(form.items).toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span>GST Total</span><span>{getCurrencySymbol(form.currency)}{getGSTTotal(form.items).toFixed(2)}</span></div>
                <div className="flex justify-between text-xl font-bold border-t pt-2 mt-2"><span>Total</span><span className="text-primary">{getCurrencySymbol(form.currency)}{getTotal(form.items).toFixed(2)}</span></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => upsertQuotation.mutate()} disabled={upsertQuotation.isPending || !form.client_name}>{editingId ? "Save Changes" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="print:hidden">
            <DialogTitle>Quotation Preview</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
            </div>
          </DialogHeader>
          {preview && (
            <div className="p-8 border rounded-lg bg-background print:border-0 print:p-0" id="print-area">
              <div className="flex justify-between border-b pb-6 mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-primary italic uppercase tracking-widest">Quotation</h2>
                  <p className="font-mono mt-1">{preview.quotation_number}</p>
                  <p className="text-sm text-muted-foreground">Date: {format(new Date(preview.date), "MMM d, yyyy")}</p>
                </div>
                <div className="text-right">
                  <Badge className="capitalize mb-2">{preview.status}</Badge>
                  <p className="font-bold">{profile?.company_name}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile?.address}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="font-bold text-muted-foreground uppercase text-xs mb-2">Quotation For:</h3>
                  <p className="font-bold text-lg">{preview.client_name}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{preview.client_address}</p>
                </div>
                <div className="text-right">
                   {preview.valid_until && <p className="text-sm text-red-500 font-medium italic">Valid Until: {format(new Date(preview.valid_until), "MMM d, yyyy")}</p>}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.quotation_items?.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{getCurrencySymbol(preview.currency)}{Number(item.rate).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold">{getCurrencySymbol(preview.currency)}{(item.quantity * item.rate).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end pt-6 border-t mt-6">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm"><span>Subtotal</span><span>{getCurrencySymbol(preview.currency)}{getSubtotal(preview.quotation_items).toFixed(2)}</span></div>
                  <div className="flex justify-between text-xl font-bold border-t pt-2 mt-2"><span>Grand Total</span><span>{getCurrencySymbol(preview.currency)}{getTotal(preview.quotation_items).toFixed(2)}</span></div>
                </div>
              </div>
              
              <div className="mt-12 text-center text-xs text-muted-foreground italic border-t pt-4">
                Thank you for your business! This is a computer-generated quotation.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
