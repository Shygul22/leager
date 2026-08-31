-- Migration: Add Document Number and Description Columns
-- Description: Extends the public.documents table with fields for tracking document numbers (IDs) and descriptive details.

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS document_number TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;
