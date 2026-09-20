import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { format } from "date-fns";
import { numberToWords } from "@/utils/numberToWords";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface ExpenseStatementItem {
  date?: string;
  categoryCode?: string; // e.g. TR, FL, FD, AC, CM, IN, OS, SH, SW, OT
  description: string;
  billReceiptNo?: string;
  amountClaimed: number;
  approvedAmount?: number;
}

export interface ReimbursementVoucherData {
  voucherNo?: string;
  voucherDate?: string;
  financialYear?: string;
  claimantName?: string;
  employeeId?: string;
  designation?: string;
  department?: string;
  reportingManager?: string;
  contactNo?: string;
  vertical?: string;
  claimPeriodFrom?: string;
  claimPeriodTo?: string;
  projectOrClient?: string;
  purpose?: string;
  items: ExpenseStatementItem[];
  advanceTaken?: number;
  nonAdmissible?: number;
  paymentMode?: "Bank Transfer" | "UPI" | "Cash" | "Cheque" | "Adjust against: Salary / Advance";
  accountNameOrUpi?: string;
  accountNo?: string;
  ifsc?: string;
  paymentDate?: string;
  preparedBy?: string;
  managerName?: string;
  accountsName?: string;
  approvedByName?: string;
  companyName?: string;
  cin?: string;
  registeredOffice?: string;
  verticals?: string;
}

interface ReimbursementVoucherModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReimbursementVoucherData;
}

export const ReimbursementVoucherModal: React.FC<ReimbursementVoucherModalProps> = ({
  open,
  onOpenChange,
  data: initialData
}) => {
  const { user, account } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ReimbursementVoucherData>(initialData);
  const [selectedVertical, setSelectedVertical] = useState<string>(
    initialData.vertical || "Zenjourney InfoTech"
  );
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>(
    initialData.paymentMode || "Bank Transfer"
  );
  const [isExporting, setIsExporting] = useState(false);

  // Dynamically fetch company profile settings
  const { data: profile } = useQuery({
    queryKey: ["reimb_voucher_profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return p;
    },
    enabled: !!user,
  });

  const companyName = data.companyName || account?.company_name || profile?.company_name || "ZENJOURNEY PRIVATE LIMITED";
  const cinNumber = data.cin || profile?.cin_number || profile?.cin || "U62013TN2026PTC191867";
  const registeredOffice = data.registeredOffice || profile?.address || "Registered Office: Kallakurichi District, Tamil Nadu, India";
  const authPersonName = data.approvedByName || profile?.auth_person_name || "Authorized Director";
  const authDesignation = profile?.auth_designation || "Director / Authorized Signatory";
  const bankAccNo = data.accountNo || profile?.account_number || "—";
  const bankIfsc = data.ifsc || profile?.ifsc_code || "—";
  const bankAccountName = data.accountNameOrUpi || (profile?.full_name ? `${profile.full_name} / ${profile.upi_id || ""}`.trim() : "—");

  React.useEffect(() => {
    setData(initialData);
    if (initialData.vertical) setSelectedVertical(initialData.vertical);
    if (initialData.paymentMode) setSelectedPaymentMode(initialData.paymentMode);
  }, [initialData]);

  const currentYear = new Date().getFullYear();
  const defaultFY = `${currentYear}-${currentYear + 1}`;
  const fy = data.financialYear || defaultFY;

  const defaultCostCenters = [
    "Zenjourney InfoTech",
    "Movara Media Production",
    "Zero Growth",
    "Corporate / General"
  ];
  const availableVerticals = Array.from(new Set([
    ...defaultCostCenters,
    ...(data.vertical ? [data.vertical] : [])
  ]));

  const normalizedItems = (data.items && data.items.length > 0)
    ? data.items
    : [
        {
          date: format(new Date(), "yyyy-MM-dd"),
          categoryCode: "OT",
          description: data.purpose || "Expense claim",
          billReceiptNo: "REC-01",
          amountClaimed: 0,
          approvedAmount: 0
        }
      ];

  const totalClaimed = normalizedItems.reduce((acc, item) => acc + (item.amountClaimed || 0), 0);
  const advanceTaken = data.advanceTaken || 0;
  const nonAdmissible = data.nonAdmissible || 0;
  const netPayable = Math.max(0, totalClaimed - advanceTaken - nonAdmissible);

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

      const filename = `Expense_Voucher_${data.voucherNo || "ZJ-EV"}_${format(new Date(), "yyyyMMdd")}.pdf`;
      pdf.save(filename);
      toast.success("Expense Voucher PDF downloaded successfully");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setIsExporting(false);
    }
  };

  // Ensure 10 rows visually like the template
  const padRowCount = Math.max(10, normalizedItems.length);
  const rows = [...normalizedItems];
  while (rows.length < padRowCount) {
    rows.push({ description: "", amountClaimed: 0, approvedAmount: 0 });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-2 sm:p-6 bg-slate-100 dark:bg-slate-950">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Expense / Reimbursement Voucher
              <span className="text-xs font-normal text-muted-foreground font-mono">
                {data.voucherNo || "(ZJ/EV/26-27/001)"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Official Employee, Founder & Team Claims Voucher with category attribution and managerial sign-offs
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
                {companyName}
              </h1>
              {cinNumber && cinNumber !== "NIL" && (
                <p className="text-[11px] font-mono tracking-tight text-slate-200">
                  CIN: {cinNumber}
                </p>
              )}
              <p className="text-[10px] text-slate-300">
                {registeredOffice}
              </p>
              <p className="text-[9px] font-semibold text-cyan-300 tracking-wider">
                {data.verticals || (companyName.toLowerCase().includes("zenjourney") 
                  ? "Zenjourney InfoTech \u00a0|\u00a0 Movara Media Production \u00a0|\u00a0 Zero Growth" 
                  : "Finance & Accounts Department")}
              </p>
            </div>
            <div className="mt-3 sm:mt-0 text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-700">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
                EXPENSE / REIMBURSEMENT VOUCHER
              </h2>
              <p className="text-[10px] font-medium text-cyan-200">
                Employee, Founder & Team Claims
              </p>
            </div>
          </div>

          {/* Voucher Meta Grid */}
          <div className="border-x border-b border-slate-400 text-[11px]">
            <div className="grid grid-cols-3 divide-x divide-slate-400">
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Voucher No.: </span>
                <span className="font-mono font-bold text-slate-900">{data.voucherNo || "(ZJ/EV/26-27/001)"}</span>
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
          </div>

          {/* Claimant Details */}
          <div className="border-x border-b border-slate-400 text-[11px]">
            <div className="bg-slate-100 font-bold px-2 py-1 uppercase text-[10px] text-slate-700 border-b border-slate-300">
              Claimant Details
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-400 border-b border-slate-400">
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Name of Claimant: </span>
                <span className="font-bold text-slate-900">{data.claimantName || "Claimant"}</span>
              </div>
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Employee / Team ID: </span>
                <span className="font-mono">{data.employeeId || "—"}</span>
              </div>
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Designation: </span>
                <span>{data.designation || "Staff Member"}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-400 border-b border-slate-400">
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Department / Vertical: </span>
                <span>{data.department || selectedVertical}</span>
              </div>
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Reporting Manager: </span>
                <span>{data.reportingManager || "Management"}</span>
              </div>
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Contact No.: </span>
                <span>{data.contactNo || "—"}</span>
              </div>
            </div>
            <div className="p-2 flex flex-wrap items-center gap-4 sm:gap-6">
              <span className="font-bold text-slate-700">Vertical:</span>
              {availableVerticals.map((v) => (
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

          {/* Claim Details */}
          <div className="border-x border-b border-slate-400 text-[11px]">
            <div className="bg-slate-100 font-bold px-2 py-1 uppercase text-[10px] text-slate-700 border-b border-slate-300">
              Claim Details
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-400 border-b border-slate-400">
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Claim Period: </span>
                <span>From {data.claimPeriodFrom || format(new Date(), "dd/MM/yyyy")} To {data.claimPeriodTo || format(new Date(), "dd/MM/yyyy")}</span>
              </div>
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Project / Client / Shoot (if any): </span>
                <span>{data.projectOrClient || "General Corporate Operations"}</span>
              </div>
            </div>
            <div className="p-1.5">
              <span className="font-bold text-slate-700">Purpose of Expense / Business Justification: </span>
              <span className="text-slate-800">{data.purpose || "Official business operational expenditure authorized for company development."}</span>
            </div>
          </div>

          {/* Expense Statement Table */}
          <div className="border-x border-b border-slate-400">
            <div className="bg-slate-100 font-bold px-2 py-1 uppercase text-[10px] text-slate-700 border-b border-slate-400">
              Expense Statement
            </div>
            <table className="w-full text-[10.5px] border-collapse">
              <thead>
                <tr className="bg-[#0c3656] text-white border-b border-slate-400 text-center font-bold">
                  <th className="border-r border-slate-500 py-1.5 px-1 w-10">S. No.</th>
                  <th className="border-r border-slate-500 py-1.5 px-1.5 w-24">Date</th>
                  <th className="border-r border-slate-500 py-1.5 px-1 w-24">Category (see code)</th>
                  <th className="border-r border-slate-500 py-1.5 px-2 text-left">Description / Place / Party</th>
                  <th className="border-r border-slate-500 py-1.5 px-1 w-24">Bill / Receipt No.</th>
                  <th className="border-r border-slate-500 py-1.5 px-1 w-24 text-right">Amount Claimed (₹)</th>
                  <th className="py-1.5 px-1 w-24 text-right">Approved (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {rows.map((row, idx) => (
                  <tr key={idx} className="h-6">
                    <td className="border-r border-slate-300 text-center py-1 px-1 font-mono text-slate-600">
                      {idx + 1}
                    </td>
                    <td className="border-r border-slate-300 text-center py-1 px-1 text-slate-700 font-mono">
                      {row.date || ""}
                    </td>
                    <td className="border-r border-slate-300 text-center py-1 px-1 font-mono font-bold text-[#0c3656]">
                      {row.categoryCode || ""}
                    </td>
                    <td className="border-r border-slate-300 py-1 px-2 font-medium text-slate-900">
                      {row.description}
                    </td>
                    <td className="border-r border-slate-300 text-center py-1 px-1 font-mono text-slate-700">
                      {row.billReceiptNo || ""}
                    </td>
                    <td className="border-r border-slate-300 text-right py-1 px-1 font-mono">
                      {row.amountClaimed > 0 ? row.amountClaimed.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : ""}
                    </td>
                    <td className="text-right py-1 px-1 font-mono font-semibold">
                      {row.approvedAmount !== undefined && row.approvedAmount > 0 ? row.approvedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Bottom Summary & Category Codes */}
            <div className="grid grid-cols-12 border-t border-slate-400">
              <div className="col-span-7 p-2.5 flex flex-col justify-between border-r border-slate-400">
                <div>
                  <div className="font-bold text-[9.5px] uppercase text-slate-700 mb-1">CATEGORY CODES</div>
                  <div className="grid grid-cols-2 text-[9px] gap-x-2 text-slate-600 leading-tight font-mono">
                    <div>TR - Travel / Transport</div>
                    <div>IN - Internet / Phone / Data</div>
                    <div>FL - Fuel / Toll / Parking</div>
                    <div>OS - Office Supplies</div>
                    <div>FD - Food / Meals</div>
                    <div>SH - Shoot / Production Exp.</div>
                    <div>AC - Accommodation</div>
                    <div>SW - Software / Tools</div>
                    <div>CM - Client Meeting / Hospitality</div>
                    <div>OT - Other (specify)</div>
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-200">
                  <span className="font-bold text-[10px] text-slate-700">Net Amount in Words (Rupees):</span>
                  <p className="text-xs font-serif font-bold text-slate-900 mt-0.5 capitalize leading-snug">
                    {numberToWords(netPayable)}
                  </p>
                </div>
              </div>
              <div className="col-span-5 text-[10.5px]">
                <div className="grid grid-cols-2 divide-x divide-slate-300 border-b border-slate-300 px-2 py-1.5">
                  <span className="text-slate-700 font-medium">Total Amount Claimed</span>
                  <span className="text-right font-mono font-bold">₹{totalClaimed.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-300 border-b border-slate-300 px-2 py-1.5">
                  <span className="text-slate-700">Less: Advance Taken</span>
                  <span className="text-right font-mono text-rose-700">{advanceTaken > 0 ? `−₹${advanceTaken.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹0.00"}</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-300 border-b border-slate-400 px-2 py-1.5">
                  <span className="text-slate-700">Less: Non-Admissible / Rejected</span>
                  <span className="text-right font-mono text-rose-700">{nonAdmissible > 0 ? `−₹${nonAdmissible.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹0.00"}</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-400 px-2 py-2 bg-[#0c3656] text-white font-bold text-xs">
                  <span className="uppercase tracking-wider">NET PAYABLE / (RECOVERABLE)</span>
                  <span className="text-right font-mono text-sm tracking-tight text-white">
                    ₹{netPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Reimbursement Details */}
          <div className="border-x border-b border-slate-400 text-[11px]">
            <div className="bg-slate-100 font-bold px-2 py-1 uppercase text-[10px] text-slate-700 border-b border-slate-300">
              Reimbursement Details
            </div>
            <div className="p-2 flex flex-wrap items-center gap-4 border-b border-slate-300">
              <span className="font-bold text-slate-700">Mode:</span>
              {[
                "Bank Transfer",
                "UPI",
                "Cash",
                "Cheque",
                "Adjust against: Salary / Advance"
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
            <div className="grid grid-cols-4 divide-x divide-slate-400">
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Account Name / UPI ID: </span>
                <span>{bankAccountName}</span>
              </div>
              <div className="p-1.5">
                <span className="font-bold text-slate-700">A/c No.: </span>
                <span className="font-mono">{bankAccNo}</span>
              </div>
              <div className="p-1.5">
                <span className="font-bold text-slate-700">IFSC: </span>
                <span className="font-mono">{bankIfsc}</span>
              </div>
              <div className="p-1.5">
                <span className="font-bold text-slate-700">Payment Date: </span>
                <span>{data.paymentDate || format(new Date(), "dd/MM/yyyy")}</span>
              </div>
            </div>
          </div>

          {/* Declaration */}
          <div className="border-x border-b border-slate-400 text-[10px] p-2 bg-slate-50 text-slate-700 leading-normal">
            <span className="font-bold text-slate-900 uppercase">DECLARATION: </span>
            I certify that the above expenses were incurred wholly and necessarily for the business of {companyName}, are supported by the attached original bills / receipts, and have not been claimed or reimbursed earlier from any other source.
          </div>

          {/* Signature Boxes */}
          <div className="border-x border-b border-slate-400 grid grid-cols-4 divide-x divide-slate-400 text-center text-[10px] font-bold">
            <div className="p-3 pt-8 flex flex-col justify-end">
              <div className="border-t border-slate-400 pt-1.5">
                <div className="text-slate-900 uppercase font-black">CLAIMANT</div>
                <div className="font-normal text-slate-600 text-[9px]">{data.claimantName || "Claimant"} / Date</div>
              </div>
            </div>
            <div className="p-3 pt-8 flex flex-col justify-end">
              <div className="border-t border-slate-400 pt-1.5">
                <div className="text-slate-900 uppercase font-black">REPORTING MANAGER</div>
                <div className="font-normal text-slate-600 text-[9px]">{data.managerName || "Manager"} / Date</div>
              </div>
            </div>
            <div className="p-3 pt-8 flex flex-col justify-end">
              <div className="border-t border-slate-400 pt-1.5">
                <div className="text-slate-900 uppercase font-black">ACCOUNTS</div>
                <div className="font-normal text-slate-600 text-[9px]">{data.accountsName || "Accounts Team"} / Date</div>
              </div>
            </div>
            <div className="p-3 pt-8 flex flex-col justify-end">
              <div className="border-t border-slate-400 pt-1.5">
                <div className="text-slate-900 uppercase font-black">APPROVED BY (DIRECTOR)</div>
                <div className="font-normal text-slate-600 text-[9px]">{authPersonName} / {authDesignation}</div>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="flex justify-between items-center text-[9px] text-slate-500 pt-2 font-medium">
            <span>Attach original bills / receipts. Submit claims within 30 days of the expense.</span>
            <span className="font-semibold text-slate-700">{companyName}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
