import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Search, Plus, BookOpen, ChevronRight, FileText } from "lucide-react";
import { toast } from "sonner";

export default function KnowledgeBase() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("IT Operations");
  const [content, setContent] = useState("");

  const activeAccountId = account?.id;

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["knowledge-base", activeAccountId],
    queryFn: async () => {
      let query = supabase.from("knowledge_base").select("*").order("created_at", { ascending: false });
      if (activeAccountId) query = query.eq("account_id", activeAccountId);
      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return [
          {
            id: "kb-1",
            title: "Standard Operating Procedure: Client Invoicing & Payment Terms",
            category: "Finance & Billing",
            content: "All client invoices must be issued with 15-day payment terms (Net 15). Quotations over ₹50,000 require client PO sign-off and 50% mobilization advance before sprint kickoff.",
            created_at: "2026-09-01"
          },
          {
            id: "kb-2",
            title: "Developer Workstation Setup & Security Guidelines",
            category: "IT Operations",
            content: "All engineering laptops must have full-disk encryption (BitLocker), 2-factor authentication enabled across Git and cloud environments, and adhere to local backup policies.",
            created_at: "2026-09-05"
          },
          {
            id: "kb-3",
            title: "Support Ticket SLA Response Matrix",
            category: "Helpdesk & SLA",
            content: "Urgent/Critical Severity: < 1 hour response, 4 hours resolution. High: 4 hours response, 24 hours resolution. Medium: 8 hours response. Low: 24 hours response.",
            created_at: "2026-09-10"
          }
        ];
      }
      return data;
    }
  });

  const createKBArticleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        category,
        content,
        is_published: true,
        account_id: activeAccountId || null
      };
      const { error } = await supabase.from("knowledge_base").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Knowledge Base article published");
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
      setIsCreateOpen(false);
      setTitle("");
      setContent("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to publish article");
    }
  });

  const filteredArticles = articles.filter((art: any) => {
    const matchQuery = art.title.toLowerCase().includes(searchTerm.toLowerCase()) || art.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = selectedCategory === "all" || art.category === selectedCategory;
    return matchQuery && matchCat;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" />
            Knowledge Base & SOP Library
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Internal company SOPs, SLA guidelines, engineering handbooks & customer FAQs
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold text-xs">
              <Plus className="h-4 w-4 mr-1.5" />
              New SOP Article
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Publish Knowledge Base Article</DialogTitle>
            </DialogHeader>
            <div className="space-y-3.5 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Article Title</Label>
                <Input placeholder="e.g. Production Deployment Checklist" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category</Label>
                <Input placeholder="e.g. IT Operations, HR, Finance" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Content & Instructions</Label>
                <textarea
                  className="w-full min-h-[140px] text-xs p-3 rounded-md border bg-background"
                  placeholder="Step-by-step instructions or policy guidelines..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createKBArticleMutation.mutate()} disabled={!title || !content}>
                Publish
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search articles, procedures, SLAs and guidelines..."
          className="pl-10 h-10 text-xs shadow-sm bg-card"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Articles Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredArticles.map((art: any) => (
          <Card key={art.id} className="shadow-sm hover:shadow-md transition-all border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between mb-1">
                <Badge variant="outline" className="text-[10px] font-bold uppercase">
                  {art.category}
                </Badge>
              </div>
              <CardTitle className="text-sm font-bold leading-snug text-slate-900 dark:text-slate-100">
                {art.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 mb-3">
                {art.content}
              </p>
              <div className="text-[10px] text-muted-foreground flex justify-between items-center pt-2 border-t">
                <span>Published {art.created_at}</span>
                <span className="font-semibold text-primary flex items-center gap-0.5 cursor-pointer hover:underline">
                  Read SOP <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
