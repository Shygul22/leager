import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Users,
  FileText,
  Briefcase,
  UserCheck,
  MessageSquare,
  Bug,
  FolderOpen,
  Truck,
  Handshake,
  ArrowRight
} from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: "Customer" | "Invoice" | "Quotation" | "Project" | "Employee" | "Ticket" | "Bug" | "Document" | "Supplier" | "Contract";
  url: string;
}

export function GlobalSearch({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { account, profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const activeAccountId = account?.id || profile?.account_id;

  // Multi-entity search queries
  const { data: clients = [] } = useQuery({
    queryKey: ["gs-clients", activeAccountId],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name, company, email");
      return data || [];
    }
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["gs-invoices", activeAccountId],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("id, invoice_number, client_name");
      return data || [];
    }
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ["gs-quotations", activeAccountId],
    queryFn: async () => {
      const { data } = await supabase.from("quotations").select("id, quotation_number, client_name");
      return data || [];
    }
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["gs-projects", activeAccountId],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, title, status");
      return data || [];
    }
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["gs-employees", activeAccountId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, name, designation");
      return data || [];
    }
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["gs-suppliers", activeAccountId],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name, category");
      return data || [];
    }
  });

  // Aggregated search results
  const results: SearchResult[] = [];
  const q = searchTerm.toLowerCase().trim();

  if (q.length > 0) {
    clients.forEach((c: any) => {
      if (c.name?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)) {
        results.push({ id: c.id, title: c.name, subtitle: c.company || c.email || "Customer", type: "Customer", url: "/clients" });
      }
    });

    invoices.forEach((inv: any) => {
      if (inv.invoice_number?.toLowerCase().includes(q) || inv.client_name?.toLowerCase().includes(q)) {
        results.push({ id: inv.id, title: inv.invoice_number, subtitle: inv.client_name, type: "Invoice", url: "/invoices" });
      }
    });

    quotations.forEach((quo: any) => {
      if (quo.quotation_number?.toLowerCase().includes(q) || quo.client_name?.toLowerCase().includes(q)) {
        results.push({ id: quo.id, title: quo.quotation_number, subtitle: quo.client_name, type: "Quotation", url: "/quotations" });
      }
    });

    projects.forEach((p: any) => {
      if (p.title?.toLowerCase().includes(q)) {
        results.push({ id: p.id, title: p.title, subtitle: `Status: ${p.status}`, type: "Project", url: "/projects" });
      }
    });

    employees.forEach((emp: any) => {
      if (emp.name?.toLowerCase().includes(q) || emp.designation?.toLowerCase().includes(q)) {
        results.push({ id: emp.id, title: emp.name, subtitle: emp.designation, type: "Employee", url: "/employees" });
      }
    });

    suppliers.forEach((s: any) => {
      if (s.name?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q)) {
        results.push({ id: s.id, title: s.name, subtitle: s.category || "Supplier", type: "Supplier", url: "/suppliers" });
      }
    });
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Customer": return <Users className="h-4 w-4 text-blue-500" />;
      case "Invoice": return <FileText className="h-4 w-4 text-emerald-500" />;
      case "Quotation": return <FileText className="h-4 w-4 text-amber-500" />;
      case "Project": return <Briefcase className="h-4 w-4 text-purple-500" />;
      case "Employee": return <UserCheck className="h-4 w-4 text-indigo-500" />;
      case "Supplier": return <Truck className="h-4 w-4 text-orange-500" />;
      default: return <Search className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleSelect = (url: string) => {
    onClose();
    navigate(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden shadow-2xl">
        <div className="p-3 border-b flex items-center gap-2.5 bg-slate-50 dark:bg-slate-900">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Global ERP Search (Customers, Invoices, Projects, Employees, Suppliers)..."
            className="border-none shadow-none focus-visible:ring-0 text-xs h-9 bg-transparent p-0"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Badge variant="outline" className="text-[10px] font-mono">ESC</Badge>
        </div>

        <ScrollArea className="max-h-[360px] p-2">
          {q.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Type keywords to search across the entire ZenJourney InfoTech enterprise system...
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No ERP records matching "{searchTerm}" found.
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((res) => (
                <div
                  key={`${res.type}-${res.id}`}
                  onClick={() => handleSelect(res.url)}
                  className="flex items-center justify-between p-2.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      {getTypeIcon(res.type)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{res.title}</p>
                      <p className="text-[11px] text-muted-foreground">{res.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase font-bold">
                      {res.type}
                    </Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
