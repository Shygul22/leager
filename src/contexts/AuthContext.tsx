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
    account_id?: string | null;
    is_active?: boolean;
};

type AccountDetails = {
    id: string;
    company_name: string;
    plan: string;
    status: 'active' | 'suspended' | 'expired';
    user_limit: number;
};

type LicenseDetails = {
    id: string;
    license_key: string;
    status: 'pending' | 'active' | 'suspended' | 'expired';
    expiry_date: string | null;
    start_date: string | null;
};

type AuthContextType = {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    role: string | null;
    account: AccountDetails | null;
    license: LicenseDetails | null;
    accountStatus: string;
    licenseStatus: string;
    impersonatedAccount: AccountDetails | null;
    impersonateAccount: (acc: AccountDetails) => void;
    exitImpersonation: () => void;
    loading: boolean;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [account, setAccount] = useState<AccountDetails | null>(null);
    const [license, setLicense] = useState<LicenseDetails | null>(null);
    const [accountStatus, setAccountStatus] = useState<string>("active");
    const [licenseStatus, setLicenseStatus] = useState<string>("active");
    const [impersonatedAccount, setImpersonatedAccount] = useState<AccountDetails | null>(null);
    const [loading, setLoading] = useState(true);

    // Load active impersonation on mount if stored in sessionStorage
    useEffect(() => {
        const storedImpersonation = sessionStorage.getItem("super_admin_impersonated_account");
        if (storedImpersonation) {
            try {
                const parsed = JSON.parse(storedImpersonation);
                setImpersonatedAccount(parsed);
                setAccount(parsed);
            } catch (e) {
                sessionStorage.removeItem("super_admin_impersonated_account");
            }
        }
    }, []);

    const fetchProfileAndLicense = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                const userProfile = data as Profile;
                setProfile(userProfile);
                const isSuperAdminEmail = userProfile.email?.toLowerCase() === "shyguldigital@gmail.com";
                const userRole = isSuperAdminEmail ? "super_admin" : (userProfile.role || "staff");
                setRole(userRole);

                // If Super Admin is currently impersonating an account, prioritize impersonated account details
                const storedImpersonation = sessionStorage.getItem("super_admin_impersonated_account");
                if (storedImpersonation && (isSuperAdminEmail || userRole === "super_admin")) {
                    const parsed = JSON.parse(storedImpersonation);
                    setAccount(parsed);
                    setImpersonatedAccount(parsed);
                    setAccountStatus("active");
                    setLicenseStatus("active");
                    return;
                }

                // Fetch Account & License details if account_id is present
                if (userProfile.account_id) {
                    const { data: accData } = await supabase
                        .from("accounts")
                        .select("*")
                        .eq("id", userProfile.account_id)
                        .maybeSingle();

                    if (accData) {
                        setAccount(accData as AccountDetails);
                        setAccountStatus(accData.status || "active");

                        const { data: licData } = await supabase
                            .from("licenses")
                            .select("*")
                            .eq("account_id", accData.id)
                            .order("created_at", { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        if (licData) {
                            setLicense(licData as LicenseDetails);
                            setLicenseStatus(licData.status || "pending");
                        } else {
                            setLicense(null);
                            setLicenseStatus(isSuperAdminEmail || userRole === "super_admin" ? "active" : "pending");
                        }
                    } else {
                        setAccount(null);
                        setAccountStatus(isSuperAdminEmail || userRole === "super_admin" ? "active" : "pending");
                        setLicenseStatus(isSuperAdminEmail || userRole === "super_admin" ? "active" : "pending");
                    }
                } else {
                    setAccount(null);
                    setLicense(null);
                    setAccountStatus(isSuperAdminEmail || userRole === "super_admin" ? "active" : "pending");
                    setLicenseStatus(isSuperAdminEmail || userRole === "super_admin" ? "active" : "pending");
                }
            } else {
                setRole("staff");
                setAccountStatus("pending");
                setLicenseStatus("pending");
            }
        } catch (err) {
            console.error("Error fetching profile and license:", err);
            setRole("staff");
        }
    };

    const impersonateAccount = (acc: AccountDetails) => {
        sessionStorage.setItem("super_admin_impersonated_account", JSON.stringify(acc));
        setImpersonatedAccount(acc);
        setAccount(acc);
        if (profile) {
            setProfile({
                ...profile,
                company_name: acc.company_name
            });
        }
    };

    const exitImpersonation = () => {
        sessionStorage.removeItem("super_admin_impersonated_account");
        setImpersonatedAccount(null);
        if (user) {
            fetchProfileAndLicense(user.id);
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
                fetchProfileAndLicense(currentUser.id).finally(() => setLoading(false));
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
                fetchProfileAndLicense(currentUser.id);

                // Stamp last_login on every fresh sign-in
                if (event === "SIGNED_IN") {
                    stampLastLogin(currentUser.id);
                }
            } else {
                setProfile(null);
                setRole(null);
                setAccount(null);
                setLicense(null);
                setImpersonatedAccount(null);
                sessionStorage.removeItem("super_admin_impersonated_account");
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        sessionStorage.removeItem("super_admin_impersonated_account");
        await supabase.auth.signOut();
        setProfile(null);
        setRole(null);
        setAccount(null);
        setLicense(null);
        setImpersonatedAccount(null);
    };

    return (
        <AuthContext.Provider value={{ session, user, profile, role, account, license, accountStatus, licenseStatus, impersonatedAccount, impersonateAccount, exitImpersonation, loading, signOut }}>
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
