import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Auth() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const navigate = useNavigate();

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
                navigate("/");
            }
        } catch (error: any) {
            console.error(error);
            if (error.message === "Failed to fetch") {
                toast.error("Network error: Could not connect to Supabase. Please check your internet or if the Supabase project is active.");
            } else {
                toast.error(error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold">{isSignUp ? "Create an account" : "Sign in"}</CardTitle>
                    <CardDescription>
                        {isSignUp ? "Enter your email to create your company account" : "Enter your email to access your account"}
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleAuth}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="m@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4">
                        <Button className="w-full" type="submit" disabled={loading}>
                            {loading ? "Processing..." : isSignUp ? "Sign Up" : "Sign In"}
                        </Button>
                        <Button
                            variant="link"
                            className="text-sm text-muted-foreground"
                            onClick={() => setIsSignUp(!isSignUp)}
                            type="button"
                        >
                            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
