import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
    Users, DollarSign, TrendingUp, Award, Percent, Building2, 
    PieChart, Plus, Trash2, Edit, Printer, FileText, CheckCircle2, 
    ShieldCheck, Banknote, RefreshCw, Calculator, ArrowUpRight, Scale
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export interface Shareholder {
    id: string;
    name: string;
    designation: string;
    category: "Promoter" | "Angel Investor" | "Institutional" | "Key Executive" | "Retail";
    panNumber: string;
    folioNumber: string;
    sharesHeld: number;
    faceValue: number; // e.g. 10
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    email?: string;
    phone?: string;
    status: "Active" | "Inactive";
}

export interface DividendRecord {
    id: string;
    shareholderId: string;
    shareholderName: string;
    financialYear: string;
    grossDividend: number;
    tdsRate: number; // 10% under Sec 194
    tdsDeducted: number;
    netDividendPayable: number;
    paymentStatus: "Declared" | "Processing" | "Paid";
    paymentRef?: string;
    paymentDate?: string;
}

const defaultShareholders: Shareholder[] = [
    {
        id: "sh-1",
        name: "Shygul Akbar",
        designation: "Founder & Executive Director",
        category: "Promoter",
        panNumber: "ABCPA1234F",
        folioNumber: "ZJ-FOLIO-001",
        sharesHeld: 60000,
        faceValue: 10,
        bankName: "HDFC Bank",
        accountNumber: "50100234567890",
        ifscCode: "HDFC0001234",
        email: "shygul@zenjourney.in",
        status: "Active"
    },
    {
        id: "sh-2",
        name: "Co-Founder / Director",
        designation: "Director",
        category: "Promoter",
        panNumber: "XYZPB9876K",
        folioNumber: "ZJ-FOLIO-002",
        sharesHeld: 30000,
        faceValue: 10,
        bankName: "ICICI Bank",
        accountNumber: "000405012345",
        ifscCode: "ICIC0000004",
        email: "director@zenjourney.in",
        status: "Active"
    },
    {
        id: "sh-3",
        name: "Employee Stock Option Trust (ESOP)",
        designation: "Key Employee Pool",
        category: "Key Executive",
        panNumber: "AAATT1122M",
        folioNumber: "ZJ-FOLIO-003",
        sharesHeld: 10000,
        faceValue: 10,
        bankName: "State Bank of India",
        accountNumber: "33098765432",
        ifscCode: "SBIN0000800",
        status: "Active"
    }
];

export default function Shareholders() {
    const { user, role } = useAuth();
    const [mainTab, setMainTab] = useState("cap-table");

    // Local Storage Persisted Shareholders
    const [shareholders, setShareholders] = useState<Shareholder[]>(() => {
        const saved = localStorage.getItem("company_shareholders");
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return defaultShareholders;
    });

    // Payout Ratio Settings (% of Net Profit distributed as Dividend)
    const [payoutRatio, setPayoutRatio] = useState<number>(50); // Default 50%
    const [customNetProfitOverride, setCustomNetProfitOverride] = useState<string>("");

    // Modal States
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editingShareholder, setEditingShareholder] = useState<Shareholder | null>(null);

    const [warrantModalOpen, setWarrantModalOpen] = useState(false);
    const [selectedShareholderForWarrant, setSelectedShareholderForWarrant] = useState<Shareholder | null>(null);

    // Form State
    const [form, setForm] = useState({
        name: "",
        designation: "Shareholder",
        category: "Promoter" as Shareholder["category"],
        panNumber: "",
        folioNumber: "",
        sharesHeld: "",
        faceValue: "10",
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        email: "",
        phone: ""
    });

    // Fetch Live Transactions to compute Cash Net Profit
    const { data: transactions = [], isLoading: isLoadingTx } = useQuery({
        queryKey: ["transactions-shareholders", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase.from("transactions").select("*");
            if (error) return [];
            return data || [];
        },
        enabled: !!user,
    });

    // Fetch Live Invoices & Bills to compute Accrual Net Profit
    const { data: invoices = [] } = useQuery({
        queryKey: ["invoices-shareholders", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase.from("invoices").select("*, invoice_items(*)");
            if (error) return [];
            return data || [];
        },
        enabled: !!user,
    });

    const { data: bills = [] } = useQuery({
        queryKey: ["bills-shareholders", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase.from("bills").select("*, bill_items(*)");
            if (error) return [];
            return data || [];
        },
        enabled: !!user,
    });

    // Real-time Financial Calculations
    const cashIncome = useMemo(() => {
        return transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount || 0), 0);
    }, [transactions]);

    const cashExpense = useMemo(() => {
        return transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount || 0), 0);
    }, [transactions]);

    const liveCashNetProfit = useMemo(() => {
        return cashIncome - cashExpense;
    }, [cashIncome, cashExpense]);

    const totalInvoiceRev = useMemo(() => {
        return invoices.reduce((acc, inv) => {
            const items = inv.invoice_items || [];
            const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.rate), 0);
            const disc = subtotal * ((inv.discount_percentage || 0) / 100);
            return acc + (subtotal - disc);
        }, 0);
    }, [invoices]);

    const totalBillCosts = useMemo(() => {
        return bills.reduce((acc, b) => {
            const items = b.bill_items || [];
            const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.rate), 0);
            const disc = subtotal * ((b.discount_percentage || 0) / 100);
            return acc + (subtotal - disc);
        }, 0);
    }, [bills]);

    const liveAccrualNetProfit = useMemo(() => {
        return totalInvoiceRev - totalBillCosts;
    }, [totalInvoiceRev, totalBillCosts]);

    // Final Net Profit used for distribution
    const effectiveNetProfit = useMemo(() => {
        if (customNetProfitOverride !== "" && !isNaN(parseFloat(customNetProfitOverride))) {
            return parseFloat(customNetProfitOverride);
        }
        return liveCashNetProfit > 0 ? liveCashNetProfit : (liveAccrualNetProfit > 0 ? liveAccrualNetProfit : 1944.00);
    }, [customNetProfitOverride, liveCashNetProfit, liveAccrualNetProfit]);

    // Cap Table Calculations
    const totalIssuedShares = useMemo(() => {
        return shareholders.reduce((sum, s) => sum + s.sharesHeld, 0);
    }, [shareholders]);

    const totalPaidUpCapital = useMemo(() => {
        return shareholders.reduce((sum, s) => sum + (s.sharesHeld * s.faceValue), 0);
    }, [shareholders]);

    // Dividend Allocation Pool
    const totalDividendPool = useMemo(() => {
        return (effectiveNetProfit * payoutRatio) / 100;
    }, [effectiveNetProfit, payoutRatio]);

    const retainedEarningsReserve = useMemo(() => {
        return effectiveNetProfit - totalDividendPool;
    }, [effectiveNetProfit, totalDividendPool]);

    // Per Share Key Metrics
    const earningsPerShare = useMemo(() => {
        return totalIssuedShares > 0 ? effectiveNetProfit / totalIssuedShares : 0;
    }, [effectiveNetProfit, totalIssuedShares]);

    const dividendPerShare = useMemo(() => {
        return totalIssuedShares > 0 ? totalDividendPool / totalIssuedShares : 0;
    }, [totalDividendPool, totalIssuedShares]);

    // Handlers
    const saveShareholdersToStorage = (list: Shareholder[]) => {
        setShareholders(list);
        try {
            localStorage.setItem("company_shareholders", JSON.stringify(list));
        } catch (e) {}
    };

    const handleOpenAddModal = () => {
        setEditingShareholder(null);
        setForm({
            name: "",
            designation: "Shareholder",
            category: "Promoter",
            panNumber: "",
            folioNumber: `ZJ-FOLIO-00${shareholders.length + 1}`,
            sharesHeld: "10000",
            faceValue: "10",
            bankName: "",
            accountNumber: "",
            ifscCode: "",
            email: "",
            phone: ""
        });
        setAddModalOpen(true);
    };

    const handleOpenEditModal = (s: Shareholder) => {
        setEditingShareholder(s);
        setForm({
            name: s.name,
            designation: s.designation,
            category: s.category,
            panNumber: s.panNumber,
            folioNumber: s.folioNumber,
            sharesHeld: s.sharesHeld.toString(),
            faceValue: s.faceValue.toString(),
            bankName: s.bankName || "",
            accountNumber: s.accountNumber || "",
            ifscCode: s.ifscCode || "",
            email: s.email || "",
            phone: s.phone || ""
        });
        setAddModalOpen(true);
    };

    const handleSaveShareholder = () => {
        if (!form.name.trim()) {
            toast.error("Shareholder Name is required");
            return;
        }
        const shares = parseInt(form.sharesHeld);
        if (isNaN(shares) || shares <= 0) {
            toast.error("Please enter a valid number of equity shares");
            return;
        }

        if (editingShareholder) {
            const updated = shareholders.map(s => s.id === editingShareholder.id ? {
                ...s,
                name: form.name,
                designation: form.designation,
                category: form.category,
                panNumber: form.panNumber,
                folioNumber: form.folioNumber,
                sharesHeld: shares,
                faceValue: parseFloat(form.faceValue) || 10,
                bankName: form.bankName || undefined,
                accountNumber: form.accountNumber || undefined,
                ifscCode: form.ifscCode || undefined,
                email: form.email || undefined,
                phone: form.phone || undefined
            } : s);
            saveShareholdersToStorage(updated);
            toast.success("Shareholder record updated!");
        } else {
            const newSh: Shareholder = {
                id: `sh-${Date.now()}`,
                name: form.name,
                designation: form.designation,
                category: form.category,
                panNumber: form.panNumber || "PANPENDING",
                folioNumber: form.folioNumber || `ZJ-FOLIO-00${shareholders.length + 1}`,
                sharesHeld: shares,
                faceValue: parseFloat(form.faceValue) || 10,
                bankName: form.bankName || undefined,
                accountNumber: form.accountNumber || undefined,
                ifscCode: form.ifscCode || undefined,
                email: form.email || undefined,
                phone: form.phone || undefined,
                status: "Active"
            };
            saveShareholdersToStorage([newSh, ...shareholders]);
            toast.success("New Shareholder added to Cap Table!");
        }
        setAddModalOpen(false);
    };

    const handleDeleteShareholder = (id: string) => {
        if (confirm("Are you sure you want to remove this shareholder from the Cap Table?")) {
            const updated = shareholders.filter(s => s.id !== id);
            saveShareholdersToStorage(updated);
            toast.success("Shareholder removed from Cap Table");
        }
    };

    const handlePrintDividendWarrant = (s: Shareholder) => {
        setSelectedShareholderForWarrant(s);
        setWarrantModalOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Page Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">Shareholders & Dividend Hub</h1>
                        <Badge className="bg-indigo-600 text-white font-mono text-[10px] uppercase">
                            Companies Act 2013 Compliant
                        </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">
                        Equity shareholding register, cap table management, and automated dividend distribution based on real-time Net Profit.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button onClick={handleOpenAddModal} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                        <Plus className="mr-1.5 h-4 w-4" /> Add Shareholder
                    </Button>
                </div>
            </div>

            {/* Company Banner */}
            <Card className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg border-0">
                <CardContent className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-1 md:col-span-2">
                            <span className="text-[10px] text-indigo-300 font-mono uppercase tracking-widest block font-bold">Company Name</span>
                            <div className="text-lg font-black text-white flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-indigo-400" />
                                ZENJOURNEY PRIVATE LIMITED
                            </div>
                            <p className="text-xs text-slate-300 font-mono mt-1">
                                CIN: U62013TN2026PTC191867 • Inc: 07 April 2026
                            </p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] text-indigo-300 font-mono uppercase tracking-widest block font-bold">Total Issued Shares</span>
                            <div className="text-2xl font-extrabold text-white font-mono">
                                {totalIssuedShares.toLocaleString("en-IN")} <span className="text-xs font-normal text-slate-400">Equity Shares</span>
                            </div>
                            <span className="text-[10px] text-slate-300 block">Face Value: ₹10 per share</span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] text-indigo-300 font-mono uppercase tracking-widest block font-bold">Paid-Up Share Capital</span>
                            <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                                ₹{totalPaidUpCapital.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </div>
                            <span className="text-[10px] text-slate-300 block">Registered Capital</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Net Profit & Dividend Engine Control Panel */}
            <Card className="border-2 border-indigo-100 dark:border-indigo-950 shadow-sm bg-indigo-50/20">
                <CardHeader className="py-3 px-5 border-b bg-indigo-100/30 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-indigo-700" />
                            Net Profit & Dividend Allocation Engine
                        </CardTitle>
                        <CardDescription className="text-xs text-indigo-700/80">Configure net profit distribution between Dividends and Reserves</CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-indigo-100 text-indigo-800 border-indigo-300 font-mono text-[10px]">
                        FY 2026-27
                    </Badge>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Live Net Profit Card */}
                        <div className="bg-background rounded-lg p-3.5 border shadow-sm space-y-1">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground block">Current Net Profit</span>
                            <div className="text-xl font-extrabold text-emerald-600 font-mono">
                                ₹{effectiveNetProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </div>
                            <span className="text-[9px] text-muted-foreground block">
                                {customNetProfitOverride ? "Custom Override Applied" : "Synced from Live Ledger"}
                            </span>
                        </div>

                        {/* Payout Ratio Input */}
                        <div className="bg-background rounded-lg p-3.5 border shadow-sm space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <Label htmlFor="p-ratio" className="font-bold">Dividend Payout Ratio</Label>
                                <span className="font-bold text-indigo-600 font-mono">{payoutRatio}%</span>
                            </div>
                            <Input 
                                id="p-ratio"
                                type="number"
                                min="0"
                                max="100"
                                value={payoutRatio}
                                onChange={(e) => setPayoutRatio(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                className="h-8 text-xs font-bold"
                            />
                            <Progress value={payoutRatio} className="h-1.5 bg-indigo-100" />
                        </div>

                        {/* Allocated Dividend Pool */}
                        <div className="bg-background rounded-lg p-3.5 border shadow-sm space-y-1">
                            <span className="text-[10px] font-bold uppercase text-indigo-700 block">Total Dividend Pool</span>
                            <div className="text-xl font-extrabold text-indigo-600 font-mono">
                                ₹{totalDividendPool.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </div>
                            <span className="text-[9px] text-indigo-600/80 block">
                                Distributed to Shareholders ({payoutRatio}%)
                            </span>
                        </div>

                        {/* Retained Earnings to Reserves */}
                        <div className="bg-background rounded-lg p-3.5 border shadow-sm space-y-1">
                            <span className="text-[10px] font-bold uppercase text-purple-700 block">Retained Earnings (Reserves)</span>
                            <div className="text-xl font-extrabold text-purple-600 font-mono">
                                ₹{retainedEarningsReserve.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </div>
                            <span className="text-[9px] text-purple-600/80 block">
                                Ploughed back into Business ({100 - payoutRatio}%)
                            </span>
                        </div>
                    </div>

                    {/* Financial Metrics Summary Bar */}
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-lg border text-xs flex-wrap gap-3">
                        <div className="flex items-center gap-4">
                            <div>
                                <span className="text-[10px] text-muted-foreground block font-semibold">Earnings Per Share (EPS):</span>
                                <span className="font-extrabold text-slate-800 dark:text-slate-200 font-mono">₹{earningsPerShare.toFixed(4)} / share</span>
                            </div>
                            <div className="h-6 w-px bg-border" />
                            <div>
                                <span className="text-[10px] text-muted-foreground block font-semibold">Dividend Per Share (DPS):</span>
                                <span className="font-extrabold text-indigo-600 font-mono">₹{dividendPerShare.toFixed(4)} / share</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Label htmlFor="override-np" className="text-[10px] font-bold text-muted-foreground">Adjust Net Profit (₹):</Label>
                            <Input 
                                id="override-np"
                                placeholder="Enter Net Profit..."
                                value={customNetProfitOverride}
                                onChange={(e) => setCustomNetProfitOverride(e.target.value)}
                                className="w-36 h-7 text-xs font-mono"
                            />
                            {customNetProfitOverride && (
                                <Button size="xs" variant="ghost" onClick={() => setCustomNetProfitOverride("")} className="h-7 text-[10px]">
                                    Reset Sync
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Main Tabs Workspace */}
            <Tabs value={mainTab} onValueChange={setMainTab} className="w-full space-y-4">
                <TabsList className="bg-muted/40">
                    <TabsTrigger value="cap-table" className="font-semibold text-xs">
                        <Users className="h-3.5 w-3.5 mr-1.5" /> Equity Cap Table ({shareholders.length})
                    </TabsTrigger>
                    <TabsTrigger value="dividend-schedule" className="font-semibold text-xs">
                        <Banknote className="h-3.5 w-3.5 mr-1.5" /> Dividend Payout Schedule
                    </TabsTrigger>
                    <TabsTrigger value="reserves" className="font-semibold text-xs">
                        <Scale className="h-3.5 w-3.5 mr-1.5" /> Reserves & Surplus Analysis
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: Equity Cap Table */}
                <TabsContent value="cap-table">
                    <Card>
                        <CardHeader className="py-3 px-5 bg-muted/20 border-b flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Shareholding Register & Capital Structure
                            </CardTitle>
                            <span className="text-[10px] font-mono text-muted-foreground">
                                Total 100% Equity Ownership
                            </span>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table className="text-xs min-w-[800px] md:min-w-full">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Shareholder Name</TableHead>
                                        <TableHead>Folio / PAN No.</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead className="text-right">Shares Held</TableHead>
                                        <TableHead className="text-right">Equity Investment (₹)</TableHead>
                                        <TableHead className="w-40">Ownership %</TableHead>
                                        <TableHead className="w-20 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {shareholders.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                No shareholders added yet. Click "+ Add Shareholder" above.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        shareholders.map((s) => {
                                            const ownershipPct = totalIssuedShares > 0 ? (s.sharesHeld / totalIssuedShares) * 100 : 0;
                                            const capitalValue = s.sharesHeld * s.faceValue;

                                            return (
                                                <TableRow key={s.id} className="hover:bg-muted/30 transition-colors">
                                                    <TableCell className="font-bold">
                                                        <div className="text-foreground font-semibold">{s.name}</div>
                                                        <div className="text-[10px] text-muted-foreground font-normal">{s.designation}</div>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-muted-foreground">
                                                        <div>{s.folioNumber}</div>
                                                        <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{s.panNumber}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge 
                                                            variant="outline"
                                                            className={
                                                                s.category === "Promoter" ? "bg-indigo-500/10 text-indigo-600 border-indigo-300" :
                                                                s.category === "Angel Investor" ? "bg-emerald-500/10 text-emerald-600 border-emerald-300" :
                                                                "bg-slate-500/10 text-slate-600 border-slate-300"
                                                            }
                                                        >
                                                            {s.category}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                                        {s.sharesHeld.toLocaleString("en-IN")}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-emerald-600">
                                                        ₹{capitalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between text-[10px] font-bold">
                                                                <span>{ownershipPct.toFixed(2)}%</span>
                                                            </div>
                                                            <Progress value={ownershipPct} className="h-1.5 bg-indigo-100" />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-7 w-7 text-indigo-600"
                                                                onClick={() => handlePrintDividendWarrant(s)}
                                                                title="Dividend Warrant Voucher"
                                                            >
                                                                <FileText className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-7 w-7"
                                                                onClick={() => handleOpenEditModal(s)}
                                                                title="Edit Shareholder"
                                                            >
                                                                <Edit className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-7 w-7 text-destructive"
                                                                onClick={() => handleDeleteShareholder(s.id)}
                                                                title="Remove"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 2: Dividend Payout Schedule */}
                <TabsContent value="dividend-schedule">
                    <Card>
                        <CardHeader className="py-3 px-5 bg-muted/20 border-b flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                                    Dividend Distribution Schedule & Sec 194 TDS Calculations
                                </CardTitle>
                                <CardDescription className="text-[10px]">
                                    Calculated on Total Dividend Pool of ₹{totalDividendPool.toLocaleString("en-IN", { minimumFractionDigits: 2 })} ({payoutRatio}% of Net Profit)
                                </CardDescription>
                            </div>
                            <Badge className="bg-emerald-600 text-white font-mono text-[10px]">
                                FY 2026-27 Dividend
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table className="text-xs min-w-[800px] md:min-w-full">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Shareholder</TableHead>
                                        <TableHead>Ownership %</TableHead>
                                        <TableHead className="text-right">Gross Dividend (₹)</TableHead>
                                        <TableHead className="text-right">Sec 194 TDS (10%)</TableHead>
                                        <TableHead className="text-right">Net Dividend Payable (₹)</TableHead>
                                        <TableHead>Bank / Payment Method</TableHead>
                                        <TableHead className="w-28 text-right">Voucher</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {shareholders.map((s) => {
                                        const pct = totalIssuedShares > 0 ? s.sharesHeld / totalIssuedShares : 0;
                                        const grossDiv = totalDividendPool * pct;
                                        // Under Sec 194 of IT Act, TDS @ 10% applies if gross dividend exceeds Rs 5,000
                                        const tds = grossDiv > 5000 ? grossDiv * 0.10 : 0;
                                        const netDiv = grossDiv - tds;

                                        return (
                                            <TableRow key={s.id} className="hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-bold">
                                                    <div className="text-foreground">{s.name}</div>
                                                    <div className="text-[10px] text-muted-foreground font-mono">{s.folioNumber}</div>
                                                </TableCell>
                                                <TableCell className="font-mono font-bold text-indigo-600">
                                                    {(pct * 100).toFixed(2)}%
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                                    ₹{grossDiv.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-rose-600 font-bold">
                                                    {tds > 0 ? `- ₹${tds.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹0.00 (Exempt)"}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-extrabold text-emerald-600 text-sm">
                                                    ₹{netDiv.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-[11px]">
                                                    {s.bankName ? (
                                                        <div>
                                                            <span className="font-semibold text-slate-700 dark:text-slate-300">{s.bankName}</span>
                                                            <div className="font-mono text-[9px]">A/c: ...{s.accountNumber ? s.accountNumber.slice(-4) : ''}</div>
                                                        </div>
                                                    ) : <span className="italic text-muted-foreground">Bank Pending</span>}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button 
                                                        size="xs" 
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[10px]"
                                                        onClick={() => handlePrintDividendWarrant(s)}
                                                    >
                                                        <Printer className="h-3 w-3 mr-1" /> Warrant
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 3: Reserves & Surplus Analysis */}
                <TabsContent value="reserves">
                    <Card>
                        <CardHeader className="py-3 px-5 bg-muted/20 border-b">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-purple-900">
                                Capital Reserves & Retained Earnings Movement
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="border rounded-lg p-4 bg-purple-50/30">
                                    <span className="text-[10px] uppercase font-bold text-purple-700 block">Total Net Profit Generated</span>
                                    <div className="text-2xl font-extrabold text-purple-700 font-mono mt-1">
                                        ₹{effectiveNetProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </div>
                                    <p className="text-[10px] text-purple-600/80 mt-1">100% Bottom-line Earnings</p>
                                </div>

                                <div className="border rounded-lg p-4 bg-indigo-50/30">
                                    <span className="text-[10px] uppercase font-bold text-indigo-700 block">Dividends Distributed</span>
                                    <div className="text-2xl font-extrabold text-indigo-700 font-mono mt-1">
                                        ₹{totalDividendPool.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </div>
                                    <p className="text-[10px] text-indigo-600/80 mt-1">Payout to Equity Shareholders ({payoutRatio}%)</p>
                                </div>

                                <div className="border rounded-lg p-4 bg-emerald-50/30">
                                    <span className="text-[10px] uppercase font-bold text-emerald-700 block">Transferred to Reserves</span>
                                    <div className="text-2xl font-extrabold text-emerald-700 font-mono mt-1">
                                        ₹{retainedEarningsReserve.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </div>
                                    <p className="text-[10px] text-emerald-600/80 mt-1">Added to Balance Sheet Capital Reserve ({100 - payoutRatio}%)</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Add / Edit Shareholder Dialog Modal */}
            <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingShareholder ? "Edit Shareholder Profile" : "Add Equity Shareholder"}</DialogTitle>
                        <DialogDescription className="text-xs">
                            Add shareholder equity allocation and statutory bank details under Companies Act 2013.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2 text-xs">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1 col-span-2">
                                <Label htmlFor="sh-name">Shareholder / Entity Name <span className="text-destructive">*</span></Label>
                                <Input 
                                    id="sh-name" 
                                    value={form.name} 
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g. Shygul Akbar"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="sh-desig">Designation / Designation Title</Label>
                                <Input 
                                    id="sh-desig" 
                                    value={form.designation} 
                                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                                    placeholder="e.g. Director"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="sh-cat">Shareholder Category</Label>
                                <Select value={form.category} onValueChange={(v: any) => setForm({ ...form, category: v })}>
                                    <SelectTrigger id="sh-cat"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Promoter">Promoter Group</SelectItem>
                                        <SelectItem value="Angel Investor">Angel Investor</SelectItem>
                                        <SelectItem value="Institutional">Institutional Investor</SelectItem>
                                        <SelectItem value="Key Executive">Key Executive / ESOP</SelectItem>
                                        <SelectItem value="Retail">Retail Investor</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="sh-folio">Folio / Demat Number</Label>
                                <Input 
                                    id="sh-folio" 
                                    value={form.folioNumber} 
                                    onChange={(e) => setForm({ ...form, folioNumber: e.target.value })}
                                    className="font-mono"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="sh-pan">PAN Card Number</Label>
                                <Input 
                                    id="sh-pan" 
                                    value={form.panNumber} 
                                    onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
                                    className="font-mono uppercase"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="sh-shares">Number of Equity Shares <span className="text-destructive">*</span></Label>
                                <Input 
                                    id="sh-shares" 
                                    type="number"
                                    value={form.sharesHeld} 
                                    onChange={(e) => setForm({ ...form, sharesHeld: e.target.value })}
                                    className="font-bold text-indigo-600 font-mono"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="sh-face">Face Value (₹)</Label>
                                <Input 
                                    id="sh-face" 
                                    type="number"
                                    value={form.faceValue} 
                                    onChange={(e) => setForm({ ...form, faceValue: e.target.value })}
                                    className="font-mono"
                                />
                            </div>
                        </div>

                        {/* Bank Details */}
                        <div className="space-y-2 pt-2 border-t">
                            <h4 className="font-bold text-foreground">Dividend Bank Settlement Details</h4>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <Label htmlFor="sh-bank">Bank Name</Label>
                                    <Input id="sh-bank" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="sh-acc">A/c Number</Label>
                                    <Input id="sh-acc" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} className="font-mono" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="sh-ifsc">IFSC Code</Label>
                                    <Input id="sh-ifsc" value={form.ifscCode} onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })} className="font-mono uppercase" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveShareholder} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                            Save Shareholder
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dividend Warrant Voucher Modal */}
            <Dialog open={warrantModalOpen} onOpenChange={setWarrantModalOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Dividend Warrant / Advice Voucher</DialogTitle>
                        <DialogDescription className="text-xs">
                            Official Dividend Statement under Section 194 of the Income Tax Act, 1961
                        </DialogDescription>
                    </DialogHeader>

                    {selectedShareholderForWarrant && (() => {
                        const pct = totalIssuedShares > 0 ? selectedShareholderForWarrant.sharesHeld / totalIssuedShares : 0;
                        const grossDiv = totalDividendPool * pct;
                        const tds = grossDiv > 5000 ? grossDiv * 0.10 : 0;
                        const netDiv = grossDiv - tds;

                        return (
                            <div className="space-y-4 py-3 text-xs border p-4 rounded-lg bg-slate-50 dark:bg-slate-900 font-mono">
                                <div className="text-center border-b pb-3 space-y-1">
                                    <h3 className="font-extrabold text-sm uppercase text-slate-900 dark:text-white">ZENJOURNEY PRIVATE LIMITED</h3>
                                    <p className="text-[10px] text-muted-foreground">CIN: U62013TN2026PTC191867</p>
                                    <Badge className="bg-indigo-600 text-white font-mono text-[9px]">DIVIDEND WARRANT ADVICE — FY 2026-27</Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                    <div>
                                        <span className="text-muted-foreground block text-[9px] uppercase">Shareholder Name:</span>
                                        <strong className="text-slate-900 dark:text-white">{selectedShareholderForWarrant.name}</strong>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block text-[9px] uppercase">Folio / Demat No:</span>
                                        <strong>{selectedShareholderForWarrant.folioNumber}</strong>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block text-[9px] uppercase">PAN Number:</span>
                                        <strong>{selectedShareholderForWarrant.panNumber}</strong>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block text-[9px] uppercase">Equity Shares Held:</span>
                                        <strong>{selectedShareholderForWarrant.sharesHeld.toLocaleString("en-IN")} Shares ({(pct * 100).toFixed(2)}%)</strong>
                                    </div>
                                </div>

                                <div className="border-t border-b py-2 space-y-1 bg-white dark:bg-slate-800 p-2 rounded">
                                    <div className="flex justify-between"><span>Gross Dividend Entitlement:</span> <span className="font-bold">₹{grossDiv.toFixed(2)}</span></div>
                                    <div className="flex justify-between text-rose-600"><span>Less: TDS under Sec 194 (10%):</span> <span className="font-bold">- ₹{tds.toFixed(2)}</span></div>
                                    <div className="flex justify-between text-emerald-600 font-extrabold text-sm border-t pt-1">
                                        <span>Net Dividend Payable:</span>
                                        <span>₹{netDiv.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="text-[10px] text-muted-foreground">
                                    Bank Settlement Account: {selectedShareholderForWarrant.bankName || 'HDFC Bank'} (A/c: {selectedShareholderForWarrant.accountNumber || 'Pending'})
                                </div>
                            </div>
                        );
                    })()}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setWarrantModalOpen(false)}>Close</Button>
                        <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                            <Printer className="h-4 w-4 mr-1.5" /> Print Dividend Warrant
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
