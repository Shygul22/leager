import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Layers, Download, Printer, Filter, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function GeneralLedger() {
  const { user, account } = useAuth();
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const activeAccountId = account?.id;

  // 1. Fetch Chart of Accounts for selector
  const { data: chartAccounts = [] } = useQuery({
    queryKey: ["gl-chart-accounts", activeAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chart_of_accounts").select("*").order("code", { ascending: true });
      if (error || !data || data.length === 0) {
        return [
          { code: "1010", name: "Cash on Hand", type: "asset" },
          { code: "1020", name: "Bank Accounts (SBI)", type: "asset" },
          { code: "1030", name: "Accounts Receivable (Debtors)", type: "asset" },
          { code: "1510", name: "Computer Equipment & Hardware", type: "asset" },
          { code: "2010", name: "Accounts Payable (Creditors)", type: "liability" },
          { code: "2020", name: "GST Output Tax Payable", type: "liability" },
          { code: "3010", name: "Share Capital / Founder Equity", type: "equity" },
          { code: "4010", name: "Software Development Revenue", type: "revenue" },
          { code: "5010", name: "Cost of Goods Sold (Direct Costs)", type: "expense" },
          { code: "6010", name: "Salaries & Staff Compensation", type: "expense" },
          { code: "6020", name: "Office Rent & Utilities", type: "expense" }
        ];
      }
      return data;
    }
  });

  // 2. Fetch Journal Lines for Ledger
  const { data: ledgerLines = [], isLoading } = useQuery({
    queryKey: ["gl-lines", activeAccountId, selectedAccount],
    queryFn: async () => {
      let query = supabase.from("journal_entry_lines").select("*, journal_entries(entry_number, entry_date, description)");
      if (selectedAccount !== "all") {
        query = query.eq("account_code", selectedAccount);
      }
      const { data, error } = await query;
      if (error) {
        console.warn("General ledger query error:", error);
        return [];
      }
      return data || [];
    }
  });

  const filteredLines = ledgerLines.filter((l: any) => {
    if (selectedAccount === "all") return true;
    return l.account_code === selectedAccount;
  });

  const totalDebit = filteredLines.reduce((sum: number, l: any) => sum + Number(l.debit || 0), 0);
  const totalCredit = filteredLines.reduce((sum: number, l: any) => sum + Number(l.credit || 0), 0);
  const netBalance = totalDebit - totalCredit;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            General Ledger
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Individual Account Ledgers with running balances and double-entry postings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-[240px] text-xs font-medium bg-card">
              <SelectValue placeholder="All Ledger Accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts Summary</SelectItem>
              {chartAccounts.map((acc: any) => (
                <SelectItem key={acc.code} value={acc.code} className="text-xs">
                  {acc.code} - {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Account KPI Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm border-t-4 border-t-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Debits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-blue-600">
              ₹{totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-t-4 border-t-amber-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-amber-600">
              ₹{totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-t-4 border-t-purple-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Net Ledger Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-purple-700">
              ₹{netBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {netBalance >= 0 ? "(Dr)" : "(Cr)"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ledger Table */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 dark:bg-slate-900 py-3 border-b">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Account Postings & Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 text-[10px] uppercase font-bold">Date</TableHead>
                <TableHead className="w-28 text-[10px] uppercase font-bold">Journal Ref</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Account Name & Narration</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold text-blue-600">Debit (₹)</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold text-amber-600">Credit (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                    Loading General Ledger records...
                  </TableCell>
                </TableRow>
              ) : filteredLines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                    No postings found for the selected account.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLines.map((line: any) => (
                  <TableRow key={line.id} className="hover:bg-slate-50/70">
                    <TableCell className="text-xs font-medium text-slate-700">
                      {line.journal_entries?.entry_date || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-slate-900">
                      {line.journal_entries?.entry_number || "—"}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-xs text-slate-900">{line.account_code} - {line.account_name}</span>
                      <p className="text-[11px] text-muted-foreground">{line.description || line.journal_entries?.description}</p>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-blue-700">
                      {Number(line.debit) > 0 ? `₹${Number(line.debit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs text-amber-700">
                      {Number(line.credit) > 0 ? `₹${Number(line.credit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
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
