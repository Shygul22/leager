import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Loader2, AlertTriangle, Check, X, FileText, History, PlusCircle, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { Document, DocumentAuditLog } from "@/types/document";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";

interface DocumentViewerProps {
    document: Document | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // Optional verification action props
    onVerify?: (docId: string) => Promise<void>;
    onReject?: (docId: string, reason: string) => Promise<void>;
    showActions?: boolean;
}

export default function DocumentViewer({
    document,
    open,
    onOpenChange,
    onVerify,
    onReject,
    showActions = false
}: DocumentViewerProps) {
    const [fileUrl, setFileUrl] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [isRejecting, setIsRejecting] = useState(false);
    const [isActionSubmitting, setIsActionSubmitting] = useState(false);
    const [activeView, setActiveView] = useState<'preview' | 'history'>('preview');

    // Fetch audit history logs for the document
    const { data: logs = [], isLoading: isLoadingLogs } = useQuery<DocumentAuditLog[]>({
        queryKey: ["document-audit-logs", document?.id],
        queryFn: async () => {
            if (!document) return [];
            const { data, error } = await supabase
                .from("document_audit_logs")
                .select("*, changer_profile:profiles!changed_by(full_name, email)")
                .eq("document_id", document.id)
                .order("changed_at", { ascending: false });

            if (error) {
                console.error("Error fetching audit logs:", error);
                return [];
            }
            return data as DocumentAuditLog[];
        },
        enabled: open && !!document?.id
    });



    const loadFileUrl = useCallback(async () => {
        if (!document) return;
        setIsLoading(true);
        setError(null);

        try {
            // Case 1: Base64 data already exists in the document object
            if (document.file_data) {
                setFileUrl(document.file_data);
                setIsLoading(false);
                return;
            }

            // Case 2: Document is stored as base64 in the database, but we need to fetch it
            if (document.file_path.startsWith("database-fallback/")) {
                const { data, error: dbErr } = await supabase
                    .from("documents")
                    .select("file_data")
                    .eq("id", document.id)
                    .single();

                if (dbErr) throw dbErr;
                if (data?.file_data) {
                    setFileUrl(data.file_data);
                } else {
                    throw new Error("Base64 data not found in fallback storage.");
                }
                setIsLoading(false);
                return;
            }

            // Case 3: Standard Supabase Storage. Request a signed URL.
            const { data, error: storageErr } = await supabase.storage
                .from("documents")
                .createSignedUrl(document.file_path, 3600); // 1 hour expiry

            if (storageErr) {
                console.warn("Could not create signed URL, trying public URL:", storageErr);
                const { data: publicData } = supabase.storage
                    .from("documents")
                    .getPublicUrl(document.file_path);
                
                if (publicData?.publicUrl) {
                    setFileUrl(publicData.publicUrl);
                } else {
                    throw storageErr;
                }
            } else if (data?.signedUrl) {
                setFileUrl(data.signedUrl);
            }
        } catch (err) {
            console.error("Error loading file URL:", err);
            setError("Failed to load file preview. Please download the file to view it.");
        } finally {
            setIsLoading(false);
        }
    }, [document]);

    useEffect(() => {
        if (open && document) {
            loadFileUrl();
            setRejectReason("");
            setIsRejecting(false);
            setError(null);
            setActiveView('preview');
        } else {
            setFileUrl("");
        }
    }, [open, document, loadFileUrl]);

    const handleDownload = () => {
        if (!fileUrl || !document) return;
        
        const link = window.document.createElement("a");
        link.href = fileUrl;
        link.download = document.name;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
    };

    const handleVerifyAction = async () => {
        if (!document || !onVerify) return;
        setIsActionSubmitting(true);
        try {
            await onVerify(document.id);
            toast.success("Document verified successfully.");
            onOpenChange(false);
        } catch (err) {
            const error = err as Error;
            toast.error(error.message || "Failed to verify document.");
        } finally {
            setIsActionSubmitting(false);
        }
    };

    const handleRejectAction = async () => {
        if (!document || !onReject) return;
        if (!rejectReason.trim()) {
            toast.error("Please enter a reason for rejection.");
            return;
        }

        setIsActionSubmitting(true);
        try {
            await onReject(document.id, rejectReason);
            toast.success("Document rejected.");
            onOpenChange(false);
        } catch (err) {
            const error = err as Error;
            toast.error(error.message || "Failed to reject document.");
        } finally {
            setIsActionSubmitting(false);
            setIsRejecting(false);
        }
    };

    const isImage = document?.file_type.startsWith("image/") || 
                    ["png", "jpg", "jpeg"].includes(document?.file_type || "");
    const isPDF = document?.file_type.includes("pdf") || 
                  (document?.name.toLowerCase().endsWith(".pdf"));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
                <DialogHeader className="border-b pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <DialogTitle className="text-lg font-bold truncate max-w-[500px]">
                            {document?.name}
                        </DialogTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                            Category: <span className="uppercase text-blue-500 font-semibold">{document?.category}</span> • 
                            Size: {document ? (document.file_size / (1024 * 1024)).toFixed(2) : 0} MB
                            {document?.document_number && (
                                <> • ID/Number: <span className="font-bold text-foreground">{document.document_number}</span></>
                            )}
                        </p>
                    </div>
                    <div className="flex bg-muted p-0.5 rounded-lg text-xs w-fit shrink-0">
                        <button
                            type="button"
                            onClick={() => setActiveView('preview')}
                            className={`px-3 py-1 rounded-md font-medium transition-all ${
                                activeView === 'preview'
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Preview
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveView('history')}
                            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                                activeView === 'history'
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <History className="h-3 w-3" />
                            History
                        </button>
                    </div>
                </DialogHeader>

                {/* Description bar */}
                {document?.description && (
                    <div className="bg-muted/30 border p-3 rounded-lg text-xs text-muted-foreground leading-relaxed">
                        <span className="font-bold text-foreground block mb-0.5">Description / Notes:</span>
                        {document.description}
                    </div>
                )}

                {/* Content switching based on activeView */}
                {activeView === 'preview' ? (
                    <div className="flex-1 overflow-auto py-6 flex items-center justify-center min-h-[300px] bg-muted/30 rounded-lg border">
                        {isLoading ? (
                            <div className="flex flex-col items-center space-y-2">
                                <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
                                <span className="text-muted-foreground text-sm">Loading document preview...</span>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center space-y-3 p-4 text-center">
                                <AlertTriangle className="h-12 w-12 text-amber-500" />
                                <span className="font-medium text-foreground">{error}</span>
                                <Button onClick={handleDownload} variant="outline" className="mt-2">
                                    <Download className="h-4 w-4 mr-2" /> Download File
                                </Button>
                            </div>
                        ) : isImage && fileUrl ? (
                            <div className="max-w-full max-h-[60vh] flex items-center justify-center p-2">
                                <img
                                    src={fileUrl}
                                    alt={document?.name}
                                    className="max-w-full max-h-[55vh] object-contain rounded border shadow-md"
                                />
                            </div>
                        ) : isPDF && fileUrl ? (
                            <iframe
                                src={`${fileUrl}#toolbar=0`}
                                title={document?.name}
                                className="w-full h-[60vh] rounded border"
                            />
                        ) : (
                            <div className="flex flex-col items-center space-y-4 p-6 text-center">
                                <FileText className="h-16 w-16 text-muted-foreground/60" />
                                <div className="space-y-1">
                                    <p className="font-semibold text-foreground">Preview Unavailable</p>
                                    <p className="text-xs text-muted-foreground">Preview is only supported for PDFs and Images.</p>
                                </div>
                                <Button onClick={handleDownload}>
                                    <Download className="h-4 w-4 mr-2" /> Download File
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto p-6 min-h-[300px] bg-muted/30 rounded-lg border space-y-4">
                        {isLoadingLogs ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-2">
                                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                                <span className="text-muted-foreground text-xs">Loading audit logs...</span>
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground space-y-1">
                                <History className="h-8 w-8 mx-auto text-muted-foreground/40" />
                                <p className="font-semibold text-foreground text-sm">No History Records</p>
                                <p className="text-xs">No edit or action history logs found for this document.</p>
                            </div>
                        ) : (
                            <div className="relative pl-6 border-l border-border/80 space-y-6 max-h-[55vh] overflow-y-auto pr-2">
                                {logs.map((log) => {
                                    const dateStr = format(parseISO(log.changed_at), "dd MMM yyyy, hh:mm a");
                                    const actor = log.changer_profile?.full_name || log.changer_profile?.email || "System";
                                    
                                    let icon = <PlusCircle className="h-4 w-4 text-blue-500" />;
                                    let actionTitle = "Created";

                                    if (log.action === 'updated') {
                                        icon = <RefreshCw className="h-4 w-4 text-amber-500" />;
                                        actionTitle = "Details Updated";
                                    } else if (log.action === 'verified') {
                                        icon = <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
                                        actionTitle = "Approved & Verified";
                                    } else if (log.action === 'rejected') {
                                        icon = <XCircle className="h-4 w-4 text-rose-500" />;
                                        actionTitle = "Rejected";
                                    }

                                    return (
                                        <div key={log.id} className="relative">
                                            <span className="absolute -left-[34px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border">
                                                {icon}
                                            </span>
                                            <div className="space-y-1">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-semibold text-foreground">{actionTitle}</span>
                                                        <span className="text-[10px] text-muted-foreground">• by {actor}</span>
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground font-mono">{dateStr}</span>
                                                </div>
                                                
                                                {log.action === 'updated' && log.previous_values && log.new_values && (
                                                    <div className="bg-background border rounded-lg p-2.5 text-[11px] space-y-1 w-full max-w-2xl text-muted-foreground leading-normal shadow-sm">
                                                        {Object.keys(log.new_values).map((key) => {
                                                            const prevVal = log.previous_values?.[key];
                                                            const newVal = log.new_values?.[key];
                                                            if (prevVal !== newVal) {
                                                                return (
                                                                    <div key={key} className="flex flex-wrap items-center gap-1">
                                                                        <span className="font-semibold text-foreground capitalize">{key.replace('_', ' ')}:</span>
                                                                        <span className="line-through text-rose-500/80 bg-rose-500/5 px-1 rounded truncate max-w-[200px]">{String(prevVal || "—")}</span>
                                                                        <span className="text-muted-foreground">→</span>
                                                                        <span className="text-emerald-600 bg-emerald-500/5 px-1 rounded truncate max-w-[200px]">{String(newVal || "—")}</span>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })}
                                                    </div>
                                                )}
                                                
                                                {log.action === 'rejected' && log.new_values?.rejection_reason && (
                                                    <p className="text-xs text-rose-600 bg-rose-500/5 border border-rose-500/10 rounded-lg p-2 max-w-2xl italic">
                                                        Reason: {log.new_values.rejection_reason}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Footer and Verification Actions */}
                <DialogFooter className="border-t pt-4 flex flex-col sm:flex-row sm:justify-between items-center gap-4">
                    <div className="flex gap-2">
                        {fileUrl && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={handleDownload}
                                >
                                    <Download className="h-4 w-4 mr-2" /> Download
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => window.open(fileUrl, "_blank")}
                                >
                                    <ExternalLink className="h-4 w-4 mr-2" /> Open in New Tab
                                </Button>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {showActions && document?.status === "pending" && (
                            <>
                                {!isRejecting ? (
                                    <>
                                        <Button
                                            variant="destructive"
                                            onClick={() => setIsRejecting(true)}
                                            className="px-5 font-semibold"
                                            disabled={isActionSubmitting}
                                        >
                                            <X className="h-4 w-4 mr-2" /> Reject
                                        </Button>
                                        <Button
                                            onClick={handleVerifyAction}
                                            className="px-5 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500"
                                            disabled={isActionSubmitting}
                                        >
                                            {isActionSubmitting ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Check className="h-4 w-4 mr-2" />
                                            )}
                                            Approve & Verify
                                        </Button>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2 w-full max-w-md">
                                        <input
                                            type="text"
                                            placeholder="Enter rejection reason..."
                                            value={rejectReason}
                                            onChange={(e) => setRejectReason(e.target.value)}
                                            className="flex-1 bg-background border border-rose-500/50 rounded px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-rose-500"
                                        />
                                        <Button
                                            variant="destructive"
                                            onClick={handleRejectAction}
                                            size="sm"
                                            disabled={isActionSubmitting}
                                        >
                                            Confirm Reject
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                setIsRejecting(false);
                                                setRejectReason("");
                                            }}
                                            size="sm"
                                            className="text-muted-foreground"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                        
                        {(!showActions || document?.status !== "pending") && (
                            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">
                                Close
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
