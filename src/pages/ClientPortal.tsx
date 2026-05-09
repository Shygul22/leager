import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";


import { 
    LayoutDashboard, 
    FileText, 
    Receipt, 
    Wallet, 
    TrendingUp, 
    LogOut, 
    User, 
    Mail, 
    Phone, 
    MapPin,
    ArrowRight,
    Loader2,
    CheckCircle2,
    Clock,
    AlertCircle,
    MessageSquare,
    AlertTriangle,
    Send,
    Building2,
    Headset
} from "lucide-react";
import { toast } from "sonner";

type Client = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    client_number: string | null;
    currency: string | null;
};

export default function ClientPortal() {
    const { clientNumber } = useParams();
    const navigate = useNavigate();
    const [loginId, setLoginId] = useState(clientNumber || "");
    const [loginEmail, setLoginEmail] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [activeClient, setActiveClient] = useState<Client | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);

    // Persistence: Check if client info is in session
    useEffect(() => {
        const stored = sessionStorage.getItem("active_portal_client");
        if (stored) {
            setActiveClient(JSON.parse(stored));
            setIsAuthenticated(true);
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginId.trim() || !loginEmail.trim()) {
            toast.error("Please enter both Client ID and Email");
            return;
        }

        setIsVerifying(true);
        try {
            // Check if loginId is a valid UUID to avoid Postgres cast errors
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(loginId);
            
            let query = supabase.from("clients").select("*").ilike("email", loginEmail);
            
            if (isUUID) {
                query = query.or(`client_number.ilike.${loginId},id.eq.${loginId}`);
            } else {
                query = query.ilike("client_number", loginId);
            }

            const { data, error } = await query.maybeSingle();

            if (error) throw error;

            if (data) {
                setActiveClient(data);
                setIsAuthenticated(true);
                sessionStorage.setItem("active_portal_client", JSON.stringify(data));
                navigate(`/portal/${data.client_number || data.id}`);
                toast.success(`Welcome back, ${data.name}!`);
            } else {
                toast.error("Invalid Client ID or Email combination");
            }
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem("active_portal_client");
        setIsAuthenticated(false);
        setActiveClient(null);
        navigate("/portal");
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
                    <CardHeader className="text-center space-y-2">
                        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                            <LayoutDashboard className="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-bold">Client Portal</CardTitle>
                        <CardDescription>Enter your credentials to access your dashboard</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Client ID</label>
                                <Input 
                                    placeholder="e.g. ZENCI-001" 
                                    value={loginId}
                                    onChange={(e) => setLoginId(e.target.value)}
                                    className="h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email Address</label>
                                <Input 
                                    type="email"
                                    placeholder="your@email.com" 
                                    value={loginEmail}
                                    onChange={(e) => setLoginEmail(e.target.value)}
                                    className="h-11"
                                />
                            </div>
                            <Button type="submit" className="w-full h-11 text-lg" disabled={isVerifying}>
                                {isVerifying ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Access Dashboard"}
                                {!isVerifying && <ArrowRight className="ml-2 h-5 w-5" />}
                            </Button>
                        </form>
                    </CardContent>
                    <div className="px-6 pb-6 text-center">
                        <p className="text-xs text-muted-foreground">
                            Having trouble accessing? Please contact our support team.
                        </p>
                    </div>
                </Card>
            </div>
        );
    }

    return <PortalDashboard client={activeClient!} onLogout={handleLogout} />;
}

function PortalDashboard({ client, onLogout }: { client: Client; onLogout: () => void }) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
    const [selectedTicketForChat, setSelectedTicketForChat] = useState<any>(null);
    const [chatDialogOpen, setChatDialogOpen] = useState(false);
    const [bugDialogOpen, setBugDialogOpen] = useState(false);
    
    const [ticketForm, setTicketForm] = useState({ title: "", description: "", priority: "medium" });
    const [newMessage, setNewMessage] = useState("");
    const [bugForm, setBugForm] = useState({ title: "", description: "", severity: "medium", module: "Client Portal" });

    const [selectedProjectForTimeline, setSelectedProjectForTimeline] = useState<any>(null);
    const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
    const [supportInfoOpen, setSupportInfoOpen] = useState(false);
    
    const [editProfileOpen, setEditProfileOpen] = useState(false);
    const [profileForm, setProfileForm] = useState({
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || ""
    });

    // 1. Fetch Invoices
    const { data: invoices = [], isLoading: invLoading } = useQuery({
        queryKey: ["portal-invoices", client.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("invoices")
                .select("*, invoice_items(*)")
                .or(`client_id.eq.${client.id},client_name.eq.${client.name}`)
                .order("date", { ascending: false });
            if (error) throw error;
            return data;
        }
    });


    // 3. Fetch Projects linked to client
    const { data: projects = [], isLoading: projLoading } = useQuery({
        queryKey: ["portal-projects", client.id],
        queryFn: async () => {
            // First, get project IDs from quotations
            const { data: qs } = await supabase
                .from("quotations")
                .select("client_project_id")
                .or(`client_id.eq.${client.id},client_name.eq.${client.name}`)
                .not("client_project_id", "is", null);
            
            const projectIdsFromQuotations = Array.from(new Set((qs || []).map(q => q.client_project_id)));
            
            // Now fetch projects that are either directly linked to this client OR linked via quotations
            let query = supabase
                .from("projects")
                .select("*");
            
            if (projectIdsFromQuotations.length > 0) {
                query = query.or(`client_id.eq.${client.id},id.in.(${projectIdsFromQuotations.join(',')})`);
            } else {
                query = query.eq("client_id", client.id);
            }

            const { data, error } = await query.order("updated_at", { ascending: false });
            if (error) throw error;
            return data;
        }
    });


    // 4. Fetch Support Tickets
    const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
        queryKey: ["portal-tickets", client.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("support_tickets")
                .select("*")
                .eq("client_id", client.id)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        }
    });

    // 5. Fetch Bug Reports
    const { data: bugs = [], isLoading: bugsLoading } = useQuery({
        queryKey: ["portal-bugs", client.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("bug_reports")
                .select("*")
                .eq("client_id", client.id)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        }
    });

    // 6. Fetch Company Profile (Support Info)
    const { data: companyProfile } = useQuery({
        queryKey: ["company-profile"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            return data;
        }
    });

    // 6. Fetch Project Updates for client projects
    const { data: updates = [], isLoading: updLoading } = useQuery({
        queryKey: ["portal-updates", client.id, projects.map(p => p.id)],
        queryFn: async () => {
            const projectIds = projects.map(p => p.id);
            if (projectIds.length === 0) return [];
            
            const { data, error } = await supabase
                .from("project_updates")
                .select("*, projects(name)")
                .in("project_id", projectIds)
                .order("created_at", { ascending: false })
                .limit(10);
            if (error) throw error;
            return data;
        },
        enabled: projects.length > 0
    });


    // Mutations for creation
    const createTicket = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.from("support_tickets").insert({
                title: ticketForm.title,
                description: ticketForm.description,
                priority: ticketForm.priority,
                client_id: client.id,
                user_id: user?.id,
                status: "open"
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["portal-tickets"] });
            setTicketDialogOpen(false);
            setTicketForm({ title: "", description: "", priority: "medium" });
            toast.success("Support ticket created");
        },
        onError: (e) => toast.error(e.message)
    });

    const reportBug = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.from("bug_reports").insert({
                title: bugForm.title,
                description: bugForm.description,
                severity: bugForm.severity,
                module: bugForm.module,
                client_id: client.id,
                reported_by: user?.id,
                status: "open"
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["portal-bugs"] });
            setBugDialogOpen(false);
            setBugForm({ title: "", description: "", severity: "medium", module: "Client Portal" });
            toast.success("Bug reported successfully");
        },
        onError: (e) => toast.error(e.message)
    });

    const { data: chatMessages = [], isLoading: chatLoading } = useQuery({
        queryKey: ["portal-chat", selectedTicketForChat?.id],
        queryFn: async () => {
            if (!selectedTicketForChat) return [];
            const { data, error } = await supabase
                .from("support_ticket_messages")
                .select("*")
                .eq("ticket_id", selectedTicketForChat.id)
                .order("created_at", { ascending: true });
            if (error) throw error;
            return data;
        },
        enabled: !!selectedTicketForChat,
    });

    const sendChatMessage = useMutation({
        mutationFn: async () => {
            if (!selectedTicketForChat || !newMessage.trim()) return;
            const { error } = await supabase.from("support_ticket_messages").insert({
                ticket_id: selectedTicketForChat.id,
                user_id: user?.id,
                message: newMessage,
                is_agent: false,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["portal-chat", selectedTicketForChat?.id] });
            setNewMessage("");
        },
        onError: (e) => toast.error(e.message)
    });

    const updateProfile = useMutation({
        mutationFn: async () => {
            const { error } = await supabase
                .from("clients")
                .update({
                    email: profileForm.email,
                    phone: profileForm.phone,
                    address: profileForm.address
                })
                .eq("id", client.id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Profile updated and synced successfully!");
            setEditProfileOpen(false);
            // Update local session storage to reflect changes
            const updatedClient = { ...client, ...profileForm };
            sessionStorage.setItem("active_portal_client", JSON.stringify(updatedClient));
            window.location.reload(); // Hard reload to sync all data
        },
        onError: (e) => toast.error(e.message)
    });

    const { data: timelineUpdates = [], isLoading: timelineLoading } = useQuery({
        queryKey: ["project-timeline", selectedProjectForTimeline?.id],
        queryFn: async () => {
            if (!selectedProjectForTimeline) return [];
            const { data, error } = await supabase
                .from("project_updates")
                .select("*")
                .eq("project_id", selectedProjectForTimeline.id)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!selectedProjectForTimeline && timelineDialogOpen
    });

    const getInvoiceTotal = (inv: any) => {

        const items = inv.invoice_items || [];
        const subtotal = items.reduce((s: number, i: any) => s + (i.quantity * i.rate), 0);
        const discountPercentage = inv.discount_percentage || 0;
        const discountAmount = subtotal * (discountPercentage / 100);
        
        const totalGst = items.reduce((s: number, i: any) => s + (i.quantity * i.rate * ((i.gst || 0) / 100)), 0);
        const discountedGst = totalGst * (1 - (discountPercentage / 100));
        
        return (subtotal - discountAmount) + discountedGst;
    };

    const totalInvoiced = invoices.reduce((sum, inv) => sum + getInvoiceTotal(inv), 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + (Number(inv.paid_amount) || (inv.status === "paid" ? getInvoiceTotal(inv) : 0)), 0);
    const balanceDue = totalInvoiced - totalPaid;
    
    const futureInvoices = invoices.filter(inv => inv.status === "draft" || (inv.date && new Date(inv.date) > new Date()));
    const futureAmount = futureInvoices.reduce((sum, inv) => sum + getInvoiceTotal(inv), 0);


    const formatCurrency = (amount: number) => {
        return amount.toLocaleString("en-IN", {
            style: "currency",
            currency: client.currency || "INR",
            minimumFractionDigits: 2
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Navbar */}
            <nav className="bg-white border-b px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-xl shadow-md">
                        <LayoutDashboard className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-extrabold text-base text-gray-900 hidden sm:block tracking-tight">Client Dashboard</h1>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">ZENJOURNEY PRIVATE LIMITED</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-gray-800">{client.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{client.client_number}</p>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow">
                        {client.name?.charAt(0).toUpperCase()}
                    </div>
                    <button onClick={onLogout} className="ml-1 p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Logout">
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </nav>

            <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
                {/* Welcome Hero */}
                <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-6 md:p-8 shadow-xl">
                    <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px'}} />
                    <div className="relative">
                        <p className="text-blue-100 text-sm font-semibold uppercase tracking-widest mb-1">Welcome back</p>
                        <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{client.name}</h2>
                        <p className="text-blue-200 text-sm mt-1">Here's an overview of your account activity and projects.</p>
                    </div>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden md:block opacity-10">
                        <LayoutDashboard className="h-24 w-24 text-white" />
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Total Value</span>
                            <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center">
                                <TrendingUp className="h-4 w-4 text-blue-500" />
                            </div>
                        </div>
                        <div>
                            <p className="text-2xl font-extrabold text-gray-900 tracking-tight">{formatCurrency(totalInvoiced)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Total across all invoices</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Amount Paid</span>
                            <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            </div>
                        </div>
                        <div>
                            <p className="text-2xl font-extrabold text-emerald-600 tracking-tight">{formatCurrency(totalPaid)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Confirmed payments received</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Balance Due</span>
                            <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center">
                                <Clock className="h-4 w-4 text-amber-500" />
                            </div>
                        </div>
                        <div>
                            <p className="text-2xl font-extrabold text-amber-600 tracking-tight">{formatCurrency(balanceDue)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Pending and overdue items</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Future Amount</span>
                            <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                                <TrendingUp className="h-4 w-4 text-indigo-500" />
                            </div>
                        </div>
                        <div>
                            <p className="text-2xl font-extrabold text-indigo-600 tracking-tight">{formatCurrency(futureAmount)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Drafts and scheduled</p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left Column: Projects */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-gray-900">Active Projects</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">Track the progress of your ongoing works</p>
                                </div>
                                <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                                </div>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {projLoading ? (
                                    <div className="p-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-300" /></div>
                                ) : projects.length === 0 ? (
                                    <div className="p-10 text-center">
                                        <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
                                            <TrendingUp className="h-5 w-5 text-gray-300" />
                                        </div>
                                        <p className="text-sm text-gray-400 font-medium">No active projects found.</p>
                                    </div>
                                ) : (
                                    projects.map((proj) => (
                                        <div key={proj.id} className="p-5 hover:bg-gray-50/60 transition-colors cursor-pointer" onClick={() => { setSelectedProjectForTimeline(proj); setTimelineDialogOpen(true); }}>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                                <div>
                                                    <h4 className="font-bold text-gray-900">{proj.name}</h4>
                                                    <p className="text-sm text-gray-400 line-clamp-1 mt-0.5">{proj.description || "No description provided."}</p>
                                                </div>
                                                <Badge className="w-fit h-5 uppercase text-[10px] tracking-wider">
                                                    {proj.status.replace('_', ' ')}
                                                </Badge>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-gray-400">
                                                    <span>Progress</span>
                                                    <span className="text-indigo-600">{proj.progress}%</span>
                                                </div>
                                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${proj.progress}%` }} />
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    Started: {proj.start_date ? format(new Date(proj.start_date), "MMM d, yyyy") : "N/A"}
                                                </div>
                                                {proj.end_date && (
                                                    <div className="flex items-center gap-1">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Deadline: {format(new Date(proj.end_date), "MMM d, yyyy")}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Invoices & Quotations */}
                    <div className="space-y-8">
                        {/* Invoices */}
                        <Card className="shadow-sm overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg">Invoices</CardTitle>
                                    <FileText className="h-5 w-5 text-muted-foreground" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>No.</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="text-right">Balance</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invLoading ? (
                                            <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                                        ) : invoices.length === 0 ? (
                                            <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic text-sm">No invoices found.</TableCell></TableRow>
                                        ) : (
                                            invoices.slice(0, 8).map((inv) => (
                                                <TableRow key={inv.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => window.open(`/public/invoice/${inv.id}`, '_blank')}>
                                                    <TableCell className="font-mono text-[10px] font-semibold">
                                                        {inv.invoice_number}
                                                        <div className="mt-1">
                                                            <Badge variant={inv.status === "paid" ? "default" : inv.status === "partially_paid" ? "secondary" : "outline"} className="text-[8px] uppercase px-1 py-0 h-3.5">
                                                                {inv.status.replace('_', ' ')}
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-xs">
                                                        {formatCurrency(getInvoiceTotal(inv))}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-xs text-destructive">
                                                        {formatCurrency(getInvoiceTotal(inv) - (Number(inv.paid_amount) || 0))}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                    {invoices.length > 0 && (
                                        <tfoot className="bg-slate-50 font-bold border-t">
                                            <TableRow>
                                                <TableCell colSpan={2} className="text-[10px] uppercase tracking-widest text-muted-foreground pl-4">Grand Total</TableCell>
                                                <TableCell className="text-right text-primary">{formatCurrency(totalInvoiced)}</TableCell>
                                            </TableRow>
                                        </tfoot>
                                    )}
                                </Table>
                                {invoices.length > 8 && <div className="p-3 text-center border-t"><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">+ {invoices.length - 8} more</p></div>}
                            </CardContent>
                        </Card>

                        {/* Future Billing / Forecast */}
                        <Card className="shadow-sm overflow-hidden border-t-4 border-t-blue-500">
                            <CardHeader className="bg-blue-50/30 border-b">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-blue-700 flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4" />
                                        Future Forecast
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-[10px] uppercase">Upcoming Item</TableHead>
                                            <TableHead className="text-right text-[10px] uppercase">Estimated</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {futureInvoices.length === 0 ? (
                                            <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground italic text-[10px] uppercase tracking-widest">No future billing found</TableCell></TableRow>
                                        ) : (
                                            futureInvoices.map((inv) => (
                                                <TableRow key={inv.id} className="hover:bg-blue-50/50 transition-colors">
                                                    <TableCell className="py-3">
                                                        <div className="text-[10px] font-bold text-slate-900">{inv.invoice_number}</div>
                                                        <div className="text-[8px] text-muted-foreground mt-0.5">
                                                            {inv.date ? format(new Date(inv.date), "PPP") : "Schedule Pending"}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs font-bold text-blue-600">
                                                        {formatCurrency(getInvoiceTotal(inv))}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                                {futureInvoices.length > 0 && (
                                    <div className="p-3 bg-blue-50 border-t flex items-center justify-between">
                                        <span className="text-[9px] font-bold text-blue-700 uppercase tracking-widest">Projected Future Total</span>
                                        <span className="text-xs font-bold text-blue-700">{formatCurrency(futureAmount)}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold">Support & Feedback</h3>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={() => setTicketDialogOpen(true)}>
                                    <MessageSquare className="mr-1 h-3 w-3" /> New Ticket
                                </Button>
                                <Button size="sm" variant="destructive" className="h-8 text-[10px]" onClick={() => setBugDialogOpen(true)}>
                                    <AlertTriangle className="mr-1 h-3 w-3" /> Report Bug
                                </Button>
                            </div>
                        </div>

                        <Tabs defaultValue="tickets" className="w-full">

                            <TabsList className="grid w-full grid-cols-2 mb-4">
                                <TabsTrigger value="tickets" className="text-xs">Support Tickets ({tickets.length})</TabsTrigger>
                                <TabsTrigger value="bugs" className="text-xs">Bug Reports ({bugs.length})</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="tickets">
                                <Card className="shadow-sm">
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Subject</TableHead>
                                                    <TableHead>Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {ticketsLoading ? (
                                                    <TableRow><TableCell colSpan={2} className="text-center py-4"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                                                ) : tickets.length === 0 ? (
                                                    <TableRow><TableCell colSpan={2} className="text-center py-6 text-muted-foreground text-xs italic">No support tickets found.</TableCell></TableRow>
                                                ) : (
                                                    tickets.map((t) => (
                                                        <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedTicketForChat(t); setChatDialogOpen(true); }}>
                                                            <TableCell className="text-xs font-semibold">{t.title}</TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className="text-[8px] uppercase px-1 py-0 h-3.5">
                                                                    {t.status}
                                                                </Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}

                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                            
                            <TabsContent value="bugs">
                                <Card className="shadow-sm">
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Issue</TableHead>
                                                    <TableHead>Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {bugsLoading ? (
                                                    <TableRow><TableCell colSpan={2} className="text-center py-4"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                                                ) : bugs.length === 0 ? (
                                                    <TableRow><TableCell colSpan={2} className="text-center py-6 text-muted-foreground text-xs italic">No bugs reported yet.</TableCell></TableRow>
                                                ) : (
                                                    bugs.map((b) => (
                                                        <TableRow key={b.id}>
                                                            <TableCell className="text-xs font-semibold">{b.title}</TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className="text-[8px] uppercase px-1 py-0 h-3.5">
                                                                    {b.status}
                                                                </Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>


                    </div>
                </div>

                <Card className="bg-white overflow-hidden shadow-sm border border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-primary">
                            <User className="h-5 w-5" />
                            Account Details
                        </CardTitle>
                        <Button variant="outline" size="sm" className="h-8 text-xs font-bold uppercase tracking-widest" onClick={() => setEditProfileOpen(true)}>
                            Sync Profile
                        </Button>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-3 gap-8 py-8">
                        <div className="flex items-start gap-3">
                            <div className="bg-primary/10 p-2 rounded-lg">
                                <Mail className="h-5 w-5 text-primary shrink-0" />
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Email Address</p>
                                <p className="text-sm font-semibold text-slate-900">{client.email || "Not provided"}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="bg-primary/10 p-2 rounded-lg">
                                <Phone className="h-5 w-5 text-primary shrink-0" />
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Phone Number</p>
                                <p className="text-sm font-semibold text-slate-900">{client.phone || "Not provided"}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="bg-primary/10 p-2 rounded-lg">
                                <MapPin className="h-5 w-5 text-primary shrink-0" />
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Billing Address</p>
                                <p className="text-sm font-semibold text-slate-900 line-clamp-2">{client.address || "Not provided"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Support Notice */}
                <div className="bg-white border rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden relative">
                    <div className="absolute right-0 top-0 h-full w-32 bg-primary/5 -skew-x-12 transform translate-x-16" />
                    <div className="flex items-start gap-4 relative z-10">
                        <div className="bg-blue-100 p-3 rounded-2xl">
                            <AlertCircle className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-bold text-slate-900">Need Technical Assistance?</h4>
                            <p className="text-sm text-slate-500 leading-relaxed max-w-xl">
                                Our support team is available Monday to Friday, 9:00 AM - 6:00 PM. 
                                For urgent matters regarding your project or billing, please contact your account manager directly.
                            </p>
                        </div>
                    </div>
                    <Button variant="default" className="relative z-10 whitespace-nowrap" onClick={() => setSupportInfoOpen(true)}>
                        Contact Support
                    </Button>
                </div>
            </main>

            {/* Ticket Creation Dialog */}
            <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New Support Ticket</DialogTitle>
                        <DialogDescription>Describe your issue and our team will get back to you.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input value={ticketForm.title} onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })} placeholder="Briefly describe the issue" />
                        </div>
                        <div className="space-y-2">
                            <Label>Priority</Label>
                            <Select value={ticketForm.priority} onValueChange={(v: any) => setTicketForm({ ...ticketForm, priority: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Details</Label>
                            <Textarea value={ticketForm.description} onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} placeholder="Provide more details..." className="h-32" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTicketDialogOpen(false)}>Cancel</Button>
                        <Button onClick={() => createTicket.mutate()} disabled={!ticketForm.title || createTicket.isPending}>
                            {createTicket.isPending ? "Creating..." : "Create Ticket"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bug Report Dialog */}
            <Dialog open={bugDialogOpen} onOpenChange={setBugDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Report System Bug
                        </DialogTitle>
                        <DialogDescription>Help us improve by reporting any errors you encounter.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Bug Title</Label>
                            <Input value={bugForm.title} onChange={(e) => setBugForm({ ...bugForm, title: e.target.value })} placeholder="e.g. Page not loading correctly" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Severity</Label>
                                <Select value={bugForm.severity} onValueChange={(v: any) => setBugForm({ ...bugForm, severity: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="critical">Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Module</Label>
                                <Input value={bugForm.module} onChange={(e) => setBugForm({ ...bugForm, module: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea value={bugForm.description} onChange={(e) => setBugForm({ ...bugForm, description: e.target.value })} placeholder="What happened?" className="h-32" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBugDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => reportBug.mutate()} disabled={!bugForm.title || reportBug.isPending}>
                            {reportBug.isPending ? "Submitting..." : "Submit Report"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <footer className="py-8 text-center text-muted-foreground text-[10px] mt-auto uppercase tracking-[0.2em] font-medium">
                &copy; {new Date().getFullYear()} ZENJOURNEY PRIVATE LIMITED &bull; Secure Client Access
            </footer>

            {/* Chat Dialog */}
            <Dialog open={chatDialogOpen} onOpenChange={setChatDialogOpen}>
                <DialogContent className="max-w-lg flex flex-col h-[600px]">
                    <DialogHeader>
                        <DialogTitle>{selectedTicketForChat?.title}</DialogTitle>
                        <DialogDescription>Support conversation for this ticket.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 border rounded-md bg-slate-50/50 my-4">
                        <div className="bg-white p-3 rounded-lg border text-sm shadow-sm">
                            <p className="font-bold text-xs mb-1">Issue Description:</p>
                            <p className="text-muted-foreground">{selectedTicketForChat?.description}</p>
                        </div>
                        
                        {chatLoading ? (
                            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
                        ) : chatMessages.length === 0 ? (
                            <div className="text-center py-10 text-xs text-muted-foreground italic">No messages yet. Our team will respond soon.</div>
                        ) : (
                            chatMessages.map((m: any) => (
                                <div key={m.id} className={`flex ${m.is_agent ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-lg text-sm shadow-sm border ${m.is_agent ? 'bg-white border-slate-200' : 'bg-primary text-white border-primary'}`}>
                                        <p className={`font-bold text-[10px] mb-1 uppercase tracking-wider ${m.is_agent ? 'text-primary' : 'text-primary-foreground/80'}`}>
                                            {m.is_agent ? 'Support Agent' : 'You'}
                                        </p>
                                        <p>{m.message}</p>
                                        <p className={`text-[9px] mt-2 text-right ${m.is_agent ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>
                                            {format(new Date(m.created_at), "HH:mm")}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="flex gap-2 mt-auto">
                        <Input 
                            placeholder="Type your message..." 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendChatMessage.mutate()}
                        />
                        <Button size="icon" onClick={() => sendChatMessage.mutate()} disabled={!newMessage.trim() || sendChatMessage.isPending}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>



            {/* Project Timeline Dialog */}
            <Dialog open={timelineDialogOpen} onOpenChange={setTimelineDialogOpen}>
                <DialogContent className="max-w-2xl flex flex-col h-[600px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary" />
                            {selectedProjectForTimeline?.name} - Timeline
                        </DialogTitle>
                        <DialogDescription>Full history of updates and milestones for this project.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4 relative before:absolute before:inset-0 before:left-3 before:h-full before:w-0.5 before:bg-slate-100">
                        {timelineLoading ? (
                            <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
                        ) : timelineUpdates.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground italic text-sm">No specific updates recorded for this project yet.</div>
                        ) : (
                            timelineUpdates.map((update: any) => (
                                <div key={update.id} className="relative pl-8 group">
                                    <div className="absolute left-1.5 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-primary shadow-sm z-10" />
                                    <div className="bg-white border rounded-lg p-4 shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="font-bold text-sm">{update.title}</h5>
                                            <span className="text-[10px] text-muted-foreground font-mono bg-slate-50 px-2 py-0.5 rounded border">
                                                {format(new Date(update.created_at), "PPP")}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{update.body}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setTimelineDialogOpen(false)}>Close Timeline</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Admin/Support Details Dialog */}
            <Dialog open={supportInfoOpen} onOpenChange={setSupportInfoOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Headset className="h-5 w-5 text-primary" />
                            Support Contact Details
                        </DialogTitle>
                        <DialogDescription>Get in touch with our administrative team for assistance.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="bg-white p-2 rounded-lg shadow-sm">
                                    <Building2 className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Company</p>
                                    <p className="text-sm font-bold text-slate-900">{companyProfile?.company_name || "ZENJOURNEY PRIVATE LIMITED"}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="bg-white p-2 rounded-lg shadow-sm">
                                    <Mail className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Contact Email</p>
                                    <p className="text-sm font-bold text-slate-900">info@zenjourney.io</p>
                                    <p className="text-[9px] text-muted-foreground">Website: ZenJourney.io</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="bg-white p-2 rounded-lg shadow-sm">
                                    <Phone className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Contact Numbers</p>
                                    <p className="text-sm font-bold text-slate-900">+91 9092406569, +91 9629236257</p>
                                    <p className="text-[9px] text-muted-foreground">Mon-Fri, 9:00 AM - 6:00 PM</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="bg-white p-2 rounded-lg shadow-sm">
                                    <MapPin className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Official Address</p>
                                    <div className="text-sm font-bold text-slate-900 whitespace-pre-wrap leading-relaxed">
                                        {companyProfile?.address || "10A New Weaver St, Mangalampet 606104"}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="text-center p-2">
                            <p className="text-[10px] text-muted-foreground">
                                For technical issues, please use the <strong>Report Bug</strong> feature.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setSupportInfoOpen(false)} className="w-full">Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit/Sync Profile Dialog */}
            <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            Sync Account Details
                        </DialogTitle>
                        <DialogDescription>Update your contact information to sync with our records.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Email Address</Label>
                            <Input value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} type="email" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Phone Number</Label>
                            <Input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Billing Address</Label>
                            <Textarea value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} className="h-24" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditProfileOpen(false)}>Cancel</Button>
                        <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>
                            {updateProfile.isPending ? "Syncing..." : "Sync Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
