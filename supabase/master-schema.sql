-- MelloAi Master Database Schema
-- Central configuration for all projects

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT UNIQUE NOT NULL, -- e.g., 'pagepulse', 'project2'
  name TEXT NOT NULL,
  supabase_url TEXT NOT NULL,
  supabase_key TEXT NOT NULL,
  stripe_webhook_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert PagePulse project
INSERT INTO projects (project_id, name, supabase_url, supabase_key)
VALUES (
  'pagepulse',
  'PagePulse',
  'https://ksxzytsvrrspeofweleo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' -- PagePulse service role key
)
ON CONFLICT (project_id) DO NOTHING;

-- Webhook events log (for debugging)
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  stripe_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL, -- processed, failed, ignored
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_project ON webhook_events(project_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_event ON webhook_events(stripe_event_id);
