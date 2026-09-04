import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Plus, Trash2, Edit, Briefcase, Clock, CheckCircle2, MessageSquare, History } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type ProjectUpdate = {
    id: string;
    project_id: string;
    title: string;
    body: string;
    created_at: string;
};

type Project = {
    id: string;
    name: string;
    description: string | null;
    status: string;
    progress: number;
    start_date: string;
    end_date: string | null;
    client_id: string | null;
    created_at: string;
    clients?: { name: string };
    project_updates?: ProjectUpdate[];
};

export default function Projects() {
    const { user, role, account } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: "",
        description: "",
        status: "in_progress",
        progress: 0,
        start_date: format(new Date(), "yyyy-MM-dd"),
        end_date: "",
        client_id: "",
    });

    const [updateForm, setUpdateForm] = useState({
        title: "",
        body: "",
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
            const { data, error } = await query.order("name");
            if (error) throw error;
            return data;
        },
        enabled: !!user
    });

    const { data: projects = [], isLoading } = useQuery({
        queryKey: ["projects", user?.id, role, account?.id],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("projects").select("*, clients(name), project_updates(*)");
            if (account?.id) {
                query = query.or(`account_id.eq.${account.id},user_id.eq.${user.id}`);
            } else {
                query = query.eq("user_id", user.id);
            }
            const { data, error } = await query.order("created_at", { ascending: false });
            if (error) throw error;
            return data as Project[];
        },
        enabled: !!user
    });

    const upsertProject = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Not authenticated");
            const payload = {
                ...form,
                user_id: user.id,
                client_id: form.client_id || null,
                end_date: form.end_date || null,
            };

            if (editingId) {
                const { error } = await supabase.from("projects").update(payload).eq("id", editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("projects").insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            setOpen(false);
            toast.success(editingId ? "Project updated" : "Project created");
        },
        onError: (e) => toast.error(e.message),
    });

    const addUpdate = useMutation({
        mutationFn: async () => {
            if (!selectedProjectId) return;
            const { error } = await supabase.from("project_updates").insert({
                project_id: selectedProjectId,
                title: updateForm.title,
                body: updateForm.body,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            setUpdateDialogOpen(false);
            setUpdateForm({ title: "", body: "" });
            toast.success("Project update added");
        },
        onError: (e) => toast.error(e.message),
    });

    const deleteProject = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("projects").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            toast.success("Project deleted");
        },
        onError: (e) => toast.error(e.message),
    });

    const { data: projectHistory = [], isLoading: historyLoading } = useQuery({
        queryKey: ["project_history", selectedProjectId],
        queryFn: async () => {
            if (!selectedProjectId) return [];
            const { data, error } = await supabase
                .from("project_updates")
                .select("*")
                .eq("project_id", selectedProjectId)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: historyDialogOpen && !!selectedProjectId,
    });

    const openCreate = () => {
        setEditingId(null);
        setForm({
            name: "",
            description: "",
            status: "in_progress",
            progress: 0,
            start_date: format(new Date(), "yyyy-MM-dd"),
            end_date: "",
            client_id: "",
        });
        setOpen(true);
    };

    const openEdit = (p: Project) => {
        setEditingId(p.id);
        setForm({
            name: p.name,
            description: p.description || "",
            status: p.status,
            progress: p.progress,
            start_date: p.start_date,
            end_date: p.end_date || "",
            client_id: p.client_id || "",
        });
        setOpen(true);
    };

    const statusColor = (s: string) => {
        switch (s) {
            case "completed": return "default";
            case "in_progress": return "secondary";
            case "on_hold": return "outline";
            case "cancelled": return "destructive";
            default: return "outline";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
                    <p className="text-muted-foreground">Manage client projects and track progress.</p>
                </div>
                <Button onClick={openCreate} className="w-fit">
                    <Plus className="mr-2 h-4 w-4" /> New Project
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-primary" />
                        Active Projects
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Project Name</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Progress</TableHead>
                                <TableHead>Timeline</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-10">Loading projects...</TableCell></TableRow>
                            ) : projects.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">No projects found. Create one to get started.</TableCell></TableRow>
                            ) : (
                                projects.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell>
                                            <div className="font-bold">{p.name}</div>
                                            <div className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{p.description}</div>
                                        </TableCell>
                                        <TableCell>{p.clients?.name || "No Client"}</TableCell>
                                        <TableCell>
                                            <Badge variant={statusColor(p.status)} className="capitalize">
                                                {p.status.replace('_', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 w-32">
                                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden border">
                                                    <div className="h-full bg-primary" style={{ width: `${p.progress}%` }} />
                                                </div>
                                                <span className="text-xs font-bold">{p.progress}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-xs space-y-1">
                                                <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(p.start_date), "MMM d")}</div>
                                                {p.end_date && <div className="flex items-center gap-1 text-primary"><CheckCircle2 className="h-3 w-3" /> {format(new Date(p.end_date), "MMM d")}</div>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => { setSelectedProjectId(p.id); setHistoryDialogOpen(true); }} title="Update History"><History className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" onClick={() => { setSelectedProjectId(p.id); setUpdateDialogOpen(true); }} title="Add Update"><MessageSquare className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" onClick={() => deleteProject.mutate(p.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </TableCell>

                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Project Dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Project" : "Create New Project"}</DialogTitle>
                        <DialogDescription>Define the project scope and client details.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="col-span-2 space-y-2">
                            <Label>Project Name *</Label>
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Website Redesign" />
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label>Description</Label>
                            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Project goals and scope..." />
                        </div>
                        <div className="space-y-2">
                            <Label>Client</Label>
                            <Select value={form.client_id} onValueChange={(val) => setForm({ ...form, client_id: val })}>
                                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                                <SelectContent>
                                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={form.status} onValueChange={(val) => setForm({ ...form, status: val })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="on_hold">On Hold</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Progress (%)</Label>
                            <Input type="number" min="0" max="100" value={form.progress} onChange={(e) => setForm({ ...form, progress: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={() => upsertProject.mutate()} disabled={!form.name || upsertProject.isPending}>
                            {upsertProject.isPending ? "Saving..." : "Save Project"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Update Dialog */}
            <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Project Update</DialogTitle>
                        <DialogDescription>Share progress or milestones with the client.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Update Title</Label>
                            <Input value={updateForm.title} onChange={(e) => setUpdateForm({ ...updateForm, title: e.target.value })} placeholder="e.g. Design Phase Completed" />
                        </div>
                        <div className="space-y-2">
                            <Label>Update Details</Label>
                            <Textarea value={updateForm.body} onChange={(e) => setUpdateForm({ ...updateForm, body: e.target.value })} placeholder="What has been achieved?" className="h-32" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>Cancel</Button>
                        <Button onClick={() => addUpdate.mutate()} disabled={!updateForm.title || addUpdate.isPending}>
                            {addUpdate.isPending ? "Adding..." : "Add Update"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Project History Dialog */}
            <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" />
                            Update History
                        </DialogTitle>
                        <DialogDescription>Past milestones and updates for this project.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[500px] overflow-y-auto pr-2 space-y-4 py-4">
                        {historyLoading ? (
                            <div className="text-center py-10">Loading history...</div>
                        ) : projectHistory.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground italic">No updates recorded yet.</div>
                        ) : (
                            projectHistory.map((h: any) => (
                                <div key={h.id} className="border rounded-lg p-4 bg-slate-50/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="font-bold text-sm">{h.title}</h5>
                                        <span className="text-[10px] text-muted-foreground bg-white px-2 py-0.5 rounded border">
                                            {format(new Date(h.created_at), "PPP")}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{h.body}</p>
                                </div>
                            ))
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setHistoryDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
