import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, CheckCircle2, AlertCircle, Printer, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const getCurrencySymbol = (currency?: string | null) => {
  switch (currency) {
    case "USD": return "$";
    case "EUR": return "€";
    case "GBP": return "£";
    case "AED": return "AED ";
    default: return "₹";
  }
};

export default function PublicInvoice() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: inv, error: invErr } = await supabase
          .from("invoices")
          .select("*, invoice_items(*)")
          .eq("id", id)
          .single();

        if (invErr) throw invErr;
        setInvoice(inv);

        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", inv.user_id)
          .single();

        if (profErr) throw profErr;
        setProfile(prof);
      } catch (err: any) {
        console.error("Error fetching public invoice:", err);
        setError("Invoice not found or no longer available.");
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchData();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Error</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => window.close()}>Close Tab</Button>
      </div>
    );
  }

  const subtotal = invoice.invoice_items.reduce((sum: any, item: any) => sum + (Number(item.quantity) * Number(item.rate)), 0);
  const discountAmount = subtotal * ((invoice.discount_percentage || 0) / 100);
  const gstTotal = invoice.invoice_items.reduce((sum: any, item: any) => sum + (Number(item.quantity) * Number(item.rate) * (Number(item.gst) / 100)), 0) * (1 - (invoice.discount_percentage || 0) / 100);
  const total = (subtotal - discountAmount) + gstTotal;

  return (
    <div className="min-h-screen bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-end print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Print / Save PDF
          </Button>
        </div>

        <Card className="shadow-xl border-none overflow-hidden relative bg-white">
          {/* Watermark Logo */}
          {invoice.include_background && profile?.background_logo_url && (
            <div 
              className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0"
              style={{ opacity: (profile.background_logo_opacity || 5) / 100 }}
            >
              <img src={profile.background_logo_url} alt="" className="w-2/3 h-2/3 object-contain" />
            </div>
          )}

          <CardHeader className="border-b bg-white py-8 px-8 sm:px-12 relative z-10">
            <div className="flex flex-col sm:flex-row justify-between gap-6">
              <div>
                <h2 className="text-4xl font-extrabold text-primary italic uppercase tracking-tighter">Tax Invoice</h2>
                <div className="mt-2 text-sm font-mono text-muted-foreground uppercase">
                  #{invoice.invoice_number}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {format(new Date(invoice.date), "MMMM d, yyyy")}
                </div>
              </div>
              <div className="text-right sm:text-right flex flex-col items-end">
                <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'} className="mb-3 capitalize px-3 py-1 text-xs">
                  {invoice.status}
                </Badge>
                {profile?.logo_url && (
                    <img src={profile.logo_url} alt="Logo" className="h-12 w-auto object-contain mb-2" />
                )}
                <div className="font-bold text-xl text-slate-800">{profile?.company_name}</div>
                <div className="text-xs text-slate-500 whitespace-pre-wrap max-w-[250px] text-right">
                  {profile?.address}
                  {profile?.gstin && <p className="mt-1 font-bold">GSTIN: {profile.gstin}</p>}
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="py-12 px-8 sm:px-12 space-y-12 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-3">
                <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest px-1">Bill To:</h3>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="font-bold text-xl text-slate-900 mb-1">{invoice.client_name}</div>
                  <div className="text-sm text-slate-600 space-y-1 whitespace-pre-wrap">
                    {invoice.client_address}
                  </div>
                  <div className="mt-4 space-y-1 text-xs font-medium">
                    {invoice.client_email && <div className="text-primary">{invoice.client_email}</div>}
                    {invoice.client_phone && <div>{invoice.client_phone}</div>}
                    {invoice.client_gstin && <div className="text-muted-foreground mt-2 uppercase">GSTIN: {invoice.client_gstin}</div>}
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-end items-end space-y-4">
                <div className="text-right space-y-1">
                   <div className="text-slate-400 text-[10px] uppercase tracking-widest">Amount Due</div>
                   <div className="text-4xl font-black text-slate-900 tracking-tight">
                     {getCurrencySymbol(invoice.currency)}{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                   </div>
                   <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider pt-1">
                     Due Date: {format(new Date(invoice.due_date), "MMM d, yyyy")}
                   </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="border-b border-slate-100">
                    <TableHead className="py-4 text-slate-500 font-bold uppercase text-[10px] tracking-widest pl-6">Description</TableHead>
                    <TableHead className="text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">Qty</TableHead>
                    <TableHead className="text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">MRP</TableHead>
                    <TableHead className="text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">Disc</TableHead>
                    <TableHead className="text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">Rate</TableHead>
                    <TableHead className="text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest pr-6">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.invoice_items?.map((item: any, i: number) => (
                    <TableRow key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-colors">
                      <TableCell className="py-5 pl-6 font-medium text-slate-800">{item.description}</TableCell>
                      <TableCell className="text-right text-slate-600">{item.quantity}</TableCell>
                      <TableCell className="text-right text-slate-600">
                        {getCurrencySymbol(invoice.currency)}{Number(item.mrp || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-slate-600">
                        {Number(item.discount || 0).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right text-slate-600">
                        {getCurrencySymbol(invoice.currency)}{Number(item.rate).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900 pr-6">
                        {getCurrencySymbol(invoice.currency)}{(item.quantity * item.rate).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{getCurrencySymbol(invoice.currency)}{subtotal.toFixed(2)}</span>
                </div>
                {invoice.discount_percentage && invoice.discount_percentage > 0 ? (
                  <div className="flex justify-between text-sm text-red-500 font-medium">
                    <span>Discount ({invoice.discount_percentage}%)</span>
                    <span>-{getCurrencySymbol(invoice.currency)}{(subtotal * (invoice.discount_percentage / 100)).toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GST Total</span>
                  <span>{getCurrencySymbol(invoice.currency)}{gstTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold border-t pt-2 mt-2">
                  <span>Grand Total</span>
                  <span className="text-primary">{getCurrencySymbol(invoice.currency)}{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-start">
                {invoice.notes && (
                  <div className="p-6 bg-slate-50/30 rounded-2xl border border-slate-100">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Terms & Notes</h4>
                    <p className="text-sm text-slate-600 italic whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                )}
                {invoice.include_signature && profile?.signature_url && (
                    <div className="text-right space-y-2">
                         <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authorized Signature</h4>
                         <img src={profile.signature_url} alt="Signature" className="h-16 w-auto ml-auto object-contain" />
                         <p className="text-xs font-bold text-slate-900">{profile.company_name}</p>
                    </div>
                )}
            </div>
          </CardContent>

          <CardFooter className="bg-slate-900 rounded-b-xl py-6 px-8 sm:px-12 border-t border-slate-800 relative z-10">
            <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-8">
              <div className="flex items-center gap-4 text-slate-400">
                <div className="p-3 bg-slate-800 rounded-full">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">Payment Status</p>
                  <p className="text-xs text-slate-500 uppercase tracking-widest">{invoice.status}</p>
                </div>
              </div>
              {invoice.status !== 'paid' && profile?.payment_details && (
                  <div className="text-right hidden sm:block">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Payment Instructions</p>
                      <p className="text-xs text-slate-300 whitespace-pre-wrap">{profile.payment_details}</p>
                  </div>
              )}
            </div>
          </CardFooter>
        </Card>
        
        <div className="text-center space-y-2 pb-12 opacity-50">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.2em]">Generated by ZENJOURNEY PRIVATE LIMITED</p>
          <div className="flex justify-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest underline decoration-slate-200 underline-offset-4 pointer-events-none">
            <span>Secure SSL Payment</span>
            <span>Digital Audit Trail</span>
          </div>
        </div>
      </div>
    </div>
  );
}
