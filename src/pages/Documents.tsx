import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
    FolderOpen, 
    Clock, 
    CheckCircle2, 
    AlertTriangle, 
    Search, 
    Upload, 
    Filter, 
    Eye, 
    Trash2, 
    ShieldCheck, 
    RefreshCw, 
    FileText,
    Lock,
    ChevronRight,
    ArrowLeft,
    Plus,
    Check,
    Loader2,
    Edit2,
    History,
    Settings2
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import DocumentUploadModal from "@/components/documents/DocumentUploadModal";
import DocumentViewer from "@/components/documents/DocumentViewer";
import DocumentEditModal from "@/components/documents/DocumentEditModal";
import { Document, DocumentFolder } from "@/types/document";

const COLOR_PRESETS = [
    { name: "blue", class: "bg-blue-500 border-blue-600 text-white" },
    { name: "amber", class: "bg-amber-500 border-amber-600 text-white" },
    { name: "teal", class: "bg-teal-500 border-teal-600 text-white" },
    { name: "purple", class: "bg-purple-500 border-purple-600 text-white" },
    { name: "indigo", class: "bg-indigo-500 border-indigo-600 text-white" },
    { name: "rose", class: "bg-rose-500 border-rose-600 text-white" },
    { name: "emerald", class: "bg-emerald-500 border-emerald-600 text-white" },
    { name: "slate", class: "bg-slate-500 border-slate-600 text-white" }
];

const AVAILABLE_ROLES = [
    { id: "admin", label: "Administrator" },
    { id: "accounts_manager", label: "Accounts Manager" },
    { id: "project_manager", label: "Project Manager" },
    { id: "staff", label: "Staff" },
    { id: "ticket_support", label: "Support Ticket" },
    { id: "client", label: "Client" },
];

const DEFAULT_FOLDERS: DocumentFolder[] = [
    { id: "kyc", name: "KYC & Identity", category: "kyc", color: "blue", allowed_roles: ["admin", "accounts_manager"], created_at: new Date().toISOString() },
    { id: "contracts", name: "Contracts", category: "contract", color: "amber", allowed_roles: ["admin", "accounts_manager", "project_manager"], created_at: new Date().toISOString() },
    { id: "agreements", name: "Agreements", category: "agreement", color: "teal", allowed_roles: ["admin", "accounts_manager", "project_manager"], created_at: new Date().toISOString() },
    { id: "invoices", name: "Invoices", category: "invoice", color: "purple", allowed_roles: ["admin", "accounts_manager", "staff"], created_at: new Date().toISOString() },
    { id: "receipts", name: "Receipts", category: "receipt", color: "indigo", allowed_roles: ["admin", "accounts_manager", "staff"], created_at: new Date().toISOString() },
    { id: "other", name: "Other Files", category: "other", color: "slate", allowed_roles: ["admin", "accounts_manager", "staff", "project_manager"], created_at: new Date().toISOString() }
];

export default function Documents() {
    const { user, role } = useAuth();
    const queryClient = useQueryClient();
    
    // UI state
    const [uploadOpen, setUploadOpen] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [activeTab, setActiveTab] = useState<string>("library");
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [dbError, setDbError] = useState<string | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<Document | null>(null);
    
    // Folder creation modal state
    const [createFolderOpen, setCreateFolderOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [newFolderColor, setNewFolderColor] = useState("blue");
    const [newFolderRoles, setNewFolderRoles] = useState<string[]>(["admin", "accounts_manager"]);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    // Folder access edit modal state
    const [editFolderOpen, setEditFolderOpen] = useState(false);
    const [editingFolder, setEditingFolder] = useState<DocumentFolder | null>(null);
    const [editFolderRoles, setEditFolderRoles] = useState<string[]>([]);

    // Drag & Drop tracking
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
    const [draggedDocId, setDraggedDocId] = useState<string | null>(null);
    const [droppedFile, setDroppedFile] = useState<File | null>(null);
    const [uploadCategoryOverride, setUploadCategoryOverride] = useState<string | null>(null);

    // Search and filters
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const isAdminOrManager = role && ["admin", "accounts_manager"].includes(role);
    const isManagerOrStaff = role && ["admin", "accounts_manager", "project_manager", "staff"].includes(role);

    // Fetch custom folders dynamically from the database
    const { data: folders = [], refetch: refetchFolders } = useQuery({
        queryKey: ["document-folders"],
        queryFn: async () => {
            try {
                const { data, error } = await supabase
                    .from("document_folders")
                    .select("*")
                    .order("created_at", { ascending: true });

                console.log("DEBUG: Supabase returned folders:", data, "error:", error);

                if (error) {
                    console.error("document_folders table query returned error:", error);
                    setDbError("Query error: " + error.message);
                    toast.error("Failed to load custom folders: " + error.message);
                    return DEFAULT_FOLDERS;
                }
                setDbError(null);
                const result = data && data.length > 0 ? (data as DocumentFolder[]) : DEFAULT_FOLDERS;
                console.log("DEBUG: final folders resolved list:", result);
                return result;
            } catch (err) {
                console.error("document_folders query failed:", err);
                setDbError("Fetch error: " + (err as Error).message);
                toast.error("Failed to load custom folders: " + (err as Error).message);
                return DEFAULT_FOLDERS;
            }
        }
    });

    // Fetch all documents matching the user's role access (RLS-controlled)
    const { data: documents = [], isLoading: isLoadingDocs, refetch, isFetching } = useQuery({
        queryKey: ["all-documents"],
        queryFn: async () => {
            try {
                const { data, error } = await supabase
                    .from("documents")
                    .select("*, uploader_profile:profiles!uploaded_by(full_name, email), verifier_profile:profiles!verified_by(full_name)")
                    .order("created_at", { ascending: false });

                if (error) {
                    console.error("Database error fetching documents:", error);
                    toast.error("Failed to load documents: " + error.message);
                    return [] as Document[];
                }
                return (data || []) as Document[];
            } catch (err) {
                const error = err as Error;
                console.error("Fetch documents failed:", error);
                toast.error("Failed to load documents: " + error.message);
                return [] as Document[];
            }
        },
        enabled: !!user
    });

    // Fetch global audit logs (visible to admin/manager)
    const { data: globalLogs = [], isLoading: isLoadingGlobalLogs, refetch: refetchGlobalLogs } = useQuery({
        queryKey: ["global-document-audit-logs"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("document_audit_logs")
                .select("*, changer_profile:profiles!changed_by(full_name, email), documents!document_id(name)")
                .order("changed_at", { ascending: false });

            if (error) {
                console.error("Error fetching global audit logs:", error);
                return [];
            }
            return data as DocumentAuditLog[];
        },
        enabled: isAdminOrManager && activeTab === "audit-history"
    });

    // Create Custom Folder Mutation
    const createFolderMutation = useMutation({
        mutationFn: async (newFolder: { name: string; category: string; color: string; allowed_roles: string[] }) => {
            setIsCreatingFolder(true);
            const { error } = await supabase
                .from("document_folders")
                .insert({
                    name: newFolder.name,
                    category: newFolder.category,
                    color: newFolder.color,
                    allowed_roles: newFolder.allowed_roles,
                    created_by: user?.id
                });
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Custom folder created successfully!");
            queryClient.invalidateQueries({ queryKey: ["document-folders"] });
            refetchFolders();
            refetchGlobalLogs();
            setCreateFolderOpen(false);
            setNewFolderName("");
            setNewFolderColor("blue");
            setNewFolderRoles(["admin", "accounts_manager"]);
        },
        onError: (err) => {
            const error = err as Error;
            toast.error(error.message || "Failed to create custom folder.");
        },
        onSettled: () => {
            setIsCreatingFolder(false);
        }
    });

    // Delete Folder Mutation
    const deleteFolderMutation = useMutation({
        mutationFn: async (folder: DocumentFolder) => {
            // First check if folders have documents in them
            const hasDocs = documents.some(doc => doc.category === folder.category);
            if (hasDocs) {
                throw new Error("Cannot delete a folder that contains files. Please delete or move the files first.");
            }

            const { error } = await supabase
                .from("document_folders")
                .delete()
                .eq("id", folder.id);

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Folder deleted successfully.");
            queryClient.invalidateQueries({ queryKey: ["document-folders"] });
            refetchFolders();
            refetchGlobalLogs();
            setSelectedFolder(null);
        },
        onError: (err) => {
            const error = err as Error;
            toast.error(error.message || "Failed to delete folder.");
        }
    });

    // Delete Document Mutation
    const deleteDocMutation = useMutation({
        mutationFn: async (doc: Document) => {
            if (doc.file_path && !doc.file_path.startsWith("database-fallback/")) {
                const storageRes = await supabase.storage.from("documents").remove([doc.file_path]);
                console.log("DEBUG: Storage delete response:", storageRes);
            }
            const response = await supabase.from("documents").delete().eq("id", doc.id).select();
            console.log("DEBUG: Database delete response:", response);
            
            if (response.error) throw response.error;
            if (!response.data || response.data.length === 0) {
                throw new Error("No database rows were deleted. RLS or permissions may have blocked the deletion.");
            }
        },
        onSuccess: () => {
            toast.success("Document deleted successfully.");
            queryClient.invalidateQueries({ queryKey: ["all-documents"] });
            refetch();
            refetchGlobalLogs();
        },
        onError: (err: Error) => {
            console.error("Delete document mutation failed:", err);
            toast.error(err.message || "Failed to delete document.");
        }
    });

    // Recategorize Mutation
    const recategorizeDocMutation = useMutation({
        mutationFn: async ({ docId, category }: { docId: string; category: string }) => {
            const { error } = await supabase
                .from("documents")
                .update({ category })
                .eq("id", docId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Document moved successfully.");
            queryClient.invalidateQueries({ queryKey: ["all-documents"] });
            refetch();
            refetchGlobalLogs();
        },
        onError: (err) => {
            const error = err as Error;
            toast.error(error.message || "Failed to move document.");
        }
    });

    // Mutation to update folder access roles (uses category as the stable unique key)
    const updateFolderAccessMutation = useMutation({
        mutationFn: async ({ folderCategory, roles }: { folderCategory: string; roles: string[] }) => {
            const { error } = await supabase
                .from("document_folders")
                .update({ allowed_roles: roles })
                .eq("category", folderCategory);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Folder access updated successfully.");
            queryClient.invalidateQueries({ queryKey: ["document-folders"] });
            refetchFolders();
            setEditFolderOpen(false);
            setEditingFolder(null);
        },
        onError: (err) => {
            const error = err as Error;
            toast.error(error.message || "Failed to update folder access.");
        }
    });

    // Verification mutation helper functions (passed to DocumentViewer)
    const handleVerifyDoc = async (docId: string) => {
        const { error } = await supabase
            .from("documents")
            .update({
                status: "verified",
                verified_by: user?.id,
                verified_at: new Date().toISOString()
            })
            .eq("id", docId);

        if (error) throw error;
        refetch();
        refetchGlobalLogs();
        toast.success("Document approved & verified.");
    };

    const handleRejectDoc = async (docId: string, reason: string) => {
        const { error } = await supabase
            .from("documents")
            .update({
                status: "rejected",
                rejection_reason: reason,
                verified_by: user?.id,
                verified_at: new Date().toISOString()
            })
            .eq("id", docId);

        if (error) throw error;
        refetch();
        refetchGlobalLogs();
        toast.success("Document rejected.");
    };

    const handleCreateFolder = () => {
        if (!newFolderName.trim()) {
            toast.error("Please enter a folder name.");
            return;
        }

        // Generate URL-friendly category slug
        const categorySlug = newFolderName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/(^_+|_+$)/g, '');

        if (!categorySlug) {
            toast.error("Invalid folder name.");
            return;
        }

        // Verify if folder already exists
        const exists = folders.some(f => f.category === categorySlug);
        if (exists) {
            toast.error("A folder with this name or category already exists.");
            return;
        }

        createFolderMutation.mutate({
            name: newFolderName.trim(),
            category: categorySlug,
            color: newFolderColor,
            allowed_roles: newFolderRoles
        });
    };

    const handleRoleToggle = (roleId: string) => {
        setNewFolderRoles(prev => 
            prev.includes(roleId) 
                ? prev.filter(r => r !== roleId) 
                : [...prev, roleId]
        );
    };

    const handleEditFolderRoleToggle = (roleId: string) => {
        setEditFolderRoles(prev =>
            prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
        );
    };

    // Filter documents
    const filteredDocs = documents.filter((doc) => {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
            doc.name.toLowerCase().includes(searchLower) ||
            (doc.document_number?.toLowerCase() || "").includes(searchLower) ||
            (doc.description?.toLowerCase() || "").includes(searchLower);
        const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
        const matchesFolder = selectedFolder === null || doc.category === selectedFolder;
        return matchesSearch && matchesStatus && matchesFolder;
    });

    // Sub-lists based on tab context
    const pendingQueue = documents.filter(doc => doc.status === "pending");
    const myUploads = documents.filter(doc => doc.uploaded_by === user?.id);

    // Calculate metrics
    const totalCount = documents.length;
    const pendingCount = pendingQueue.length;
    const verifiedCount = documents.filter(doc => doc.status === "verified").length;
    const rejectedCount = documents.filter(doc => doc.status === "rejected").length;

    // Helper to check role accessibility
    const hasFolderAccess = (folder: DocumentFolder) => {
        if (!role) return false;
        // Seed default folders or user created folders
        return folder.allowed_roles.includes(role);
    };

    // Drag and Drop Handlers for Folder Targets
    const handleDragOver = (e: React.DragEvent, folder: DocumentFolder) => {
        e.preventDefault();
        if (!hasFolderAccess(folder)) return;
        setDragOverFolderId(folder.id);
    };

    const handleDragLeave = () => {
        setDragOverFolderId(null);
    };

    const handleDrop = async (e: React.DragEvent, folder: DocumentFolder) => {
        e.preventDefault();
        setDragOverFolderId(null);
        
        if (!hasFolderAccess(folder)) {
            toast.error(`You do not have access to the "${folder.name}" folder.`);
            return;
        }

        const docId = e.dataTransfer.getData("text/plain");
        
        if (docId) {
            // Case 1: Dragged an existing document row onto a folder card
            recategorizeDocMutation.mutate({ docId, category: folder.category });
        } else if (e.dataTransfer.files?.length > 0) {
            // Case 2: Dragged a local file from desktop onto a folder card
            const file = e.dataTransfer.files[0];
            setDroppedFile(file);
            setUploadCategoryOverride(folder.category);
            setUploadOpen(true);
        }
    };

    const handleUploadSuccess = () => {
        refetch();
        setDroppedFile(null);
        setUploadCategoryOverride(null);
    };

    const getFolderColorClasses = (colorName: string) => {
        switch (colorName) {
            case "blue": 
                return "text-blue-600 border-blue-200 bg-blue-50/30 dark:text-blue-400 dark:border-blue-500/20 dark:bg-blue-500/5";
            case "amber":
                return "text-amber-600 border-amber-200 bg-amber-50/30 dark:text-amber-400 dark:border-amber-500/20 dark:bg-amber-500/5";
            case "teal":
                return "text-teal-600 border-teal-200 bg-teal-50/30 dark:text-teal-400 dark:border-teal-500/20 dark:bg-teal-500/5";
            case "purple":
                return "text-purple-600 border-purple-200 bg-purple-50/30 dark:text-purple-400 dark:border-purple-400/30 dark:bg-purple-500/5";
            case "indigo":
                return "text-indigo-600 border-indigo-200 bg-indigo-50/30 dark:text-indigo-400 dark:border-indigo-400/30 dark:bg-indigo-500/5";
            case "rose":
                return "text-rose-600 border-rose-200 bg-rose-50/30 dark:text-rose-400 dark:border-rose-450/20 dark:bg-rose-500/5";
            case "emerald":
                return "text-emerald-600 border-emerald-200 bg-emerald-50/30 dark:text-emerald-400 dark:border-emerald-500/20 dark:bg-emerald-500/5";
            default: // slate / other
                return "text-slate-600 border-slate-200 bg-slate-50/30 dark:text-slate-400 dark:border-slate-700 dark:bg-slate-800/5";
        }
    };

    const getCategoryBadgeColor = (category: string, folderColor: string = "slate") => {
        switch (category) {
            case "kyc": return "text-blue-600 border-blue-200 bg-blue-50/50 dark:text-blue-400 dark:border-blue-400/30 dark:bg-transparent";
            case "invoice": return "text-purple-600 border-purple-200 bg-purple-50/50 dark:text-purple-400 dark:border-purple-400/30 dark:bg-transparent";
            case "receipt": return "text-indigo-600 border-indigo-200 bg-indigo-50/50 dark:text-indigo-400 dark:border-indigo-400/30 dark:bg-transparent";
            case "contract": return "text-amber-600 border-amber-200 bg-amber-50/50 dark:text-amber-400 dark:border-amber-400/30 dark:bg-transparent";
            case "agreement": return "text-teal-600 border-teal-200 bg-teal-50/50 dark:text-teal-400 dark:border-teal-400/30 dark:bg-transparent";
            default: {
                // Dynamic fallback colors for custom folders
                return getFolderColorClasses(folderColor)
                    .replace("bg-", "bg-opacity-50 bg-")
                    .replace("/30", "/50");
            }
        }
    };

    const activeFolderConfig = folders.find(f => f.category === selectedFolder);
    const isCustomFolder = activeFolderConfig && !['kyc', 'invoice', 'receipt', 'contract', 'agreement', 'other'].includes(activeFolderConfig.category);

    const isLoading = isLoadingDocs;

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 py-2">
            {dbError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-650 dark:text-red-400 text-xs p-3 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                    <span><strong>Database Error:</strong> {dbError}</span>
                </div>
            )}
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                        <ShieldCheck className="h-8 w-8 text-blue-500" />
                        Document Hub & Verification
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Securely upload, organize, and verify registration proofs, contracts, and business receipts.
                    </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => refetch()} 
                        title="Refresh Documents"
                    >
                        <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button 
                        onClick={() => {
                            setDroppedFile(null);
                            setUploadCategoryOverride(null);
                            setUploadOpen(true);
                        }}
                        className="flex items-center gap-2 w-full sm:w-auto justify-center"
                    >
                        <Upload className="h-4 w-4" /> Upload Document
                    </Button>
                </div>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Documents</CardTitle>
                        <FolderOpen className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{isLoading ? "..." : totalCount}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Cumulative records across systems</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Review</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{isLoading ? "..." : pendingCount}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Requires admin/manager review</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Verified</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{isLoading ? "..." : verifiedCount}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Approved compliance items</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rejected</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{isLoading ? "..." : rejectedCount}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Failed verification checks</p>
                    </CardContent>
                </Card>
            </div>

            {/* Dashboard Tabs & Content */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <TabsList className="bg-muted p-1 rounded-lg">
                        <TabsTrigger 
                            value="library" 
                            className="rounded px-4 py-1.5 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                        >
                            All Documents
                        </TabsTrigger>
                        {isAdminOrManager && (
                            <TabsTrigger 
                                value="queue"
                                className="rounded px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                            >
                                Verification Queue 
                                {pendingCount > 0 && (
                                    <span className="h-5 min-w-5 px-1.5 bg-amber-500 text-white dark:text-slate-950 rounded-full text-[10px] font-black flex items-center justify-center">
                                        {pendingCount}
                                    </span>
                                )}
                            </TabsTrigger>
                        )}
                        <TabsTrigger 
                            value="my-uploads"
                            className="rounded px-4 py-1.5 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                        >
                            My Uploads
                        </TabsTrigger>
                        {isAdminOrManager && (
                            <TabsTrigger 
                                value="audit-history"
                                className="rounded px-4 py-1.5 text-xs font-semibold flex items-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                            >
                                <History className="h-3.5 w-3.5" />
                                Audit Trail
                            </TabsTrigger>
                        )}
                    </TabsList>

                    {/* Filter controls: visible when viewing a selected folder */}
                    {activeTab === "library" && selectedFolder !== null && (
                        <div className="flex items-center gap-2">
                            <div className="relative w-56">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search in folder..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 h-9 rounded text-xs"
                                />
                            </div>

                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[120px] text-xs h-9 rounded">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent className="text-xs">
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="verified">Verified</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {/* Library Tab: Folder Navigation Grid */}
                <TabsContent value="library" className="mt-0">
                    {selectedFolder === null ? (
                        <div className="space-y-4">
                            <div className="text-sm font-semibold text-muted-foreground px-1">
                                Drag files onto folders to upload directly, or click to browse.
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                {folders.map((folder) => {
                                    const hasAccess = hasFolderAccess(folder);
                                    const isDragOver = dragOverFolderId === folder.id;
                                    const fileCount = documents.filter(doc => doc.category === folder.category).length;
                                    const colorClasses = getFolderColorClasses(folder.color);

                                    return (
                                        <div
                                            key={folder.id}
                                            onDragOver={(e) => handleDragOver(e, folder)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, folder)}
                                            onClick={() => {
                                                if (hasAccess) {
                                                    setSelectedFolder(folder.category);
                                                    setSearchQuery("");
                                                } else {
                                                    toast.error(`Access Denied: The "${folder.name}" folder requires additional role privileges.`);
                                                }
                                            }}
                                            className={`relative border rounded-2xl p-5 flex flex-col justify-between h-40 cursor-pointer shadow-sm transition-all duration-300 transform hover:scale-[1.01] hover:shadow-md ${colorClasses} ${
                                                isDragOver 
                                                    ? "bg-blue-500/10 border-blue-500 scale-[1.02]" 
                                                    : !hasAccess 
                                                        ? "opacity-60 bg-muted/30 border-dashed cursor-not-allowed" 
                                                        : "hover:bg-slate-500/5 dark:hover:bg-slate-500/10"
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="p-3 bg-background rounded-xl border">
                                                    <FolderOpen className="h-6 w-6" />
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {isAdminOrManager && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingFolder(folder);
                                                                setEditFolderRoles(folder.allowed_roles || []);
                                                                setEditFolderOpen(true);
                                                            }}
                                                            title="Edit Folder Access"
                                                            className="p-1.5 rounded-lg bg-background/80 border hover:bg-muted transition-colors"
                                                        >
                                                            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                        </button>
                                                    )}
                                                    {!hasAccess ? (
                                                        <Badge variant="secondary" className="flex items-center gap-1 bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400">
                                                            <Lock className="h-3 w-3" /> Locked
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="bg-muted text-muted-foreground uppercase text-[9px] tracking-wider font-bold">
                                                            {folder.category}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <h3 className="font-bold text-foreground text-base tracking-tight">{folder.name}</h3>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {hasAccess 
                                                        ? `${fileCount} document${fileCount !== 1 ? 's' : ''}` 
                                                        : "Restricted role access"
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Add Custom Folder Card */}
                                {isManagerOrStaff && (
                                    <div
                                        onClick={() => setCreateFolderOpen(true)}
                                        className="border border-dashed rounded-2xl p-5 flex flex-col items-center justify-center h-40 cursor-pointer hover:bg-muted/40 transition-colors gap-2 text-muted-foreground hover:text-foreground"
                                    >
                                        <Plus className="h-8 w-8 text-muted-foreground/60" />
                                        <span className="font-bold text-sm">Create Custom Folder</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Folder View (contents of a single folder)
                        <div className="space-y-4">
                            {/* Breadcrumbs */}
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
                                    <span 
                                        className="cursor-pointer hover:text-foreground flex items-center gap-1"
                                        onClick={() => setSelectedFolder(null)}
                                    >
                                        <ArrowLeft className="h-4 w-4" /> Documents Hub
                                    </span>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                                    <span className="text-foreground">{activeFolderConfig?.name}</span>
                                </div>
                                <div className="flex gap-2">
                                    {isCustomFolder && isAdminOrManager && (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => {
                                                if (window.confirm(`Are you sure you want to delete the custom folder "${activeFolderConfig?.name}"?`)) {
                                                    deleteFolderMutation.mutate(activeFolderConfig!);
                                                }
                                            }}
                                            className="h-8"
                                        >
                                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Folder
                                        </Button>
                                    )}
                                    <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => setSelectedFolder(null)} 
                                        className="h-8 text-xs text-muted-foreground"
                                    >
                                        Back to Folders
                                    </Button>
                                </div>
                            </div>

                            {/* Drop Zone Folder Strip (for moving files across folders) */}
                            <div className="bg-muted/30 border p-3.5 rounded-xl space-y-2">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block px-1">
                                    Drag rows and drop here to change folder:
                                </span>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {folders.map((f) => {
                                        const isTarget = f.category === selectedFolder;
                                        const isDragOver = dragOverFolderId === f.id;
                                        const hasAccess = hasFolderAccess(f);

                                        return (
                                            <div
                                                key={f.id}
                                                onDragOver={(e) => handleDragOver(e, f)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, f)}
                                                className={`flex items-center gap-2 border px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                    isTarget 
                                                        ? "bg-background border-border text-foreground opacity-65"
                                                        : !hasAccess
                                                            ? "opacity-40 cursor-not-allowed border-dashed"
                                                            : isDragOver
                                                                ? "bg-blue-500/20 border-blue-500 text-blue-600 scale-[1.02]"
                                                                : "bg-background border-border hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                                }`}
                                            >
                                                <FolderOpen className="h-4 w-4" />
                                                {f.name}
                                                {!hasAccess && <Lock className="h-3 w-3 text-muted-foreground/60" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <Card className="rounded-xl shadow-sm">
                                <CardHeader className="pb-2 border-b flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base font-bold">{activeFolderConfig?.name}</CardTitle>
                                        <CardDescription className="text-xs">
                                            Documents classified under {activeFolderConfig?.name.toLowerCase()}.
                                        </CardDescription>
                                    </div>
                                    <Button
                                        onClick={() => {
                                            setDroppedFile(null);
                                            setUploadCategoryOverride(selectedFolder);
                                            setUploadOpen(true);
                                        }}
                                        size="sm"
                                        className="h-8 flex items-center gap-1.5"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Upload to folder
                                    </Button>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    {isLoading ? (
                                        <div className="text-center py-10 text-muted-foreground text-sm">
                                            Fetching folder contents...
                                        </div>
                                    ) : filteredDocs.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground space-y-2 border border-dashed rounded bg-muted/20">
                                            <FileText className="h-8 w-8 mx-auto text-muted-foreground/60" />
                                            <p className="font-medium text-sm text-foreground">Folder is empty</p>
                                            <p className="text-xs">Upload new compliance records, or drag items here from other areas.</p>
                                        </div>
                                    ) : (
                                        <DocumentTable 
                                            data={filteredDocs} 
                                            onView={(doc) => { setSelectedDoc(doc); setViewerOpen(true); }}
                                            onEdit={(doc) => { setEditingDoc(doc); setEditOpen(true); }}
                                            onDelete={(doc) => {
                                                if (window.confirm(`Are you sure you want to delete "${doc.name}"?`)) {
                                                    deleteDocMutation.mutate(doc);
                                                }
                                            }}
                                            currentUserId={user?.id}
                                            isAdmin={isAdminOrManager}
                                            isDeleting={deleteDocMutation.isPending}
                                            onDragStart={(docId) => setDraggedDocId(docId)}
                                            folders={folders}
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </TabsContent>

                {/* Queue Tab Content */}
                {isAdminOrManager && (
                    <TabsContent value="queue" className="mt-0">
                        <Card className="rounded-xl shadow-sm">
                            <CardHeader className="pb-2 border-b">
                                <CardTitle className="text-base font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                    <Clock className="h-5 w-5 animate-pulse text-amber-500" />
                                    Pending Verification Queue
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Review submitted files, inspect details, and mark them as Verified or Rejected.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-4">
                                {isLoading ? (
                                    <div className="text-center py-10 text-muted-foreground text-sm">
                                        Loading queue...
                                    </div>
                                ) : pendingQueue.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground space-y-2 border border-dashed rounded bg-muted/20">
                                        <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                                        <p className="text-foreground font-bold text-sm">Verification Queue Clear!</p>
                                        <p className="text-xs">All submitted documents have been processed.</p>
                                    </div>
                                ) : (
                                    <DocumentTable 
                                        data={pendingQueue} 
                                        onView={(doc) => { setSelectedDoc(doc); setViewerOpen(true); }}
                                        onEdit={(doc) => { setEditingDoc(doc); setEditOpen(true); }}
                                        onDelete={(doc) => {
                                            if (window.confirm(`Delete "${doc.name}"?`)) {
                                                deleteDocMutation.mutate(doc);
                                            }
                                        }}
                                        currentUserId={user?.id}
                                        isAdmin={isAdminOrManager}
                                        isDeleting={deleteDocMutation.isPending}
                                        folders={folders}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* My Uploads Tab Content */}
                <TabsContent value="my-uploads" className="mt-0">
                    <Card className="rounded-xl shadow-sm">
                        <CardHeader className="pb-2 border-b">
                            <CardTitle className="text-base font-bold">My Uploaded Documents</CardTitle>
                            <CardDescription className="text-xs">
                                Documents you uploaded. Track verification status and view comments.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            {isLoading ? (
                                <div className="text-center py-10 text-muted-foreground text-sm">
                                    Loading your uploads...
                                </div>
                            ) : myUploads.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground space-y-2 border border-dashed rounded bg-muted/20">
                                    <Upload className="h-8 w-8 mx-auto text-muted-foreground/60" />
                                    <p className="font-medium text-sm text-foreground">No files uploaded yet</p>
                                    <p className="text-xs">Click &quot;Upload Document&quot; above to get started.</p>
                                </div>
                            ) : (
                                <DocumentTable 
                                    data={myUploads} 
                                    onView={(doc) => { setSelectedDoc(doc); setViewerOpen(true); }}
                                    onEdit={(doc) => { setEditingDoc(doc); setEditOpen(true); }}
                                    onDelete={(doc) => {
                                        if (window.confirm(`Are you sure you want to delete your document "${doc.name}"?`)) {
                                            deleteDocMutation.mutate(doc);
                                        }
                                    }}
                                    currentUserId={user?.id}
                                    isAdmin={isAdminOrManager}
                                    isDeleting={deleteDocMutation.isPending}
                                    folders={folders}
                                />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {isAdminOrManager && (
                    <TabsContent value="audit-history" className="mt-0">
                        <Card className="rounded-xl shadow-sm">
                            <CardHeader className="pb-2 border-b">
                                <CardTitle className="text-base font-bold flex items-center gap-1.5">
                                    <History className="h-5 w-5 text-blue-500" />
                                    System Audit Trail
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Track all activities, edits, approvals, and actions taken on documents.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-4">
                                {isLoadingGlobalLogs ? (
                                    <div className="text-center py-10 text-muted-foreground text-sm">
                                        Loading audit history logs...
                                    </div>
                                ) : globalLogs.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground space-y-2 border border-dashed rounded bg-muted/20">
                                        <History className="h-8 w-8 mx-auto text-muted-foreground/60" />
                                        <p className="font-medium text-sm text-foreground">No history records found</p>
                                        <p className="text-xs">Activities and modifications will appear here once users perform actions.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Timestamp</TableHead>
                                                    <TableHead>Document</TableHead>
                                                    <TableHead>Action</TableHead>
                                                    <TableHead>Performed By</TableHead>
                                                    <TableHead>Details</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {globalLogs.map((log) => {
                                                    const dateStr = format(parseISO(log.changed_at), "dd MMM yyyy, hh:mm a");
                                                    const docName = log.documents?.name || "Deleted Document";
                                                    const actor = log.changer_profile?.full_name || log.changer_profile?.email || "System";
                                                    
                                                    let badge = <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/10 border-blue-200">Created</Badge>;
                                                    if (log.action === "updated") {
                                                        badge = <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/10 border-amber-200">Updated</Badge>;
                                                    } else if (log.action === "verified") {
                                                        badge = <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10 border-emerald-250">Verified</Badge>;
                                                    } else if (log.action === "rejected") {
                                                        badge = <Badge className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/10 border-rose-250">Rejected</Badge>;
                                                    }

                                                    return (
                                                        <TableRow key={log.id}>
                                                            <TableCell className="text-xs font-mono whitespace-nowrap">{dateStr}</TableCell>
                                                            <TableCell className="font-semibold text-foreground text-xs">{docName}</TableCell>
                                                            <TableCell>{badge}</TableCell>
                                                            <TableCell className="text-xs">{actor}</TableCell>
                                                            <TableCell className="text-xs text-muted-foreground max-w-[300px]">
                                                                {log.action === "updated" && log.previous_values && log.new_values && (
                                                                    <div className="space-y-0.5">
                                                                        {Object.keys(log.new_values).map((key) => {
                                                                            const prevVal = log.previous_values?.[key];
                                                                            const newVal = log.new_values?.[key];
                                                                            if (prevVal !== newVal) {
                                                                                return (
                                                                                    <div key={key} className="flex flex-wrap items-center gap-1 text-[10px]">
                                                                                        <span className="font-bold capitalize text-foreground">{key.replace('_', ' ')}:</span>
                                                                                        <span className="line-through px-0.5 rounded bg-rose-500/5 text-rose-500">{String(prevVal || "—")}</span>
                                                                                        <span>→</span>
                                                                                        <span className="px-0.5 rounded bg-emerald-500/5 text-emerald-600">{String(newVal || "—")}</span>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        })}
                                                                    </div>
                                                                )}
                                                                {log.action === "rejected" && log.new_values?.rejection_reason && (
                                                                    <span className="italic text-rose-600">Rejection comment: {log.new_values.rejection_reason}</span>
                                                                )}
                                                                {log.action === "created" && (
                                                                    <span>Uploaded new document.</span>
                                                                )}
                                                                {log.action === "verified" && (
                                                                    <span className="text-emerald-600">Document approved.</span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>

            {/* Create Custom Folder Modal */}
            <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-xl shadow-xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold tracking-tight">Create Custom Folder</DialogTitle>
                        <DialogDescription>
                            Organize your documents with custom names, color tags, and role permissions.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Folder Name */}
                        <div className="space-y-2">
                            <Label htmlFor="folder-name" className="text-sm font-semibold">Folder Name</Label>
                            <Input
                                id="folder-name"
                                placeholder="e.g., HR Audits, Board Resolutions..."
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                            />
                        </div>

                        {/* Color Selector */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Theme Color</Label>
                            <div className="flex gap-2.5 flex-wrap pt-1">
                                {COLOR_PRESETS.map((preset) => (
                                    <button
                                        key={preset.name}
                                        type="button"
                                        onClick={() => setNewFolderColor(preset.name)}
                                        className={`h-7 w-7 rounded-full flex items-center justify-center transition-all ${preset.bg} hover:scale-105 active:scale-95 ${
                                            newFolderColor === preset.name 
                                                ? "ring-2 ring-offset-2 ring-primary scale-[1.05]" 
                                                : "opacity-85"
                                        }`}
                                        title={preset.label}
                                    >
                                        {newFolderColor === preset.name && (
                                            <Check className="h-4 w-4 text-white" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Role Permissions */}
                        <div className="space-y-2 pt-1">
                            <Label className="text-sm font-semibold">Who Can Access?</Label>
                            <div className="grid grid-cols-2 gap-2.5 pt-1">
                                {AVAILABLE_ROLES.map((r) => {
                                    const isChecked = newFolderRoles.includes(r.id);
                                    return (
                                        <button
                                            key={r.id}
                                            type="button"
                                            onClick={() => handleRoleToggle(r.id)}
                                            className={`flex items-center gap-2 border px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all ${
                                                isChecked
                                                    ? "bg-primary/5 border-primary text-primary"
                                                    : "bg-background border-border hover:bg-muted text-muted-foreground"
                                            }`}
                                        >
                                            <div className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                                                isChecked 
                                                    ? "bg-primary border-primary text-white" 
                                                    : "border-muted-foreground/35 bg-transparent"
                                            }`}>
                                                {isChecked && <Check className="h-3 w-3" />}
                                            </div>
                                            {r.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t pt-4">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setCreateFolderOpen(false)}
                            className="text-muted-foreground"
                            disabled={isCreatingFolder}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleCreateFolder}
                            disabled={isCreatingFolder || !newFolderName.trim()}
                        >
                            {isCreatingFolder ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create Folder"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Document Upload Modal */}
            <DocumentUploadModal
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                onUploadSuccess={handleUploadSuccess}
                initialEntityType="general"
                initialEntityId={null}
                initialCategory={uploadCategoryOverride || 'other'}
                initialFile={droppedFile}
            />

            {/* Document Inline Viewer */}
            <DocumentViewer
                open={viewerOpen}
                onOpenChange={setViewerOpen}
                document={selectedDoc}
                onVerify={handleVerifyDoc}
                onReject={handleRejectDoc}
                showActions={isAdminOrManager}
            />

            {/* Document Edit Modal */}
            <DocumentEditModal
                open={editOpen}
                onOpenChange={setEditOpen}
                document={editingDoc}
                onEditSuccess={refetch}
            />

            {/* Edit Folder Access Modal */}
            <Dialog open={editFolderOpen} onOpenChange={(o) => { setEditFolderOpen(o); if (!o) setEditingFolder(null); }}>
                <DialogContent className="sm:max-w-[440px] rounded-xl shadow-xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Settings2 className="h-5 w-5 text-blue-500" />
                            Folder Access Control
                        </DialogTitle>
                        <DialogDescription>
                            Choose which roles can view and access the <span className="font-semibold text-foreground">"{editingFolder?.name}"</span> folder.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        {/* Current access summary */}
                        <div className="bg-muted/40 rounded-lg px-3.5 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
                            <Lock className="h-3.5 w-3.5 shrink-0" />
                            <span>At least one role must have access. Admin always retains access.</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                            {AVAILABLE_ROLES.map((r) => {
                                const isChecked = editFolderRoles.includes(r.id);
                                const isAdmin = r.id === "admin";
                                return (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => !isAdmin && handleEditFolderRoleToggle(r.id)}
                                        disabled={isAdmin}
                                        className={`flex items-center gap-2.5 border px-3 py-2.5 rounded-lg text-xs font-semibold text-left transition-all ${
                                            isChecked
                                                ? "bg-primary/5 border-primary text-primary"
                                                : "bg-background border-border hover:bg-muted text-muted-foreground"
                                        } ${isAdmin ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                                    >
                                        <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                            isChecked
                                                ? "bg-primary border-primary text-white"
                                                : "border-muted-foreground/35 bg-transparent"
                                        }`}>
                                            {isChecked && <Check className="h-3 w-3" />}
                                        </div>
                                        <span>{r.label}</span>
                                        {isAdmin && <span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground">Always</span>}
                                    </button>
                                );
                            })}
                        </div>

                        {editFolderRoles.length === 0 && (
                            <p className="text-xs text-rose-500 text-center">Select at least one role to save.</p>
                        )}
                    </div>

                    <DialogFooter className="border-t pt-4 gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => { setEditFolderOpen(false); setEditingFolder(null); }}
                            className="text-muted-foreground"
                            disabled={updateFolderAccessMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (!editingFolder) return;
                                const roles = editFolderRoles.includes("admin") 
                                    ? editFolderRoles 
                                    : ["admin", ...editFolderRoles];
                                updateFolderAccessMutation.mutate({ folderCategory: editingFolder.category, roles });
                            }}
                            disabled={updateFolderAccessMutation.isPending || editFolderRoles.length === 0}
                        >
                            {updateFolderAccessMutation.isPending ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                            ) : (
                                "Save Access Rules"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Table UI Sub-component helper
interface DocumentTableProps {
    data: Document[];
    onView: (doc: Document) => void;
    onEdit: (doc: Document) => void;
    onDelete: (doc: Document) => void;
    currentUserId?: string;
    isAdmin: boolean;
    isDeleting: boolean;
    onDragStart?: (docId: string) => void;
    folders?: DocumentFolder[];
}

function DocumentTable({ data, onView, onEdit, onDelete, currentUserId, isAdmin, isDeleting, onDragStart, folders = [] }: DocumentTableProps) {
    const getFolderColorClasses = (colorName: string) => {
        switch (colorName) {
            case "blue": 
                return "text-blue-600 border-blue-200 bg-blue-50/30 dark:text-blue-400 dark:border-blue-500/20 dark:bg-blue-500/5";
            case "amber":
                return "text-amber-600 border-amber-200 bg-amber-50/30 dark:text-amber-400 dark:border-amber-500/20 dark:bg-amber-500/5";
            case "teal":
                return "text-teal-600 border-teal-200 bg-teal-50/30 dark:text-teal-400 dark:border-teal-500/20 dark:bg-teal-500/5";
            case "purple":
                return "text-purple-600 border-purple-200 bg-purple-50/30 dark:text-purple-400 dark:border-purple-400/30 dark:bg-purple-500/5";
            case "indigo":
                return "text-indigo-600 border-indigo-200 bg-indigo-50/30 dark:text-indigo-400 dark:border-indigo-400/30 dark:bg-indigo-500/5";
            case "rose":
                return "text-rose-600 border-rose-200 bg-rose-50/30 dark:text-rose-400 dark:border-rose-450/20 dark:bg-rose-500/5";
            case "emerald":
                return "text-emerald-600 border-emerald-200 bg-emerald-50/30 dark:text-emerald-400 dark:border-emerald-500/20 dark:bg-emerald-500/5";
            default: // slate / other
                return "text-slate-600 border-slate-200 bg-slate-50/30 dark:text-slate-400 dark:border-slate-700 dark:bg-slate-800/5";
        }
    };

    const getCategoryBadgeColor = (category: string) => {
        const folder = folders.find(f => f.category === category);
        const folderColor = folder?.color || "slate";

        switch (category) {
            case "kyc": return "text-blue-600 border-blue-200 bg-blue-50/50 dark:text-blue-400 dark:border-blue-400/30 dark:bg-transparent";
            case "invoice": return "text-purple-600 border-purple-200 bg-purple-50/50 dark:text-purple-400 dark:border-purple-400/30 dark:bg-transparent";
            case "receipt": return "text-indigo-600 border-indigo-200 bg-indigo-50/50 dark:text-indigo-400 dark:border-indigo-400/30 dark:bg-transparent";
            case "contract": return "text-amber-600 border-amber-200 bg-amber-50/50 dark:text-amber-400 dark:border-amber-400/30 dark:bg-transparent";
            case "agreement": return "text-teal-600 border-teal-200 bg-teal-50/50 dark:text-teal-400 dark:border-teal-400/30 dark:bg-transparent";
            default: {
                return getFolderColorClasses(folderColor)
                    .replace("bg-", "bg-opacity-50 bg-")
                    .replace("/30", "/50");
            }
        }
    };

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Document / ID No.</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Linked Context</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Uploaded By</TableHead>
                        <TableHead>Upload Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((doc) => {
                        const canDelete = isAdmin || (doc.uploaded_by === currentUserId && doc.status === "pending");
                        const linkContext = doc.entity_type 
                            ? `${doc.entity_type.toUpperCase()}` 
                            : "GENERAL";
                        const folder = folders.find(f => f.category === doc.category);
                        const categoryName = folder?.name || doc.category;

                        return (
                            <TableRow 
                                key={doc.id}
                                draggable={!!onDragStart}
                                onDragStart={(e) => {
                                    if (onDragStart) {
                                        e.dataTransfer.setData("text/plain", doc.id);
                                        onDragStart(doc.id);
                                    }
                                }}
                                className={onDragStart ? "cursor-grab active:cursor-grabbing hover:bg-muted/40 transition-colors" : ""}
                            >
                                <TableCell className="font-semibold text-foreground max-w-[220px]" title={doc.name}>
                                    <div className="flex items-center gap-2">
                                        {onDragStart && <div className="text-muted-foreground/30 font-mono text-sm cursor-grab select-none">⋮⋮</div>}
                                        <div className="flex flex-col">
                                            <span className="truncate max-w-[190px]">{doc.name}</span>
                                            {doc.description && (
                                                <span className="text-[10px] text-muted-foreground font-normal truncate max-w-[190px]">
                                                    {doc.description}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs font-mono font-medium text-muted-foreground/90">
                                    {doc.document_number || "—"}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={`uppercase text-[10px] tracking-wider font-bold px-2 py-0.5 ${getCategoryBadgeColor(doc.category)}`}>
                                        {categoryName}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs font-medium">
                                    <Badge variant="outline" className="bg-secondary text-secondary-foreground border-border text-[10px] uppercase px-1.5 py-0.5">
                                        {linkContext}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col space-y-0.5">
                                        {doc.status === "verified" ? (
                                            <Badge className="w-fit bg-emerald-100 text-emerald-800 border-emerald-250 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30">Verified</Badge>
                                        ) : doc.status === "rejected" ? (
                                            <Badge className="w-fit bg-rose-100 text-rose-800 border-rose-250 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30">Rejected</Badge>
                                        ) : (
                                            <Badge className="w-fit bg-amber-100 text-amber-800 border-amber-250 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 animate-pulse">Pending</Badge>
                                        )}
                                        {doc.status === "rejected" && doc.rejection_reason && (
                                            <span className="text-[10px] text-rose-600 dark:text-rose-400/90 italic max-w-[150px] truncate" title={doc.rejection_reason}>
                                                Reason: {doc.rejection_reason}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                    {doc.uploader_profile?.full_name || doc.uploader_profile?.email || "System"}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                    {format(parseISO(doc.created_at), "dd MMM yyyy, hh:mm a")}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1.5">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onView(doc)}
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            title="View Document Details"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onEdit(doc)}
                                            className="h-8 w-8 text-muted-foreground hover:text-blue-500"
                                            title="Edit Document Details"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        {canDelete && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => onDelete(doc)}
                                                className="h-8 w-8 text-muted-foreground hover:text-rose-500"
                                                title="Delete Document"
                                                disabled={isDeleting}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
