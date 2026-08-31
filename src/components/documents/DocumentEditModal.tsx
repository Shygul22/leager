import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Document, DocumentFolder } from "@/types/document";

interface DocumentEditModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    document: Document | null;
    onEditSuccess: () => void;
}

const DEFAULT_FOLDERS: DocumentFolder[] = [
    { id: "kyc", name: "KYC & Identity", category: "kyc", color: "blue", allowed_roles: ["admin", "accounts_manager"], created_at: new Date().toISOString() },
    { id: "contracts", name: "Contracts", category: "contract", color: "amber", allowed_roles: ["admin", "accounts_manager", "project_manager"], created_at: new Date().toISOString() },
    { id: "agreements", name: "Agreements", category: "agreement", color: "teal", allowed_roles: ["admin", "accounts_manager", "project_manager"], created_at: new Date().toISOString() },
    { id: "invoices", name: "Invoices", category: "invoice", color: "purple", allowed_roles: ["admin", "accounts_manager", "staff"], created_at: new Date().toISOString() },
    { id: "receipts", name: "Receipts", category: "receipt", color: "indigo", allowed_roles: ["admin", "accounts_manager", "staff"], created_at: new Date().toISOString() },
    { id: "other", name: "Other Files", category: "other", color: "slate", allowed_roles: ["admin", "accounts_manager", "staff", "project_manager"], created_at: new Date().toISOString() }
];

export default function DocumentEditModal({
    open,
    onOpenChange,
    document,
    onEditSuccess
}: DocumentEditModalProps) {
    const [name, setName] = useState("");
    const [documentNumber, setDocumentNumber] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("other");

    // Fetch custom folders dynamically from database
    const { data: folders = DEFAULT_FOLDERS } = useQuery({
        queryKey: ["document-folders"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("document_folders")
                .select("*")
                .order("created_at", { ascending: true });

            if (error) return DEFAULT_FOLDERS;
            return data && data.length > 0 ? (data as DocumentFolder[]) : DEFAULT_FOLDERS;
        }
    });

    // Sync state when document changes
    useEffect(() => {
        if (document) {
            setName(document.name || "");
            setDocumentNumber(document.document_number || "");
            setDescription(document.description || "");
            setCategory(document.category || "other");
        }
    }, [document, open]);

    // Mutation to update document
    const editMutation = useMutation({
        mutationFn: async () => {
            if (!document) return;
            const { error } = await supabase
                .from("documents")
                .update({
                    name,
                    document_number: documentNumber || null,
                    description: description || null,
                    category
                })
                .eq("id", document.id);

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Document updated successfully.");
            onEditSuccess();
            onOpenChange(false);
        },
        onError: (err) => {
            toast.error("Failed to update document: " + (err as Error).message);
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("Document name is required");
            return;
        }
        editMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                            <Edit2 className="h-5 w-5 text-blue-500" />
                            Edit Document Details
                        </DialogTitle>
                        <DialogDescription>
                            Modify document metadata. Changes will be tracked in the change log history.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Document Name</Label>
                            <Input
                                id="edit-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter document name"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-doc-number">Document / ID No.</Label>
                            <Input
                                id="edit-doc-number"
                                value={documentNumber}
                                onChange={(e) => setDocumentNumber(e.target.value)}
                                placeholder="e.g. TRN0726, KYC-1002"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-category">Category / Folder</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger id="edit-category" className="w-full">
                                    <SelectValue placeholder="Select a folder" />
                                </SelectTrigger>
                                <SelectContent>
                                    {folders.map((folder) => (
                                        <SelectItem key={folder.id} value={folder.category}>
                                            {folder.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-description">Description / Notes</Label>
                            <Textarea
                                id="edit-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Add notes or detailed description about the document..."
                                className="min-h-[80px]"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={editMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={editMutation.isPending}>
                            {editMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save Changes"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
