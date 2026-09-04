import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Invoices from "./pages/Invoices";
import Clients from "./pages/Clients";
import PublicInvoice from "./pages/PublicInvoice";
import ClientPortal from "./pages/ClientPortal";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import Products from "./pages/Products";
import Suppliers from "./pages/Suppliers";
import Bills from "./pages/Bills";
import TaxReports from "./pages/TaxReports";
import Shareholders from "./pages/Shareholders";
import Employees from "./pages/Employees";
import Tickets from "./pages/Tickets";
import Roles from "./pages/Roles";
import Projects from "./pages/Projects";
import BugTracker from "./pages/BugTracker";
import Quotations from "./pages/Quotations";
import Documents from "./pages/Documents";
import AccessDirectory from "./pages/AccessDirectory";
import LeadTracking from "./pages/LeadTracking";
import LicenseManagement from "./pages/LicenseManagement";
import AuditLogs from "./pages/AuditLogs";
import { LicenseLockScreen } from "@/components/LicenseLockScreen";

import NotFound from "./pages/NotFound";
import { Loader2, Lock, ShieldAlert } from "lucide-react";

const ROLE_LEVELS: Record<string, number> = {
  super_admin: 110,
  admin: 100,
  sub_admin: 90,
  "sub-admin": 90,
  accounts_manager: 80,
  project_manager: 60,
  staff: 40,
  ticket_support: 30,
  client: 10
};

const ROLE_LANDING_PAGES: Record<string, string> = {
  super_admin: "/licenses",
  admin: "/dashboard",
  sub_admin: "/dashboard",
  "sub-admin": "/dashboard",
  accounts_manager: "/dashboard",
  project_manager: "/projects",
  staff: "/invoices",
  client: "/portal",
  ticket_support: "/tickets"
};

const ProtectedRoute = ({ children, allowedRoles, minLevel }: { children: React.ReactNode, allowedRoles?: string[], minLevel?: number }) => {
  const { user, role, accountStatus, licenseStatus, loading } = useAuth();

  // Show loader while session OR role is still being resolved
  if (loading || (user && role === null)) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950">
      <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
      <p className="text-slate-400 font-medium animate-pulse">Establishing Secure Session...</p>
    </div>
  );
  
  if (!user) return <Navigate to="/auth" />;

  const normRole = role ? role.toLowerCase() : "";

  // License Access Rule Enforcement: Admin Portal Access = Account Active + License Active + User Active
  if (normRole !== 'super_admin' && (licenseStatus !== 'active' || accountStatus !== 'active')) {
    return (
      <AppLayout>
        <LicenseLockScreen />
      </AppLayout>
    );
  }

  const userLevel = role ? ROLE_LEVELS[normRole] || ROLE_LEVELS[role] || (normRole !== "client" ? 50 : 10) : 0;
  
  let isAllowed = false;

  if (normRole === "super_admin") {
    isAllowed = true;
  } else if (allowedRoles && allowedRoles.length === 1 && allowedRoles[0] === "super_admin") {
    // Strictly super_admin only route (e.g. /licenses)
    isAllowed = normRole === "super_admin";
  } else if (allowedRoles && (allowedRoles.includes(normRole) || (role && allowedRoles.includes(role)))) {
    isAllowed = true;
  } else if (minLevel !== undefined && userLevel >= minLevel) {
    isAllowed = true;
  } else if (normRole !== "client" && (!allowedRoles || !allowedRoles.includes("super_admin") || allowedRoles.length > 1)) {
    // Custom non-client internal roles (e.g. Sub-Admin, Finance Manager) have access to internal app modules
    isAllowed = true;
  }

  if (!isAllowed) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
            <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
                <Lock className="h-10 w-10 text-destructive" />
            </div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">403 - Access Denied</h1>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">Your account level does not have sufficient permissions to access the <strong>{window.location.pathname.split('/')[1].replace('-', ' ')}</strong> module.</p>
          <div className="flex gap-4">
            <Button onClick={() => window.location.href = "/"} size="lg" className="rounded-full px-8 shadow-lg shadow-blue-500/20">Return to Portal</Button>
            <Button variant="outline" onClick={() => supabase.auth.signOut()} size="lg" className="rounded-full px-8">Switch Account / Login</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return <AppLayout>{children}</AppLayout>;
};

const queryClient = new QueryClient();

const AuthRedirect = () => {
  const { role } = useAuth();
  if (!role) return <Navigate to="/auth" replace />;
  
  const normRole = role.toLowerCase();
  const landingPage = ROLE_LANDING_PAGES[normRole] || ROLE_LANDING_PAGES[role] || (normRole === "client" ? "/portal" : "/dashboard");
  return <Navigate to={landingPage} replace />;
};

// Separate route guard for Client Portal — uses sessionStorage, not Supabase auth
const ClientPortalRoute = ({ children }: { children: React.ReactNode }) => {
  const storedClient = sessionStorage.getItem("active_portal_client");
  if (!storedClient) {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={
              <ProtectedRoute minLevel={10}>
                <AuthRedirect />
              </ProtectedRoute>
            } />
            <Route path="/licenses" element={<ProtectedRoute allowedRoles={['super_admin']}><LicenseManagement /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'accounts_manager', 'staff', 'project_manager']}><Dashboard /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'accounts_manager']}><Transactions /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'staff']}><Invoices /></ProtectedRoute>} />
            <Route path="/public/invoice/:id" element={<PublicInvoice />} />
            <Route path="/portal" element={<ClientPortalRoute><ClientPortal /></ClientPortalRoute>} />
            <Route path="/portal/:clientNumber" element={<ClientPortalRoute><ClientPortal /></ClientPortalRoute>} />
            <Route path="/clients" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'project_manager']}><Clients /></ProtectedRoute>} />
            <Route path="/lead-tracking" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'accounts_manager', 'project_manager', 'staff']}><LeadTracking /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'staff']}><Products /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute allowedRoles={['super_admin', 'admin']}><Suppliers /></ProtectedRoute>} />
            <Route path="/bills" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'accounts_manager']}><Bills /></ProtectedRoute>} />
            <Route path="/tax-reports" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'accounts_manager']}><TaxReports /></ProtectedRoute>} />
            <Route path="/shareholders" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'accounts_manager']}><Shareholders /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute allowedRoles={['super_admin', 'admin']}><Employees /></ProtectedRoute>} />
            <Route path="/tickets" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'ticket_support']}><Tickets /></ProtectedRoute>} />
            <Route path="/roles" element={<ProtectedRoute allowedRoles={['super_admin', 'admin']}><Roles /></ProtectedRoute>} />
            <Route path="/bug-tracker" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'project_manager', 'ticket_support']}><BugTracker /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'project_manager']}><Projects /></ProtectedRoute>} />
            <Route path="/quotations" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'project_manager', 'staff']}><Quotations /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'accounts_manager', 'project_manager', 'staff']}><Documents /></ProtectedRoute>} />
            <Route path="/access-directory" element={<ProtectedRoute allowedRoles={['super_admin', 'admin']}><AccessDirectory /></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['super_admin', 'admin']}><AuditLogs /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute minLevel={10}><Settings /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
