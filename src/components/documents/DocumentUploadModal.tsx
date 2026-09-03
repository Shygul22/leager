import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { DocumentFolder } from "@/types/document";

interface DocumentUploadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUploadSuccess: () => void;
    initialEntityType?: 'client' | 'employee' | 'bill' | 'transaction' | 'general' | 'lead';
    initialEntityId?: string | null;
    initialCategory?: string;
    initialFile?: File | null;
}
const DEFAULT_FOLDERS: DocumentFolder[] = [
    { id: "kyc", name: "KYC & Identity", category: "kyc", color: "blue", allowed_roles: ["admin", "accounts_manager"], created_at: new Date().toISOString() },
    { id: "contracts", name: "Contracts", category: "contract", color: "amber", allowed_roles: ["admin", "accounts_manager", "project_manager"], created_at: new Date().toISOString() },
    { id: "agreements", name: "Agreements", category: "agreement", color: "teal", allowed_roles: ["admin", "accounts_manager", "project_manager"], created_at: new Date().toISOString() },
    { id: "invoices", name: "Invoices", category: "invoice", color: "purple", allowed_roles: ["admin", "accounts_manager", "staff"], created_at: new Date().toISOString() },
    { id: "receipts", name: "Receipts", category: "receipt", color: "indigo", allowed_roles: ["admin", "accounts_manager", "staff"], created_at: new Date().toISOString() },
    { id: "other", name: "Other Files", category: "other", color: "slate", allowed_roles: ["admin", "accounts_manager", "staff", "project_manager"], created_at: new Date().toISOString() }
];
export default function DocumentUploadModal({
    open,
    onOpenChange,
    onUploadSuccess,
    initialEntityType = 'general',
    initialEntityId = null,
    initialCategory = 'other',
    initialFile = null
}: DocumentUploadModalProps) {
    const { user } = useAuth();
    const [file, setFile] = useState<File | null>(initialFile);
    const [isDragging, setIsDragging] = useState(false);
    
    // Metadata states
    const [docName, setDocName] = useState("");
    const [docNumber, setDocNumber] = useState("");
    const [docDescription, setDocDescription] = useState("");
    
    const [category, setCategory] = useState<string>(initialCategory);
    const [entityType, setEntityType] = useState<'client' | 'employee' | 'bill' | 'transaction' | 'general' | 'lead'>(initialEntityType);
    const [entityId, setEntityId] = useState<string | null>(initialEntityId);
    const [isUploading, setIsUploading] = useState(false);

    // Fetch folders dynamically from database
    const { data: folders = [] } = useQuery({
        queryKey: ["document-folders"],
        queryFn: async () => {
            try {
                const { data, error } = await supabase
                    .from("document_folders")
                    .select("*")
                    .order("created_at", { ascending: true });
                if (error) {
                    console.warn("document_folders table query returned error, using fallback defaults:", error);
                    return DEFAULT_FOLDERS;
                }
                return data && data.length > 0 ? (data as DocumentFolder[]) : DEFAULT_FOLDERS;
            } catch (err) {
                console.warn("document_folders query failed in upload modal, returning defaults:", err);
                return DEFAULT_FOLDERS;
            }
        },
        enabled: open
    });

    // Sync state when props change
    useEffect(() => {
        setEntityType(initialEntityType);
        setEntityId(initialEntityId);
        if (open) {
            setCategory(initialCategory);
            setFile(initialFile);
            setDocName(initialFile ? initialFile.name : "");
            setDocNumber("");
            setDocDescription("");
        }
    }, [initialEntityType, initialEntityId, initialCategory, initialFile, open]);

    // Reset modal state on close
    useEffect(() => {
        if (!open) {
            setFile(null);
            setCategory('other');
            setIsUploading(false);
            setDocName("");
            setDocNumber("");
            setDocDescription("");
        }
    }, [open]);

    // Fetch potential entities to link to if in General mode
    const { data: clients = [] } = useQuery({
        queryKey: ["upload-modal-clients"],
        queryFn: async () => {
            const { data, error } = await supabase.from("clients").select("id, name").order("name");
            if (error) throw error;
            return data || [];
        },
        enabled: open && entityType === 'client' && !initialEntityId
    });

    const { data: employees = [] } = useQuery({
        queryKey: ["upload-modal-employees"],
        queryFn: async () => {
            const { data, error } = await supabase.from("employees").select("id, name").order("name");
            if (error) throw error;
            return data || [];
        },
        enabled: open && entityType === 'employee' && !initialEntityId
    });

    const { data: bills = [] } = useQuery({
        queryKey: ["upload-modal-bills"],
        queryFn: async () => {
            const { data, error } = await supabase.from("bills").select("id, bill_number").order("bill_number");
            if (error) throw error;
            return data || [];
        },
        enabled: open && entityType === 'bill' && !initialEntityId
    });

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            validateAndSetFile(droppedFile);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            validateAndSetFile(selectedFile);
        }
    };

    const validateAndSetFile = (selectedFile: File) => {
        // Max 10MB file size limit
        const maxSize = 10 * 1024 * 1024;
        if (selectedFile.size > maxSize) {
            toast.error("File is too large. Maximum size is 10MB.");
            return;
        }

        const allowedExtensions = ["pdf", "png", "jpg", "jpeg", "xlsx", "xls", "csv"];
        const fileExt = selectedFile.name.split(".").pop()?.toLowerCase();
        
        if (!fileExt || !allowedExtensions.includes(fileExt)) {
            toast.error("Unsupported file type. Please upload a PDF, Excel sheet, or Image.");
            return;
        }

        setFile(selectedFile);
        setDocName(selectedFile.name);
    };

    const handleUpload = async () => {
        if (!file || !user) {
            toast.error("Please select a file to upload.");
            return;
        }

        if (!docName.trim()) {
            toast.error("Please specify a document name.");
            return;
        }

        setIsUploading(true);

        try {
            const fileExt = file.name.split(".").pop();
            const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
            const storagePath = `${category}/${uniqueFileName}`;

            let finalFilePath = storagePath;
            let base64Fallback: string | null = null;
            let uploadedViaStorage = false;

            // Attempt to upload to Supabase Storage Bucket 'documents'
            try {
                const { data, error } = await supabase.storage
                    .from("documents")
                    .upload(storagePath, file, {
                        cacheControl: "3600",
                        upsert: false
                    });

                if (error) {
                    throw error;
                }
                
                uploadedViaStorage = true;
            } catch (storageErr) {
                console.warn("Supabase Storage bucket upload failed, using Base64 DB fallback:", storageErr);
                
                // Convert file to Base64
                base64Fallback = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = (error) => reject(error);
                });

                finalFilePath = `database-fallback/${file.name}`;
            }

            // Insert metadata record in the database
            const { error: dbError } = await supabase.from("documents").insert({
                name: docName.trim(),
                title: docName.trim(),
                file_name: docName.trim(),
                document_number: docNumber.trim() || null,
                description: docDescription.trim() || null,
                file_path: finalFilePath,
                file_type: file.type || fileExt || "unknown",
                file_size: file.size,
                category: category,
                status: "pending",
                uploaded_by: user.id,
                entity_type: entityType === "general" ? null : entityType,
                entity_id: entityType === "general" ? null : entityId || null,
                file_data: base64Fallback
            });

            if (dbError) throw dbError;

            toast.success(
                uploadedViaStorage
                    ? "Document uploaded and submitted for verification successfully!"
                    : "Document saved securely to database (storage fallback active) and submitted!"
            );

            onUploadSuccess();
            onOpenChange(false);
        } catch (err) {
            const error = err as Error;
            console.error("Upload error details:", error);
            toast.error(error.message || "An error occurred during upload.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px] rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold tracking-tight">
                        Upload Document
                    </DialogTitle>
                    <DialogDescription>
                        Upload files for compliance, receipts, or record-keeping. Max file size: 10MB.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-5 py-3">
                    {/* Drag and Drop Area */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-5 cursor-pointer transition-all duration-300 ${
                            isDragging 
                                ? "border-blue-500 bg-blue-500/10 scale-[0.99]" 
                                : file 
                                    ? "border-emerald-500/50 bg-emerald-500/5" 
                                    : "border-border hover:border-blue-500/50 hover:bg-muted/50"
                        }`}
                        onClick={() => document.getElementById("file-upload-input")?.click()}
                    >
                        <input
                            id="file-upload-input"
                            type="file"
                            className="hidden"
                            accept=".pdf,image/png,image/jpeg,image/jpg,.xlsx,.xls,.csv"
                            onChange={handleFileChange}
                        />

                        {file ? (
                            <div className="flex flex-col items-center text-center space-y-1.5 w-full">
                                <div className="h-10 w-10 bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-full flex items-center justify-center">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <span className="font-semibold text-foreground truncate max-w-[320px]">
                                    {file.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-foreground h-8"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFile(null);
                                    }}
                                >
                                    <X className="h-3.5 w-3.5 mr-1" /> Remove File
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-center space-y-2">
                                <div className="h-11 w-11 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mb-1">
                                    <Upload className="h-5 w-5" />
                                </div>
                                <span className="text-sm font-medium text-muted-foreground">
                                    Drag & drop file here or click to browse
                                </span>
                                <span className="text-xs text-muted-foreground/65">
                                    Supports PDF, PNG, JPG, JPEG, Excel, CSV
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Metadata fields - enabled only when file is selected */}
                    {file && (
                        <div className="space-y-4 border-t pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            {/* Document Name & Number */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="doc-name">Document Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="doc-name"
                                        placeholder="e.g. Passport Copy, Invoice 124"
                                        value={docName}
                                        onChange={(e) => setDocName(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="doc-number">Document / ID Number</Label>
                                    <Input
                                        id="doc-number"
                                        placeholder="e.g. TX-98234, PAN12345"
                                        value={docNumber}
                                        onChange={(e) => setDocNumber(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Category & Link Entity */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Select
                                        value={category}
                                        onValueChange={(val) => setCategory(val)}
                                    >
                                        <SelectTrigger id="category">
                                            <SelectValue placeholder="Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {folders.map((f) => (
                                                <SelectItem key={f.id} value={f.category}>
                                                    {f.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="entityType">Link Entity</Label>
                                    <Select
                                        value={entityType}
                                        onValueChange={(val: 'client' | 'employee' | 'bill' | 'transaction' | 'general') => {
                                            setEntityType(val);
                                            setEntityId(null);
                                        }}
                                        disabled={initialEntityType !== 'general'}
                                    >
                                        <SelectTrigger id="entityType">
                                            <SelectValue placeholder="Link type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="general">None (General)</SelectItem>
                                            <SelectItem value="client">Client</SelectItem>
                                            <SelectItem value="employee">Employee</SelectItem>
                                            <SelectItem value="bill">Bill / Expense</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Contextual Entity Select dropdown (if not general and not pre-linked) */}
                            {entityType !== "general" && !initialEntityId && (
                                <div className="space-y-2">
                                    <Label htmlFor="entityId">Select {entityType}</Label>
                                    <Select
                                        value={entityId || ""}
                                        onValueChange={(val) => setEntityId(val)}
                                    >
                                        <SelectTrigger id="entityId">
                                            <SelectValue placeholder={`Select ${entityType}`} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {entityType === "client" && clients.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                            {entityType === "employee" && employees.map((e) => (
                                                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                            ))}
                                            {entityType === "bill" && bills.map((b) => (
                                                <SelectItem key={b.id} value={b.id}>Bill #{b.bill_number}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Description */}
                            <div className="space-y-2">
                                <Label htmlFor="doc-description">Description / Notes</Label>
                                <Textarea
                                    id="doc-description"
                                    placeholder="Add brief details about the document, e.g. Valid until Dec 2028..."
                                    value={docDescription}
                                    onChange={(e) => setDocDescription(e.target.value)}
                                    className="resize-none h-20 text-xs"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="text-muted-foreground hover:text-foreground"
                        disabled={isUploading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleUpload}
                        disabled={isUploading || !file || !docName.trim()}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            "Submit Document"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
