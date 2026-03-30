-- Fix linkedin_tokens table - allow null refresh_token
ALTER TABLE linkedin_tokens ALTER COLUMN refresh_token DROP NOT NULL;

-- Also allow null for linkedin_id since we may not get profile info
ALTER TABLE linkedin_tokens ALTER COLUMN linkedin_id DROP NOT NULL;
