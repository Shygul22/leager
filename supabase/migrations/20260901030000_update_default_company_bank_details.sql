-- ============================================================================
-- UPDATE DEFAULT COMPANY BANK DETAILS IN PUBLIC.PROFILES
-- ============================================================================

-- 1. Set column defaults on public.profiles
ALTER TABLE public.profiles ALTER COLUMN bank_name SET DEFAULT 'State Bank of India (SBI)';
ALTER TABLE public.profiles ALTER COLUMN account_number SET DEFAULT '45505327860';
ALTER TABLE public.profiles ALTER COLUMN branch_name SET DEFAULT 'Ulundurpet';
ALTER TABLE public.profiles ALTER COLUMN ifsc_code SET DEFAULT 'SBIN0011071';
ALTER TABLE public.profiles ALTER COLUMN payment_details SET DEFAULT 'Account Holder: ZenJourney Private Limited
Bank Name: State Bank of India (SBI)
Account Number: 45505327860
Branch Name: Ulundurpet
IFSC Code: SBIN0011071';

-- 2. Update existing profiles with default bank details if blank or old default
UPDATE public.profiles
SET 
    bank_name = 'State Bank of India (SBI)',
    account_number = '45505327860',
    branch_name = 'Ulundurpet',
    ifsc_code = 'SBIN0011071',
    payment_details = 'Account Holder: ZenJourney Private Limited
Bank Name: State Bank of India (SBI)
Account Number: 45505327860
Branch Name: Ulundurpet
IFSC Code: SBIN0011071'
WHERE bank_name IS NULL OR bank_name = 'BANK OF INDIA' OR payment_details LIKE '%DREAM LIFTS%' OR payment_details IS NULL;

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
