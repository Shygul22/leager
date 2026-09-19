import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Receipt, FileText } from "lucide-react";
import { format } from "date-fns";
import { PurchaseVoucherData } from "./PurchaseVoucherModal";
import { ReimbursementVoucherData } from "./ReimbursementVoucherModal";

interface CreateVoucherModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: "purchase_voucher" | "reimbursement";
  userId: string;
  accountId?: string | null;
  employees: any[];
  suppliers?: any[];
  onCreated: (type: "purchase" | "reimbursement", voucherData: PurchaseVoucherData | ReimbursementVoucherData) => void;
}

export const CreateVoucherModal: React.FC<CreateVoucherModalProps> = ({
  open,
  onOpenChange,
  defaultType = "purchase_voucher",
  userId,
  accountId,
  employees,
  suppliers = [],
  onCreated
}) => {
  const queryClient = useQueryClient();
  const [voucherType, setVoucherType] = useState<"purchase_voucher" | "reimbursement">(defaultType);
  const [vertical, setVertical] = useState<"Zenjourney InfoTech" | "Movara Media Production" | "Zero Growth" | "Corporate / General">("Zenjourney InfoTech");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [paymentMode, setPaymentMode] = useState("NEFT / RTGS / IMPS");
  const [submitting, setSubmitting] = useState(false);

  // Purchase Specific Fields
  const [supplierId, setSupplierId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorGstin, setVendorGstin] = useState("");
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState("");
  const [natureOfPurchase, setNatureOfPurchase] = useState<any>("Services");
  const [purchaseItems, setPurchaseItems] = useState([
    { description: "", hsn: "9983", quantity: 1, rate: 0, gstPercent: 18 }
  ]);

  // Reimbursement Specific Fields
  const [employeeId, setEmployeeId] = useState("");
  const [claimantName, setClaimantName] = useState("");
  const [designation, setDesignation] = useState("");
  const [purpose, setPurpose] = useState("");
  const [advanceTaken, setAdvanceTaken] = useState(0);
  const [expenseItems, setExpenseItems] = useState([
    { date: format(new Date(), "yyyy-MM-dd"), categoryCode: "CM", description: "", receiptNo: "", amountClaimed: 0 }
  ]);

  React.useEffect(() => {
    setVoucherType(defaultType);
  }, [defaultType]);

  const handleSupplierChange = (supId: string) => {
    setSupplierId(supId);
    const sup = suppliers.find(s => s.id === supId);
    if (sup) {
      setVendorName(sup.name || "");
      setVendorGstin(sup.gstin || "");
    }
  };

  const handleEmployeeChange = (empId: string) => {
    setEmployeeId(empId);
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      setClaimantName(emp.name || "");
      setDesignation(emp.designation || "");
    }
  };

  const handleSubmit = async () => {
    if (!description) {
      toast.error("Please enter a brief voucher description");
      return;
    }

    setSubmitting(true);
    try {
      const yearShort = format(new Date(), "yy");
      const nextYearShort = (parseInt(yearShort) + 1).toString();
      const randomSeq = Math.floor(100 + Math.random() * 900);

      if (voucherType === "purchase_voucher") {
        const voucherNo = `ZJ/PV/${yearShort}-${nextYearShort}/${randomSeq}`;
        
        const totalTaxable = purchaseItems.reduce((acc, i) => acc + (i.quantity * i.rate), 0);
        const totalGst = purchaseItems.reduce((acc, i) => acc + (i.quantity * i.rate * (i.gstPercent || 18) / 100), 0);
        const totalAmount = totalTaxable + totalGst;

        // Insert into transactions
        const { error } = await supabase.from("transactions").insert({
          description: `${vendorName || "Purchase"}: ${description}`,
          amount: totalAmount,
          type: "purchase_voucher",
          category: natureOfPurchase,
          date,
          user_id: userId,
          account_id: accountId || null
        });

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        toast.success(`Purchase Voucher ${voucherNo} generated!`);

        const purchaseData: PurchaseVoucherData = {
          voucherNo,
          voucherDate: format(new Date(date), "dd/MM/yyyy"),
          financialYear: `20${yearShort}-20${nextYearShort}`,
          vendorInvoiceNo: vendorInvoiceNo || `INV-${randomSeq}`,
          vendorInvoiceDate: format(new Date(date), "dd/MM/yyyy"),
          costCenter: vertical,
          vendorName: vendorName || "Vendor / Supplier",
          vendorGstin: vendorGstin || "NIL",
          natureOfPurchase,
          paymentMode: paymentMode as any,
          items: purchaseItems.map(p => ({
            description: p.description || description,
            hsn: p.hsn,
            quantity: p.quantity,
            rate: p.rate,
            taxableValue: p.quantity * p.rate,
            gstPercent: p.gstPercent,
            gstAmount: (p.quantity * p.rate * (p.gstPercent || 18)) / 100,
            total: (p.quantity * p.rate) * (1 + (p.gstPercent || 18) / 100)
          })),
          narration: description
        };

        onOpenChange(false);
        onCreated("purchase", purchaseData);
      } else {
        const voucherNo = `ZJ/EV/${yearShort}-${nextYearShort}/${randomSeq}`;
        const totalClaimed = expenseItems.reduce((acc, i) => acc + (Number(i.amountClaimed) || 0), 0);
        const netPayable = Math.max(0, totalClaimed - advanceTaken);

        // Insert into transactions
        const { error } = await supabase.from("transactions").insert({
          description: `${claimantName || "Employee"}: ${description}`,
          amount: netPayable,
          type: "reimbursement",
          category: "Employee Reimbursement",
          date,
          employee_id: employeeId || null,
          user_id: userId,
          account_id: accountId || null
        });

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        toast.success(`Reimbursement Voucher ${voucherNo} generated!`);

        const reimbData: ReimbursementVoucherData = {
          voucherNo,
          voucherDate: format(new Date(date), "dd/MM/yyyy"),
          financialYear: `20${yearShort}-20${nextYearShort}`,
          claimantName: claimantName || "Claimant",
          designation,
          vertical,
          purpose: purpose || description,
          paymentMode: paymentMode as any,
          advanceTaken,
          items: expenseItems.map(e => ({
            date: e.date,
            categoryCode: e.categoryCode,
            description: e.description || description,
            billReceiptNo: e.receiptNo || "REC-" + randomSeq,
            amountClaimed: Number(e.amountClaimed) || 0,
            approvedAmount: Number(e.amountClaimed) || 0
          }))
        };

        onOpenChange(false);
        onCreated("reimbursement", reimbData);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create voucher");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            {voucherType === "purchase_voucher" ? <Receipt className="h-5 w-5 text-blue-600" /> : <FileText className="h-5 w-5 text-purple-600" />}
            Generate Official Voucher
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Create an audit-compliant voucher with cost center allocation, itemized particulars, and print preview
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Voucher Type Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <Button
              type="button"
              variant={voucherType === "purchase_voucher" ? "default" : "ghost"}
              size="sm"
              className="text-xs font-bold"
              onClick={() => setVoucherType("purchase_voucher")}
            >
              <Receipt className="h-3.5 w-3.5 mr-1.5" /> Purchase Voucher (Vendor / Goods)
            </Button>
            <Button
              type="button"
              variant={voucherType === "reimbursement" ? "default" : "ghost"}
              size="sm"
              className="text-xs font-bold"
              onClick={() => setVoucherType("reimbursement")}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Expense / Reimbursement (Team Claim)
            </Button>
          </div>

          {/* Common Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Cost Centre / Business Vertical</Label>
              <Select value={vertical} onValueChange={(val: any) => setVertical(val)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Zenjourney InfoTech">Zenjourney InfoTech</SelectItem>
                  <SelectItem value="Movara Media Production">Movara Media Production</SelectItem>
                  <SelectItem value="Zero Growth">Zero Growth</SelectItem>
                  <SelectItem value="Corporate / General">Corporate / General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Voucher Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEFT / RTGS / IMPS">NEFT / RTGS / IMPS</SelectItem>
                  <SelectItem value="UPI">UPI Transfer</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Card">Corporate Card</SelectItem>
                  <SelectItem value="Credit (Payable)">Credit (Payable)</SelectItem>
                  <SelectItem value="Adjust against: Salary / Advance">Adjust against: Salary / Advance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Type Specific Fields */}
          {voucherType === "purchase_voucher" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Select Vendor / Supplier</Label>
                  <Select value={supplierId} onValueChange={handleSupplierChange}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select or type..." /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Vendor Name (Custom)</Label>
                  <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="e.g. AWS Cloud / Adobe" className="h-9 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Vendor GSTIN / PAN</Label>
                  <Input value={vendorGstin} onChange={(e) => setVendorGstin(e.target.value)} placeholder="33AAAAA0000A1Z5" className="h-9 text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Vendor Invoice / Ref No.</Label>
                  <Input value={vendorInvoiceNo} onChange={(e) => setVendorInvoiceNo(e.target.value)} placeholder="e.g. INV-2026-904" className="h-9 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Nature of Purchase</Label>
                  <Select value={natureOfPurchase} onValueChange={setNatureOfPurchase}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Services">Services</SelectItem>
                      <SelectItem value="Goods / Assets">Goods / Assets</SelectItem>
                      <SelectItem value="Software / SaaS">Software / SaaS</SelectItem>
                      <SelectItem value="Freelancer / Contract">Freelancer / Contract</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2 border rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold uppercase text-slate-700">Line Items & Particulars</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setPurchaseItems([...purchaseItems, { description: "", hsn: "9983", quantity: 1, rate: 0, gstPercent: 18 }])}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Line
                  </Button>
                </div>
                {purchaseItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      placeholder="Item / Service description"
                      value={item.description}
                      onChange={(e) => {
                        const next = [...purchaseItems];
                        next[idx].description = e.target.value;
                        setPurchaseItems(next);
                      }}
                      className="col-span-5 h-8 text-xs"
                    />
                    <Input
                      placeholder="HSN"
                      value={item.hsn}
                      onChange={(e) => {
                        const next = [...purchaseItems];
                        next[idx].hsn = e.target.value;
                        setPurchaseItems(next);
                      }}
                      className="col-span-2 h-8 text-xs font-mono"
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => {
                        const next = [...purchaseItems];
                        next[idx].quantity = parseFloat(e.target.value) || 0;
                        setPurchaseItems(next);
                      }}
                      className="col-span-1 h-8 text-xs font-mono"
                    />
                    <Input
                      type="number"
                      placeholder="Rate ₹"
                      value={item.rate}
                      onChange={(e) => {
                        const next = [...purchaseItems];
                        next[idx].rate = parseFloat(e.target.value) || 0;
                        setPurchaseItems(next);
                      }}
                      className="col-span-2 h-8 text-xs font-mono"
                    />
                    <Select
                      value={item.gstPercent.toString()}
                      onValueChange={(val) => {
                        const next = [...purchaseItems];
                        next[idx].gstPercent = parseInt(val) || 0;
                        setPurchaseItems(next);
                      }}
                    >
                      <SelectTrigger className="col-span-1 h-8 text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="5">5%</SelectItem>
                        <SelectItem value="12">12%</SelectItem>
                        <SelectItem value="18">18%</SelectItem>
                        <SelectItem value="28">28%</SelectItem>
                      </SelectContent>
                    </Select>
                    {purchaseItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="col-span-1 h-8 w-8 text-destructive"
                        onClick={() => setPurchaseItems(purchaseItems.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Select Employee / Claimant</Label>
                  <Select value={employeeId} onValueChange={handleEmployeeChange}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select claimant..." /></SelectTrigger>
                    <SelectContent>
                      {employees.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.name} ({e.designation})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Claimant Name (Custom)</Label>
                  <Input value={claimantName} onChange={(e) => setClaimantName(e.target.value)} placeholder="e.g. Shygul Akbar" className="h-9 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Designation</Label>
                  <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Lead Engineer" className="h-9 text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Advance Previously Taken (₹)</Label>
                  <Input type="number" value={advanceTaken} onChange={(e) => setAdvanceTaken(parseFloat(e.target.value) || 0)} className="h-9 text-xs font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Purpose of Expense / Project</Label>
                  <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Client shoot / travel / tech infra" className="h-9 text-xs" />
                </div>
              </div>

              {/* Expense statement lines */}
              <div className="space-y-2 border rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold uppercase text-slate-700">Expense Statement Items</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setExpenseItems([...expenseItems, { date: format(new Date(), "yyyy-MM-dd"), categoryCode: "TR", description: "", receiptNo: "", amountClaimed: 0 }])}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Claim Line
                  </Button>
                </div>
                {expenseItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      type="date"
                      value={item.date}
                      onChange={(e) => {
                        const next = [...expenseItems];
                        next[idx].date = e.target.value;
                        setExpenseItems(next);
                      }}
                      className="col-span-3 h-8 text-[11px]"
                    />
                    <Select
                      value={item.categoryCode}
                      onValueChange={(val) => {
                        const next = [...expenseItems];
                        next[idx].categoryCode = val;
                        setExpenseItems(next);
                      }}
                    >
                      <SelectTrigger className="col-span-2 h-8 text-[11px] font-mono"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TR">TR - Travel</SelectItem>
                        <SelectItem value="FL">FL - Fuel / Toll</SelectItem>
                        <SelectItem value="FD">FD - Meals</SelectItem>
                        <SelectItem value="AC">AC - Hotel</SelectItem>
                        <SelectItem value="CM">CM - Client Meet</SelectItem>
                        <SelectItem value="IN">IN - Internet</SelectItem>
                        <SelectItem value="OS">OS - Supplies</SelectItem>
                        <SelectItem value="SH">SH - Shoot/Prod</SelectItem>
                        <SelectItem value="SW">SW - Software</SelectItem>
                        <SelectItem value="OT">OT - Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Description / Party"
                      value={item.description}
                      onChange={(e) => {
                        const next = [...expenseItems];
                        next[idx].description = e.target.value;
                        setExpenseItems(next);
                      }}
                      className="col-span-4 h-8 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Amount ₹"
                      value={item.amountClaimed}
                      onChange={(e) => {
                        const next = [...expenseItems];
                        next[idx].amountClaimed = parseFloat(e.target.value) || 0;
                        setExpenseItems(next);
                      }}
                      className="col-span-2 h-8 text-xs font-mono"
                    />
                    {expenseItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="col-span-1 h-8 w-8 text-destructive"
                        onClick={() => setExpenseItems(expenseItems.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overall Description / Narration */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Voucher Narration / Remarks</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Paid against verified invoice / official business trip expenditure"
              className="h-16 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="font-bold">
            {submitting ? "Processing..." : "Generate & Print Voucher"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
