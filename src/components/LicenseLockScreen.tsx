import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ShieldAlert, Key, Loader2, Check, LogOut } from "lucide-react";
import { toast } from "sonner";
import { addMonths } from "date-fns";

export function LicenseLockScreen() {
    const { user, licenseStatus, accountStatus, signOut } = useAuth();
    const [modalOpen, setModalOpen] = useState(false);
    const [licenseKeyInput, setLicenseKeyInput] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleActivateLicense = async () => {
        const cleanKey = licenseKeyInput.trim();
        if (!cleanKey) {
            toast.error("Please enter a valid license key.");
            return;
        }

        if (!user) {
            toast.error("User session expired. Please sign in again.");
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Search for license key in DB
            const { data: licData, error: licErr } = await supabase
                .from("licenses")
                .select("*, accounts(*)")
                .eq("license_key", cleanKey)
                .maybeSingle();

            if (licErr) throw licErr;

            if (!licData) {
                toast.error("Invalid license key. Please check and try again.");
                setIsSubmitting(false);
                return;
            }

            if (licData.status === "suspended") {
                toast.error("This license key has been suspended. Please contact support.");
                setIsSubmitting(false);
                return;
            }

            if (licData.status === "expired") {
                toast.error("This license key has expired.");
                setIsSubmitting(false);
                return;
            }

            // 2. Link user profile to account_id
            const { error: profileErr } = await supabase
                .from("profiles")
                .update({ account_id: licData.account_id })
                .eq("id", user.id);

            if (profileErr) throw profileErr;

            // 3. If license is pending, activate it
            if (licData.status === "pending") {
                const startDate = new Date();
                const expiryDate = addMonths(startDate, licData.duration_months || 12);

                await supabase
                    .from("licenses")
                    .update({
                        status: "active",
                        start_date: startDate.toISOString(),
                        expiry_date: expiryDate.toISOString(),
                    })
                    .eq("id", licData.id);

                if (licData.account_id) {
                    await supabase.from("accounts").update({ status: "active" }).eq("id", licData.account_id);
                }
            }

            toast.success("License key validated & activated! Reloading portal access...");
            setModalOpen(false);

            setTimeout(() => {
                window.location.reload();
            }, 800);

        } catch (err: any) {
            console.error("Error activating license key:", err);
            toast.error(err.message || "Failed to activate license key.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[65vh] text-center p-6">
            <div className="w-20 h-20 bg-amber-500/10 dark:bg-amber-500/20 rounded-full flex items-center justify-center mb-6">
                <ShieldAlert className="h-10 w-10 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 mb-2">Portal Access Gated</h1>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
                {licenseStatus === 'pending'
                    ? "Your account requires an active license key to access the portal."
                    : licenseStatus === 'expired'
                    ? "Your account license has expired. Please enter a new license key or renew your subscription."
                    : "Your company account or license status is suspended."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
                <Button
                    onClick={() => setModalOpen(true)}
                    size="lg"
                    className="rounded-full px-8 bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/25 gap-2"
                >
                    <Key className="h-4 w-4" /> Enter License Key
                </Button>
                <Button
                    variant="outline"
                    onClick={() => signOut()}
                    size="lg"
                    className="rounded-full px-8 gap-2"
                >
                    <LogOut className="h-4 w-4" /> Sign Out
                </Button>
            </div>

            {/* License Key Entry Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                            <Key className="h-5 w-5 text-purple-600" />
                            Activate License Key
                        </DialogTitle>
                        <DialogDescription>
                            Enter the unique license key (`LIC-XXXX-XXXX-XXXX`) provided by your Super Admin to unlock your portal access.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                        <div>
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">License Key</Label>
                            <Input
                                placeholder="LIC-A1B2-C3D4-E5F6"
                                value={licenseKeyInput}
                                onChange={(e) => setLicenseKeyInput(e.target.value.toUpperCase())}
                                className="font-mono text-center tracking-widest text-lg py-5 uppercase font-bold mt-1"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleActivateLicense}
                            disabled={isSubmitting || !licenseKeyInput.trim()}
                            className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Activate License
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
