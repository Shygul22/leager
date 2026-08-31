import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowRight, ShieldCheck, Users, Lock, Mail, Building2, Globe } from "lucide-react";

export default function Auth() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const navigate = useNavigate();

    // Check if already logged in
    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                navigate("/");
            }
        };
        checkUser();
    }, [navigate]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                toast.success("Check your email for the confirmation link!");
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                toast.success("Login successful!");
                navigate("/");
            }
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

    const handleResetPassword = async () => {
        if (!email) {
            toast.error("Please enter your email address first.");
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/settings`,
            });
            if (error) throw error;
            toast.success("Password reset link sent! Check your email.");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
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
                                        <h3 className="text-lg font-bold text-gray-900">Manager Login</h3>
                                        <p className="text-sm text-gray-400">Access your business dashboard</p>
                                    </div>

                                    <form onSubmit={handleAuth} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="email" className="text-gray-700 ml-1 font-medium">Email Address</Label>
                                            <div className="relative group">
                                                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    autoComplete="username"
                                                    placeholder="m@example.com"
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
                                                    onClick={handleResetPassword}
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
                
                <div className="mt-8 text-center">
                    <p className="text-xs text-gray-400">© 2026 ZENJOURNEY PRIVATE LIMITED. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
}
