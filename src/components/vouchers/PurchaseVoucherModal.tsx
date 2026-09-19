import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, X, CheckSquare, Square } from "lucide-react";
import { format } from "date-fns";
import { numberToWords } from "@/utils/numberToWords";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";

export interface PurchaseVoucherItem {
  description: string;
  hsn?: string;
  quantity: number;
  rate: number;
  taxableValue?: number;
  gstPercent?: number;
  gstAmount?: number;
  total?: number;
}

export interface PurchaseVoucherData {
  voucherNo?: string;
  voucherDate?: string;
  financialYear?: string;
  vendorInvoiceNo?: string;
  vendorInvoiceDate?: string;
  poRefNo?: string;
  costCenter?: "Zenjourney InfoTech" | "Movara Media Production" | "Zero Growth" | "Corporate / General";
  vendorName?: string;
  vendorCode?: string;
  vendorAddress?: string;
  vendorGstin?: string;
  vendorPan?: string;
  vendorPhoneEmail?: string;
  natureOfPurchase?: "Goods / Assets" | "Services" | "Software / SaaS" | "Freelancer / Contract" | "Other";
  items: PurchaseVoucherItem[];
  tdsSection?: string;
  tdsAmount?: number;
  roundOff?: number;
  paymentMode?: "Cash" | "UPI" | "NEFT / RTGS / IMPS" | "Cheque" | "Card" | "Credit (Payable)";
  bankAccountPaidFrom?: string;
  txnRefNo?: string;
  paymentDate?: string;
  supportingDocs?: string[];
  narration?: string;
  preparedBy?: string;
  verifiedBy?: string;
  approvedBy?: string;
  receivedBy?: string;
}

interface PurchaseVoucherModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PurchaseVoucherData;
}

export const PurchaseVoucherModal: React.FC<PurchaseVoucherModalProps> = ({
  open,
  onOpenChange,
  data: initialData
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<PurchaseVoucherData>(initialData);
  const [selectedVertical, setSelectedVertical] = useState<string>(
    initialData.costCenter || "Zenjourney InfoTech"
  );
  const [selectedNature, setSelectedNature] = useState<string>(
    initialData.natureOfPurchase || "Services"
  );
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>(
    initialData.paymentMode || "NEFT / RTGS / IMPS"
  );
  const [isExporting, setIsExporting] = useState(false);

  // Sync state if initialData changes
  React.useEffect(() => {
    setData(initialData);
    if (initialData.costCenter) setSelectedVertical(initialData.costCenter);
    if (initialData.natureOfPurchase) setSelectedNature(initialData.natureOfPurchase);
    if (initialData.paymentMode) setSelectedPaymentMode(initialData.paymentMode);
  }, [initialData]);

  // Compute Financial Year if not supplied
  const currentYear = new Date().getFullYear();
  const nextYearShort = (currentYear + 1).toString().slice(-2);
  const defaultFY = `${currentYear}-${currentYear + 1}`;
  const fy = data.financialYear || defaultFY;

  // Compute Items and Totals
  const normalizedItems = (data.items && data.items.length > 0)
    ? data.items
    : [
        {
          description: "Technical Consulting & Cloud Architecture Services",
          hsn: "998313",
          quantity: 1,
          rate: 45000,
          taxableValue: 45000,
          gstPercent: 18,
          gstAmount: 8100,
          total: 53100
        }
      ];

  const totalTaxable = normalizedItems.reduce((acc, item) => {
    const taxVal = item.taxableValue ?? (item.quantity * item.rate);
    return acc + taxVal;
  }, 0);

  const totalGst = normalizedItems.reduce((acc, item) => {
    const taxVal = item.taxableValue ?? (item.quantity * item.rate);
    const gst = item.gstAmount ?? (taxVal * (item.gstPercent || 18) / 100);
    return acc + gst;
  }, 0);

  const isInterState = data.vendorGstin && !data.vendorGstin.startsWith("33"); // 33 is Tamil Nadu
  const cgst = isInterState ? 0 : totalGst / 2;
  const sgst = isInterState ? 0 : totalGst / 2;
  const igst = isInterState ? totalGst : 0;
  const tdsDeducted = data.tdsAmount || 0;
  const roundOff = data.roundOff || 0;
  const netAmountPayable = Math.max(0, Math.round(totalTaxable + totalGst - tdsDeducted + roundOff));

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
        heightLeft -= pageHeight;
      }

      const filename = `Purchase_Voucher_${data.voucherNo || "ZJ-PV"}_${format(new Date(), "yyyyMMdd")}.pdf`;
      pdf.save(filename);
      toast.success("Purchase Voucher PDF downloaded successfully");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setIsExporting(false);
    }
  };

  // Ensure 6 rows visually
  const padRowCount = Math.max(6, normalizedItems.length);
  const rows = [...normalizedItems];
  while (rows.length < padRowCount) {
    rows.push({ description: "", quantity: 0, rate: 0, taxableValue: 0, gstPercent: 0, gstAmount: 0, total: 0 });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-2 sm:p-6 bg-slate-100 dark:bg-slate-950">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Official Purchase Voucher
              <span className="text-xs font-normal text-muted-foreground font-mono">
                {data.voucherNo || "(ZJ/PV/26-27/001)"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Goods, Services & Subscriptions Voucher — Print ready and compliant with corporate standards
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 text-xs font-semibold gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            <Button size="sm" onClick={handleDownloadPDF} disabled={isExporting} className="h-8 text-xs font-semibold gap-1.5 bg-primary">
              <Download className="h-3.5 w-3.5" /> {isExporting ? "Exporting..." : "Download PDF"}
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Canvas */}
        <div className="voucher-printable bg-white text-slate-900 p-6 md:p-8 rounded-lg shadow-md border border-slate-300 font-sans mx-auto max-w-[850px]" ref={printRef}>
          {/* Header */}
          <div className="bg-[#0c3656] text-white p-4 sm:p-5 rounded-t-md flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-[#009688]">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-black tracking-wide uppercase font-serif text-white">
                ZENJOURNEY PRIVATE LIMITED
              </h1>
              <p className="text-[11px] font-mono tracking-tight text-slate-200">
                CIN: U62013TN2026PTC191867
              </p>
              <p className="text-[10px] text-slate-300">
                Registered Office: Kallakurichi District, Tamil Nadu, India
              </p>
              <p className="text-[9px] font-semibold text-cyan-300 tracking-wider">
                Zenjourney InfoTech &nbsp;|&nbsp; Movara Media Production &nbsp;|&nbsp; Zero Growth
              </p>
            </div>
            <div className="mt-3 sm:mt-0 text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-700">
              <h2 className="text-lg sm:text-xl font-black uppercase tracking-wider text-white">
                PURCHASE VOUCHER
              </h2>
              <p className="text-[10px] font-medium text-cyan-200">
                Goods / Services / Subscriptions
              </p>
            </div>
          </div>

          {/* Voucher Meta Grid */}
          <div className="border-x border-b border-slate-400 text-[11px]">
            <div className="grid grid-cols-3 divide-x divide-slate-400 border-b border-slate-400">
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Voucher No.: </span>
                <span className="font-mono font-bold text-slate-900">{data.voucherNo || "(ZJ/PV/26-27/001)"}</span>
              </div>
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Voucher Date: </span>
                <span className="font-medium">{data.voucherDate || format(new Date(), "dd/MM/yyyy")}</span>
              </div>
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Financial Year: </span>
                <span className="font-medium">{fy}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-400">
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Vendor Invoice No.: </span>
                <span className="font-mono">{data.vendorInvoiceNo || "—"}</span>
              </div>
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Vendor Invoice Date: </span>
                <span>{data.vendorInvoiceDate || "—"}</span>
              </div>
              <div className="p-1.5">
                <span className="font-bold text-slate-700">PO / Ref. No.: </span>
                <span className="font-mono">{data.poRefNo || "—"}</span>
              </div>
            </div>
          </div>

          {/* Cost Centre / Business Vertical */}
          <div className="border-x border-b border-slate-400 text-[11px]">
            <div className="bg-slate-100 font-bold px-2 py-1 uppercase text-[10px] text-slate-700 border-b border-slate-300">
              Cost Centre / Business Vertical
            </div>
            <div className="p-2 flex flex-wrap gap-4 sm:gap-6">
              {[
                "Zenjourney InfoTech",
                "Movara Media Production",
                "Zero Growth",
                "Corporate / General"
              ].map((v) => (
                <label key={v} className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={selectedVertical === v}
                    onChange={() => setSelectedVertical(v)}
                    className="h-3.5 w-3.5 rounded border-slate-400 text-[#0c3656] focus:ring-0"
                  />
                  <span>{v}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Vendor Details */}
          <div className="border-x border-b border-slate-400 text-[11px]">
            <div className="bg-slate-100 font-bold px-2 py-1 uppercase text-[10px] text-slate-700 border-b border-slate-300">
              Vendor Details
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-400 border-b border-slate-400">
              <div className="col-span-2 p-1.5">
                <span className="font-bold text-slate-700">Vendor / Supplier Name: </span>
                <span className="font-bold text-slate-900">{data.vendorName || "Unspecified Vendor"}</span>
              </div>
              <div className="col-span-1 p-1.5">
                <span className="font-bold text-slate-700">Vendor Code: </span>
                <span className="font-mono">{data.vendorCode || "—"}</span>
              </div>
            </div>
            <div className="p-1.5 border-b border-slate-400">
              <span className="font-bold text-slate-700">Address: </span>
              <span>{data.vendorAddress || "—"}</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-400 border-b border-slate-400">
              <div className="p-1.5">
                <span className="font-bold text-slate-700">GSTIN: </span>
                <span className="font-mono font-semibold">{data.vendorGstin || "NIL"}</span>
              </div>
              <div className="p-1.5">
                <span className="font-bold text-slate-700">PAN: </span>
                <span className="font-mono">{data.vendorPan || "—"}</span>
              </div>
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Phone / Email: </span>
                <span>{data.vendorPhoneEmail || "—"}</span>
              </div>
            </div>
            <div className="p-2 flex flex-wrap items-center gap-4">
              <span className="font-bold text-slate-700">Nature of Purchase:</span>
              {[
                "Goods / Assets",
                "Services",
                "Software / SaaS",
                "Freelancer / Contract",
                "Other"
              ].map((n) => (
                <label key={n} className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={selectedNature === n}
                    onChange={() => setSelectedNature(n)}
                    className="h-3.5 w-3.5 rounded border-slate-400 text-[#0c3656] focus:ring-0"
                  />
                  <span>{n}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Particulars of Purchase Table */}
          <div className="border-x border-b border-slate-400">
            <div className="bg-slate-100 font-bold px-2 py-1 uppercase text-[10px] text-slate-700 border-b border-slate-400">
              Particulars of Purchase
            </div>
            <table className="w-full text-[10.5px] border-collapse">
              <thead>
                <tr className="bg-[#0c3656] text-white border-b border-slate-400 text-center font-bold">
                  <th className="border-r border-slate-500 py-1.5 px-1 w-10">S. No.</th>
                  <th className="border-r border-slate-500 py-1.5 px-2 text-left">Description of Goods / Services</th>
                  <th className="border-r border-slate-500 py-1.5 px-1 w-16">HSN / SAC</th>
                  <th className="border-r border-slate-500 py-1.5 px-1 w-12">Qty</th>
                  <th className="border-r border-slate-500 py-1.5 px-1 w-16 text-right">Rate (₹)</th>
                  <th className="border-r border-slate-500 py-1.5 px-1 w-20 text-right">Taxable Value (₹)</th>
                  <th className="border-r border-slate-500 py-1.5 px-1 w-12">GST %</th>
                  <th className="border-r border-slate-500 py-1.5 px-1 w-16 text-right">GST Amt (₹)</th>
                  <th className="py-1.5 px-1 w-20 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {rows.map((row, idx) => {
                  const taxable = row.taxableValue ?? (row.quantity && row.rate ? row.quantity * row.rate : 0);
                  const gstAmt = row.gstAmount ?? (taxable ? taxable * (row.gstPercent || 18) / 100 : 0);
                  const rowTotal = row.total ?? (taxable + gstAmt);

                  return (
                    <tr key={idx} className="h-6">
                      <td className="border-r border-slate-300 text-center py-1 px-1 font-mono text-slate-600">
                        {idx + 1}
                      </td>
                      <td className="border-r border-slate-300 py-1 px-2 font-medium text-slate-900">
                        {row.description}
                      </td>
                      <td className="border-r border-slate-300 text-center py-1 px-1 font-mono text-slate-700">
                        {row.hsn || (row.description ? "9983" : "")}
                      </td>
                      <td className="border-r border-slate-300 text-center py-1 px-1 font-mono">
                        {row.quantity > 0 ? row.quantity : ""}
                      </td>
                      <td className="border-r border-slate-300 text-right py-1 px-1 font-mono">
                        {row.rate > 0 ? row.rate.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : ""}
                      </td>
                      <td className="border-r border-slate-300 text-right py-1 px-1 font-mono">
                        {taxable > 0 ? taxable.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : ""}
                      </td>
                      <td className="border-r border-slate-300 text-center py-1 px-1 font-mono">
                        {row.description ? `${row.gstPercent || 18}%` : ""}
                      </td>
                      <td className="border-r border-slate-300 text-right py-1 px-1 font-mono">
                        {gstAmt > 0 ? gstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : ""}
                      </td>
                      <td className="text-right py-1 px-1 font-mono font-semibold">
                        {rowTotal > 0 ? rowTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Calculations and Amount in Words */}
            <div className="grid grid-cols-12 border-t border-slate-400">
              <div className="col-span-7 p-2.5 flex flex-col justify-between border-r border-slate-400">
                <div>
                  <span className="font-bold text-[10.5px] text-slate-700">Amount in Words (Rupees):</span>
                  <p className="text-xs font-serif font-bold text-slate-900 mt-1 capitalize leading-snug">
                    {numberToWords(netAmountPayable)}
                  </p>
                </div>
                <div className="text-[10px] text-slate-500 italic mt-3">
                  Rupees <span className="font-bold font-serif not-italic text-slate-800">{numberToWords(netAmountPayable)}</span>
                </div>
              </div>
              <div className="col-span-5 text-[10.5px]">
                <div className="grid grid-cols-2 divide-x divide-slate-300 border-b border-slate-300 px-2 py-1">
                  <span className="text-slate-700">Sub-Total (Taxable Value)</span>
                  <span className="text-right font-mono font-semibold">₹{totalTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-300 border-b border-slate-300 px-2 py-1">
                  <span className="text-slate-700">CGST</span>
                  <span className="text-right font-mono">₹{cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-300 border-b border-slate-300 px-2 py-1">
                  <span className="text-slate-700">SGST</span>
                  <span className="text-right font-mono">₹{sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-300 border-b border-slate-300 px-2 py-1">
                  <span className="text-slate-700">IGST</span>
                  <span className="text-right font-mono">₹{igst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-300 border-b border-slate-300 px-2 py-1">
                  <span className="text-slate-700">Less: TDS deducted {data.tdsSection ? `(Sec. ${data.tdsSection})` : ""}</span>
                  <span className="text-right font-mono text-rose-700">{tdsDeducted > 0 ? `−₹${tdsDeducted.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹0.00"}</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-300 border-b border-slate-400 px-2 py-1">
                  <span className="text-slate-700">Round Off</span>
                  <span className="text-right font-mono">{roundOff !== 0 ? `₹${roundOff.toFixed(2)}` : "₹0.00"}</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-400 px-2 py-1.5 bg-[#0c3656] text-white font-bold text-xs">
                  <span className="uppercase tracking-wider">NET AMOUNT PAYABLE</span>
                  <span className="text-right font-mono text-sm tracking-tight text-white">
                    ₹{netAmountPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="border-x border-b border-slate-400 text-[11px]">
            <div className="bg-slate-100 font-bold px-2 py-1 uppercase text-[10px] text-slate-700 border-b border-slate-300">
              Payment Details
            </div>
            <div className="p-2 flex flex-wrap items-center gap-4 border-b border-slate-300">
              <span className="font-bold text-slate-700">Mode:</span>
              {[
                "Cash",
                "UPI",
                "NEFT / RTGS / IMPS",
                "Cheque",
                "Card",
                "Credit (Payable)"
              ].map((m) => (
                <label key={m} className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={selectedPaymentMode === m}
                    onChange={() => setSelectedPaymentMode(m)}
                    className="h-3.5 w-3.5 rounded border-slate-400 text-[#0c3656] focus:ring-0"
                  />
                  <span>{m}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-400">
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Bank / Account Paid From: </span>
                <span>{data.bankAccountPaidFrom || "SBI A/c 45505327860"}</span>
              </div>
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Txn. Ref. / Cheque No.: </span>
                <span className="font-mono">{data.txnRefNo || "—"}</span>
              </div>
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Payment Date: </span>
                <span>{data.paymentDate || format(new Date(), "dd/MM/yyyy")}</span>
              </div>
            </div>
          </div>

          {/* Supporting Documents Attached */}
          <div className="border-x border-b border-slate-400 text-[11px]">
            <div className="bg-slate-100 font-bold px-2 py-1 uppercase text-[10px] text-slate-700 border-b border-slate-300">
              Supporting Documents Attached
            </div>
            <div className="p-2 flex flex-wrap gap-5">
              {[
                "Tax Invoice / Bill",
                "Purchase Order",
                "Delivery Challan / Receipt",
                "Payment Proof",
                "Other: ________"
              ].map((doc, idx) => (
                <label key={idx} className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-slate-800">
                  <input
                    type="checkbox"
                    defaultChecked={idx === 0}
                    className="h-3.5 w-3.5 rounded border-slate-400 text-[#0c3656] focus:ring-0"
                  />
                  <span>{doc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Narration / Remarks */}
          <div className="border-x border-b border-slate-400 text-[11px] p-2 min-h-[42px]">
            <span className="font-bold text-slate-700">Narration / Remarks: </span>
            <span className="text-slate-800">{data.narration || "Being payment against approved purchase order and verified vendor tax invoice."}</span>
          </div>

          {/* Signature Boxes */}
          <div className="border-x border-b border-slate-400 grid grid-cols-4 divide-x divide-slate-400 text-center text-[10px] font-bold">
            <div className="p-3 pt-8 flex flex-col justify-end">
              <div className="border-t border-slate-400 pt-1.5">
                <div className="text-slate-900 uppercase font-black">PREPARED BY</div>
                <div className="font-normal text-slate-600 text-[9px]">{data.preparedBy || "Staff / Accounts"} / {format(new Date(), "dd-MM-yy")}</div>
              </div>
            </div>
            <div className="p-3 pt-8 flex flex-col justify-end">
              <div className="border-t border-slate-400 pt-1.5">
                <div className="text-slate-900 uppercase font-black">VERIFIED BY (ACCOUNTS)</div>
                <div className="font-normal text-slate-600 text-[9px]">{data.verifiedBy || "Finance Lead"} / {format(new Date(), "dd-MM-yy")}</div>
              </div>
            </div>
            <div className="p-3 pt-8 flex flex-col justify-end">
              <div className="border-t border-slate-400 pt-1.5">
                <div className="text-slate-900 uppercase font-black">APPROVED BY (DIRECTOR)</div>
                <div className="font-normal text-slate-600 text-[9px]">Shygul Akbar / Executive Director</div>
              </div>
            </div>
            <div className="p-3 pt-8 flex flex-col justify-end">
              <div className="border-t border-slate-400 pt-1.5">
                <div className="text-slate-900 uppercase font-black">RECEIVED BY (VENDOR)</div>
                <div className="font-normal text-slate-600 text-[9px]">Sign / Stamp / Date</div>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="flex justify-between items-center text-[9px] text-slate-500 pt-2 font-medium">
            <span>Original: Accounts &nbsp;|&nbsp; Duplicate: Vendor. Attach original tax invoice.</span>
            <span className="font-semibold text-slate-700">Zenjourney Private Limited</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
