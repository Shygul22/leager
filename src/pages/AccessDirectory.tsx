import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, Lock, ChevronRight, Settings2, FolderOpen, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DocumentFolder } from "@/types/document";
import { toast } from "sonner";

// ─── Role Definitions ─────────────────────────────────────────────────────────
const AVAILABLE_ROLES = [
    { id: "admin",            label: "Administrator" },
    { id: "accounts_manager", label: "Accounts Manager" },
    { id: "project_manager",  label: "Project Manager" },
    { id: "staff",            label: "Staff" },
    { id: "ticket_support",   label: "Support Ticket" },
    { id: "client",           label: "Client" },
];

// ─── Operations ───────────────────────────────────────────────────────────────
const OPERATIONS_FEATURES: {
    module: string; icon: string;
    pageRoles: string[];
    features: { name: string; roles: string[] }[];
}[] = [
    { module: "Dashboard",        icon: "📊", pageRoles: ["admin","accounts_manager","staff","project_manager"],
      features: [
        { name: "View KPI Cards",           roles: ["admin","accounts_manager","staff","project_manager"] },
        { name: "View Revenue Chart",       roles: ["admin","accounts_manager"] },
        { name: "View Recent Transactions", roles: ["admin","accounts_manager"] },
      ]},
    { module: "Clients",          icon: "👥", pageRoles: ["admin","project_manager"],
      features: [
        { name: "View Clients List", roles: ["admin","project_manager"] },
        { name: "Create Client",     roles: ["admin"] },
        { name: "Edit Client",       roles: ["admin"] },
        { name: "Delete Client",     roles: ["admin"] },
      ]},
    { module: "Service Catalog",  icon: "📦", pageRoles: ["admin","staff"],
      features: [
        { name: "View Products",  roles: ["admin","staff"] },
        { name: "Add Product",    roles: ["admin"] },
        { name: "Edit Product",   roles: ["admin"] },
        { name: "Delete Product", roles: ["admin"] },
      ]},
    { module: "Quotations",       icon: "📋", pageRoles: ["admin","project_manager","staff"],
      features: [
        { name: "View Quotations",    roles: ["admin","project_manager","staff"] },
        { name: "Create Quotation",   roles: ["admin","project_manager","staff"] },
        { name: "Edit Quotation",     roles: ["admin","project_manager"] },
        { name: "Delete Quotation",   roles: ["admin"] },
        { name: "Convert to Invoice", roles: ["admin","project_manager"] },
      ]},
    { module: "Invoices",         icon: "🧾", pageRoles: ["admin","staff"],
      features: [
        { name: "View Invoices",  roles: ["admin","staff"] },
        { name: "Create Invoice", roles: ["admin","staff"] },
        { name: "Edit Invoice",   roles: ["admin"] },
        { name: "Delete Invoice", roles: ["admin"] },
        { name: "Mark as Paid",   roles: ["admin","accounts_manager"] },
        { name: "Send to Client", roles: ["admin","staff"] },
      ]},
    { module: "Transactions",     icon: "💳", pageRoles: ["admin","accounts_manager"],
      features: [
        { name: "View Transactions",  roles: ["admin","accounts_manager"] },
        { name: "Add Transaction",    roles: ["admin","accounts_manager"] },
        { name: "Edit Transaction",   roles: ["admin"] },
        { name: "Delete Transaction", roles: ["admin"] },
        { name: "Export CSV",         roles: ["admin","accounts_manager"] },
      ]},
    { module: "Projects",         icon: "🏗️", pageRoles: ["admin","project_manager"],
      features: [
        { name: "View Projects",  roles: ["admin","project_manager"] },
        { name: "Create Project", roles: ["admin","project_manager"] },
        { name: "Edit Project",   roles: ["admin","project_manager"] },
        { name: "Delete Project", roles: ["admin"] },
        { name: "Assign Members", roles: ["admin","project_manager"] },
      ]},
    { module: "Bills",            icon: "📑", pageRoles: ["admin","accounts_manager"],
      features: [
        { name: "View Bills",   roles: ["admin","accounts_manager"] },
        { name: "Add Bill",     roles: ["admin","accounts_manager"] },
        { name: "Edit Bill",    roles: ["admin"] },
        { name: "Delete Bill",  roles: ["admin"] },
        { name: "Mark as Paid", roles: ["admin","accounts_manager"] },
      ]},
    { module: "Tax Reports",      icon: "📈", pageRoles: ["admin","accounts_manager"],
      features: [
        { name: "View Reports",   roles: ["admin","accounts_manager"] },
        { name: "Export PDF/CSV", roles: ["admin","accounts_manager"] },
      ]},
    { module: "Documents Library",icon: "📁", pageRoles: ["admin","accounts_manager","project_manager","staff"],
      features: [
        { name: "View Folders",       roles: ["admin","accounts_manager","project_manager","staff"] },
        { name: "Upload Document",    roles: ["admin","accounts_manager","project_manager","staff"] },
        { name: "Edit Metadata",      roles: ["admin","accounts_manager"] },
        { name: "Verify Document",    roles: ["admin","accounts_manager"] },
        { name: "Reject Document",    roles: ["admin","accounts_manager"] },
        { name: "Delete Document",    roles: ["admin","accounts_manager"] },
        { name: "Create Folder",      roles: ["admin","accounts_manager","project_manager","staff"] },
        { name: "Edit Folder Access", roles: ["admin","accounts_manager"] },
      ]},
    { module: "Support Tickets",  icon: "🎫", pageRoles: ["admin","ticket_support"],
      features: [
        { name: "View Tickets",  roles: ["admin","ticket_support"] },
        { name: "Create Ticket", roles: ["admin","ticket_support"] },
        { name: "Reply / Notes", roles: ["admin","ticket_support"] },
        { name: "Close Ticket",  roles: ["admin"] },
        { name: "Delete Ticket", roles: ["admin"] },
      ]},
    { module: "Bug Tracker",      icon: "🐛", pageRoles: ["admin","project_manager","ticket_support"],
      features: [
        { name: "View Bugs",   roles: ["admin","project_manager","ticket_support"] },
        { name: "Report Bug",  roles: ["admin","project_manager","ticket_support"] },
        { name: "Assign Bug",  roles: ["admin","project_manager"] },
        { name: "Resolve Bug", roles: ["admin","project_manager"] },
        { name: "Delete Bug",  roles: ["admin"] },
      ]},
    { module: "Client Portal",    icon: "🌐", pageRoles: ["client"],
      features: [
        { name: "View Own Invoices",   roles: ["client"] },
        { name: "View Own Quotations", roles: ["client"] },
        { name: "Download Documents",  roles: ["client"] },
      ]},
    { module: "Role Management",  icon: "🛡️", pageRoles: ["admin"],
      features: [
        { name: "View All Users",  roles: ["admin"] },
        { name: "Assign Roles",    roles: ["admin"] },
        { name: "View Last Login", roles: ["admin"] },
        { name: "Delete User",     roles: ["admin"] },
      ]},
];

// ─── Management ───────────────────────────────────────────────────────────────
const MANAGEMENT_FEATURES: {
    module: string; icon: string;
    pageRoles: string[];
    features: { name: string; roles: string[] }[];
}[] = [
    { module: "Employee Management", icon: "👤", pageRoles: ["admin"],
      features: [
        { name: "View Employee List",    roles: ["admin"] },
        { name: "Add Employee",          roles: ["admin"] },
        { name: "Edit Employee Details", roles: ["admin"] },
        { name: "Delete Employee",       roles: ["admin"] },
        { name: "View Salary Info",      roles: ["admin","accounts_manager"] },
        { name: "Export Employee Data",  roles: ["admin"] },
      ]},
    { module: "Supplier Management", icon: "🏭", pageRoles: ["admin","accounts_manager"],
      features: [
        { name: "View Suppliers",      roles: ["admin","accounts_manager"] },
        { name: "Add Supplier",        roles: ["admin"] },
        { name: "Edit Supplier",       roles: ["admin"] },
        { name: "Delete Supplier",     roles: ["admin"] },
        { name: "View Supplier Bills", roles: ["admin","accounts_manager"] },
      ]},
    { module: "Financial Reports",   icon: "📊", pageRoles: ["admin","accounts_manager"],
      features: [
        { name: "View P&L Report",    roles: ["admin","accounts_manager"] },
        { name: "View Balance Sheet", roles: ["admin","accounts_manager"] },
        { name: "View Cash Flow",     roles: ["admin","accounts_manager"] },
        { name: "Export Tax Reports", roles: ["admin","accounts_manager"] },
        { name: "View GST Summary",   roles: ["admin","accounts_manager"] },
      ]},
    { module: "User & Role Management", icon: "🛡️", pageRoles: ["admin"],
      features: [
        { name: "View All Users",       roles: ["admin"] },
        { name: "Assign / Change Role", roles: ["admin"] },
        { name: "View Last Login",      roles: ["admin"] },
        { name: "Invite User",          roles: ["admin"] },
        { name: "Remove User",          roles: ["admin"] },
        { name: "View Audit Logs",      roles: ["admin"] },
      ]},
    { module: "Audit & Compliance",  icon: "🔍", pageRoles: ["admin","accounts_manager"],
      features: [
        { name: "View Document Audit Trail", roles: ["admin","accounts_manager"] },
        { name: "View Login History",        roles: ["admin"] },
        { name: "View Role Change Logs",     roles: ["admin"] },
        { name: "Export Audit Report",       roles: ["admin"] },
      ]},
    { module: "Notifications & Alerts", icon: "🔔", pageRoles: ["admin","accounts_manager","project_manager","staff","ticket_support"],
      features: [
        { name: "Receive System Alerts",     roles: ["admin","accounts_manager","project_manager","staff","ticket_support"] },
        { name: "Manage Notification Prefs", roles: ["admin","accounts_manager","project_manager","staff","ticket_support"] },
        { name: "Send Broadcast",            roles: ["admin"] },
      ]},
    { module: "System Settings",     icon: "⚙️", pageRoles: ["admin"],
      features: [
        { name: "Company Profile",   roles: ["admin"] },
        { name: "Tax Configuration", roles: ["admin"] },
        { name: "Currency Settings", roles: ["admin"] },
        { name: "Invoice Template",  roles: ["admin"] },
        { name: "Integrations",      roles: ["admin"] },
      ]},
];

// ─── Shared Feature Matrix Component ─────────────────────────────────────────
type FeatureSection = {
    module: string; icon: string;
    pageRoles: string[];
    features: { name: string; roles: string[] }[];
}[];

function FeatureMatrix({
    data, accentClass, expandedModules, setExpandedModules, prefix, onToggle,
}: {
    data: FeatureSection;
    accentClass: string;
    expandedModules: Set<string>;
    setExpandedModules: (s: Set<string>) => void;
    prefix: string;
    onToggle: (moduleIndex: number, roleId: string, featureIndex?: number) => void;
}) {
    const toggle = (key: string) => {
        const next = new Set(expandedModules);
        if (next.has(key)) next.delete(key); else next.add(key);
        setExpandedModules(next);
    };
    const allExpanded = data.every(op => expandedModules.has(`${prefix}-${op.module}`));

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b bg-muted/10 sticky top-0 z-10">
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground min-w-[240px]">
                            <div className="flex items-center justify-between gap-3">
                                <span>Module / Feature</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const next = new Set(expandedModules);
                                        if (allExpanded) {
                                            data.forEach(op => next.delete(`${prefix}-${op.module}`));
                                        } else {
                                            data.forEach(op => next.add(`${prefix}-${op.module}`));
                                        }
                                        setExpandedModules(next);
                                    }}
                                    className="text-[10px] text-blue-500 hover:underline font-semibold whitespace-nowrap"
                                >
                                    {allExpanded ? "Collapse All" : "Expand All"}
                                </button>
                            </div>
                        </th>
                        {AVAILABLE_ROLES.map(r => (
                            <th key={r.id} className="text-center px-3 py-3 font-semibold text-muted-foreground whitespace-nowrap text-[10px]">
                                {r.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((op, moduleIndex) => {
                        const key = `${prefix}-${op.module}`;
                        const isExpanded = expandedModules.has(key);
                        return (
                            <Fragment key={key}>
                                <tr
                                    className="border-b bg-muted/5 cursor-pointer hover:bg-muted/20 transition-colors"
                                    onClick={() => toggle(key)}
                                >
                                    <td className="px-4 py-3 font-bold text-foreground">
                                        <span className="flex items-center gap-2">
                                            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`} />
                                            <span className="text-base leading-none">{op.icon}</span>
                                            {op.module}
                                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-1 font-normal">
                                                {op.features.length} features
                                            </Badge>
                                        </span>
                                    </td>
                                    {AVAILABLE_ROLES.map(r => {
                                        const has = op.pageRoles.includes(r.id);
                                        return (
                                            <td 
                                                key={r.id} 
                                                className="text-center px-3 py-3 cursor-pointer hover:bg-muted/50 transition-colors select-none"
                                                title={`Click to ${has ? 'revoke' : 'grant'} ${r.label} access to ${op.module}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggle(moduleIndex, r.id);
                                                }}
                                            >
                                                {has
                                                    ? <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full ${accentClass} hover:scale-110 active:scale-95 transition-transform`}><Check className="h-3 w-3" /></span>
                                                    : <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-muted text-muted-foreground/20 hover:scale-110 active:scale-95 transition-transform"><Lock className="h-3 w-3" /></span>
                                                }
                                            </td>
                                        );
                                    })}
                                </tr>
                                {isExpanded && op.features.map((feat, fi) => (
                                    <tr key={`${key}-${fi}`} className="border-b last:border-0 bg-background hover:bg-muted/10 transition-colors">
                                        <td className="px-4 py-1.5 text-muted-foreground pl-14 flex items-center gap-2">
                                            <span className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                                            {feat.name}
                                        </td>
                                        {AVAILABLE_ROLES.map(r => {
                                            const allowed = feat.roles.includes(r.id);
                                            return (
                                                <td 
                                                    key={r.id} 
                                                    className="text-center px-3 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors select-none"
                                                    title={`Click to ${allowed ? 'revoke' : 'grant'} ${r.label} access to ${feat.name}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onToggle(moduleIndex, r.id, fi);
                                                    }}
                                                >
                                                    {allowed
                                                        ? <span className={`inline-flex items-center justify-center h-4 w-4 rounded ${accentClass} hover:scale-110 active:scale-95 transition-transform`}><Check className="h-2.5 w-2.5" /></span>
                                                        : <span className="inline-flex items-center justify-center h-4 w-4 rounded bg-transparent text-muted-foreground/15 hover:scale-110 active:scale-95 transition-transform"><Lock className="h-2.5 w-2.5" /></span>
                                                    }
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AccessDirectory() {
    const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
    const [activeSection, setActiveSection] = useState<"operations" | "folders" | "management">("operations");
    
    const [opsData, setOpsData] = useState(OPERATIONS_FEATURES);
    const [mgmtData, setMgmtData] = useState(MANAGEMENT_FEATURES);

    const queryClient = useQueryClient();

    const handleOpsToggle = (moduleIndex: number, roleId: string, featureIndex?: number) => {
        const roleObj = AVAILABLE_ROLES.find(r => r.id === roleId);
        const roleLabel = roleObj?.label || roleId;
        let targetName = "";
        let isGranted = false;

        setOpsData(prev => {
            const newData = [...prev];
            newData[moduleIndex] = { ...newData[moduleIndex] };
            
            if (featureIndex !== undefined) {
                newData[moduleIndex].features = [...newData[moduleIndex].features];
                newData[moduleIndex].features[featureIndex] = { ...newData[moduleIndex].features[featureIndex] };
                const roles = newData[moduleIndex].features[featureIndex].roles;
                targetName = newData[moduleIndex].features[featureIndex].name;
                if (roles.includes(roleId)) {
                    newData[moduleIndex].features[featureIndex].roles = roles.filter(id => id !== roleId);
                    isGranted = false;
                } else {
                    newData[moduleIndex].features[featureIndex].roles = [...roles, roleId];
                    isGranted = true;
                }
            } else {
                const roles = newData[moduleIndex].pageRoles;
                targetName = newData[moduleIndex].module;
                if (roles.includes(roleId)) {
                    newData[moduleIndex].pageRoles = roles.filter(id => id !== roleId);
                    isGranted = false;
                } else {
                    newData[moduleIndex].pageRoles = [...roles, roleId];
                    isGranted = true;
                }
            }
            return newData;
        });

        if (isGranted) {
            toast.success(`Granted access to "${targetName}" for ${roleLabel}`);
        } else {
            toast.info(`Revoked access to "${targetName}" for ${roleLabel}`);
        }
    };

    const handleMgmtToggle = (moduleIndex: number, roleId: string, featureIndex?: number) => {
        const roleObj = AVAILABLE_ROLES.find(r => r.id === roleId);
        const roleLabel = roleObj?.label || roleId;
        let targetName = "";
        let isGranted = false;

        setMgmtData(prev => {
            const newData = [...prev];
            newData[moduleIndex] = { ...newData[moduleIndex] };
            
            if (featureIndex !== undefined) {
                newData[moduleIndex].features = [...newData[moduleIndex].features];
                newData[moduleIndex].features[featureIndex] = { ...newData[moduleIndex].features[featureIndex] };
                const roles = newData[moduleIndex].features[featureIndex].roles;
                targetName = newData[moduleIndex].features[featureIndex].name;
                if (roles.includes(roleId)) {
                    newData[moduleIndex].features[featureIndex].roles = roles.filter(id => id !== roleId);
                    isGranted = false;
                } else {
                    newData[moduleIndex].features[featureIndex].roles = [...roles, roleId];
                    isGranted = true;
                }
            } else {
                const roles = newData[moduleIndex].pageRoles;
                targetName = newData[moduleIndex].module;
                if (roles.includes(roleId)) {
                    newData[moduleIndex].pageRoles = roles.filter(id => id !== roleId);
                    isGranted = false;
                } else {
                    newData[moduleIndex].pageRoles = [...roles, roleId];
                    isGranted = true;
                }
            }
            return newData;
        });

        if (isGranted) {
            toast.success(`Granted access to "${targetName}" for ${roleLabel}`);
        } else {
            toast.info(`Revoked access to "${targetName}" for ${roleLabel}`);
        }
    };

    const toggleFolderRole = useMutation({
        mutationFn: async ({ folderId, currentRoles, roleId, folderName }: { folderId: string; currentRoles: string[]; roleId: string; folderName: string }) => {
            const hasRole = currentRoles.includes(roleId);
            const newRoles = hasRole
                ? currentRoles.filter(r => r !== roleId)
                : [...currentRoles, roleId];
            
            const { error } = await supabase
                .from("document_folders")
                .update({ allowed_roles: newRoles })
                .eq("id", folderId);
            
            if (error) throw error;
            return { folderName, roleId, granted: !hasRole };
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ["document-folders"] });
            const roleLabel = AVAILABLE_ROLES.find(r => r.id === res.roleId)?.label || res.roleId;
            if (res.granted) {
                toast.success(`Granted access to folder "${res.folderName}" for ${roleLabel}`);
            } else {
                toast.info(`Revoked access to folder "${res.folderName}" for ${roleLabel}`);
            }
        },
        onError: (err) => {
            toast.error("Failed to update folder permission: " + (err as Error).message);
        }
    });

    const { data: folders = [] } = useQuery({
        queryKey: ["document-folders"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("document_folders")
                .select("*")
                .order("created_at", { ascending: true });
            if (error) return [] as DocumentFolder[];
            return (data ?? []) as DocumentFolder[];
        },
    });

    const sectionTabs = [
        { id: "operations" as const, label: "Operations / Pages", count: OPERATIONS_FEATURES.length },
        { id: "folders"    as const, label: "Document Folders",   count: folders.length },
        { id: "management" as const, label: "Management",          count: MANAGEMENT_FEATURES.length },
    ];

    return (
        <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
            {/* Page header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <ShieldCheck className="h-5 w-5 text-blue-500" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Access Directory</h1>
                    </div>
                    <p className="text-sm text-muted-foreground ml-11">
                        Full role-to-resource permission matrix across all operations, documents, and management modules.
                    </p>
                </div>
                <div className="hidden md:flex items-center gap-1.5 flex-wrap justify-end">
                    {AVAILABLE_ROLES.map(r => (
                        <Badge key={r.id} variant="secondary" className="text-[10px] font-semibold px-2 py-0.5">
                            {r.label}
                        </Badge>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 text-xs text-muted-foreground border rounded-lg px-4 py-2.5 bg-muted/20 flex-wrap">
                <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                    <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-emerald-500/10"><Check className="h-2.5 w-2.5" /></span>
                    Operations access
                </span>
                <span className="flex items-center gap-1.5 text-violet-600 font-medium">
                    <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-violet-500/10"><Check className="h-2.5 w-2.5" /></span>
                    Management access
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                    <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted text-muted-foreground/30"><Lock className="h-2.5 w-2.5" /></span>
                    No access
                </span>
                <span className="ml-auto text-[11px] hidden sm:block">Click any module row to expand its feature list</span>
            </div>

            {/* Section tabs */}
            <div className="flex gap-1 border rounded-xl p-1 bg-muted/30 w-fit">
                {sectionTabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveSection(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            activeSection === tab.id
                                ? "bg-background shadow text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {tab.label}
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {tab.count}
                        </Badge>
                    </button>
                ))}
            </div>

            {/* Content panel */}
            <div className="border rounded-xl overflow-hidden">
                {activeSection === "operations" && (
                    <FeatureMatrix
                        data={opsData}
                        accentClass="bg-emerald-500/10 text-emerald-600"
                        expandedModules={expandedModules}
                        setExpandedModules={setExpandedModules}
                        prefix="ops"
                        onToggle={handleOpsToggle}
                    />
                )}

                {activeSection === "folders" && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b bg-muted/10">
                                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground min-w-[200px]">Folder</th>
                                    {AVAILABLE_ROLES.map(r => (
                                        <th key={r.id} className="text-center px-3 py-3 font-semibold text-muted-foreground whitespace-nowrap text-[10px]">
                                            {r.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {folders.length === 0 && (
                                    <tr>
                                        <td colSpan={AVAILABLE_ROLES.length + 1} className="text-center py-10 text-muted-foreground">
                                            No folders loaded. Check Documents Library.
                                        </td>
                                    </tr>
                                )}
                                {folders.map(folder => (
                                    <tr key={folder.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                                        <td className="px-4 py-3 font-medium text-foreground">
                                            <span className="flex items-center gap-2">
                                                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                {folder.name}
                                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 uppercase tracking-wider font-normal">
                                                    {folder.category}
                                                </Badge>
                                            </span>
                                        </td>
                                        {AVAILABLE_ROLES.map(r => {
                                            const hasRole = (folder.allowed_roles || []).includes(r.id);
                                            return (
                                                <td 
                                                    key={r.id} 
                                                    className="text-center px-3 py-3 cursor-pointer hover:bg-muted/50 transition-colors select-none"
                                                    title={`Click to ${hasRole ? 'revoke' : 'grant'} ${r.label} access to ${folder.name}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleFolderRole.mutate({
                                                            folderId: folder.id,
                                                            currentRoles: folder.allowed_roles || [],
                                                            roleId: r.id,
                                                            folderName: folder.name
                                                        });
                                                    }}
                                                >
                                                    {hasRole
                                                        ? <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 hover:scale-110 active:scale-95 transition-transform"><Check className="h-3 w-3" /></span>
                                                        : <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-muted text-muted-foreground/20 hover:scale-110 active:scale-95 transition-transform"><Lock className="h-3 w-3" /></span>
                                                    }
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="px-4 py-2.5 border-t bg-muted/10 text-[10px] text-muted-foreground flex items-center gap-1.5">
                            <Settings2 className="h-3 w-3 shrink-0" />
                            To edit folder access, go to <strong className="mx-1">Documents Library</strong> and click the ⚙ gear icon on any folder card.
                        </div>
                    </div>
                )}

                {activeSection === "management" && (
                    <FeatureMatrix
                        data={mgmtData}
                        accentClass="bg-violet-500/10 text-violet-600"
                        expandedModules={expandedModules}
                        setExpandedModules={setExpandedModules}
                        prefix="mgmt"
                        onToggle={handleMgmtToggle}
                    />
                )}
            </div>
        </div>
    );
}
