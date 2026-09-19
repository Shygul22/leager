import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, BookOpen, Layers, CheckCircle2, FileText, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

export default function ChartOfAccounts() {
  const { user, role, account } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"asset" | "liability" | "equity" | "revenue" | "expense">("asset");
  const [category, setCategory] = useState("Current Assets");
  const [description, setDescription] = useState("");

  const activeAccountId = account?.id;

  const { data: accountsList = [], isLoading } = useQuery({
    queryKey: ["chart-of-accounts", activeAccountId],
    queryFn: async () => {
      let query = supabase.from("chart_of_accounts").select("*").order("code", { ascending: true });
      if (activeAccountId) {
        query = query.or(`account_id.eq.${activeAccountId},account_id.is.null`);
      }
      const { data, error } = await query;
      if (error) {
        console.warn("Using default Indian IT GAAP Chart of Accounts", error);
        // Fallback default Indian IT GAAP Chart of Accounts if table not yet migrated
        return [
          { id: "1", code: "1010", name: "Cash on Hand", type: "asset", category: "Current Assets", balance: 1500, is_active: true },
          { id: "2", code: "1020", name: "Bank Accounts (State Bank of India)", type: "asset", category: "Current Assets", balance: 3000, is_active: true },
          { id: "3", code: "1030", name: "Accounts Receivable (Debtors)", type: "asset", category: "Current Assets", balance: 0, is_active: true },
          { id: "4", code: "1510", name: "Computer Hardware & Laptops", type: "asset", category: "Fixed Assets", balance: 75000, is_active: true },
          { id: "5", code: "2010", name: "Accounts Payable (Creditors)", type: "liability", category: "Current Liabilities", balance: 2140, is_active: true },
          { id: "6", code: "2020", name: "GST Output Tax Payable", type: "liability", category: "Current Liabilities", balance: 0, is_active: true },
          { id: "7", code: "3010", name: "Founder Share Capital", type: "equity", category: "Equity", balance: 100000, is_active: true },
          { id: "8", code: "3020", name: "Retained Earnings", type: "equity", category: "Equity", balance: 2360, is_active: true },
          { id: "9", code: "4010", name: "Software Development Revenue", type: "revenue", category: "Operating Revenue", balance: 4500, is_active: true },
          { id: "10", code: "5010", name: "Cost of Goods Sold (Direct Costs)", type: "expense", category: "Direct Expense", balance: 1200, is_active: true },
          { id: "11", code: "6010", name: "Salaries & Staff Compensation", type: "expense", category: "Operating Expense", balance: 940, is_active: true }
        ];
      }
      return data || [];
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code,
        name,
        type,
        category,
        description,
        account_id: activeAccountId || null,
        balance: 0.00,
        is_active: true
      };
      const { error } = await supabase.from("chart_of_accounts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account successfully added to Chart of Accounts");
      queryClient.invalidateQueries({ queryKey: ["chart-of-accounts"] });
      setIsCreateOpen(false);
      setCode("");
      setName("");
      setDescription("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add account");
    }
  });

  const filteredAccounts = accountsList.filter((acc: any) => {
    const matchesSearch =
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === "all" || acc.type === selectedType;
    return matchesSearch && matchesType;
  });

  const getTypeBadge = (accType: string) => {
    switch (accType) {
      case "asset": return <Badge className="bg-blue-600 text-white">Asset</Badge>;
      case "liability": return <Badge className="bg-amber-600 text-white">Liability</Badge>;
      case "equity": return <Badge className="bg-purple-600 text-white">Equity</Badge>;
      case "revenue": return <Badge className="bg-emerald-600 text-white">Revenue</Badge>;
      case "expense": return <Badge className="bg-rose-600 text-white">Expense</Badge>;
      default: return <Badge variant="outline">{accType}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Chart of Accounts
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            GAAP & Ind AS standard General Ledger accounts structure for ZenJourney InfoTech
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold text-xs">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Ledger Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">New Ledger Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Account Code</Label>
                  <Input placeholder="e.g. 1040" value={code} onChange={(e) => setCode(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Account Type</Label>
                  <Select value={type} onValueChange={(val: any) => setType(val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">Asset (1000s)</SelectItem>
                      <SelectItem value="liability">Liability (2000s)</SelectItem>
                      <SelectItem value="equity">Equity (3000s)</SelectItem>
                      <SelectItem value="revenue">Revenue (4000s)</SelectItem>
                      <SelectItem value="expense">Expense (5000s-6000s)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Account Name</Label>
                <Input placeholder="e.g. Cloud Hosting & AWS" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category / Group</Label>
                <Input placeholder="e.g. Operating Expense, Fixed Assets" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Description (Optional)</Label>
                <Input placeholder="Usage details..." value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createAccountMutation.mutate()} disabled={!code || !name}>Save Account</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <Card className="shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code, account name, category..."
              className="pl-9 h-9 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[160px] h-9 text-xs font-medium">
                <SelectValue placeholder="All Account Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Account Types</SelectItem>
                <SelectItem value="asset">Assets (1000s)</SelectItem>
                <SelectItem value="liability">Liabilities (2000s)</SelectItem>
                <SelectItem value="equity">Equity (3000s)</SelectItem>
                <SelectItem value="revenue">Revenue (4000s)</SelectItem>
                <SelectItem value="expense">Expenses (5000-6000s)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900">
              <TableRow>
                <TableHead className="w-24 text-[10px] uppercase font-bold">Code</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Account Name</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Type</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Category Group</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold">Current Balance</TableHead>
                <TableHead className="text-center text-[10px] uppercase font-bold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                    Loading Chart of Accounts...
                  </TableCell>
                </TableRow>
              ) : filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                    No accounts found matching filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((acc: any) => (
                  <TableRow key={acc.id || acc.code} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                    <TableCell className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                      {acc.code}
                    </TableCell>
                    <TableCell className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                      {acc.name}
                      {acc.description && <span className="block text-[10px] text-muted-foreground font-normal">{acc.description}</span>}
                    </TableCell>
                    <TableCell>{getTypeBadge(acc.type)}</TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">{acc.category}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs">
                      ₹{Number(acc.balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Active
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
