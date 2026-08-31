import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FolderOpen, Plus, Trash2, Eye, FileText, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import DocumentUploadModal from "./DocumentUploadModal";
import DocumentViewer from "./DocumentViewer";
import DocumentEditModal from "./DocumentEditModal";
import { Document } from "@/types/document";

interface EntityDocumentsSectionProps {
    entityId: string;
    entityType: 'client' | 'employee' | 'bill' | 'transaction';
    title?: string;
    description?: string;
}

export default function EntityDocumentsSection({
    entityId,
    entityType,
    title = "Attached Documents",
    description = "Manage documentation, files, and verification records associated with this item."
}: EntityDocumentsSectionProps) {
    const { user, role } = useAuth();
    const queryClient = useQueryClient();
    const [uploadOpen, setUploadOpen] = useState(false);
    const [viewOpen, setViewOpen] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<Document | null>(null);

    // Fetch documents linked to this entity
    const { data: documents = [], isLoading, refetch } = useQuery({
        queryKey: ["documents", entityType, entityId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("documents")
                .select("*, uploader_profile:profiles!uploaded_by(full_name, email), verifier_profile:profiles!verified_by(full_name)")
                .eq("entity_type", entityType)
                .eq("entity_id", entityId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return (data || []) as Document[];
        },
        enabled: !!entityId
    });

    // Delete Mutation
    const deleteDocMutation = useMutation({
        mutationFn: async (doc: Document) => {
            // If stored in storage, try deleting it from storage first
            if (doc.file_path && !doc.file_path.startsWith("database-fallback/")) {
                await supabase.storage.from("documents").remove([doc.file_path]);
            }
            
            // Delete DB record
            const { error } = await supabase
                .from("documents")
                .delete()
                .eq("id", doc.id);

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Document deleted successfully.");
            queryClient.invalidateQueries({ queryKey: ["documents", entityType, entityId] });
            queryClient.invalidateQueries({ queryKey: ["all-documents"] });
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to delete document.");
        }
    });

    // Verify Mutation
    const verifyDoc = async (docId: string) => {
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
        queryClient.invalidateQueries({ queryKey: ["all-documents"] });
    };

    // Reject Mutation
    const rejectDoc = async (docId: string, reason: string) => {
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
        queryClient.invalidateQueries({ queryKey: ["all-documents"] });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "verified":
                return (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-250 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30">
                        Verified
                    </Badge>
                );
            case "rejected":
                return (
                    <Badge className="bg-rose-100 text-rose-800 border-rose-250 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30">
                        Rejected
                    </Badge>
                );
            default:
                return (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-250 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 animate-pulse">
                        Pending
                    </Badge>
                );
        }
    };

    const isAdminOrManager = role && ["admin", "accounts_manager"].includes(role);

    return (
        <Card className="rounded-xl shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b">
                <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <FolderOpen className="h-5 w-5 text-blue-500" />
                        {title}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                        {description}
                    </CardDescription>
                </div>
                <Button
                    onClick={() => setUploadOpen(true)}
                    size="sm"
                    className="flex items-center gap-1.5"
                >
                    <Plus className="h-4 w-4" /> Add Document
                </Button>
            </CardHeader>
            <CardContent className="pt-4">
                {isLoading ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                        Loading documents...
                    </div>
                ) : documents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-2 border border-dashed rounded-lg bg-muted/20">
                        <FileText className="h-10 w-10 text-muted-foreground/60" />
                        <p className="font-medium text-sm text-foreground">No documents uploaded yet</p>
                        <p className="text-xs text-muted-foreground max-w-xs">Upload identity proofs, receipts, or agreements here.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>File Name</TableHead>
                                    <TableHead>Document / ID No.</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Size</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Uploaded By</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {documents.map((doc) => {
                                    const uploaderName = doc.uploader_profile?.full_name || "Unknown";
                                    const formattedSize = (doc.file_size / (1024 * 1024)).toFixed(2) + " MB";
                                    const canDelete = isAdminOrManager || (doc.uploaded_by === user?.id && doc.status === "pending");

                                    return (
                                        <TableRow key={doc.id}>
                                            <TableCell className="font-medium text-foreground max-w-[220px]">
                                                <div className="flex flex-col">
                                                    <span className="truncate max-w-[190px]">{doc.name}</span>
                                                    {doc.description && (
                                                        <span className="text-[10px] text-muted-foreground font-normal truncate max-w-[190px]">
                                                            {doc.description}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs font-mono font-medium text-muted-foreground/90">
                                                {doc.document_number || "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="uppercase text-[10px] tracking-wider border-border text-muted-foreground font-semibold px-2 py-0.5">
                                                    {doc.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs">{formattedSize}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col space-y-1">
                                                    {getStatusBadge(doc.status)}
                                                    {doc.status === "rejected" && doc.rejection_reason && (
                                                        <span className="text-[10px] text-rose-600 dark:text-rose-400 italic max-w-[150px] truncate" title={doc.rejection_reason}>
                                                            Reason: {doc.rejection_reason}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs">
                                                <div className="flex flex-col">
                                                    <span>{uploaderName}</span>
                                                    <span className="text-[10px]">{format(parseISO(doc.created_at), "dd MMM yyyy")}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    <Button
                                                         variant="ghost"
                                                         size="icon"
                                                         onClick={() => {
                                                             setSelectedDoc(doc);
                                                             setViewOpen(true);
                                                         }}
                                                         className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                         title="View / Verify File"
                                                     >
                                                         <Eye className="h-4 w-4" />
                                                     </Button>

                                                     <Button
                                                         variant="ghost"
                                                         size="icon"
                                                         onClick={() => {
                                                             setEditingDoc(doc);
                                                             setEditOpen(true);
                                                         }}
                                                         className="h-8 w-8 text-muted-foreground hover:text-blue-500"
                                                         title="Edit Document Details"
                                                     >
                                                         <Edit2 className="h-4 w-4" />
                                                     </Button>

                                                    {canDelete && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                if (window.confirm("Are you sure you want to delete this document?")) {
                                                                    deleteDocMutation.mutate(doc);
                                                                }
                                                            }}
                                                            className="h-8 w-8 text-muted-foreground hover:text-rose-500"
                                                            title="Delete Document"
                                                            disabled={deleteDocMutation.isPending}
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
                )}
            </CardContent>

            {/* Document Upload Dialog */}
            <DocumentUploadModal
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                onUploadSuccess={refetch}
                initialEntityType={entityType}
                initialEntityId={entityId}
            />

            {/* Inline Document Preview / Verification Dialog */}
            <DocumentViewer
                open={viewOpen}
                onOpenChange={setViewOpen}
                document={selectedDoc}
                onVerify={verifyDoc}
                onReject={rejectDoc}
                showActions={isAdminOrManager}
            />

            {/* Document Edit Dialog */}
            <DocumentEditModal
                open={editOpen}
                onOpenChange={setEditOpen}
                document={editingDoc}
                onEditSuccess={refetch}
            />
        </Card>
    );
}
