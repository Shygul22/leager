-- Migration: Remove restrictive type check constraint on transactions table
-- Description: Allows vouchers (purchase_voucher, reimbursement) and custom ledger transaction types without constraint violation.

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

NOTIFY pgrst, 'reload schema';
