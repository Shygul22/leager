import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Plus, X, Receipt, Trash2, Zap, ArrowLeftRight, CreditCard } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
    const { user, role, account, license, signOut } = useAuth();
    const isAdmin = role === "admin" || role === "super_admin";
    const [loading, setLoading] = useState(true);
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [profile, setProfile] = useState({
        company_name: "",
        address: "",
        gstin: "",
        invoice_prefix: "INV-",
        invoice_next_sequence: 1,
        hsn_prefix: "ZEN-",
        hsn_next_sequence: 1,
        auto_log_invoices: true,
        auth_person_name: "",
        auth_designation: "",
        signature_url: "",
        background_logo_url: "",
        background_logo_opacity: 5, // Default 5%
        default_currency: "INR",
        default_items: [] as any[],
        transaction_categories: [] as string[],
        payment_details: "",
        email: "",
        phone: "",
        pan: "",
        cin: "",
        website: "",
    });
    const [newCategory, setNewCategory] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [updatingPassword, setUpdatingPassword] = useState(false);

    useEffect(() => {
        async function getProfile() {
            try {
                if (!user) return;

                const { data, error } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", user.id)
                    .maybeSingle();

                if (error) throw error;
                if (data) {
                    let parsedItems = [];
                    if (data.default_items) {
                        try {
                            parsedItems = typeof data.default_items === "string" ? JSON.parse(data.default_items) : data.default_items;
                        } catch (e) { console.error("Could not parse default items"); }
                    }
                    let parsedCats = ["General", "Salary", "Food", "Transport", "Utilities", "Entertainment", "Health", "Shopping", "Other"];
                    if (data.transaction_categories) {
                        try {
                            const readCats = typeof data.transaction_categories === "string" ? JSON.parse(data.transaction_categories) : data.transaction_categories;
                            if (Array.isArray(readCats) && readCats.length > 0) {
                                parsedCats = readCats;
                            }
                        } catch (e) { console.error("Could not parse categories"); }
                    }
                    setProfile({
                        company_name: data.company_name || "",
                        address: data.address || "",
                        gstin: data.gstin || "",
                        invoice_prefix: data.invoice_prefix || "INV-",
                        invoice_next_sequence: data.invoice_next_sequence || 1,
                        hsn_prefix: data.hsn_prefix || "ZEN-",
                        hsn_next_sequence: data.hsn_next_sequence || 1,
                        auto_log_invoices: data.auto_log_invoices ?? true,
                        auth_person_name: data.auth_person_name || "",
                        auth_designation: data.auth_designation || "",
                        signature_url: data.signature_url || "",
                        background_logo_url: data.background_logo_url || "",
                        background_logo_opacity: data.background_logo_opacity ?? 5,
                        default_currency: data.default_currency || "INR",
                        default_items: parsedItems,
                        transaction_categories: parsedCats,
                        payment_details: data.payment_details || "Account Holder: ZenJourney Private Limited\nBank Name: State Bank of India (SBI)\nAccount Number: 45505327860\nBranch Name: Ulundurpet\nIFSC Code: SBIN0011071",
                        email: data.email || user?.email || "",
                        phone: data.phone || "",
                        pan: data.pan || "",
                        cin: data.cin || "",
                        website: data.website || "",
                    });
                }
            } catch (error: any) {
                toast.error("Error loading profile");
                console.error(error);
            } finally {
                setLoading(false);
            }
        }

        getProfile();
    }, [user]);

    const addItem = () => setProfile({ ...profile, default_items: [...profile.default_items, { description: "", quantity: 1, rate: 0, gst: 0 }] });
    const removeItem = (i: number) => setProfile({ ...profile, default_items: profile.default_items.filter((_, idx) => idx !== i) });
    const updateItem = (i: number, field: string, value: string | number) => {
        const items = [...profile.default_items];
        items[i][field] = value;
        setProfile({ ...profile, default_items: items });
    };

    const addCategory = () => {
        if (!newCategory.trim()) return;
        if (profile.transaction_categories.includes(newCategory.trim())) {
            toast.error("Category already exists");
            return;
        }
        setProfile({
            ...profile,
            transaction_categories: [...profile.transaction_categories, newCategory.trim()]
        });
        setNewCategory("");
    };

    const removeCategory = (index: number) => {
        setProfile({
            ...profile,
            transaction_categories: profile.transaction_categories.filter((_, i) => i !== index)
        });
    };

    async function updateProfile() {
        try {
            setLoading(true);
            const { error } = await supabase.from("profiles").upsert({
                id: user?.id,
                company_name: profile.company_name,
                address: profile.address,
                gstin: profile.gstin,
                invoice_prefix: profile.invoice_prefix,
                invoice_next_sequence: profile.invoice_next_sequence,
                hsn_prefix: profile.hsn_prefix,
                hsn_next_sequence: profile.hsn_next_sequence,
                auto_log_invoices: profile.auto_log_invoices,
                auth_person_name: profile.auth_person_name,
                auth_designation: profile.auth_designation,
                signature_url: profile.signature_url,
                background_logo_url: profile.background_logo_url,
                background_logo_opacity: profile.background_logo_opacity,
                default_currency: profile.default_currency,
                default_items: profile.default_items, // save as JSON array
                transaction_categories: profile.transaction_categories, // save as JSON array
                payment_details: profile.payment_details,
                email: profile.email,
                phone: profile.phone,
                pan: profile.pan,
                cin: profile.cin,
                website: profile.website,
                updated_at: new Date().toISOString(),
            });

            if (error) throw error;
            toast.success("Profile updated!");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }

    const handleUpdatePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            toast.error("Password must be at least 6 characters.");
            return;
        }
        setUpdatingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            toast.success("Password updated successfully!");
            setNewPassword("");
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setUpdatingPassword(false);
        }
    };

    const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 1024 * 1024) { // 1MB limit
            toast.error("Signature image must be less than 1MB");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setProfile({ ...profile, signature_url: reader.result as string });
        };
        reader.readAsDataURL(file);
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            toast.error("Logo image must be less than 2MB");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setProfile({ ...profile, background_logo_url: reader.result as string });
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <Button variant="destructive" onClick={signOut} className="w-full sm:w-auto">Sign Out</Button>
            </div>

            {isAdmin && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Branding & Signatures</CardTitle>
                            <CardDescription>Upload your logo for the invoice background and your electronic signature.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Background Print Logo</Label>
                                <p className="text-xs text-muted-foreground mb-2">This logo will be printed faintly in the center background of your invoices.</p>
                                <div className="flex items-center gap-4">
                                    {profile.background_logo_url?.trim() ? (
                                        <div className="relative border rounded-md p-2 bg-white flex items-center justify-center w-24 h-24">
                                            <img src={profile.background_logo_url} alt="Logo" className="max-w-full max-h-full object-contain mix-blend-multiply" />
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                                onClick={() => setProfile({ ...profile, background_logo_url: "" })}
                                                title="Remove Logo"
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted-foreground italic w-24 h-24 border border-dashed rounded flex flex-col items-center justify-center">No Logo</div>
                                    )}
                                    <div className="flex-1 space-y-4">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                            className="cursor-pointer"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Suggested: max 2MB, transparent PNG or clear JPEG.</p>
                                        
                                        {profile.background_logo_url?.trim() && (
                                            <div className="space-y-3 pt-2">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-sm border-none">Print Opacity (Faintness)</Label>
                                                    <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{profile.background_logo_opacity}%</span>
                                                </div>
                                                <Slider
                                                    value={[profile.background_logo_opacity]}
                                                    min={1}
                                                    max={20}
                                                    step={1}
                                                    onValueChange={(vals) => setProfile({ ...profile, background_logo_opacity: vals[0] })}
                                                />
                                                <p className="text-xs text-muted-foreground">Adjust how faint the background logo appears (1% to 20%).</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 pt-4 border-t">
                                <Label>E-Signature Image</Label>
                                <div className="flex items-center gap-4">
                                    {profile.signature_url?.trim() ? (
                                        <div className="relative border rounded-md p-2 bg-white">
                                            <img src={profile.signature_url} alt="Signature" className="h-12 object-contain" />
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                                onClick={() => setProfile({ ...profile, signature_url: "" })}
                                                title="Remove Signature"
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted-foreground italic">No signature uploaded</div>
                                    )}
                                    <div className="flex-1">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleSignatureUpload}
                                            className="cursor-pointer"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Suggested: max 1MB, transparent PNG.</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <ArrowLeftRight className="mr-2 h-5 w-5" />
                                Regional & Currency
                            </CardTitle>
                            <CardDescription>
                                Set your default currency for invoices and billing.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="default_currency">Default Currency</Label>
                                <Select
                                    value={profile.default_currency}
                                    onValueChange={(val) => setProfile({ ...profile, default_currency: val })}
                                >
                                    <SelectTrigger id="default_currency">
                                        <SelectValue placeholder="Select currency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="INR">INR (₹)</SelectItem>
                                        <SelectItem value="USD">USD ($)</SelectItem>
                                        <SelectItem value="EUR">EUR (€)</SelectItem>
                                        <SelectItem value="GBP">GBP (£)</SelectItem>
                                        <SelectItem value="AED">AED (د.إ)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Company Profile</CardTitle>
                            <CardDescription>Update your company details for invoices.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="company_name">Company Name</Label>
                                <Input
                                    id="company_name"
                                    value={profile.company_name}
                                    onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                                    placeholder="e.g. Acme Corp"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="gstin">GSTIN (Optional)</Label>
                                    <Input
                                        id="gstin"
                                        value={profile.gstin}
                                        onChange={(e) => setProfile({ ...profile, gstin: e.target.value })}
                                        placeholder="e.g. 27AAAAA0000A1Z5"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="pan">PAN</Label>
                                    <Input
                                        id="pan"
                                        value={profile.pan}
                                        onChange={(e) => setProfile({ ...profile, pan: e.target.value })}
                                        placeholder="e.g. ABCDE1234F"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="cin">CIN</Label>
                                    <Input
                                        id="cin"
                                        value={profile.cin}
                                        onChange={(e) => setProfile({ ...profile, cin: e.target.value })}
                                        placeholder="e.g. L01234MH2026PLC123456"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="website">Website</Label>
                                    <Input
                                        id="website"
                                        value={profile.website}
                                        onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                                        placeholder="e.g. www.acmecorp.com"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="auth_person_name">Authorized Person Name</Label>
                                    <Input
                                        id="auth_person_name"
                                        value={profile.auth_person_name}
                                        onChange={(e) => setProfile({ ...profile, auth_person_name: e.target.value })}
                                        placeholder="e.g. John Doe"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="auth_designation">Position / Designation</Label>
                                    <Input
                                        id="auth_designation"
                                        value={profile.auth_designation}
                                        onChange={(e) => setProfile({ ...profile, auth_designation: e.target.value })}
                                        placeholder="e.g. Director"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="profile_email">Email Address</Label>
                                <Input
                                    id="profile_email"
                                    type="email"
                                    value={profile.email}
                                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                    placeholder="e.g. info@company.com"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="profile_phone">Mobile Number</Label>
                                <Input
                                    id="profile_phone"
                                    type="text"
                                    value={profile.phone}
                                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                    placeholder="e.g. +91 98765 43210"
                                />
                            </div>

                            <div className="space-y-2 pt-4 border-t">
                                <Label htmlFor="address">Business Address</Label>
                                <Textarea
                                    id="address"
                                    value={profile.address}
                                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                                    placeholder="Full address for invoices..."
                                    className="min-h-[100px]"
                                />
                            </div>
                            <div className="space-y-2 pt-4 border-t">
                                <Label htmlFor="payment_details">Bank / Payment Details (Displays on Invoice)</Label>
                                <Textarea
                                    id="payment_details"
                                    value={profile.payment_details}
                                    onChange={(e) => setProfile({ ...profile, payment_details: e.target.value })}
                                    placeholder="Account Holder Name: ZenJourney Private Limited&#10;Bank Name: State Bank of India (SBI)&#10;Account Number: 45505327860&#10;Branch Name: Ulundurpet&#10;IFSC Code: SBIN0011071"
                                    className="min-h-[120px]"
                                />
                            </div>
                            <Button onClick={updateProfile} disabled={loading} className="w-full">
                                {loading ? "Saving..." : "Save Changes"}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" /> Workflow Automation</CardTitle>
                            <CardDescription>Configure automatic actions that occur when you create invoices.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between space-x-2">
                                <Label htmlFor="auto_log" className="flex flex-col space-y-1">
                                    <span>Auto-log Transactions</span>
                                    <span className="font-normal text-sm text-muted-foreground">Automatically create an income entry in the transactions ledger whenever an invoice is successfully created.</span>
                                </Label>
                                <Switch
                                    id="auto_log"
                                    checked={profile.auto_log_invoices}
                                    onCheckedChange={(v) => setProfile({ ...profile, auto_log_invoices: v })}
                                />
                            </div>
                        </CardContent>
                        <div className="border-t px-6 py-4">
                            <Button onClick={updateProfile} disabled={loading} className="w-full">
                                {loading ? "Saving..." : "Save Preferences"}
                            </Button>
                        </div>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Invoice Numbering Sequence</CardTitle>
                            <CardDescription>Configure how your invoices are automatically numbered.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="invoice_prefix">Prefix</Label>
                                    <Input
                                        id="invoice_prefix"
                                        value={profile.invoice_prefix}
                                        onChange={(e) => setProfile({ ...profile, invoice_prefix: e.target.value })}
                                        placeholder="e.g. ZEN-2026-"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="invoice_next_sequence">Next Sequence Number</Label>
                                    <Input
                                        id="invoice_next_sequence"
                                        type="number"
                                        min="1"
                                        value={profile.invoice_next_sequence}
                                        onChange={(e) => setProfile({ ...profile, invoice_next_sequence: parseInt(e.target.value) || 1 })}
                                    />
                                </div>
                            </div>
                            <div className="bg-secondary/30 p-3 rounded-md border border-border/50 text-sm">
                                <span className="text-muted-foreground mr-2">Preview of next invoice number:</span>
                                <span className="font-mono font-bold text-primary">{profile.invoice_prefix}{String(profile.invoice_next_sequence).padStart(3, '0')}</span>
                            </div>
                            <Button onClick={updateProfile} disabled={loading} className="w-full mt-2">
                                {loading ? "Saving..." : "Save Sequencing"}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>HSN/SAC Code Sequence</CardTitle>
                            <CardDescription>Configure how your product/service HSN/SAC codes are automatically numbered.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="hsn_prefix">Prefix</Label>
                                    <Input
                                        id="hsn_prefix"
                                        value={profile.hsn_prefix}
                                        onChange={(e) => setProfile({ ...profile, hsn_prefix: e.target.value })}
                                        placeholder="e.g. HSN-"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="hsn_next_sequence">Next Sequence Number</Label>
                                    <Input
                                        id="hsn_next_sequence"
                                        type="number"
                                        min="1"
                                        value={profile.hsn_next_sequence}
                                        onChange={(e) => setProfile({ ...profile, hsn_next_sequence: parseInt(e.target.value) || 1 })}
                                    />
                                </div>
                            </div>
                            <div className="bg-secondary/30 p-3 rounded-md border border-border/50 text-sm">
                                <span className="text-muted-foreground mr-2">Preview of next HSN code:</span>
                                <span className="font-mono font-bold text-primary">{profile.hsn_prefix}{String(profile.hsn_next_sequence).padStart(3, '0')}</span>
                            </div>
                            <Button onClick={updateProfile} disabled={loading} className="w-full mt-2">
                                {loading ? "Saving..." : "Save HSN Sequencing"}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Default Invoice Items</CardTitle>
                            <CardDescription>Configure line items that automatically appear when you create a new invoice.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <Label>Line Items</Label>
                                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add Item</Button>
                            </div>
                            <div className="space-y-2">
                                {profile.default_items.length === 0 && (
                                    <p className="text-sm text-muted-foreground italic text-center py-4">No default items set. Click Add Item.</p>
                                )}
                                {profile.default_items.map((item, i) => (
                                    <div key={i} className="flex gap-2 items-end">
                                        <div className="flex-1">
                                            <Input placeholder="Description" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
                                        </div>
                                        <div className="w-16">
                                            <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)} />
                                        </div>
                                        <div className="w-20">
                                            <Input type="number" step="0.01" placeholder="Rate" value={item.rate} onChange={(e) => updateItem(i, "rate", parseFloat(e.target.value) || 0)} />
                                        </div>
                                        <div className="w-20">
                                            <Select value={String(item.gst)} onValueChange={(v) => updateItem(i, "gst", parseFloat(v))}>
                                                <SelectTrigger className="h-10"><SelectValue placeholder="GST" /></SelectTrigger>
                                                <SelectContent>
                                                    {[0, 5, 12, 18, 28].map(rate => <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="w-24 text-right text-sm font-medium pt-2">
                                            ₹{(item.quantity * item.rate * (1 + item.gst / 100)).toFixed(2)}
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => removeItem(i)}><X className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                            </div>
                            <Button onClick={updateProfile} disabled={loading} className="w-full mt-4">
                                {loading ? "Saving..." : "Save Default Items"}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Transaction Categories</CardTitle>
                            <CardDescription>Manage the custom categories available when adding transactions.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2 items-center mb-4">
                                <Input
                                    placeholder="New Category Name (e.g. Subscriptions)"
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }}
                                />
                                <Button onClick={addCategory} variant="outline" size="sm">
                                    <Plus className="h-4 w-4 mr-1" /> Add
                                </Button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {profile.transaction_categories.map((cat, i) => (
                                    <div key={i} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm">
                                        <span>{cat}</span>
                                        <button onClick={() => removeCategory(i)} className="text-muted-foreground hover:text-destructive transition-colors rounded-full p-0.5 ml-1">
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                                {profile.transaction_categories.length === 0 && (
                                    <p className="text-sm text-muted-foreground italic w-full">No active categories. Add some above!</p>
                                )}
                            </div>

                            <Button onClick={updateProfile} disabled={loading} className="w-full mt-4">
                                {loading ? "Saving..." : "Save Categories"}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Subscription & Billing Card for Account Admin */}
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <CreditCard className="h-5 w-5 text-primary" /> Company Subscription & Billing
                                </CardTitle>
                                <CardDescription>Manage subscription plans, view company billing, and upgrade your plan.</CardDescription>
                            </div>
                            <Badge variant={account?.status === 'active' ? 'default' : 'destructive'} className="text-xs px-3 py-1 uppercase font-bold">
                                {account?.status || 'Active'}
                            </Badge>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-background p-4 rounded-xl border">
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase">Assigned Account</p>
                                    <p className="text-base font-bold text-foreground mt-1">{account?.company_name || profile.company_name || 'My Company'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase">Current Active Plan</p>
                                    <Badge variant="outline" className="mt-1 font-bold text-primary border-primary">
                                        {account?.plan || 'Starter'} Plan
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase">License Status</p>
                                    <p className="text-sm font-semibold text-foreground mt-1">{license?.expiry_date ? format(new Date(license.expiry_date), 'dd MMM yyyy') : 'Lifetime / Active'}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-foreground">Available Plans (INR pricing)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {[
                                        { name: "Starter", price: "₹2,999", period: "/month", users: "Up to 5 Users", storage: "5GB Storage", features: ["Standard Ledger", "Basic Tax Reports", "Quotation & Invoicing"] },
                                        { name: "Professional", price: "₹7,999", period: "/month", users: "Up to 25 Users", storage: "50GB Storage", features: ["Advanced Analytics", "Custom Roles", "Audit Trail Logs", "Priority Support"] },
                                        { name: "Enterprise", price: "₹19,999", period: "/month", users: "Unlimited Users", storage: "500GB Storage", features: ["Multi-Account Portal", "Custom RLS Policies", "Dedicated Account Manager", "Unlimited API Integrations"] }
                                    ].map((planItem) => {
                                        const isCurrent = (account?.plan || "Starter").toLowerCase() === planItem.name.toLowerCase();
                                        return (
                                            <div key={planItem.name} className={`p-4 rounded-xl border transition-all ${isCurrent ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary' : 'border-border bg-card'}`}>
                                                <div className="flex justify-between items-center mb-2">
                                                    <h5 className="font-bold text-base">{planItem.name}</h5>
                                                    {isCurrent && <Badge className="bg-primary text-primary-foreground text-xs">Current Plan</Badge>}
                                                </div>
                                                <div className="mb-3">
                                                    <span className="text-2xl font-extrabold text-foreground">{planItem.price}</span>
                                                    <span className="text-xs text-muted-foreground">{planItem.period}</span>
                                                </div>
                                                <ul className="text-xs space-y-1.5 text-muted-foreground mb-4">
                                                    <li className="font-medium text-foreground">✓ {planItem.users}</li>
                                                    <li className="font-medium text-foreground">✓ {planItem.storage}</li>
                                                    {planItem.features.map((f, i) => (
                                                        <li key={i}>✓ {f}</li>
                                                    ))}
                                                </ul>
                                                <Button 
                                                    disabled={isCurrent || isUpgrading} 
                                                    onClick={async () => {
                                                        if (!account?.id) {
                                                            toast.error("No active account selected");
                                                            return;
                                                        }
                                                        setIsUpgrading(true);
                                                        try {
                                                            const { error } = await supabase.from("accounts").update({ plan: planItem.name }).eq("id", account.id);
                                                            if (error) throw error;
                                                            await supabase.from("audit_logs").insert([{
                                                                user_id: user?.id,
                                                                user_email: user?.email,
                                                                account_id: account.id,
                                                                action: `Subscription changed to ${planItem.name}`,
                                                                module: "Billing",
                                                                status: "SUCCESS"
                                                            }]);
                                                            toast.success(`Upgraded to ${planItem.name} plan successfully!`);
                                                            window.location.reload();
                                                        } catch (err: any) {
                                                            toast.error(err.message || "Failed to upgrade subscription");
                                                        } finally {
                                                            setIsUpgrading(false);
                                                        }
                                                    }} 
                                                    variant={isCurrent ? "outline" : "default"} 
                                                    className="w-full text-xs font-semibold"
                                                >
                                                    {isCurrent ? "Active Plan" : `Upgrade to ${planItem.name}`}
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}


            <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader>
                    <CardTitle className="text-destructive">Security & Account</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <p className="text-sm text-muted-foreground mb-4">Email: {user?.email}</p>
                        <p className="text-xs text-muted-foreground">User ID: {user?.id}</p>
                    </div>
                    <div className="space-y-4 pt-4 border-t border-destructive/10">
                        <h4 className="text-sm font-semibold text-destructive">Change Password</h4>
                        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center max-w-sm">
                            <Input 
                                type="password" 
                                autoComplete="new-password"
                                placeholder="New password (min 6 characters)" 
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="border-destructive/20 focus-visible:ring-destructive/30"
                            />
                            <Button variant="destructive" onClick={handleUpdatePassword} disabled={updatingPassword}>
                                {updatingPassword ? "Updating..." : "Update"}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">You will be logged out of other devices after changing your password.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
