import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowRight, ShieldCheck, Lock, Mail, Building2, Globe, CheckCircle2, KeyRound, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function Auth() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [isUnconfirmed, setIsUnconfirmed] = useState(false);
    const [unconfirmedEmail, setUnconfirmedEmail] = useState("");
    const navigate = useNavigate();

    // Forgot Password Modal State
    const [forgotModalOpen, setForgotModalOpen] = useState(false);
    const [resetEmail, setResetEmail] = useState("");
    const [isSendingReset, setIsSendingReset] = useState(false);

    // Password Reset Recovery Screen State
    const [isRecoveryMode, setIsRecoveryMode] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    // Check session or recovery mode on mount
    useEffect(() => {
        const checkUserAndHash = async () => {
            // Check URL hash or search params for password recovery link
            const hash = window.location.hash;
            const search = window.location.search;
            if (hash.includes("type=recovery") || search.includes("type=recovery") || search.includes("reset=true")) {
                setIsRecoveryMode(true);
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (session && !isRecoveryMode) {
                navigate("/");
            }
        };

        checkUserAndHash();

        // Listen for PASSWORD_RECOVERY auth event
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY") {
                setIsRecoveryMode(true);
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setIsUnconfirmed(false);

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                if (error.message?.toLowerCase().includes("email not confirmed")) {
                    setIsUnconfirmed(true);
                    setUnconfirmedEmail(email);
                    throw new Error("Your email address is not verified yet. Please check your inbox or resend the verification link.");
                }
                throw error;
            }
            toast.success("Login successful!");
            navigate("/");
        } catch (error: any) {
            console.error(error);
            if (error.message === "Failed to fetch") {
                toast.error("Network error: Could not connect to Supabase.");
            } else {
                toast.error(error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResendVerification = async () => {
        const targetEmail = unconfirmedEmail || email;
        if (!targetEmail) {
            toast.error("Please enter your email address first.");
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.resend({
                type: "signup",
                email: targetEmail,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth`,
                }
            });
            if (error) throw error;
            toast.success(`Verification email sent to ${targetEmail}! Please check your inbox and spam folder.`);
        } catch (err: any) {
            toast.error(err.message || "Failed to resend verification email.");
        } finally {
            setLoading(false);
        }
    };

    const handleSendPasswordReset = async () => {
        const targetEmail = resetEmail.trim() || email.trim();
        if (!targetEmail) {
            toast.error("Please enter a valid email address.");
            return;
        }
        setIsSendingReset(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
                redirectTo: `${window.location.origin}/auth?reset=true`,
            });
            if (error) throw error;
            toast.success(`Password reset instructions sent to ${targetEmail}! Please check your inbox and spam folder.`);
            setForgotModalOpen(false);
            setResetEmail("");
        } catch (err: any) {
            toast.error(err.message || "Failed to send password reset email.");
        } finally {
            setIsSendingReset(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters long.");
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match. Please try again.");
            return;
        }

        setIsUpdatingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            toast.success("Password updated successfully! You can now log in.");
            setIsRecoveryMode(false);
            navigate("/");
        } catch (err: any) {
            toast.error(err.message || "Failed to update password.");
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const [loginId, setLoginId] = useState("");
    const [loginEmail, setLoginEmail] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);

    const handlePortalLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedId = loginId.trim();
        const trimmedEmail = loginEmail.trim();

        if (!trimmedId || !trimmedEmail) {
            toast.error("Please enter both Client ID and Email");
            return;
        }

        setIsVerifying(true);
        try {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedId);
            
            let query = supabase.from("clients").select("*").ilike("email", trimmedEmail);
            if (isUUID) {
                query = query.or(`client_number.ilike.${trimmedId},id.eq.${trimmedId}`);
            } else {
                query = query.ilike("client_number", trimmedId);
            }

            const { data, error } = await query.maybeSingle();

            if (error) throw error;

            if (data) {
                sessionStorage.setItem("active_portal_client", JSON.stringify(data));
                toast.success(`Welcome back, ${data.name}!`);
                navigate(`/portal/${data.client_number || data.id}`);
                return;
            }

            const { data: altData } = await supabase
                .from("clients")
                .select("client_number, id")
                .ilike("email", trimmedEmail);
            
            if (altData && altData.length > 0) {
                toast.error(`Invalid Client ID. Please check your credentials.`);
            } else {
                toast.error("No client found with these credentials.");
            }

        } catch (err: any) {
            console.error("Portal Login Error:", err);
            toast.error(err.message);
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-50 p-4 sm:p-6 lg:p-8">
            {/* Subtle ambient blobs */}
            <div className="absolute top-[-5%] left-[-5%] w-[35%] h-[35%] bg-blue-100 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-5%] right-[-5%] w-[35%] h-[35%] bg-emerald-100 rounded-full blur-[100px]" />
            
            <div className="relative z-10 w-full max-w-lg">

                {/* Password Recovery Mode (Set New Password) */}
                {isRecoveryMode ? (
                    <Card className="border border-blue-200 bg-white shadow-xl shadow-blue-500/10 overflow-hidden">
                        <CardHeader className="text-center bg-blue-50/50 border-b border-blue-100 py-6">
                            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-white shadow-md">
                                <KeyRound className="h-6 w-6" />
                            </div>
                            <CardTitle className="text-xl font-bold text-gray-900">Set New Password</CardTitle>
                            <CardDescription className="text-xs text-gray-500 mt-1">
                                Enter your new account password below to complete password recovery.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                            <form onSubmit={handleUpdatePassword} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="new-password">New Password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                        <Input
                                            id="new-password"
                                            type={showNewPassword ? "text" : "password"}
                                            placeholder="Minimum 6 characters"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                            className="pl-10 pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                        >
                                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                        <Input
                                            id="confirm-password"
                                            type={showNewPassword ? "text" : "password"}
                                            placeholder="Re-enter password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            className="pl-10"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isUpdatingPassword || newPassword.length < 6}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 shadow-md"
                                >
                                    {isUpdatingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Update Password & Sign In"}
                                </Button>
                            </form>
                        </CardContent>
                        <CardFooter className="bg-gray-50 border-t p-4 text-center justify-center">
                            <button
                                onClick={() => setIsRecoveryMode(false)}
                                className="text-xs font-semibold text-gray-500 hover:text-blue-600"
                            >
                                Back to Login Screen
                            </button>
                        </CardFooter>
                    </Card>
                ) : (
                    /* Main Login Tabs */
                    <Card className="border border-gray-200 bg-white shadow-xl shadow-gray-200/60 overflow-hidden ring-0">
                        <CardHeader className="p-0">
                            <Tabs defaultValue="staff" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 rounded-none bg-gray-100/80 h-14 p-1 border-b border-gray-200">
                                    <TabsTrigger 
                                        value="staff" 
                                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all duration-300 text-gray-500 font-semibold"
                                    >
                                        <ShieldCheck className="h-4 w-4 mr-2" />
                                        Staff Portal
                                    </TabsTrigger>
                                    <TabsTrigger 
                                        value="client" 
                                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all duration-300 text-gray-500 font-semibold"
                                    >
                                        <Globe className="h-4 w-4 mr-2" />
                                        Client Portal
                                    </TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="staff" className="p-8 outline-none">
                                    <div className="space-y-6">
                                        <div className="text-center">
                                            <h3 className="text-lg font-bold text-gray-900">Manager & Staff Login</h3>
                                            <p className="text-sm text-gray-400">Access your business ledger dashboard</p>
                                        </div>

                                        {isUnconfirmed && (
                                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-2">
                                                <div className="flex items-center gap-1.5 font-bold">
                                                    <AlertCircle className="h-4 w-4 text-amber-600" />
                                                    Email Verification Pending
                                                </div>
                                                <p>Your email address ({unconfirmedEmail}) has not been verified yet.</p>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleResendVerification}
                                                    disabled={loading}
                                                    className="w-full text-xs bg-white text-amber-800 border-amber-300 hover:bg-amber-100"
                                                >
                                                    {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Mail className="h-3 w-3 mr-1" />}
                                                    Resend Verification Link
                                                </Button>
                                            </div>
                                        )}

                                        <form onSubmit={handleAuth} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="email" className="text-gray-700 ml-1 font-medium">Email Address</Label>
                                                <div className="relative group">
                                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                                    <Input
                                                        id="email"
                                                        type="email"
                                                        autoComplete="username"
                                                        placeholder="admin@example.com"
                                                        value={email}
                                                        onChange={(e) => setEmail(e.target.value)}
                                                        required
                                                        className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-400/40 focus-visible:border-blue-400"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label htmlFor="password" className="text-gray-700 ml-1 font-medium">Password</Label>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            setResetEmail(email);
                                                            setForgotModalOpen(true);
                                                        }}
                                                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                                                    >
                                                        Forgot Password?
                                                    </button>
                                                </div>
                                                <div className="relative group">
                                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                                    <Input
                                                        id="password"
                                                        type="password"
                                                        autoComplete="current-password"
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        required
                                                        className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-400/40 focus-visible:border-blue-400"
                                                    />
                                                </div>
                                            </div>
                                            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 transition-all shadow-md shadow-blue-200" type="submit" disabled={loading}>
                                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign In Securely"}
                                            </Button>
                                        </form>

                                        <div className="pt-2 text-center">
                                            <button
                                                type="button"
                                                onClick={handleResendVerification}
                                                className="text-xs text-slate-500 hover:text-blue-600 font-medium"
                                            >
                                                Didn't receive verification email? <span className="underline">Resend Email</span>
                                            </button>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="client" className="p-8 outline-none">
                                    <div className="space-y-6">
                                        <div className="text-center">
                                            <h3 className="text-lg font-bold text-gray-900">Client Access</h3>
                                            <p className="text-sm text-gray-400">View your invoices and projects</p>
                                        </div>

                                        <form onSubmit={handlePortalLogin} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="clientId" className="text-gray-700 ml-1 font-medium">Client ID</Label>
                                                <div className="relative group">
                                                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                                                    <Input
                                                        id="clientId"
                                                        placeholder="e.g. ZENCI-001"
                                                        value={loginId}
                                                        onChange={(e) => setLoginId(e.target.value)}
                                                        required
                                                        className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-emerald-400/40 focus-visible:border-emerald-400"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="portalEmail" className="text-gray-700 ml-1 font-medium">Registered Email</Label>
                                                <div className="relative group">
                                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                                                    <Input
                                                        id="portalEmail"
                                                        type="email"
                                                        placeholder="your@email.com"
                                                        value={loginEmail}
                                                        onChange={(e) => setLoginEmail(e.target.value)}
                                                        required
                                                        className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-emerald-400/40 focus-visible:border-emerald-400"
                                                    />
                                                </div>
                                            </div>
                                            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 transition-all shadow-md shadow-emerald-200" type="submit" disabled={isVerifying}>
                                                {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                                                Access My Portal
                                            </Button>
                                        </form>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardHeader>
                        <CardFooter className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center">
                            <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-semibold">Protected by Secure Ledger Protocol</p>
                        </CardFooter>
                    </Card>
                )}
                
                <div className="mt-8 text-center">
                    <p className="text-xs text-gray-400">© 2026 ZENJOURNEY PRIVATE LIMITED. All rights reserved.</p>
                </div>
            </div>

            {/* Forgot Password Modal */}
            <Dialog open={forgotModalOpen} onOpenChange={setForgotModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-blue-600">
                            <KeyRound className="h-5 w-5" /> Forgot Your Password?
                        </DialogTitle>
                        <DialogDescription>
                            Enter your registered email address and we'll send you a password reset link.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                        <div className="space-y-2">
                            <Label htmlFor="reset-email">Registered Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="reset-email"
                                    type="email"
                                    placeholder="your@company.com"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setForgotModalOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleSendPasswordReset}
                            disabled={isSendingReset || !resetEmail}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                        >
                            {isSendingReset ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                            Send Password Reset Link
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
