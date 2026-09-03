export interface Document {
  id: string;
  name: string;
  title?: string | null;
  file_name?: string | null;
  file_path: string;
  file_type: string;
  file_size: number;
  category: string;
  status: 'pending' | 'verified' | 'rejected';
  rejection_reason?: string | null;
  document_number?: string | null;
  description?: string | null;
  uploaded_by?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  created_at: string;
  entity_type?: 'client' | 'employee' | 'bill' | 'transaction' | 'general' | 'lead' | null;
  entity_id?: string | null;
  file_data?: string | null; // Base64 data fallback
  // Join properties for user profiles
  uploader_profile?: {
    id: string;
    email: string | null;
    full_name?: string | null;
    role?: string | null;
  } | null;
  verifier_profile?: {
    id: string;
    email: string | null;
    full_name?: string | null;
    role?: string | null;
  } | null;
}

export interface DocumentFolder {
  id: string;
  name: string;
  category: string;
  color: string;
  allowed_roles: string[];
  created_by?: string | null;
  created_at: string;
}

export interface DocumentAuditLog {
  id: string;
  document_id: string;
  action: 'created' | 'updated' | 'verified' | 'rejected';
  changed_by: string | null;
  changed_at: string;
  previous_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  changer_profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

