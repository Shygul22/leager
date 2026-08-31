export type SupplierStatus = 'active' | 'inactive';

export type SupplierExtended = {
    id: string;
    user_id: string;
    name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    gstin: string | null;
    category: string | null;
    status: SupplierStatus;
    payment_terms?: string | null;
    bank_name?: string | null;
    account_number?: string | null;
    ifsc_code?: string | null;
    swift_code?: string | null;
    upi_id?: string | null;
    notes?: string | null;
    created_at: string;
};

export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled';
export type PaymentMethod = 'Bank Transfer' | 'Cash' | 'UPI' | 'Cheque' | 'Other';

export type VendorPayout = {
    id: string;
    user_id: string;
    payout_number: string;
    supplier_id: string;
    bill_ids?: string[];
    amount: number;
    payment_method: PaymentMethod;
    reference_number: string | null;
    payment_date: string;
    status: PayoutStatus;
    notes: string | null;
    proof_url: string | null;
    created_by?: string | null;
    approved_by?: string | null;
    created_at: string;
    updated_at: string;
    supplier?: SupplierExtended;
    creator_profile?: { full_name: string | null; email: string | null };
    approver_profile?: { full_name: string | null; email: string | null };
};

export type VendorPayoutAuditLog = {
    id: string;
    payout_id: string;
    supplier_id: string;
    action: string;
    performed_by: string | null;
    details: any;
    created_at: string;
    performer_profile?: { full_name: string | null; email: string | null };
};

export type SupplierAnalyticsSummary = {
    totalPurchases: number;
    totalPayable: number;
    totalPaid: number;
    outstandingBalance: number;
    overdueAmount: number;
    activeSuppliersCount: number;
    pendingPayoutsCount: number;
};
