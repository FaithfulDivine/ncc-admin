-- 007_security_hardening.sql
-- Đợt 3 — HIGH risk security hardening
--
-- ⚠️  QUAN TRỌNG — ĐỌC KỸ TRƯỚC KHI APPLY ⚠️
-- Migration này SIẾT RLS policy của 16 bảng từ `USING (true)` (open) sang
-- `USING ((auth.jwt()->>'role') = 'service_role')`.
-- NGHĨA LÀ: từ lúc apply, MỌI request từ frontend dùng VITE_SUPABASE_ANON_KEY
-- sẽ bị CHẶN trên các bảng này — frontend phải đọc qua api/* (server-side dùng
-- SUPABASE_SERVICE_ROLE_KEY) HOẶC viết RLS policy riêng cho anon nếu thật sự
-- cần client đọc trực tiếp.
--
-- TRƯỚC KHI APPLY:
--   1. Chạy migration 007a_audit_current_policies.sql (nếu có) để backup.
--   2. Đảm bảo toàn bộ api/* đã chuyển sang SUPABASE_SERVICE_ROLE_KEY
--      (xem runbook ROTATE_SECRETS_RUNBOOK.md).
--   3. Audit frontend: tìm tất cả `supabase.from('<bảng>')` để biết bảng nào
--      cần giữ policy anon-read.
--
-- Apply lên BRANCH DEV trước. Smoke test xong mới merge prod.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- Helper macro-like: policy service-role chỉ
-- ═══════════════════════════════════════════════════════════════════════════
-- Pattern dùng lại cho 16 bảng: drop policy hiện có, tạo policy mới chỉ cho
-- service_role. Nếu bảng cần giữ anon-read (vd. cogs_mapping để frontend load
-- vào PnL), thêm policy SELECT riêng bên dưới — tuỳ từng bảng.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. public.system_settings  —  🚨 CHỨA SECRET, tuyệt đối không cho anon
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_all" ON public.system_settings;
DROP POLICY IF EXISTS "Allow all" ON public.system_settings;

CREATE POLICY "system_settings_service_only"
  ON public.system_settings
  FOR ALL
  TO public
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Nhóm bảng CHỈ server-side (api/*) — service_role only
-- ───────────────────────────────────────────────────────────────────────────
-- cj_orders, cj_shipments, cj_product_map, cj_webhook_log, field_mappings,
-- blocked_customer_tags, sync_logs, facebook_ad_spend_sync_log, agent_runs,
-- job_runs (mới từ migration 006)

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'cj_orders', 'cj_shipments', 'cj_product_map', 'cj_webhook_log',
    'field_mappings', 'blocked_customer_tags', 'sync_logs',
    'facebook_ad_spend_sync_log', 'agent_runs', 'job_runs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Enable all access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_open" ON public.%I', t, t);
    EXECUTE format($p$
      CREATE POLICY "%1$s_service_only"
        ON public.%1$I
        FOR ALL
        TO public
        USING ((auth.jwt() ->> 'role') = 'service_role')
        WITH CHECK ((auth.jwt() ->> 'role') = 'service_role')
    $p$, t);
  END LOOP;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Nhóm bảng CẦN frontend đọc (cogs_*, fixed_costs, facebook_ad_spend,
--    cogs_exclusions) — service_role full + anon read-only
-- ───────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'cogs_mapping', 'cogs_physical_products', 'cogs_exclusions',
    'fixed_costs', 'facebook_ad_spend'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Enable all access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_open" ON public.%I', t, t);
    -- Service role full
    EXECUTE format($p$
      CREATE POLICY "%1$s_service_full"
        ON public.%1$I
        FOR ALL
        TO public
        USING ((auth.jwt() ->> 'role') = 'service_role')
        WITH CHECK ((auth.jwt() ->> 'role') = 'service_role')
    $p$, t);
    -- Anon + authenticated chỉ SELECT
    EXECUTE format($p$
      CREATE POLICY "%1$s_anon_read"
        ON public.%1$I
        FOR SELECT
        TO anon, authenticated
        USING (true)
    $p$, t);
  END LOOP;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. fb_curator schema — criteria/config/runs/decisions/cooldown
-- ───────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['config', 'criteria', 'runs', 'decisions', 'cooldown'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON fb_curator.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all" ON fb_curator.%I', t);
    -- Service full
    EXECUTE format($p$
      CREATE POLICY "%1$s_service_full"
        ON fb_curator.%1$I
        FOR ALL
        TO public
        USING ((auth.jwt() ->> 'role') = 'service_role')
        WITH CHECK ((auth.jwt() ->> 'role') = 'service_role')
    $p$, t);
    -- Frontend đọc (MatchLevelPanel, FBCuratorRunDetail) — SELECT only
    EXECUTE format($p$
      CREATE POLICY "%1$s_anon_read"
        ON fb_curator.%1$I
        FOR SELECT
        TO anon, authenticated
        USING (true)
    $p$, t);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Function search_path mutable — set immutable
-- ═══════════════════════════════════════════════════════════════════════════
ALTER FUNCTION fb_curator.touch_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.cj_touch_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.adpnl_strip_suffix(text)
  SET search_path = public, pg_temp;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Move pg_net extension khỏi schema public
-- ═══════════════════════════════════════════════════════════════════════════
-- CẨN TRỌNG: nếu có cron gọi net.http_post từ schema cũ, cần sửa các cron đó
-- trước. Chưa chắc chắn → để commented cho đại vương quyết thời điểm.
--
-- CREATE SCHEMA IF NOT EXISTS extensions;
-- ALTER EXTENSION pg_net SET SCHEMA extensions;
-- GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Smoke test sau khi apply (branch dev):
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Login FE với anon key → mở /store/pnl → phải load được cogs_mapping,
--    fixed_costs, facebook_ad_spend (SELECT anon).
-- 2. Mở /admin/settings (nếu có) → system_settings phải TRẢ EMPTY cho anon
--    (confirm secret đã khoá).
-- 3. Chạy api/shopify/status với SERVICE_ROLE_KEY → phải đọc được system_settings.
-- 4. Chạy api/shopify/status với ANON_KEY (nếu còn) → phải 403/empty.
-- 5. Smoke test api/cj/wallet, api/cj/fulfill, api/gsheets/read → phải pass.
--
-- Rollback nếu có regression:
--   Thay tất cả policy `*_service_only` bằng `USING (true)` (temporary) rồi
--   debug. Không có rollback tự động — phải handroll lại 16 bảng.
