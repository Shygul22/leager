import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, UserCog, Mail, Search, RefreshCcw, Plus, Trash2, Edit, Sliders, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

type Profile = {
    id: string;
    email: string | null;
    role: string | null;
    company_name: string | null;
    full_name?: string | null;
    last_login?: string | null;
    account_id?: string | null;
};

type CustomRole = {
    id: string;
    account_id: string | null;
    name: string;
    description: string | null;
    permissions: Record<string, Record<string, boolean>>;
    created_at: string;
};

const ROLES = [
    { value: "admin", label: "Administrator", color: "bg-red-500" },
    { value: "accounts_manager", label: "Accounts Manager", color: "bg-blue-600" },
    { value: "project_manager", label: "Project Manager", color: "bg-amber-600" },
    { value: "staff", label: "Staff", color: "bg-emerald-600" },
    { value: "ticket_support", label: "Support Ticket", color: "bg-purple-600" },
    { value: "client", label: "Client", color: "bg-slate-600" },
];

const MODULES = [
    "Dashboard", "Transactions", "Tax Reports", "Shareholders", "Dividends",
    "Bills", "Expenses", "Suppliers", "Payouts", "Employees",
    "Clients", "Lead Tracking", "Products", "Quotations", "Invoices",
    "Projects", "Documents", "Tickets", "User Roles", "Access Directory",
    "Settings", "Billing"
];

const ACTIONS = ["View", "Create", "Edit", "Delete", "Export", "Approve"];

export default function Roles() {
    const { user, profile: currentUserProfile, role: currentUserRole, account } = useAuth();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [addOpen, setAddOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [customRoleOpen, setCustomRoleOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
    
    const [newEmail, setNewEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newRole, setNewRole] = useState("staff");
    const [isAdding, setIsAdding] = useState(false);

    const [editForm, setEditForm] = useState({
        full_name: "",
        company_name: "",
        email: ""
    });

    // Custom Role Builder State
    const [customRoleName, setCustomRoleName] = useState("");
    const [customRoleDesc, setCustomRoleDesc] = useState("");
    const [permissionsState, setPermissionsState] = useState<Record<string, Record<string, boolean>>>(() => {
        const initial: Record<string, Record<string, boolean>> = {};
        MODULES.forEach(mod => {
            initial[mod] = { View: true, Create: false, Edit: false, Delete: false, Export: false, Approve: false };
        });
        return initial;
    });

    const togglePermission = (module: string, action: string) => {
        setPermissionsState(prev => ({
            ...prev,
            [module]: {
                ...prev[module],
                [action]: !prev[module]?.[action]
            }
        }));
    };

    const handleAddUser = async () => {
        setIsAdding(true);
        try {
            const userCompany = currentUserProfile?.company_name || account?.company_name || "ZenJourney InfoTech";
            const { data, error } = await supabase.auth.signUp({
                email: newEmail,
                password: newPassword,
                options: {
                    data: {
                        role: newRole,
                        company_name: userCompany
                    }
                }
            });

            if (error) throw error;

            if (data?.user) {
                const activeAccId = account?.id || currentUserProfile?.account_id || null;
                await supabase
                    .from("profiles")
                    .update({
                        role: newRole,
                        email: newEmail,
                        company_name: userCompany,
                        account_id: activeAccId
                    })
                    .eq("id", data.user.id);

                if (activeAccId) {
                    await supabase.from("user_account_memberships").upsert([{
                        user_id: data.user.id,
                        account_id: activeAccId,
                        role: newRole,
                        status: "active"
                    }], { onConflict: "user_id,account_id" });
                }

                await supabase.from("audit_logs").insert([{
                    account_id: activeAccId,
                    actor_id: user?.id,
                    actor_email: user?.email,
                    action: "Create User Account",
                    module: "User Roles",
                    target: newEmail,
                    details: { role: newRole }
                }]);
                
                toast.success("User account created! They can now log in.");
                setAddOpen(false);
                setNewEmail("");
                setNewPassword("");
                refetch();
            }
        } catch (err) {
            const error = err as Error;
            toast.error(error.message);
        } finally {
            setIsAdding(false);
        }
    };

    const { data: profiles = [], isLoading, refetch } = useQuery({
        queryKey: ["all_profiles"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .order("email", { ascending: true });

            if (error) throw error;
            return data as Profile[];
        },
        enabled: currentUserRole === "admin" || currentUserRole === "super_admin",
    });

    const { data: customRoles = [] } = useQuery({
        queryKey: ["custom_roles", account?.id],
        queryFn: async () => {
            let query = supabase.from("custom_roles").select("*").order("created_at", { ascending: false });
            if (currentUserRole !== "super_admin" && account?.id) {
                query = query.eq("account_id", account.id);
            }
            const { data, error } = await query;
            if (error) return [];
            return data as CustomRole[];
        },
        enabled: currentUserRole === "admin" || currentUserRole === "super_admin",
    });

    const createCustomRoleMutation = useMutation({
        mutationFn: async () => {
            if (!customRoleName) throw new Error("Role name is required");
            const { error } = await supabase.from("custom_roles").insert([{
                account_id: account?.id || null,
                name: customRoleName,
                description: customRoleDesc,
                permissions: permissionsState
            }]);

            if (error) throw error;

            await supabase.from("audit_logs").insert([{
                account_id: account?.id || null,
                actor_id: user?.id,
                actor_email: user?.email,
                action: "Create Custom Role",
                module: "Role & Permission Builder",
                target: customRoleName,
                details: { description: customRoleDesc }
            }]);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["custom_roles"] });
            toast.success(`Custom Role "${customRoleName}" created successfully!`);
            setCustomRoleOpen(false);
            setCustomRoleName("");
            setCustomRoleDesc("");
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to create custom role");
        }
    });

    const updateRole = useMutation({
        mutationFn: async ({ id, role }: { id: string, role: string }) => {
            const { error } = await supabase
                .from("profiles")
                .update({ role })
                .eq("id", id);
            
            if (error) throw error;

            await supabase.from("audit_logs").insert([{
                account_id: account?.id || null,
                actor_id: user?.id,
                actor_email: user?.email,
                action: "Update User Role",
                module: "User Roles",
                target: id,
                details: { new_role: role }
            }]);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["all_profiles"] });
            toast.success("User role updated successfully");
        },
        onError: (error) => {
            const err = error as Error;
            toast.error(err.message || "Failed to update role");
        }
    });

    const updateProfile = useMutation({
        mutationFn: async () => {
            if (!editingProfile) return;
            const { error } = await supabase
                .from("profiles")
                .update({
                    full_name: editForm.full_name,
                    company_name: editForm.company_name,
                    email: editForm.email
                })
                .eq("id", editingProfile.id);
            
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["all_profiles"] });
            toast.success("User profile updated successfully");
            setEditOpen(false);
        },
        onError: (error) => {
            const err = error as Error;
            toast.error(err.message || "Failed to update profile");
        }
    });

    const deleteProfile = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("profiles")
                .delete()
                .eq("id", id);
            
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["all_profiles"] });
            toast.success("User access revoked successfully");
        },
        onError: (error) => {
            const err = error as Error;
            toast.error(err.message || "Failed to revoke access");
        }
    });

    const filteredProfiles = profiles.filter(p => {
        if (currentUserRole !== "super_admin" && (p.role === "super_admin" || p.email?.toLowerCase() === "shyguldigital@gmail.com")) {
            return false;
        }

        if (currentUserRole !== "super_admin") {
            const myAccountId = account?.id || currentUserProfile?.account_id;
            const myCompany = (currentUserProfile?.company_name || account?.company_name || "").trim().toLowerCase();

            if (p.id === user?.id) return true;

            const profileAccountId = p.account_id;
            const profileCompany = (p.company_name || "").trim().toLowerCase();

            const matchesAccount = Boolean(myAccountId && profileAccountId && profileAccountId === myAccountId);
            const matchesCompany = Boolean(myCompany && profileCompany && profileCompany === myCompany);

            if (myAccountId || myCompany) {
                if (!matchesAccount && !matchesCompany) {
                    return false;
                }
            }
        }

        const query = search.toLowerCase();
        return (
            !query ||
            (p.email?.toLowerCase().includes(query)) ||
            (p.full_name?.toLowerCase().includes(query)) ||
            (p.id.toLowerCase().includes(query)) ||
            (p.role?.toLowerCase().includes(query))
        );
    });

    const allRoleOptions = useMemo(() => {
        const builtIn = ROLES.map(r => ({ value: r.value, label: r.label, isCustom: false }));
        const custom = customRoles.map(cr => ({
            value: cr.name,
            label: `${cr.name} (Custom Role)`,
            isCustom: true
        }));
        return [...builtIn, ...custom];
    }, [customRoles]);

    const getRoleBadge = (roleValue: string | null) => {
        if (!roleValue) return <Badge className="bg-slate-400 text-white">Unknown</Badge>;
        const foundBuiltIn = ROLES.find(r => r.value === roleValue || r.label.toLowerCase() === roleValue.toLowerCase());
        if (foundBuiltIn) {
            return <Badge className={`${foundBuiltIn.color} text-white`}>{foundBuiltIn.label}</Badge>;
        }
        const foundCustom = customRoles.find(cr => cr.name.toLowerCase() === roleValue.toLowerCase());
        if (foundCustom) {
            return <Badge className="bg-indigo-600 text-white font-semibold">{foundCustom.name} (Custom)</Badge>;
        }
        return <Badge className="bg-purple-600 text-white">{roleValue}</Badge>;
    };

    const openEdit = (profile: Profile) => {
        setEditingProfile(profile);
        setEditForm({
            full_name: profile.full_name || "",
            company_name: profile.company_name || "",
            email: profile.email || ""
        });
        setEditOpen(true);
    };

    if (currentUserRole !== "admin" && currentUserRole !== "super_admin") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <ShieldCheck className="h-16 w-16 text-destructive mb-4 opacity-20" />
                <h1 className="text-3xl font-bold">Access Denied</h1>
                <p className="text-muted-foreground mt-2">Only administrators can manage user roles and permissions.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Sliders className="h-6 w-6 text-primary" /> Role & Permission Builder
                    </h1>
                    <p className="text-muted-foreground">Assign access levels and construct custom module permissions.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => refetch()}>
                        <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Sync
                    </Button>
                    <Button onClick={() => setCustomRoleOpen(true)} variant="secondary">
                        <Sliders className="h-4 w-4 mr-2 text-primary" /> Create Custom Role
                    </Button>
                    <Button onClick={() => setAddOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Add User
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="user-roles" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="user-roles">User Account Roles</TabsTrigger>
                    <TabsTrigger value="custom-roles">Custom Roles & Permission Matrix</TabsTrigger>
                </TabsList>

                <TabsContent value="user-roles" className="mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between gap-4">
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Search by name, email or UID..." 
                                        className="pl-9"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    Total Users: {filteredProfiles.length}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User ID / Email</TableHead>
                                        <TableHead>Current Role</TableHead>
                                        <TableHead>Permissions</TableHead>
                                        <TableHead>Last Login</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                                Fetching user profiles...
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredProfiles.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                                No users found matching your search.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredProfiles.map((profile) => (
                                            <TableRow key={profile.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                                                            <UserCog className="h-5 w-5 text-primary" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-sm">{profile.full_name || profile.email || "No Name"}</span>
                                                            <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{profile.email}</span>
                                                            <span className="text-[10px] font-mono text-muted-foreground/50">{profile.id.substring(0, 8)}...</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {updateRole.isPending && updateRole.variables?.id === profile.id ? (
                                                        <Badge variant="outline" className="animate-pulse bg-muted">Syncing...</Badge>
                                                    ) : (
                                                        getRoleBadge(profile.role)
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs font-semibold">
                                                            {profile.role === "admin" ? "Full Control" : 
                                                             profile.role === "accounts_manager" ? "Operational Support" :
                                                             profile.role === "project_manager" ? "Project Tracking" :
                                                             profile.role === "staff" ? "Sales Operations" :
                                                             profile.role === "ticket_support" ? "Customer Support" :
                                                             "Guest Access"}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground leading-tight">
                                                            {profile.role === "admin" ? "Complete access to finances, reports, and settings." : 
                                                             profile.role === "accounts_manager" ? "Can manage clients, invoices, and suppliers." :
                                                             profile.role === "project_manager" ? "Access to clients and project quotations." :
                                                             profile.role === "staff" ? "Can create invoices, products, and see clients." :
                                                             profile.role === "ticket_support" ? "Access to support tickets and bug reports." :
                                                             "View-only access or portal restricted."}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {profile.last_login 
                                                        ? format(parseISO(profile.last_login), "dd MMM yyyy, hh:mm a")
                                                        : "Never"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8"
                                                            onClick={() => openEdit(profile)}
                                                            title="Edit Profile"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>

                                                         <Select 
                                                            defaultValue={profile.role || "staff"} 
                                                            onValueChange={(val) => updateRole.mutate({ id: profile.id, role: val })}
                                                            disabled={profile.id === user?.id}
                                                        >
                                                            <SelectTrigger className="w-[160px] h-8 text-xs">
                                                                <SelectValue placeholder="Change Role" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {allRoleOptions.map(r => (
                                                                    <SelectItem key={r.value} value={r.value}>
                                                                        {r.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        
                                                        {profile.id !== user?.id && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => {
                                                                    if (confirm(`Are you sure you want to revoke access for ${profile.email}?`)) {
                                                                        deleteProfile.mutate(profile.id);
                                                                    }
                                                                }}
                                                                title="Revoke Access"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                    {profile.id === user?.id && (
                                                        <div className="text-[10px] text-muted-foreground mt-1 pr-2 italic">You cannot change your own role.</div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="custom-roles" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Custom Roles & Permission Builder Matrix</CardTitle>
                            <CardDescription>
                                Create tailor-made organizational roles (e.g. Finance Manager, Sales Manager, Accountant, HR Manager) with granular action permissions.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {customRoles.length === 0 ? (
                                <div className="text-center py-12 border border-dashed rounded-lg">
                                    <Sliders className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                                    <h3 className="text-lg font-semibold">No Custom Roles Created Yet</h3>
                                    <p className="text-sm text-muted-foreground mb-4">Build custom role templates for your team with module-level controls.</p>
                                    <Button onClick={() => setCustomRoleOpen(true)}>
                                        <Plus className="h-4 w-4 mr-2" /> Create Custom Role
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {customRoles.map(cr => (
                                        <Card key={cr.id} className="border">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-base flex items-center justify-between">
                                                    <span>{cr.name}</span>
                                                    <Badge variant="outline" className="text-[10px]">Custom Role</Badge>
                                                </CardTitle>
                                                <CardDescription className="text-xs">{cr.description || "No description provided."}</CardDescription>
                                            </CardHeader>
                                            <CardContent className="pt-2 text-xs space-y-1">
                                                <div className="font-semibold text-muted-foreground text-[10px] uppercase">Allowed Modules:</div>
                                                <div className="flex flex-wrap gap-1">
                                                    {Object.entries(cr.permissions || {}).filter(([_, p]) => p.View).slice(0, 5).map(([mod]) => (
                                                        <Badge key={mod} variant="secondary" className="text-[10px]">{mod}</Badge>
                                                    ))}
                                                    {Object.entries(cr.permissions || {}).filter(([_, p]) => p.View).length > 5 && (
                                                        <Badge variant="outline" className="text-[10px]">+{Object.entries(cr.permissions || {}).filter(([_, p]) => p.View).length - 5} more</Badge>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Custom Role Builder Modal */}
            <Dialog open={customRoleOpen} onOpenChange={setCustomRoleOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sliders className="h-5 w-5 text-primary" /> Visual Role & Permission Builder Matrix
                        </DialogTitle>
                        <DialogDescription>
                            Configure exact permissions (`View`, `Create`, `Edit`, `Delete`, `Export`, `Approve`) for each module.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Role Name *</Label>
                                <Input 
                                    placeholder="e.g. Finance Manager"
                                    value={customRoleName}
                                    onChange={(e) => setCustomRoleName(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Description</Label>
                                <Input 
                                    placeholder="e.g. Full access to transactions & tax reports"
                                    value={customRoleDesc}
                                    onChange={(e) => setCustomRoleDesc(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="border rounded-md overflow-hidden mt-4">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-[200px]">Module</TableHead>
                                        {ACTIONS.map(act => (
                                            <TableHead key={act} className="text-center">{act}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {MODULES.map(mod => (
                                        <TableRow key={mod} className="hover:bg-muted/30">
                                            <TableCell className="font-semibold text-xs">{mod}</TableCell>
                                            {ACTIONS.map(act => (
                                                <TableCell key={act} className="text-center">
                                                    <Checkbox 
                                                        checked={!!permissionsState[mod]?.[act]}
                                                        onCheckedChange={() => togglePermission(mod, act)}
                                                    />
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCustomRoleOpen(false)}>Cancel</Button>
                        <Button 
                            onClick={() => createCustomRoleMutation.mutate()}
                            disabled={createCustomRoleMutation.isPending || !customRoleName}
                        >
                            {createCustomRoleMutation.isPending ? "Saving..." : "Save Custom Role"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add User Modal */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>
                            Create a new staff or admin account. They will be able to log in with these credentials.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="add-email">Email Address</Label>
                            <Input 
                                id="add-email" 
                                type="email" 
                                placeholder="staff@example.com"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="add-password">Temporary Password</Label>
                            <Input 
                                id="add-password" 
                                type="password" 
                                autoComplete="new-password"
                                placeholder="Minimum 6 characters"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Initial Role</Label>
                            <Select value={newRole} onValueChange={setNewRole}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {allRoleOptions.map(r => (
                                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                        <Button 
                            onClick={() => handleAddUser()} 
                            disabled={isAdding || !newEmail || newPassword.length < 6}
                        >
                            {isAdding ? "Creating..." : "Create User"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit User Modal */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit User Profile</DialogTitle>
                        <DialogDescription>
                            Update the public details for this user account.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Full Name</Label>
                            <Input 
                                id="edit-name" 
                                value={editForm.full_name}
                                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                placeholder="e.g. John Doe"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-company">Company Name</Label>
                            <Input 
                                id="edit-company" 
                                value={editForm.company_name}
                                onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                                placeholder="e.g. Acme Corp"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-email">Email Address (Profile)</Label>
                            <Input 
                                id="edit-email" 
                                type="email"
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                placeholder="email@example.com"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                        <Button 
                            onClick={() => updateProfile.mutate()} 
                            disabled={updateProfile.isPending}
                        >
                            {updateProfile.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
