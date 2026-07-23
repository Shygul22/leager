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
import { numberToWords } from "@/utils/numberToWords";

const parseBankDetails = (details: string | null) => {
  const defaultDetails = {
    holder: "DREAM LIFTS",
    bank: "BANK OF INDIA",
    accNum: "806320110000322",
    branch: "PERUNGALATHUR",
    ifsc: "BKID0008063"
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
  const [products, setProducts] = useState<any[]>([]);
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

        const { data: prods } = await supabase.from("products").select("id, hsn_sac_code");
        if (prods) setProducts(prods);
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
              <img src={profile.background_logo_url} alt="" className="w-2/3 h-2/3 object-contain mix-blend-multiply filter grayscale" />
            </div>
          )}

          <div className="relative z-10 p-8 space-y-6 bg-white font-sans">
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
                  <div className="flex justify-between"><span>Invoice No:</span> <span className="font-bold text-slate-900 font-mono">{invoice.invoice_number}</span></div>
                  <div className="flex justify-between"><span>Place Of Supply:</span> <span className="font-bold text-slate-900 uppercase">{getPlaceOfSupply(invoice.client_gstin, invoice.client_address)}</span></div>
                  <div className="flex justify-between"><span>Invoice Date:</span> <span className="font-bold text-slate-900">{format(new Date(invoice.date), "dd.MM.yyyy")}</span></div>
                  <div className="flex justify-between"><span>Due Date:</span> <span className="font-bold text-slate-900">{format(new Date(invoice.due_date), "dd.MM.yyyy")}</span></div>
                </div>
              </div>

              {/* 3. Bill To vs From Details */}
              <div className="grid grid-cols-2 text-xs">
                {/* Left Column: Bill To */}
                <div className="p-3 border-r border-slate-700 space-y-1 text-left">
                  <h3 className="font-extrabold border-b border-slate-200 pb-1 uppercase tracking-wider text-[10px] text-slate-400">Bill To</h3>
                  <p className="font-black text-slate-800 text-sm mt-1">{invoice.client_name}</p>
                  <p className="text-slate-600 whitespace-pre-wrap leading-relaxed mt-0.5">{invoice.client_address}</p>
                  {invoice.client_phone && <p className="text-slate-600 mt-1">Ph: {invoice.client_phone}</p>}
                  {invoice.client_email && <p className="text-slate-600 mt-0.5">Email: {invoice.client_email}</p>}
                  
                  <div className="pt-1.5 space-y-0.5 text-slate-700 font-medium">
                    {invoice.client_num && <div><span className="text-slate-400">Client ID:</span> <span className="font-bold font-mono">{invoice.client_num}</span></div>}
                    {invoice.client_project_id && <div><span className="text-slate-400">Project ID:</span> <span className="font-bold font-mono">{invoice.client_project_id}</span></div>}
                    {invoice.client_gstin && <div><span className="text-slate-400">GSTIN:</span> <span className="font-bold font-mono uppercase">{invoice.client_gstin}</span></div>}
                    {invoice.client_msme_number && <div><span className="text-slate-400">MSME Number:</span> <span className="font-bold font-mono uppercase">{invoice.client_msme_number}</span></div>}
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
            <div className="overflow-x-auto border border-slate-200 rounded-sm">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#1e3a8a] text-white uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-2 text-center font-bold border-r border-slate-300 w-12">S.No</th>
                    <th className="py-2.5 px-3 font-bold border-r border-slate-300">Item Description</th>
                    <th className="py-2.5 px-2 text-center font-bold border-r border-slate-300 w-20">HSN/SAC</th>
                    <th className="py-2.5 px-2 text-center font-bold border-r border-slate-300 w-16">Qty UoM</th>
                    <th className="py-2.5 px-2 text-right font-bold border-r border-slate-300 w-24">Price ({getCurrencySymbol(invoice.currency)})</th>
                    <th className="py-2.5 px-2 text-right font-bold border-r border-slate-300 w-24">Taxable Val ({getCurrencySymbol(invoice.currency)})</th>
                    <th className="py-2.5 px-2 text-right font-bold border-r border-slate-300 w-24">CGST ({getCurrencySymbol(invoice.currency)})</th>
                    <th className="py-2.5 px-2 text-right font-bold border-r border-slate-300 w-24">SGST ({getCurrencySymbol(invoice.currency)})</th>
                    <th className="py-2.5 px-3 text-right font-bold w-28">Amount ({getCurrencySymbol(invoice.currency)})</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.invoice_items || []).map((item: any, i: number) => {
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
                    const items = invoice.invoice_items || [];
                    const avgGst = items.length > 0 ? (items.reduce((s: any, i: any) => s + (i.gst || 0), 0) / items.length) : 18;

                    return (
                      <>
                        {invoice.discount_percentage ? (
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
                                Discount ({invoice.discount_percentage}%)
                              </td>
                              <td className="py-2 px-2 text-right border-r border-slate-200">
                                -{discountAmount.toFixed(2)}
                              </td>
                              <td colSpan={2} className="border-r border-slate-200"></td>
                              <td className="py-2 px-3 text-right">
                                -{discountAmount.toFixed(2)}
                              </td>
                            </tr>
                          </>
                        ) : null}
                        <tr className={`${invoice.discount_percentage ? 'border-t border-slate-200' : 'border-t-2 border-slate-300'} bg-slate-50 font-bold`}>
                          <td colSpan={5} className="py-2 px-3 text-right border-r border-slate-200">
                            {invoice.discount_percentage ? "Total (Taxable Value) @" : "Total @"}{avgGst.toFixed(0)}%
                          </td>
                          <td className="py-2 px-2 text-right border-r border-slate-200">
                            {(subtotal - discountAmount).toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right border-r border-slate-200">
                            {(gstTotal / 2).toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right border-r border-slate-200">
                            {(gstTotal / 2).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-900">
                            {total.toFixed(2)}
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {/* Totals Summary Column */}
            <div className="flex justify-end pt-4">
              <div className="w-full sm:w-80 space-y-2">
                <div className="flex justify-between items-center text-xs border-b pb-1 font-sans">
                  <span className="text-slate-500 font-semibold uppercase">Subtotal</span>
                  <span className="font-bold text-slate-800">
                    {getCurrencySymbol(invoice.currency)}{" "}
                    {subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {invoice.discount_percentage ? (
                  <div className="flex justify-between items-center text-xs border-b pb-1 font-sans text-red-600 font-medium">
                    <span>Discount ({invoice.discount_percentage}%)</span>
                    <span>
                      -{getCurrencySymbol(invoice.currency)}{" "}
                      {discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ) : null}

                <div className="flex justify-between items-center text-xs border-b pb-1 font-sans">
                  <span className="text-slate-500 font-semibold uppercase">Total Taxable Value</span>
                  <span className="font-bold text-slate-800">
                    {getCurrencySymbol(invoice.currency)}{" "}
                    {(subtotal - discountAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {gstTotal > 0 && (
                  <>
                    <div className="flex justify-between items-center text-xs border-b pb-1 font-sans">
                      <span className="text-slate-500 font-semibold uppercase">CGST</span>
                      <span className="font-bold text-slate-800">
                        {getCurrencySymbol(invoice.currency)}{" "}
                        {(gstTotal / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-b pb-1 font-sans">
                      <span className="text-slate-500 font-semibold uppercase">SGST</span>
                      <span className="font-bold text-slate-800">
                        {getCurrencySymbol(invoice.currency)}{" "}
                        {(gstTotal / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex justify-between items-center text-sm border-b pb-2 font-sans font-bold">
                  <span className="text-slate-900 uppercase">Grand Total</span>
                  <span className="text-primary text-base">
                    {getCurrencySymbol(invoice.currency)}{" "}
                    {total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-[#1e3a8a]/5 border border-[#1e3a8a]/10 p-3 rounded text-left font-sans">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Total Value (in words)</span>
                  <span className="font-extrabold text-[#1e3a8a] text-xs leading-relaxed">
                    {getCurrencySymbol(invoice.currency) === "₹" || invoice.currency === "INR" ? "INR" : getCurrencySymbol(invoice.currency)}{" "}
                    {numberToWords(total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Paytm Style Bordered Footer Box */}
            <div className="relative z-10 border border-slate-700 mt-6 text-xs text-slate-800 font-sans rounded-sm overflow-hidden bg-white shadow-sm">
              <div className="grid grid-cols-2">
                {/* Left Column: Company Metadata */}
                <div className="p-3 border-r border-slate-700 space-y-1.5 text-slate-700 font-mono text-[11px] flex flex-col justify-center text-left">
                  {profile?.gstin && profile.gstin !== "NIL" && (
                    <div className="flex"><span className="w-28 text-slate-400 font-sans font-bold">Company GSTIN</span> <span>: {profile.gstin}</span></div>
                  )}
                  {profile?.pan && (
                    <div className="flex"><span className="w-28 text-slate-400 font-sans font-bold">PAN</span> <span className="uppercase">: {profile.pan}</span></div>
                  )}
                  {profile?.cin && (
                    <div className="flex"><span className="w-28 text-slate-400 font-sans font-bold">CIN</span> <span className="uppercase">: {profile.cin}</span></div>
                  )}
                  <div className="flex"><span className="w-28 text-slate-400 font-sans font-bold">Terms</span> <span>: {invoice.notes || "ALL PAYMENTS ONLY BY NET TRANSFER"}</span></div>
                </div>

                {/* Right Column: Authorized Signature */}
                {invoice.include_signature && profile?.signature_url ? (
                  <div className="p-3 text-center flex flex-col justify-between min-h-[100px]">
                    <div className="font-bold text-slate-900 text-[11px]">FOR {profile?.company_name || "Your Business Name"}</div>
                    <div className="flex justify-center my-1">
                      <img src={profile.signature_url} alt="Signature" className="h-10 object-contain mix-blend-multiply" />
                    </div>
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
