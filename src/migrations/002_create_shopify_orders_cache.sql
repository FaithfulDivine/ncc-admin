-- Migration: Create Shopify Orders Cache Table
-- Purpose: Store orders locally to avoid repeated API calls
-- Strategy: Fetch from Shopify once, cache in DB, use cache for COGS analysis

-- Table to store cached Shopify orders
CREATE TABLE IF NOT EXISTS shopify_orders_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_order_id BIGINT NOT NULL UNIQUE,  -- Shopify order ID
  order_date DATE NOT NULL,
  order_json JSONB NOT NULL,  -- Full order data from Shopify
  items_count INT NOT NULL DEFAULT 0,
  total_price DECIMAL(12, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_order_date (order_date DESC),
  INDEX idx_shopify_order_id (shopify_order_id),
  INDEX idx_created_at (created_at DESC)
);

-- Table to store individual order line items for easier querying
CREATE TABLE IF NOT EXISTS shopify_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_cache_id UUID NOT NULL REFERENCES shopify_orders_cache(id) ON DELETE CASCADE,
  shopify_order_id BIGINT NOT NULL,
  order_date DATE NOT NULL,

  -- Item details
  title VARCHAR(255) NOT NULL,
  variant_title VARCHAR(255),
  sku VARCHAR(255),
  quantity INT NOT NULL DEFAULT 1,
  price DECIMAL(10, 2),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_order_cache_id (order_cache_id),
  INDEX idx_order_date (order_date DESC),
  INDEX idx_sku (sku),
  INDEX idx_title (title)
);

-- Table to track sync status
CREATE TABLE IF NOT EXISTS shopify_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_sync_date DATE,
  last_sync_timestamp TIMESTAMP WITH TIME ZONE,
  sync_from_date DATE DEFAULT '2020-01-01',
  sync_to_date DATE DEFAULT CURRENT_DATE,
  total_orders_synced INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',  -- pending, syncing, completed, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial sync status
INSERT INTO shopify_sync_status (status, sync_from_date)
VALUES ('pending', '2020-01-01')
ON CONFLICT DO NOTHING;

-- Table for sync schedule settings
CREATE TABLE IF NOT EXISTS shopify_sync_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  label TEXT,
  setting_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO shopify_sync_settings (key, value, label, setting_type)
VALUES
  ('AUTO_SYNC_ENABLED', 'true', 'Auto-sync orders from Shopify', 'boolean'),
  ('AUTO_SYNC_INTERVAL_HOURS', '24', 'Sync interval (hours)', 'number'),
  ('SYNC_FROM_DAYS_BACK', '30', 'Only sync orders from past N days', 'number')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE shopify_orders_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_sync_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow read access
CREATE POLICY "shopify_orders_cache_read" ON shopify_orders_cache
  FOR SELECT USING (TRUE);

CREATE POLICY "shopify_order_items_read" ON shopify_order_items
  FOR SELECT USING (TRUE);

CREATE POLICY "shopify_sync_status_read" ON shopify_sync_status
  FOR SELECT USING (TRUE);

CREATE POLICY "shopify_sync_settings_read" ON shopify_sync_settings
  FOR SELECT USING (TRUE);

-- RLS Policies - Allow insert/update
CREATE POLICY "shopify_orders_cache_write" ON shopify_orders_cache
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "shopify_orders_cache_update" ON shopify_orders_cache
  FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "shopify_order_items_write" ON shopify_order_items
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "shopify_order_items_update" ON shopify_order_items
  FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "shopify_sync_status_write" ON shopify_sync_status
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "shopify_sync_status_update" ON shopify_sync_status
  FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "shopify_sync_settings_update" ON shopify_sync_settings
  FOR UPDATE USING (TRUE) WITH CHECK (TRUE);
