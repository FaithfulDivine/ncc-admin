-- Migration: CJ Dropshipping Fulfillment Module
-- Purpose: tables for CJ product mapping, order queue, shipments, webhook audit
-- Created: 2026-04-18
--
-- Tables:
--   cj_product_map    — Shopify variant ↔ CJ product/variant
--   cj_orders         — CJ order state machine (pending → paid → shipped → delivered)
--   cj_shipments      — tracking & carrier info, 1 Shopify order có thể có nhiều shipment
--   cj_webhook_log    — raw payload từ CJ webhook (tracking update, order status)
--   system_settings   — thêm key cho CJ API (tái dùng bảng đã có)
--
-- Convention theo các migration trước: RLS bật, policy USING (TRUE) cho internal tool.

-- ─────────────────────────────────────────────────────────────
-- 1. CJ Product Mapping
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cj_product_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Shopify side
  shopify_product_id BIGINT,
  shopify_variant_id BIGINT NOT NULL UNIQUE,
  shopify_sku VARCHAR(255),
  shopify_title VARCHAR(500),

  -- CJ side
  cj_product_id VARCHAR(100) NOT NULL,
  cj_variant_id VARCHAR(100) NOT NULL,
  cj_sku VARCHAR(255),
  cj_product_name VARCHAR(500),
  cj_cost_usd DECIMAL(10, 2),          -- snapshot giá CJ tại thời điểm map

  -- POD specifics
  is_pod BOOLEAN DEFAULT FALSE,
  pod_front_url TEXT,
  pod_back_url TEXT,
  pod_mockup_url TEXT,

  -- Lifecycle
  status VARCHAR(30) DEFAULT 'active',  -- active, paused, archived
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cj_map_shopify_variant ON cj_product_map(shopify_variant_id);
CREATE INDEX IF NOT EXISTS idx_cj_map_cj_variant ON cj_product_map(cj_variant_id);
CREATE INDEX IF NOT EXISTS idx_cj_map_sku ON cj_product_map(shopify_sku);

-- ─────────────────────────────────────────────────────────────
-- 2. CJ Orders
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cj_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Shopify side
  shopify_order_id BIGINT NOT NULL,
  shopify_order_number VARCHAR(50),

  -- CJ side
  cj_order_id VARCHAR(100) UNIQUE,       -- null khi mới queued, fill sau khi create
  cj_order_number VARCHAR(100),

  -- State machine
  -- queued      → vừa sync từ Shopify, chưa gửi CJ
  -- submitted   → đã POST /shopping/order/createOrder
  -- paid        → CJ đã trừ ví
  -- in_production → POD đang in
  -- shipped     → đã có tracking
  -- delivered   → CJ báo delivered
  -- cancelled   → huỷ
  -- error       → lỗi cần can thiệp tay
  status VARCHAR(30) NOT NULL DEFAULT 'queued',

  -- Amounts
  cost_usd DECIMAL(10, 2),               -- tổng CJ tính
  shipping_cost_usd DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'USD',

  -- Address snapshot (để debug khi CJ reject)
  ship_to_name VARCHAR(255),
  ship_to_country VARCHAR(10),
  ship_to_zip VARCHAR(30),

  -- Raw payloads
  request_payload JSONB,                 -- body gửi CJ
  response_payload JSONB,                -- response CJ trả về
  error_message TEXT,

  -- Timestamps
  queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(shopify_order_id)
);

CREATE INDEX IF NOT EXISTS idx_cj_orders_status ON cj_orders(status);
CREATE INDEX IF NOT EXISTS idx_cj_orders_shopify ON cj_orders(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_cj_orders_cj_id ON cj_orders(cj_order_id);
CREATE INDEX IF NOT EXISTS idx_cj_orders_queued ON cj_orders(queued_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 3. CJ Shipments (một CJ order có thể split nhiều kiện)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cj_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cj_order_id UUID NOT NULL REFERENCES cj_orders(id) ON DELETE CASCADE,

  tracking_number VARCHAR(100) NOT NULL,
  carrier VARCHAR(100),                  -- CJPacket, YunExpress, USPS...
  tracking_url TEXT,

  -- Status
  shipment_status VARCHAR(50),           -- in_transit, delivered, exception
  pushed_to_shopify BOOLEAN DEFAULT FALSE,
  shopify_fulfillment_id BIGINT,

  -- Timestamps
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  last_checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(tracking_number)
);

CREATE INDEX IF NOT EXISTS idx_cj_ship_order ON cj_shipments(cj_order_id);
CREATE INDEX IF NOT EXISTS idx_cj_ship_pushed ON cj_shipments(pushed_to_shopify);

-- ─────────────────────────────────────────────────────────────
-- 4. CJ Webhook Log (audit trail)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cj_webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100),               -- ORDER_SHIPPED, TRACKING_UPDATED, WALLET_LOW...
  cj_order_id VARCHAR(100),
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cj_wh_received ON cj_webhook_log(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_cj_wh_processed ON cj_webhook_log(processed);

-- ─────────────────────────────────────────────────────────────
-- 5. Seed settings vào system_settings
-- ─────────────────────────────────────────────────────────────
INSERT INTO system_settings (key, value, category, label, setting_type)
VALUES
  ('CJ_API_EMAIL', '', 'CJ Dropshipping', 'CJ Developer API email', 'text'),
  ('CJ_API_PASSWORD', '', 'CJ Dropshipping', 'CJ Developer API password', 'password'),
  ('CJ_ACCESS_TOKEN', '', 'CJ Dropshipping', 'Cached access token (auto-refreshed)', 'text'),
  ('CJ_TOKEN_EXPIRES_AT', '', 'CJ Dropshipping', 'Token expiry ISO timestamp', 'text'),
  ('CJ_AUTO_FULFILL_ENABLED', 'false', 'CJ Dropshipping', 'Tự động submit order sang CJ', 'boolean'),
  ('CJ_AUTO_PAY_ENABLED', 'false', 'CJ Dropshipping', 'Tự động pay từ CJ Wallet', 'boolean'),
  ('CJ_WALLET_MIN_BALANCE', '50', 'CJ Dropshipping', 'Cảnh báo khi ví thấp hơn (USD)', 'number'),
  ('CJ_DEFAULT_SHIPPING', 'CJPacket', 'CJ Dropshipping', 'Default shipping carrier', 'text'),
  ('CJ_SKU_PREFIX_FILTER', 'CJ-', 'CJ Dropshipping', 'Chỉ auto-fulfill SKU có prefix này (để trống = all)', 'text'),
  ('CJ_WEBHOOK_SECRET', '', 'CJ Dropshipping', 'HMAC secret để verify webhook', 'password')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 6. RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE cj_product_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE cj_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cj_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cj_webhook_log ENABLE ROW LEVEL SECURITY;

-- Read
CREATE POLICY "cj_product_map_read" ON cj_product_map FOR SELECT USING (TRUE);
CREATE POLICY "cj_orders_read"      ON cj_orders      FOR SELECT USING (TRUE);
CREATE POLICY "cj_shipments_read"   ON cj_shipments   FOR SELECT USING (TRUE);
CREATE POLICY "cj_webhook_log_read" ON cj_webhook_log FOR SELECT USING (TRUE);

-- Write (insert + update)
CREATE POLICY "cj_product_map_write"  ON cj_product_map  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "cj_product_map_update" ON cj_product_map  FOR UPDATE USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "cj_product_map_delete" ON cj_product_map  FOR DELETE USING (TRUE);

CREATE POLICY "cj_orders_write"  ON cj_orders  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "cj_orders_update" ON cj_orders  FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "cj_shipments_write"  ON cj_shipments  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "cj_shipments_update" ON cj_shipments  FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "cj_webhook_log_write"  ON cj_webhook_log FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "cj_webhook_log_update" ON cj_webhook_log FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

-- ─────────────────────────────────────────────────────────────
-- 7. Trigger updated_at
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cj_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cj_product_map_touch ON cj_product_map;
CREATE TRIGGER trg_cj_product_map_touch
  BEFORE UPDATE ON cj_product_map
  FOR EACH ROW EXECUTE FUNCTION cj_touch_updated_at();

DROP TRIGGER IF EXISTS trg_cj_orders_touch ON cj_orders;
CREATE TRIGGER trg_cj_orders_touch
  BEFORE UPDATE ON cj_orders
  FOR EACH ROW EXECUTE FUNCTION cj_touch_updated_at();

DROP TRIGGER IF EXISTS trg_cj_shipments_touch ON cj_shipments;
CREATE TRIGGER trg_cj_shipments_touch
  BEFORE UPDATE ON cj_shipments
  FOR EACH ROW EXECUTE FUNCTION cj_touch_updated_at();
