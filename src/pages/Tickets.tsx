import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, MessageSquare, Clock, AlertCircle, CheckCircle2, User, Send, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Ticket = {
    id: string;
    title: string;
    description: string;
    status: "open" | "in_progress" | "resolved" | "closed";
    priority: "low" | "medium" | "high" | "urgent";
    client_id: string | null;
    user_id: string;
    created_at: string;
    client_name?: string;
};

type TicketMessage = {
    id: string;
    ticket_id: string;
    user_id: string;
    message: string;
    created_at: string;
    user_email?: string;
};

export default function Tickets() {
    const { user, role } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [newMessage, setNewMessage] = useState("");

    const [form, setForm] = useState({
        title: "",
        description: "",
        priority: "medium" as const,
        client_id: "none",
    });

    const { data: tickets = [], isLoading } = useQuery({
        queryKey: ["support_tickets", user?.id, role],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("support_tickets")
                .select("*, clients(name)")
                .order("created_at", { ascending: false });

            if (error) {
                if (error.code === "PGRST116" || error.message.includes("does not exist")) {
                    console.warn("Support tickets table not found. Showing demo data.");
                    return [];
                }
                throw error;
            }
            return data.map((t: any) => ({
                ...t,
                client_name: t.clients?.name || "No Client"
            }));
        },
        enabled: !!user && !!role,
    });


    const { data: clients = [] } = useQuery({
        queryKey: ["clients", user?.id, role],
        queryFn: async () => {
            if (!user) return [];
            let query = supabase.from("clients").select("*");
            const isStaffOrAbove = role && ["admin", "accounts_manager", "project_manager", "staff", "ticket_support"].includes(role);
            if (!isStaffOrAbove) {
                query = query.eq("user_id", user.id);
            }
            const { data, error } = await query.order("name", { ascending: true });
            if (error) throw error;
            return data;
        },
        enabled: !!user && !!role,
    });

    const createTicket = useMutation({
        mutationFn: async (newTicket: any) => {
            const { error } = await supabase.from("support_tickets").insert([
                { ...newTicket, user_id: user?.id, client_id: newTicket.client_id === "none" ? null : newTicket.client_id }
            ]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["support_tickets"] });
            setOpen(false);
            setForm({ title: "", description: "", priority: "medium", client_id: "none" });
            toast.success("Ticket created successfully");
        },
        onError: (error: any) => toast.error(error.message)
    });

    const { data: messages = [], isLoading: msgsLoading } = useQuery({
        queryKey: ["ticket_messages", selectedTicket?.id],
        queryFn: async () => {
            if (!selectedTicket) return [];
            const { data, error } = await supabase
                .from("support_ticket_messages")
                .select("*")
                .eq("ticket_id", selectedTicket.id)
                .order("created_at", { ascending: true });
            if (error) throw error;
            return data;
        },
        enabled: !!selectedTicket,
    });

    const sendMessage = useMutation({
        mutationFn: async () => {
            if (!selectedTicket || !newMessage.trim()) return;
            const { error } = await supabase.from("support_ticket_messages").insert({
                ticket_id: selectedTicket.id,
                user_id: user?.id,
                message: newMessage,
                is_agent: true,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["ticket_messages", selectedTicket?.id] });
            setNewMessage("");
        },
    });

    const updateStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string, status: string }) => {
            const { error } = await supabase
                .from("support_tickets")
                .update({ status })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["support_tickets"] });
            toast.success("Status updated");
        }
    });

    const deleteTicket = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("support_tickets").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ["support_tickets"] });
            if (selectedTicket?.id === id) {
                setSelectedTicket(null);
            }
            toast.success("Ticket deleted successfully");
        },
        onError: (error: any) => toast.error(error.message)
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "open": return <Badge variant="destructive">Open</Badge>;
            case "in_progress": return <Badge className="bg-amber-500">In Progress</Badge>;
            case "resolved": return <Badge className="bg-emerald-500">Resolved</Badge>;
            case "closed": return <Badge variant="secondary">Closed</Badge>;
            default: return <Badge>{status}</Badge>;
        }
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case "urgent": return <Badge variant="destructive">Urgent</Badge>;
            case "high": return <Badge className="bg-orange-500">High</Badge>;
            case "medium": return <Badge className="bg-blue-500">Medium</Badge>;
            case "low": return <Badge variant="outline">Low</Badge>;
            default: return <Badge variant="outline">{priority}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
                    <p className="text-muted-foreground">Manage customer support requests and issues.</p>
                </div>
                <Button onClick={() => setOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Ticket
                </Button>
            </div>

            {tickets.length === 0 && !isLoading ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                        <h3 className="text-lg font-semibold">No Tickets Found</h3>
                        <p className="text-muted-foreground max-w-sm">
                            There are currently no support tickets. Please ensure the <code className="bg-muted px-1 rounded text-xs">support_tickets</code> table exists in your database.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-3">
                    <div className="md:col-span-2 space-y-4">
                        <Card>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ticket</TableHead>
                                        <TableHead>Client</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Priority</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tickets.map((ticket: Ticket) => (
                                        <TableRow 
                                            key={ticket.id} 
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => setSelectedTicket(ticket)}
                                        >
                                            <TableCell>
                                                <div className="font-medium">{ticket.title}</div>
                                                <div className="text-xs text-muted-foreground line-clamp-1">{ticket.description}</div>
                                            </TableCell>
                                            <TableCell>{ticket.client_name}</TableCell>
                                            <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                                            <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {format(new Date(ticket.created_at), "MMM d, HH:mm")}
                                            </TableCell>
                                            <TableCell className="text-right flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="sm">View</Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm("Are you sure you want to delete this ticket?")) {
                                                            deleteTicket.mutate(ticket.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        {selectedTicket ? (
                            <Card className="h-full flex flex-col">
                                <CardHeader className="border-b">
                                    <div className="flex items-center justify-between mb-2">
                                        {getStatusBadge(selectedTicket.status)}
                                        {getPriorityBadge(selectedTicket.priority)}
                                    </div>
                                    <CardTitle className="text-lg">{selectedTicket.title}</CardTitle>
                                    <CardDescription>Opened {format(new Date(selectedTicket.created_at), "PPP")}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                                    <div className="bg-muted/50 p-3 rounded-lg text-sm">
                                        <div className="font-semibold mb-1">Issue Description:</div>
                                        {selectedTicket.description}
                                    </div>
                                    
                                    <div className="space-y-4 py-4 border-t">
                                        {msgsLoading ? (
                                            <div className="text-center py-2"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
                                        ) : messages.length === 0 ? (
                                            <div className="text-center py-4 text-xs text-muted-foreground italic">No messages yet.</div>
                                        ) : (
                                            messages.map((m: any) => (
                                                <div key={m.id} className="flex items-start gap-3">
                                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${m.is_agent ? 'bg-primary/10' : 'bg-slate-100'}`}>
                                                        <User className={`h-4 w-4 ${m.is_agent ? 'text-primary' : 'text-slate-400'}`} />
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold">{m.is_agent ? 'Support Agent' : 'Client'}</span>
                                                            <span className="text-[10px] text-muted-foreground">{format(new Date(m.created_at), "HH:mm")}</span>
                                                        </div>
                                                        <div className={`text-sm p-2 rounded-lg border ${m.is_agent ? 'bg-primary/5 border-primary/10' : 'bg-white border-slate-200'}`}>
                                                            {m.message}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>

                                <div className="p-4 border-t mt-auto">
                                    <div className="flex gap-2">
                                        <Input 
                                            placeholder="Type your message..." 
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                        />
                                        <Button size="icon" onClick={() => sendMessage.mutate()} disabled={!newMessage.trim() || sendMessage.isPending}><Send className="h-4 w-4" /></Button>

                                    </div>
                                    <div className="flex gap-2 mt-4">
                                        <Select 
                                            value={selectedTicket.status} 
                                            onValueChange={(val) => updateStatus.mutate({ id: selectedTicket.id, status: val })}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="open">Open</SelectItem>
                                                <SelectItem value="in_progress">In Progress</SelectItem>
                                                <SelectItem value="resolved">Resolved</SelectItem>
                                                <SelectItem value="closed">Closed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </Card>
                        ) : (
                            <Card className="h-full flex items-center justify-center text-center p-6 border-dashed">
                                <div>
                                    <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-20" />
                                    <p className="text-sm text-muted-foreground">Select a ticket to view conversation details.</p>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Raise New Support Ticket</DialogTitle>
                        <DialogDescription>Describe the issue and our support team will get back to you.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Subject / Title</Label>
                            <Input 
                                placeholder="Brief summary of the issue" 
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Priority</Label>
                                <Select value={form.priority} onValueChange={(v: any) => setForm({ ...form, priority: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Related Client (Optional)</Label>
                                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select client" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {clients.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Detailed Description</Label>
                            <Textarea 
                                placeholder="Describe the problem in detail..." 
                                className="min-h-[120px]"
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={() => createTicket.mutate(form)} disabled={!form.title || !form.description}>
                            Submit Ticket
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
