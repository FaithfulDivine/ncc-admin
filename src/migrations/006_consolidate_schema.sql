-- 006_consolidate_schema.sql
-- Đợt 2 — MEDIUM risk schema consolidation
-- Apply lên Supabase BRANCH DEV trước, verify, rồi merge sang prod.
--
-- Gồm 4 khối độc lập:
--   Phần I. B.3 — Gộp cogs_physical_products vào cogs_mapping
--   Phần II. B.4 — Tạo job_runs generic + convert 3 log tables thành VIEW
--   Phần III. B.5 — MATERIALIZED VIEW facebook_ad_spend_daily
--   Phần IV. G — Thêm FK index còn thiếu + drop 23 unused index (phased)
--
-- Tất cả bọc trong TRANSACTION để rollback nếu lỗi. Drop statements cuối được
-- comment-out sẵn — đại vương uncomment sau khi verify code đã migrate xong.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- Phần I. B.3 — GỘP cogs_physical_products → cogs_mapping
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.cogs_mapping
  ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'pod'
    CHECK (product_type IN ('pod', 'physical')),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Copy data từ physical sang mapping (idempotent — skip row đã tồn tại)
INSERT INTO public.cogs_mapping
  (product_title, variant_title, base_cost, shipping_cost, shipping_extra, notes, product_type)
SELECT
  product_name,
  variant,
  base_cost,
  shipping_cost,
  COALESCE(shipping_extra, 0),
  notes,
  'physical'
FROM public.cogs_physical_products pp
WHERE NOT EXISTS (
  SELECT 1 FROM public.cogs_mapping cm
  WHERE cm.product_title = pp.product_name
    AND COALESCE(cm.variant_title, '') = COALESCE(pp.variant, '')
    AND cm.product_type = 'physical'
);

CREATE INDEX IF NOT EXISTS idx_cogs_mapping_product_type
  ON public.cogs_mapping(product_type);

-- Sau khi code đã migrate sang useCogs('physical' | 'pod' | 'all'):
-- DROP TABLE public.cogs_physical_products;

-- ═══════════════════════════════════════════════════════════════════════════
-- Phần II. B.4 — job_runs generic table
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.job_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name     TEXT NOT NULL,
  source       TEXT,
  status       TEXT NOT NULL CHECK (status IN ('running','completed','failed','cancelled')),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  duration_ms  INT GENERATED ALWAYS AS
    (CASE WHEN finished_at IS NULL THEN NULL
          ELSE (EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000)::INT
     END) STORED,
  error        TEXT,
  metrics      JSONB,
  metadata     JSONB
);

CREATE INDEX IF NOT EXISTS idx_job_runs_name_started
  ON public.job_runs(job_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_runs_status
  ON public.job_runs(status)
  WHERE status IN ('running', 'failed');

-- Backfill từ 3 bảng log cũ (ghi job_name phân biệt)
INSERT INTO public.job_runs (job_name, status, started_at, finished_at, error, metrics)
SELECT
  'shopify_sync',
  COALESCE(status, 'completed'),
  COALESCE(started_at, created_at, now()),
  COALESCE(finished_at, completed_at),
  error_message,
  jsonb_build_object('legacy_id', id::text)
FROM public.sync_logs
ON CONFLICT DO NOTHING;

INSERT INTO public.job_runs (job_name, status, started_at, finished_at, error)
SELECT
  'facebook_ad_spend_sync',
  COALESCE(status, 'completed'),
  COALESCE(started_at, now()),
  COALESCE(completed_at, finished_at),
  error_msg
FROM public.facebook_ad_spend_sync_log
ON CONFLICT DO NOTHING;

INSERT INTO public.job_runs (job_name, source, status, started_at, finished_at, error, metadata)
SELECT
  'agent:' || COALESCE(agent_name, 'unknown'),
  source,
  COALESCE(status, 'completed'),
  COALESCE(started_at, now()),
  finished_at,
  error,
  to_jsonb(ar)
FROM public.agent_runs ar
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- Phần III. B.5 — MATERIALIZED VIEW facebook_ad_spend_daily
-- ═══════════════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS public.facebook_ad_spend_daily AS
SELECT
  date,
  campaign_id,
  MIN(campaign_name)    AS campaign_name,
  SUM(spend)            AS spend,
  SUM(impressions)      AS impressions,
  SUM(clicks)           AS clicks,
  SUM(purchases)        AS purchases,
  SUM(purchases_value)  AS purchases_value,
  COUNT(*)              AS ad_count
FROM public.facebook_ad_spend_product
GROUP BY date, campaign_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fb_ad_spend_daily_pk
  ON public.facebook_ad_spend_daily(date, campaign_id);

-- REFRESH sau mỗi FB sync: SELECT public.refresh_fb_ad_spend_daily();
CREATE OR REPLACE FUNCTION public.refresh_fb_ad_spend_daily()
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.facebook_ad_spend_daily;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Phần IV. G — Thêm FK index còn thiếu
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_fbc_cooldown_removed_run_id
  ON fb_curator.cooldown(removed_run_id);

CREATE INDEX IF NOT EXISTS idx_fbc_runs_criteria_id
  ON fb_curator.runs(criteria_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Phần V. G — Drop 23 unused indexes (PHASED — uncomment từng nhóm)
-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 1 — drop chắc chắn không dùng (idx_* preemptive):
-- DROP INDEX IF EXISTS public.idx_cj_orders_status_old;
-- DROP INDEX IF EXISTS public.idx_cj_orders_created_at_unused;
-- DROP INDEX IF EXISTS public.idx_cj_shipments_tracking_unused;
-- DROP INDEX IF EXISTS public.idx_cj_webhook_log_processed_old;
-- DROP INDEX IF EXISTS public.idx_agent_runs_agent_name_old;
-- DROP INDEX IF EXISTS public.idx_facebook_ad_spend_product_date_camp;
-- (liệt kê đầy đủ sau khi đại vương đồng ý — cần query
--  pg_stat_user_indexes để lấy tên chính xác trước khi drop)

-- PHASE 2 — drop sau khi observe thêm 2 tuần không ảnh hưởng query.
-- Thuộc hạ sẽ viết riêng migration 008_drop_unused_indexes.sql sau khi
-- đại vương chạy phase 1 và confirm không có regression.

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback plan (nếu cần):
-- ═══════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- DROP MATERIALIZED VIEW IF EXISTS public.facebook_ad_spend_daily;
-- DROP TABLE IF EXISTS public.job_runs;
-- ALTER TABLE public.cogs_mapping DROP COLUMN product_type;
-- ALTER TABLE public.cogs_mapping DROP COLUMN notes;
-- DROP INDEX IF EXISTS fb_curator.idx_fbc_cooldown_removed_run_id;
-- DROP INDEX IF EXISTS fb_curator.idx_fbc_runs_criteria_id;
-- COMMIT;
