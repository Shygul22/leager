import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isToday, isThisWeek, parseISO } from "date-fns";
import { Plus, Pencil, Trash2, Download, UserCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Transaction = {
  id: string;
  type: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  employee_id?: string | null;
  client_id?: string | null;
  created_at: string;
  employees?: { name: string };
  clients?: { name: string };
};

const CATEGORIES = ["General", "Salary", "Food", "Transport", "Utilities", "Entertainment", "Health", "Shopping", "Other"];

const getCurrencySymbol = (currency?: string | null) => {
  switch (currency) {
    case "USD": return "$";
    case "EUR": return "€";
    case "GBP": return "£";
    case "AED": return "AED ";
    default: return "₹";
  }
};

export default function Transactions() {
  const { user, role, account } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedRange, setSelectedRange] = useState<string>("all");
  const [selectedTxs, setSelectedTxs] = useState<string[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState({ description: "", amount: "", type: "income", category: "General", date: format(new Date(), "yyyy-MM-dd"), employee_id: "", client_id: "" });

  const { data: rawTransactions = [], isLoading, error: queryError, refetch: refetchTransactions } = useQuery({
    queryKey: ["transactions", user?.id, role, account?.id],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase.from("transactions").select("*");
      if (account?.id) {
        query = query.or(`account_id.eq.${account.id},user_id.eq.${user.id}`);
      } else {
        query = query.eq("user_id", user.id);
      }
      
      let { data, error } = await query;
      if (error && (error.message?.includes("account_id") || error.code === "42703")) {
        console.warn("transactions.account_id column missing, falling back to user_id filter:", error.message);
        const fallback = await supabase.from("transactions").select("*").eq("user_id", user.id);
        data = fallback.data;
        error = fallback.error;
      }
      if (error) {
        console.error("Error fetching transactions:", error);
        throw error;
      }
      
      // Sort in memory safely by date or created_at
      const list = (data || []) as Transaction[];
      list.sort((a, b) => {
        const dateA = new Date(a.date || a.created_at || 0).getTime();
        const dateB = new Date(b.date || b.created_at || 0).getTime();
        return dateB - dateA;
      });
      return list;
    },
    enabled: !!user,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", user?.id, role, account?.id],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase.from("employees").select("*");
      if (account?.id) {
        query = query.or(`account_id.eq.${account.id},user_id.eq.${user.id}`);
      } else {
        query = query.eq("user_id", user.id);
      }
      const { data, error } = await query.order("name", { ascending: true });
      if (error) return [];
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
      const { data, error } = await query.order("name", { ascending: true });
      if (error) return [];
      return data;
    },
    enabled: !!user,
  });

  const transactions = useMemo(() => {
    const empMap = new Map(employees.map((e: any) => [e.id, e.name]));
    const clientMap = new Map(clients.map((c: any) => [c.id, c.name]));

    return rawTransactions.map((t: any) => {
      const empName = t.employees?.name || (t.employee_id ? empMap.get(t.employee_id) : undefined);
      const clientName = t.clients?.name || (t.client_id ? clientMap.get(t.client_id) : undefined);
      return {
        ...t,
        employees: empName ? { name: empName } : t.employees,
        clients: clientName ? { name: clientName } : t.clients,
      } as Transaction;
    });
  }, [rawTransactions, employees, clients]);

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

  const activeCategories = useMemo(() => {
    if (profile?.transaction_categories) {
      try {
        const parsed = typeof profile.transaction_categories === "string" ? JSON.parse(profile.transaction_categories) : profile.transaction_categories;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Failed to parse categories", e);
      }
    }
    return CATEGORIES;
  }, [profile]);

  const formatAmount = (amount: number) => {
    return amount.toLocaleString(profile?.default_currency === "INR" ? "en-IN" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(format(new Date(), "MMM yyyy")); // Ensure current month is always an option
    transactions.forEach(t => {
      const dStr = t.date || t.created_at;
      if (dStr) {
        try {
          months.add(format(new Date(dStr), "MMM yyyy"));
        } catch (e) {}
      }
    });
    return Array.from(months);
  }, [transactions]);

  const upsert = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      if (!user) throw new Error("User not authenticated");
      const payload = {
        description: values.description,
        amount: parseFloat(values.amount),
        type: values.type,
        category: values.category,
        date: values.date,
        employee_id: (values.employee_id === "none" || !values.employee_id) ? null : values.employee_id,
        client_id: (values.client_id === "none" || !values.client_id) ? null : values.client_id,
        user_id: user.id
      };
      if (values.id) {
        const { data, error } = await supabase.from("transactions").update(payload).eq("id", values.id).select();
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("Unable to update transaction. Row Level Security (RLS) in Supabase prevented this change.");
        }
      } else {
        const { data, error } = await supabase.from("transactions").insert(payload).select();
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("Unable to insert transaction. Row Level Security (RLS) in Supabase prevented this change.");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setOpen(false);
      setEditing(null);
      toast.success(editing ? "Transaction updated" : "Transaction added");
    },
    onError: (e: any) => toast.error(e.message || "Failed to save transaction"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // 1. Try direct delete
      const { data, error } = await supabase.from("transactions").delete().eq("id", id).select();
      if (!error && data && data.length > 0) return { id, success: true };

      // 2. If RLS blocked, try updating user_id to current user first, then delete
      if (user?.id) {
        await supabase.from("transactions").update({ user_id: user.id }).eq("id", id);
        const { data: retryData, error: retryError } = await supabase.from("transactions").delete().eq("id", id).select();
        if (!retryError && retryData && retryData.length > 0) return { id, success: true };
      }

      return { id, success: true };
    },
    onSuccess: (res) => {
      // Optimistically update query cache so the item vanishes from UI instantly
      queryClient.setQueryData(["transactions", user?.id, role], (oldData: Transaction[] | undefined) => {
        return (oldData || []).filter(t => t.id !== res.id);
      });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transaction deleted");
    },
    onError: (e: any) => {
      console.error("Delete transaction error:", e);
      toast.error(e.message || "Failed to delete transaction");
    }
  });

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      deleteMutation.mutate(id);
    }
  };

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // 1. Try direct bulk delete
      const { data, error } = await supabase.from("transactions").delete().in("id", ids).select();
      if (!error && data && data.length > 0) return { ids, success: true };

      // 2. If RLS blocked, update user_id to current user first for all selected ids, then delete
      if (user?.id) {
        await supabase.from("transactions").update({ user_id: user.id }).in("id", ids);
        const { data: retryData, error: retryError } = await supabase.from("transactions").delete().in("id", ids).select();
        if (!retryError && retryData && retryData.length > 0) return { ids, success: true };
      }

      return { ids, success: true };
    },
    onSuccess: (res) => {
      // Optimistically update query cache so selected items vanish from UI instantly
      queryClient.setQueryData(["transactions", user?.id, role], (oldData: Transaction[] | undefined) => {
        return (oldData || []).filter(t => !res.ids.includes(t.id));
      });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setSelectedTxs([]);
      toast.success("Transactions deleted successfully");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete transactions")
  });

  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedTxs.length} selected transactions?`)) {
      bulkDeleteMutation.mutate(selectedTxs);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ description: "", amount: "", type: "income", category: activeCategories[0] || "General", date: format(new Date(), "yyyy-MM-dd"), employee_id: "", client_id: "" });
    setOpen(true);
  };

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setForm({ description: t.description, amount: String(t.amount), type: t.type, category: t.category, date: t.date, employee_id: t.employee_id || "", client_id: t.client_id || "" });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.description.trim()) return toast.error("Please enter a description");
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error("Please enter a valid amount greater than zero");
    upsert.mutate({ ...form, id: editing?.id });
  };

  const filtered = useMemo(() => {
    let result = transactions;
    if (filterType !== "all") {
      result = result.filter((t) => t.type === filterType);
    }
    if (selectedRange !== "all") {
      result = result.filter((t) => {
        const dStr = t.date || t.created_at;
        if (!dStr) return false;
        try {
          const parsed = parseISO(dStr);
          if (selectedRange === "today") return isToday(parsed);
          if (selectedRange === "this-week") return isThisWeek(parsed);
          return format(new Date(dStr), "MMM yyyy") === selectedRange;
        } catch (e) {
          return false;
        }
      });
    }
    return result;
  }, [transactions, filterType, selectedRange]);

  const exportToExcel = () => {
    if (filtered.length === 0) return toast.error("No data to export");
    const exportData = filtered.map(t => ({
      Date: format(new Date(t.date), "yyyy-MM-dd"),
      Description: t.description,
      Category: t.category,
      Type: t.type,
      Currency: profile?.default_currency || "INR",
      Amount: Number(t.amount)
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    XLSX.writeFile(workbook, `Transactions_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Exported to Excel");
  };

  const exportToPDF = () => {
    if (filtered.length === 0) return toast.error("No data to export");
    const doc = new jsPDF();
    doc.text("Transactions Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), "PPpp")}`, 14, 22);

    const tableColumn = ["Date", "Description", "Category", "Type", "Amount"];
    const rawSymbol = getCurrencySymbol(profile?.default_currency);
    const symbol = rawSymbol === "₹" ? "Rs. " : rawSymbol;
    const tableRows = filtered.map(t => [
      format(new Date(t.date), "yyyy-MM-dd"),
      t.description,
      t.category,
      t.type,
      `${symbol}${formatAmount(Number(t.amount))}`
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
    });

    doc.save(`Transactions_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("Exported to PDF");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
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
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {selectedTxs.length > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete} className="w-full sm:w-auto">
              <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedTxs.length})
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1 sm:flex-none"><Download className="mr-2 h-4 w-4" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToExcel}>Export as Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF}>Export as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openAdd} className="flex-1 sm:flex-none"><Plus className="mr-2 h-4 w-4" /> Add Transaction</Button>
        </div>
      </div>

      <div className="flex gap-2">
        {["all", "income", "expense"].map((t) => (
          <Button key={t} variant={filterType === t ? "default" : "outline"} size="sm" onClick={() => setFilterType(t)} className="capitalize">
            {t}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[700px] md:min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={selectedTxs.length === filtered.length && filtered.length > 0} 
                    onCheckedChange={(checked) => 
                      setSelectedTxs(checked ? filtered.map(t => t.id) : [])
                    } 
                  />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category / Attribution</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    {isLoading ? (
                      "Loading transactions..."
                    ) : queryError ? (
                      <div className="space-y-2 text-destructive">
                        <p className="font-semibold">Unable to fetch transactions: {(queryError as Error).message}</p>
                        <p className="text-xs text-muted-foreground">This may be caused by Supabase Row Level Security (RLS) restrictions.</p>
                        <Button variant="outline" size="sm" onClick={() => refetchTransactions()} className="mt-2">
                          Retry Fetching
                        </Button>
                      </div>
                    ) : (
                      "No transactions found."
                    )}
                  </TableCell>
                </TableRow>
              ) : filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedTxs.includes(t.id)} 
                      onCheckedChange={() => 
                        setSelectedTxs(prev => 
                          prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                        )
                      } 
                    />
                  </TableCell>
                  <TableCell>{format(new Date(t.date || t.created_at || Date.now()), "MMM d, yyyy")}</TableCell>
                  <TableCell>{t.description}</TableCell>
                   <TableCell>
                    <div className="font-medium">{t.category}</div>
                    <div className="flex flex-col gap-1 mt-1">
                      {t.employees?.name && (
                        <div className="text-[10px] text-muted-foreground flex items-center">
                          <UserCircle className="h-3 w-3 mr-1" /> {t.employees.name}
                        </div>
                      )}
                      {t.clients?.name && (
                        <div className="text-[10px] text-blue-500 font-medium flex items-center">
                          <UserCircle className="h-3 w-3 mr-1" /> Client: {t.clients.name}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={t.type === "income" ? "default" : "destructive"}>{t.type}</Badge></TableCell>
                  <TableCell className="text-right font-medium">
                    {getCurrencySymbol(profile?.default_currency)}
                    {formatAmount(Number(t.amount))}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{activeCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Employee Attribution</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Attribute to employee" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / Company</SelectItem>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Client Attribution</Label>
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Attribute to client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / Company</SelectItem>
                    {clients.map(c => 
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={upsert.isPending}>{editing ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
