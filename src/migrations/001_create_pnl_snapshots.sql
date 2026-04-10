-- Migration: Create P&L snapshots table for historical tracking and data locking
-- Date: 2026-04-11

-- Create P&L snapshots table
CREATE TABLE IF NOT EXISTS pnl_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  revenue DECIMAL(15, 2) NOT NULL DEFAULT 0,
  cogs DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ads_spend DECIMAL(15, 2) NOT NULL DEFAULT 0,
  payment_fees DECIMAL(15, 2) NOT NULL DEFAULT 0,
  fixed_costs DECIMAL(15, 2) NOT NULL DEFAULT 0,
  gross_profit DECIMAL(15, 2) GENERATED ALWAYS AS (revenue - cogs) STORED,
  net_profit DECIMAL(15, 2) GENERATED ALWAYS AS (revenue - cogs - ads_spend - payment_fees - fixed_costs) STORED,
  gross_margin DECIMAL(5, 2) GENERATED ALWAYS AS (CASE WHEN revenue > 0 THEN ((revenue - cogs) / revenue * 100) ELSE 0 END) STORED,
  net_margin DECIMAL(5, 2) GENERATED ALWAYS AS (CASE WHEN revenue > 0 THEN (((revenue - cogs - ads_spend - payment_fees - fixed_costs) / revenue) * 100) ELSE 0 END) STORED,
  order_count INT NOT NULL DEFAULT 0,
  total_units INT NOT NULL DEFAULT 0,
  unmatched_items INT NOT NULL DEFAULT 0,
  snapshot_details JSONB,
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pnl_snapshots_date ON pnl_snapshots(date DESC);
CREATE INDEX IF NOT EXISTS idx_pnl_snapshots_created_at ON pnl_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pnl_snapshots_is_locked ON pnl_snapshots(is_locked);

-- Enable RLS
ALTER TABLE pnl_snapshots ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to read all snapshots
CREATE POLICY IF NOT EXISTS "pnl_snapshots_read" ON pnl_snapshots
  FOR SELECT
  USING (TRUE);

-- Policy: Allow inserts
CREATE POLICY IF NOT EXISTS "pnl_snapshots_insert" ON pnl_snapshots
  FOR INSERT
  WITH CHECK (TRUE);

-- Policy: Allow updates only for non-locked or very recent data (less than 3 days old)
CREATE POLICY IF NOT EXISTS "pnl_snapshots_update" ON pnl_snapshots
  FOR UPDATE
  USING (is_locked = FALSE OR (NOW() - INTERVAL '3 days') < created_at)
  WITH CHECK (is_locked = FALSE OR (NOW() - INTERVAL '3 days') < created_at);

-- Policy: Allow deletes only for non-locked data
CREATE POLICY IF NOT EXISTS "pnl_snapshots_delete" ON pnl_snapshots
  FOR DELETE
  USING (is_locked = FALSE);

-- Create table for auto-refresh settings
CREATE TABLE IF NOT EXISTS auto_refresh_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  label TEXT,
  setting_type TEXT DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on key
CREATE INDEX IF NOT EXISTS idx_auto_refresh_settings_key ON auto_refresh_settings(key);

-- Enable RLS on auto_refresh_settings
ALTER TABLE auto_refresh_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "auto_refresh_settings_read" ON auto_refresh_settings
  FOR SELECT
  USING (TRUE);

CREATE POLICY IF NOT EXISTS "auto_refresh_settings_update" ON auto_refresh_settings
  FOR UPDATE
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY IF NOT EXISTS "auto_refresh_settings_insert" ON auto_refresh_settings
  FOR INSERT
  WITH CHECK (TRUE);

-- Insert default auto-refresh interval (5 minutes = 300 seconds)
INSERT INTO auto_refresh_settings (key, value, label, category, setting_type)
VALUES ('AUTO_REFRESH_INTERVAL', '300', 'Auto-refresh interval (seconds)', 'Data', 'number')
ON CONFLICT (key) DO UPDATE SET updated_at = NOW();
