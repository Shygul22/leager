import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { initiatePaytmPayment } from "@/utils/paytm";
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

export default function PublicQuotation() {
  const { id } = useParams();
  const [quotation, setQuotation] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: quo, error: quoErr } = await supabase
          .from("quotations")
          .select("*, quotation_items(*)")
          .eq("id", id)
          .single();

        if (quoErr) throw quoErr;
        setQuotation(quo);

        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", quo.user_id)
          .single();

        if (profErr) throw profErr;
        setProfile(prof);
      } catch (err: any) {
        console.error("Error fetching public quotation:", err);
        setError("Quotation not found or no longer available.");
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchData();
  }, [id]);

  const handlePay = async () => {
    try {
      setIsPaying(true);
      const data = await initiatePaytmPayment(quotation.id);
      
      if (data.error) throw new Error(data.error);

      // Create a hidden form and submit it to Paytm
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.url;

      for (const [key, value] of Object.entries(data.params)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value as string;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
    } catch (err: any) {
      toast.error("Payment failed to initialize: " + err.message);
    } finally {
      setIsPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Error</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => window.close()}>Close Tab</Button>
      </div>
    );
  }

  const subtotal = quotation.quotation_items.reduce((s: any, i: any) => s + i.quantity * i.rate, 0);
  const gstTotal = quotation.quotation_items.reduce((s: any, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0);
  const total = subtotal + gstTotal;

  return (
    <div className="min-h-screen bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Card className="shadow-xl border-none">
          <CardHeader className="border-b bg-white rounded-t-xl py-8 px-8 sm:px-12">
            <div className="flex flex-col sm:flex-row justify-between gap-6">
              <div>
                <h2 className="text-4xl font-extrabold text-primary italic uppercase tracking-tighter">Quotation</h2>
                <div className="mt-2 text-sm font-mono text-muted-foreground uppercase">
                  #{quotation.quotation_number}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {format(new Date(quotation.date), "MMMM d, yyyy")}
                </div>
              </div>
              <div className="text-right sm:text-right">
                <Badge variant={quotation.status === 'accepted' ? 'default' : 'secondary'} className="mb-3 capitalize px-3 py-1 text-xs">
                  {quotation.status}
                </Badge>
                <div className="font-bold text-xl text-slate-800">{profile?.company_name}</div>
                <div className="text-xs text-slate-500 whitespace-pre-wrap max-w-[250px] ml-auto">
                  {profile?.address}
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="py-12 px-8 sm:px-12 space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-3">
                <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest px-1">Bill To:</h3>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="font-bold text-xl text-slate-900 mb-1">{quotation.client_name}</div>
                  <div className="text-sm text-slate-600 space-y-1 whitespace-pre-wrap">
                    {quotation.client_address}
                  </div>
                  {quotation.client_email && <div className="text-sm text-primary mt-2">{quotation.client_email}</div>}
                </div>
              </div>
              <div className="flex flex-col justify-end items-end space-y-4">
                {quotation.valid_until && (
                  <div className="bg-red-50 text-red-600 font-medium italic text-[11px] px-3 py-1 rounded-full border border-red-100 uppercase tracking-wide">
                    Valid Until: {format(new Date(quotation.valid_until), "MMM d, yyyy")}
                  </div>
                )}
                <div className="text-right space-y-1">
                   <div className="text-slate-400 text-[10px] uppercase tracking-widest">Total Amount Due</div>
                   <div className="text-4xl font-black text-slate-900 tracking-tight">
                     {getCurrencySymbol(quotation.currency)}{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
                    <TableHead className="text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">Rate</TableHead>
                    <TableHead className="text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest pr-6">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotation.quotation_items?.map((item: any, i: number) => (
                    <TableRow key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-colors">
                      <TableCell className="py-5 pl-6 font-medium text-slate-800">{item.description}</TableCell>
                      <TableCell className="text-right text-slate-600">{item.quantity}</TableCell>
                      <TableCell className="text-right text-slate-600">
                        {getCurrencySymbol(quotation.currency)}{Number(item.rate).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900 pr-6">
                        {getCurrencySymbol(quotation.currency)}{(item.quantity * item.rate).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end pt-8">
              <div className="w-full max-w-xs space-y-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  <span>Subtotal</span>
                  <span>{getCurrencySymbol(quotation.currency)}{subtotal.toFixed(2)}</span>
                </div>
                {gstTotal > 0 && (
                  <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-widest pb-4 border-b border-slate-200/60">
                    <span>GST (Total)</span>
                    <span>{getCurrencySymbol(quotation.currency)}{gstTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-2xl font-black text-slate-900 pt-2 tracking-tight">
                  <span className="text-slate-500 text-sm font-bold uppercase flex items-center">Grand Total</span>
                  <span>{getCurrencySymbol(quotation.currency)}{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {quotation.notes && (
              <div className="p-6 bg-slate-50/30 rounded-2xl border border-slate-100">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Terms & Notes</h4>
                <p className="text-sm text-slate-600 italic whitespace-pre-wrap">{quotation.notes}</p>
              </div>
            )}
          </CardContent>

          <CardFooter className="bg-slate-900 rounded-b-xl py-10 px-8 sm:px-12 border-t border-slate-800">
            <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-8">
              <div className="flex items-center gap-4 text-slate-400">
                <div className="p-3 bg-slate-800 rounded-full">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">Secure Checkout</p>
                  <p className="text-xs text-slate-500 max-w-[180px]">Instant payment confirmation via Paytm Gateway</p>
                </div>
              </div>
              
              <div className="flex w-full sm:w-auto gap-3">
                {quotation.status === 'accepted' ? (
                   <div className="flex items-center gap-2 text-emerald-500 font-bold bg-emerald-500/10 px-6 py-4 rounded-xl border border-emerald-500/20 w-full animate-in fade-in zoom-in">
                     <CheckCircle2 className="h-6 w-6" />
                     Already Paid
                   </div>
                ) : (
                  <Button 
                    size="lg" 
                    className="w-full sm:w-auto px-12 py-8 text-lg font-black tracking-tight rounded-xl bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all shadow-xl shadow-primary/20"
                    onClick={handlePay}
                    disabled={isPaying}
                  >
                    {isPaying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Proceed to Pay {getCurrencySymbol(quotation.currency)}{total.toFixed(2)}
                  </Button>
                )}
              </div>
            </div>
          </CardFooter>
        </Card>
        
        <div className="text-center space-y-2 pb-12 opacity-50">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.2em]">Generated by EasyLedger ERP</p>
          <div className="flex justify-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest underline decoration-slate-200 underline-offset-4 pointer-events-none">
            <span>Secure 256-bit SSL</span>
            <span>GDPR Compliant</span>
            <span>Audit Trail Enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
}
