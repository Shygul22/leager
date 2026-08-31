import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

type Profile = {
    id: string;
    email: string | null;
    role: string | null;
    full_name?: string | null;
    company_name?: string | null;
    last_login?: string | null;
};

type AuthContextType = {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    role: string | null;
    loading: boolean;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                setProfile(data as Profile);
                setRole(data.role || "staff");
            } else {
                setRole("staff");
            }
        } catch (err) {
            console.error("Error fetching profile:", err);
            setRole("staff");
        }
    };

    // Stamp last_login in profiles whenever a user signs in
    const stampLastLogin = async (userId: string) => {
        try {
            await supabase
                .from("profiles")
                .update({ last_login: new Date().toISOString() })
                .eq("id", userId);
        } catch (err) {
            console.error("Failed to stamp last_login:", err);
        }
    };

    useEffect(() => {
        // Check active session on mount
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            if (currentUser) {
                fetchProfile(currentUser.id).finally(() => setLoading(false));
            } else {
                setLoading(false);
            }
        });

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            const currentUser = session?.user ?? null;
            setUser(currentUser);

            if (currentUser) {
                fetchProfile(currentUser.id);

                // Stamp last_login on every fresh sign-in
                if (event === "SIGNED_IN") {
                    stampLastLogin(currentUser.id);
                }
            } else {
                setProfile(null);
                setRole(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setRole(null);
    };

    return (
        <AuthContext.Provider value={{ session, user, profile, role, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
