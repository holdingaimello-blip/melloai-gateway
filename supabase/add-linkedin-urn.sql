-- Add linkedin_urn column to linkedin_tokens
ALTER TABLE linkedin_tokens ADD COLUMN IF NOT EXISTS linkedin_urn TEXT;
