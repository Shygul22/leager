import { useState } from "react";
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
import { ShieldCheck, UserCog, Mail, Search, RefreshCcw, Plus, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

type Profile = {
    id: string;
    email: string | null;
    role: string | null;
    company_name: string | null;
    full_name?: string | null;
    last_login?: string | null;
};

const ROLES = [
    { value: "admin", label: "Administrator", color: "bg-red-500" },
    { value: "accounts_manager", label: "Accounts Manager", color: "bg-blue-600" },
    { value: "project_manager", label: "Project Manager", color: "bg-amber-600" },
    { value: "staff", label: "Staff", color: "bg-emerald-600" },
    { value: "ticket_support", label: "Support Ticket", color: "bg-purple-600" },
    { value: "client", label: "Client", color: "bg-slate-600" },
];

export default function Roles() {
    const { user, role: currentUserRole } = useAuth();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [addOpen, setAddOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
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

    const handleAddUser = async () => {
        setIsAdding(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email: newEmail,
                password: newPassword,
                options: {
                    data: {
                        role: newRole
                    }
                }
            });

            if (error) throw error;

            if (data?.user) {
                // Manually update the profile role if the trigger hasn't finished
                await supabase
                    .from("profiles")
                    .update({ role: newRole, email: newEmail })
                    .eq("id", data.user.id);
                
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
        enabled: currentUserRole === "admin",
    });

    const updateRole = useMutation({
        mutationFn: async ({ id, role }: { id: string, role: string }) => {
            const { error } = await supabase
                .from("profiles")
                .update({ role })
                .eq("id", id);
            
            if (error) throw error;
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

    const filteredProfiles = profiles.filter(p => 
        (p.email?.toLowerCase().includes(search.toLowerCase())) ||
        (p.full_name?.toLowerCase().includes(search.toLowerCase())) ||
        (p.id.toLowerCase().includes(search.toLowerCase()))
    );

    const getRoleBadge = (roleValue: string | null) => {
        const r = ROLES.find(r => r.value === roleValue) || { label: roleValue || "Unknown", color: "bg-slate-400" };
        return <Badge className={`${r.color} text-white`}>{r.label}</Badge>;
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

    if (currentUserRole !== "admin") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <ShieldCheck className="h-16 w-16 text-destructive mb-4 opacity-20" />
                <h1 className="text-3xl font-bold">Access Denied</h1>
                <p className="text-muted-foreground mt-2">Only administrators can manage user roles.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Role Management</h1>
                    <p className="text-muted-foreground">Assign and manage access levels for all registered users.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => refetch()}>
                        <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Sync
                    </Button>
                    <Button onClick={() => setAddOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Add User
                    </Button>
                </div>
            </div>

            {/* Add User Dialog */}
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
                                    {ROLES.map(r => (
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

            {/* Edit User Dialog */}
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
                            Total Users: {profiles.length}
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
                                                    disabled={profile.id === user?.id} // Prevent self-demotion
                                                >
                                                    <SelectTrigger className="w-[140px] h-8 text-xs">
                                                        <SelectValue placeholder="Change Role" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {ROLES.map(r => (
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
                                                            if (confirm(`Are you sure you want to revoke access for ${profile.email}? This will remove their profile and role.`)) {
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
        </div>
    );
}
