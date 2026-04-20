# Báo cáo Tối ưu Hệ thống NCC-Admin

**Ngày:** 2026-04-20
**Phạm vi:** Supabase schema, shared utils, hiệu năng, tech debt toàn diện
**Codebase:** `D:\Cong viec\CODE\ncc-admin` (~13.5k LOC TypeScript/TSX)
**Supabase project:** FaithfulDivine's Project (`zcmvvpizoipxehximabk`, Postgres 17, region `ap-south-1`)

---

## TL;DR — Những việc phải xử lý

| # | Mức | Hạng mục | Action |
|---|------|----------|--------|
| 1 | **LOW** | 2 file dead code (~1.4k LOC) | Thuộc hạ đã xoá — xem mục Fix đã thực hiện |
| 2 | **HIGH** | 7 bảng code reference nhưng KHÔNG tồn tại trong DB | Quyết định: migrate hay bỏ hook |
| 3 | **HIGH** | `shopify_sync_settings` sẽ trùng mục đích với `system_settings` | Đừng apply migration 002 nguyên trạng — gộp vào `system_settings` |
| 4 | **MEDIUM** | `cogs_mapping` + `cogs_physical_products` có 6 cột trùng mục đích | Gộp 1 bảng + cột `product_type` (pod/physical) |
| 5 | **MEDIUM** | 3 bảng log-pattern (`sync_logs`, `facebook_ad_spend_sync_log`, `agent_runs`) | Gộp thành `job_runs` generic |
| 6 | **MEDIUM** | Supabase client tạo mới mỗi request serverless | Cache instance ở module scope |
| 7 | **MEDIUM** | `getSystemSetting` gọi sequential → N round-trips | Viết helper batch `getSystemSettings([...])` |
| 8 | **LOW** | 23 unused indexes trong advisors | Drop sau khi confirm |
| 9 | **WARN** | 15+ RLS policy `USING (true)` — tương đương tắt RLS | Đổi sang check `service_role` |
| 10 | **WARN** | 3 function có `search_path` mutable | Set `search_path = public, pg_temp` |

---

## A. Kiến trúc tổng quan

**Stack:**
- Frontend: React 18 + Vite 6 + TypeScript 5.7 + Tailwind + Radix/shadcn-ui
- State: TanStack Query v5
- Backend: Vercel serverless functions (`api/{shopify,cj,facebook,gsheets}/`)
- Data: Supabase Postgres 17 — 3 schema (`public`, `fb_curator`, `pod_tool`)

**Schema inventory:**

| Schema | Bảng | Mục đích |
|--------|------|----------|
| `public` | 17 bảng | Core: cogs, orders, ads, settings, CJ fulfillment, agent logs |
| `fb_curator` | 5 bảng + 2 view | Facebook ad curator (criteria/runs/decisions/cooldown/config) |
| `pod_tool` | 6 bảng | Image generation (users/quota/styles/generations/daily_usage/audit) |

---

## B. Supabase — Dữ liệu trùng & thiếu

### B.1 Bảng code reference nhưng KHÔNG tồn tại trong DB (risk: **HIGH**)

Scenario — 3 hook + 1 page có query tới bảng chưa có trong Supabase:

| Hook/Page | Bảng query | Có trong DB? |
|-----------|-----------|--------------|
| `useShopifyOrdersCache.ts` | `shopify_orders_cache` | ❌ |
| `useShopifyOrdersCache.ts` | `shopify_order_items` | ❌ |
| `useShopifyOrdersCache.ts` | `shopify_sync_status` | ❌ |
| `useShopifyOrdersCache.ts` | `shopify_sync_settings` | ❌ |
| `usePnLSnapshots.ts` | `pnl_snapshots` | ❌ |
| `usePnLSnapshots.ts` | `auto_refresh_settings` | ❌ |
| `Dashboard.tsx` (L35) | `style_mapping` | ❌ |

**Nguyên nhân:** Migrations `001_create_pnl_snapshots.sql` và `002_create_shopify_orders_cache.sql` nằm trong repo nhưng CHƯA bao giờ được apply — migration history Supabase bắt đầu từ `20260410030954`.

Consequence — nếu người dùng mở `/store/pnl` hay `Dashboard` ở trạng thái hiện tại, các hook đó throw lỗi silent (TanStack Query giữ error ở state, không crash).

Execution — Đại vương chọn 1 trong 2:
- **Phương án A (nếu còn định dùng):** Apply cả 2 migration — nhưng TRƯỚC khi apply, SỬA migration 002 bỏ `shopify_sync_settings` (xem B.2).
- **Phương án B (nếu đã bỏ):** Xoá các hook + đoạn code liên quan, dọn import.

### B.2 `shopify_sync_settings` **trùng mục đích** với `system_settings` (risk: **HIGH — đừng tách**)

Scenario — migration 002 định tạo `shopify_sync_settings (key, value)` để lưu config Shopify sync, trong khi `system_settings (key, value, category)` đã là key-value store generic đang giữ 42 keys cho Shopify, CJ, Facebook, Google Sheets, Klaviyo, Telegram, Cron…

Consequence — tách ra sẽ có 2 bảng cùng role, split-brain config, viết trùng logic upsert.

Execution — **KHÔNG tạo `shopify_sync_settings`**. Dùng `system_settings` với `category = 'Shopify Sync'`. Thay hook `useSyncSettings` filter `system_settings` theo category.

### B.3 `cogs_mapping` ↔ `cogs_physical_products` (risk: **MEDIUM — nên gộp**)

Scenario — 2 bảng cùng lưu bảng giá COGS, chỉ khác loại product:

| Cột | `cogs_mapping` (POD) | `cogs_physical_products` |
|-----|----------------------|---------------------------|
| product title | `product_title` | `product_name` |
| variant | `variant_title` | `variant` |
| `base_cost` | ✅ | ✅ |
| `shipping_cost` | ✅ | ✅ |
| `shipping_extra` | ✅ default 1.99 | ✅ default 0 |
| `sku` | ✅ | ❌ |
| `extra_cost` | ✅ | ❌ |
| `shopify_variant_name` | ✅ | ❌ |
| `notes` | ❌ | ✅ |

Consequence — 2 hook riêng (`useCogsMapping`, `usePhysicalProducts`), logic matching trong `PnL.tsx` phải duyệt 2 nguồn, khi thêm field mới phải sửa 2 nơi.

Execution — migration gộp:
```sql
ALTER TABLE cogs_mapping
  ADD COLUMN product_type TEXT NOT NULL DEFAULT 'pod'
    CHECK (product_type IN ('pod','physical')),
  ADD COLUMN notes TEXT;

INSERT INTO cogs_mapping (product_title, variant_title, base_cost,
                         shipping_cost, shipping_extra, notes, product_type)
SELECT product_name, variant, base_cost,
       shipping_cost, shipping_extra, notes, 'physical'
FROM cogs_physical_products;

-- Sau khi verify: DROP TABLE cogs_physical_products;
```
Sửa hook: 1 hook `useCogs(type?: 'pod' | 'physical' | 'all')`.

### B.4 Log/run tables trùng mẫu (risk: **MEDIUM — nên gộp**)

Scenario — 3 bảng cùng một kiểu "execution log":

| Cột chung | `sync_logs` | `facebook_ad_spend_sync_log` | `agent_runs` |
|-----------|:-----------:|:----------------------------:|:------------:|
| started_at | ✅ | ✅ | ✅ |
| finished_at / completed_at | ✅ | ✅ | ✅ |
| status | ✅ | ✅ | ✅ |
| error | ✅ `error_message` | ✅ `error_msg` | ✅ `error` |
| duration_ms | ✅ | ❌ (tính) | ✅ |
| metadata rows | scalar cols | scalar cols | text preview |

Consequence — 3 nơi update trạng thái, 3 set policy RLS, 3 dashboard query.

Execution — đề xuất:
```sql
CREATE TABLE job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,          -- 'shopify_sync' | 'facebook_ad_spend_sync' | 'agent:fd-weekly' ...
  source TEXT,                     -- 'cron' | 'manual' | 'webhook'
  status TEXT NOT NULL,            -- running/completed/failed
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INT GENERATED ALWAYS AS
    (EXTRACT(EPOCH FROM (finished_at - started_at))*1000)::INT STORED,
  error TEXT,
  metrics JSONB,                   -- rows_upserted, api_calls, png_misses ...
  metadata JSONB
);
CREATE INDEX idx_job_runs_name_started ON job_runs(job_name, started_at DESC);
```
Giữ 3 bảng cũ làm VIEW chuyển tiếp trong 1 sprint → drop sau khi mọi caller đổi sang `job_runs`.

### B.5 `facebook_ad_spend` ↔ `facebook_ad_spend_product`

Không trùng — bảng `facebook_ad_spend` là aggregate theo `(date, campaign)` (160-188 rows), bảng còn lại là detail theo `(date, ad, product)` (2885 rows). Tuy nhiên có thể thay bảng aggregate bằng **MATERIALIZED VIEW** trên detail table để tránh upsert 2 bảng:
```sql
CREATE MATERIALIZED VIEW facebook_ad_spend_daily AS
SELECT date, campaign_id, MIN(campaign_name) AS campaign_name,
       SUM(spend) AS spend, SUM(impressions) AS impressions,
       SUM(clicks) AS clicks, SUM(purchases) AS purchases
FROM facebook_ad_spend_product
GROUP BY date, campaign_id;
```
REFRESH sau mỗi lần sync → giảm 1 round-trip upsert.

---

## C. Shared utils & cấu trúc module

### C.1 Supabase client tạo-mới mỗi-request (risk: **MEDIUM**)

File: `api/shopify/_helpers.ts:9`
```ts
function getSupabaseClient() {
  const url = clean(process.env.VITE_SUPABASE_URL || '')
  const key = clean(process.env.VITE_SUPABASE_ANON_KEY || '')
  if (!url || !key) return null
  return createClient(url, key)   // ← tạo client MỖI lần gọi
}
```
Consequence — trong `fulfill.ts` có 3-4 call `.from(...)`, mỗi call đi qua helper chỉ tạo client 1 lần trong request đó (OK). Nhưng `getSystemSetting` trong `_helpers` cũng gọi `getSupabaseClient()` riêng → trong 1 request Vercel có thể tạo ≥ 2 instance → thừa.

Execution — cache ở module scope:
```ts
let _sb: SupabaseClient | null = null
function getSupabaseClient() {
  if (_sb) return _sb
  const url = clean(process.env.VITE_SUPABASE_URL || '')
  const key = clean(process.env.VITE_SUPABASE_ANON_KEY || '')
  if (!url || !key) return null
  _sb = createClient(url, key, { auth: { persistSession: false } })
  return _sb
}
```

### C.2 `getSystemSetting` gọi tuần tự → N round-trips (risk: **MEDIUM**)

Điển hình trong `api/cj/_helpers.ts`:
```ts
const email    = await getSystemSetting('CJ_API_EMAIL')      // RTT 1
const password = await getSystemSetting('CJ_API_PASSWORD')   // RTT 2
// ...
const cachedToken = await getSystemSetting('CJ_ACCESS_TOKEN')     // RTT 3
const expiresAt   = await getSystemSetting('CJ_TOKEN_EXPIRES_AT') // RTT 4
```
Consequence — mỗi RTT Supabase ≈ 50-120ms từ Vercel → ăn 200-500ms mỗi request CJ. `fulfill.ts` còn gọi thêm 2 lần nữa → 6 RTT chỉ để đọc config.

Execution — thêm helper batch:
```ts
export async function getSystemSettings(keys: string[]): Promise<Record<string, string|null>> {
  const sb = getSupabaseClient()
  if (!sb) return Object.fromEntries(keys.map(k => [k, null]))
  const { data } = await sb.from('system_settings')
    .select('key,value').in('key', keys)
  const map = Object.fromEntries(keys.map(k => [k, null as string|null]))
  for (const row of data ?? []) map[row.key] = clean(row.value)
  return map
}
```
Ghép 4 RTT → 1 RTT. Pattern này nên lan ra `getShopifyConfig` (đã OK dùng `Promise.all` nhưng vẫn 2 RTT).

### C.3 Duplicate utility — HIỆN TẠI OK

Đã kiểm tra: `formatCurrency/formatDate/cn` chỉ có 1 định nghĩa (`src/lib/utils.ts`). `detectCarrier`, `getCarrierCode` cũng chỉ 1 bản (`src/lib/carriers.ts`). **Không cần merge.**

### C.4 `gsheets/_helpers.ts` bypass `getSupabaseClient` (risk: **LOW**)

File dùng `fetch` raw URL `/rest/v1/system_settings?...` thay vì `getSupabaseClient`. Consequence: chênh lệch error handling, headers. Execution: refactor để dùng chung client, giữ single source of auth.

---

## D. Hiệu năng

### D.1 N+1 khi viết orders cache

`useShopifyOrdersCache.ts:99-137` — upsert orders rồi lấy `orderData[idx].id` để gắn vào items. Nhưng `upsert` Supabase không đảm bảo thứ tự → code hiện tại có thể gán sai `order_cache_id`! Khuyến nghị:
- Dùng `shopify_order_id` (UNIQUE đã có) làm foreign key thay vì `order_cache_id` UUID, hoặc
- Upsert orders rồi query lại `select id, shopify_order_id ...` để build map → chính xác hơn.

Tuy nhiên, vì bảng này CHƯA tồn tại (xem B.1), chỉ sửa khi quyết định apply migration.

### D.2 Thiếu TanStack Query invalidation granularity

Hook dùng `queryKey: ['shopify-orders-cache', dateFrom, dateTo]` nhưng `invalidateQueries({ queryKey: ['shopify-orders-cache'] })` invalidate TẤT CẢ date range → fetch lại nhiều hơn cần. Đề xuất invalidate theo range cụ thể.

### D.3 staleTime không đồng bộ

- `useShopifyOrdersCache`: 1h
- `useSyncStatus`: 5 min
- `useCogs` (đoán): không set → 0ms → refetch liên tục
- PR `COGS_API_OPTIMIZATION.md` đã đề xuất 30 min cho Cogs

Execution — tạo `src/lib/queryDefaults.ts`:
```ts
export const QUERY_STALE = {
  shortLived: 60 * 1000,          // 1 min (status, live counters)
  medium:     5  * 60 * 1000,     // 5 min (settings, small config)
  longLived:  30 * 60 * 1000,     // 30 min (COGS, mapping)
  historical: 60 * 60 * 1000,     // 1 h   (orders cache, snapshots)
}
```
Dùng xuyên suốt — dễ audit, tránh "set số đại".

---

## E. Dead code

### E.1 `Cogs_Optimized.tsx` (591 LOC) — ✅ THUỘC HẠ ĐÃ XOÁ

Không import từ bất kỳ nơi nào trong repo. Header file ghi "Enhanced version with API optimization" — chắc được tạo ra như sandbox rồi quên merge vào `Cogs.tsx`. Các ý tưởng cache trong file này đã nằm trong `COGS_API_OPTIMIZATION.md`.

### E.2 `PnL_Enhanced.tsx` (858 LOC) — ✅ THUỘC HẠ ĐÃ XOÁ

Tương tự, header ghi "Auto-load mechanism, Countdown timer, Data persistence" nhưng route trong `App.tsx` đang dùng `PnL.tsx`. File này reference tới `pnl_snapshots` chưa tồn tại (xem B.1). Các hook `useSavePnLSnapshot/useAutoRefreshSetting` được file này import VẪN CÒN trong `src/hooks/usePnLSnapshots.ts` (dùng bởi `SettingsAutoRefresh.tsx`) → không bị ảnh hưởng.

### E.3 Files cần xác minh thêm (chưa xoá)

Nên hỏi lại trước khi xoá:
- `src/hooks/usePnLSnapshots.ts` + `src/hooks/useShopifyOrdersCache.ts` — nếu không định apply migration 001/002 thì nên xoá cùng.
- `src/migrations/001_*.sql` và `002_*.sql` — nếu đã abandon thì di chuyển vào `docs/_archived-migrations/`.
- Root-level docs trùng (`COGS-*`, `SHOPIFY_ORDERS_CACHE_STRATEGY.md`, `COGS_QUICK_FIX.md`…) — merge/archive.

---

## F. Security advisors (từ Supabase linter)

### F.1 RLS policy `USING (true)` — 16 bảng

`public.blocked_customer_tags`, `cj_orders`, `cj_product_map`, `cj_shipments`, `cj_webhook_log`, `cogs_exclusions`, `cogs_mapping`, `cogs_physical_products`, `facebook_ad_spend`, `field_mappings`, `fixed_costs`, `sync_logs`, `system_settings`, + `fb_curator.config/criteria`.

Consequence — với anon key công khai (`VITE_SUPABASE_ANON_KEY` nằm ở frontend), bất kỳ ai cũng SELECT/UPDATE/DELETE được, **bao gồm `system_settings` đang chứa SHOPIFY_ADMIN_TOKEN, FACEBOOK_ACCESS_TOKEN, CJ_API_PASSWORD** 🚨.

Execution (HIGH PRIORITY — nằm ngoài phạm vi "sửa LOW"):
1. Đổi các policy `USING (true)` thành `USING ((auth.jwt()->>'role') = 'service_role')` cho các bảng nhạy cảm.
2. Thu hồi và xoay lại các secret đã commit (SHOPIFY_ADMIN_TOKEN, FACEBOOK_ACCESS_TOKEN, CJ credentials) — chúng đã bị expose qua bảng công khai và lại còn hardcode trong file `FB Token vinh vien.txt`, `Shopify dev secret.txt` ngoài repo.
3. Di chuyển `VITE_SUPABASE_ANON_KEY` call chỉ dùng cho frontend; server-side (api/*) bắt buộc dùng `SUPABASE_SERVICE_ROLE_KEY`.

### F.2 Function `search_path` mutable — 3 function

`fb_curator.touch_updated_at`, `public.cj_touch_updated_at`, `public.adpnl_strip_suffix`. Sửa:
```sql
ALTER FUNCTION public.cj_touch_updated_at() SET search_path = public, pg_temp;
```

### F.3 `pod_tool.*` RLS bật nhưng không có policy — 6 bảng

Bảng bị lock toàn bộ trừ service role. Nếu frontend không cần thì OK; nếu cần thì thêm policy read/write cụ thể.

### F.4 Extension `pg_net` trong schema `public`

Di chuyển: `ALTER EXTENSION pg_net SET SCHEMA extensions;` (sau khi test — nhiều cron hiện gọi `net.http_post` từ schema cũ).

---

## G. Performance advisors

- **23 unused indexes** (list đầy đủ trong Supabase advisors). Phần lớn trên `cj_*`, `agent_*`, `facebook_ad_spend_product` — có thể do tạo preemptive. Khuyến nghị giữ `unique` index, drop các `idx_*` không dùng sau 2 tuần observe thêm.
- **2 FK không index** trong `fb_curator.cooldown` và `fb_curator.runs` — thêm index:
  ```sql
  CREATE INDEX ON fb_curator.cooldown(removed_run_id);
  CREATE INDEX ON fb_curator.runs(criteria_id);
  ```

---

## H. Action plan đề xuất

### Đợt 1 — LOW risk (làm NGAY, thuộc hạ đã làm phần ✅)
- ✅ Xoá `Cogs_Optimized.tsx` (591 LOC)
- ✅ Xoá `PnL_Enhanced.tsx` (858 LOC)
- ⬜ Thêm helper `getSystemSettings([...])` vào `api/shopify/_helpers.ts` (mới, không thay đổi ai)
- ⬜ Cache Supabase client ở module scope trong `_helpers.ts`
- ⬜ Thêm `src/lib/queryDefaults.ts` + dùng ở các hook mới

### Đợt 2 — MEDIUM risk (cần review)
- ⬜ Quyết định B.1: apply hay xoá hook đang query table không tồn tại
- ⬜ Gộp `cogs_mapping` + `cogs_physical_products` (migration + sửa hook/page)
- ⬜ Tạo bảng `job_runs` generic, chuyển 3 bảng cũ thành VIEW
- ⬜ Materialized view `facebook_ad_spend_daily`
- ⬜ Drop 23 unused indexes (phase)

### Đợt 3 — HIGH risk / security
- ⬜ Siết RLS policy cho các bảng nhạy cảm
- ⬜ Xoay lại toàn bộ secret đã nằm trong `system_settings`
- ⬜ Tách server-side client dùng `SUPABASE_SERVICE_ROLE_KEY`
- ⬜ Fix 3 function mutable search_path

---

## I. Fix đã thực hiện

### I.1 Đợt 1 — Dead code cleanup (LOW risk, session trước)

| File | Action | LOC giảm | Verify |
|------|--------|----------|--------|
| `src/pages/store/Cogs_Optimized.tsx` | **DELETED** | 591 | Grep confirm 0 import |
| `src/pages/store/PnL_Enhanced.tsx` | **DELETED** | 858 | Grep confirm 0 import; hook `usePnLSnapshots` vẫn còn cho `SettingsAutoRefresh` |
| **Tổng** | | **1449 LOC** | |

### I.2 Đợt 1 — Perf helpers (LOW risk, session 2026-04-20 cont'd)

| File | Action | Nội dung | RTT save |
|------|--------|----------|----------|
| `api/shopify/_helpers.ts` | **MODIFIED** | Cache Supabase client module-scope (singleton + disable persistSession/autoRefresh/detectSession) | — |
| `api/shopify/_helpers.ts` | **ADDED** | Helper `getSystemSettings(keys[])` batch (1 round-trip thay vì N) | — |
| `api/shopify/_helpers.ts` | **MODIFIED** | `getShopifyConfig()` gộp 2 key Supabase vào 1 RTT khi fallback env | ↓ 1 RTT |
| `api/cj/_helpers.ts` | **MODIFIED** | `getCJAccessToken()` batch 4 key (email/password/token/expires) | ↓ 3 RTT |
| `api/cj/fulfill.ts` | **MODIFIED** | Batch `CJ_DEFAULT_SHIPPING` + `CJ_AUTO_PAY_ENABLED` đầu handler | ↓ 1 RTT |
| `src/lib/queryDefaults.ts` | **CREATED** | Constants `QUERY_STALE`/`QUERY_GC`/`REFETCH_INTERVAL` | — |
| `src/main.tsx` | **MODIFIED** | QueryClient default dùng `QUERY_STALE.medium` + `QUERY_GC.default` | — |
| `src/hooks/useCogs.ts` | **MODIFIED** | 3 query (`cogs-mapping`/`cogs-exclusions`/`cogs-physical`) → `longLived` (30 min) | ↓ refetch spam |
| `src/hooks/useShopifyOrdersCache.ts` | **MODIFIED** | 2 query orders → `historical`/`QUERY_GC.long`; 1 query sync status → `medium` | — |
| `src/hooks/usePnLSnapshots.ts` | **MODIFIED** | `QUERY_STALE.shortLived` | — |
| `src/hooks/useCJFulfillment.ts` | **MODIFIED** | `QUERY_STALE.shortLived` (× 2) | — |
| `src/pages/fb-curator/FBCurator.tsx` | **MODIFIED** | `REFETCH_INTERVAL.live` (× 2) | — |

**Tổng tiết kiệm mỗi request:**
- `fulfill.ts` happy path: **5 RTT** (4 CJ + 1 fulfill cfg) → **1 RTT CJ + 1 RTT handler cfg = 2 RTT** (giảm 3 RTT ≈ 240ms)
- `getCJAccessToken()` happy path: **2 RTT** → **1 RTT** (giảm 1 RTT ≈ 80ms)
- `getShopifyConfig()` fallback: **2 RTT** → **1 RTT** (giảm 1 RTT ≈ 80ms)

**Verify:**
- `tsc --noEmit -p tsconfig.json` → exit 0 (src/ sạch)
- `tsc --noEmit` trên `api/shopify/_helpers.ts` + `api/cj/_helpers.ts` → exit 0
- `api/cj/fulfill.ts` còn lỗi pre-existing `@vercel/node` (chưa cài devDep) — không phải do session này
- Vite build trong sandbox fail vì `esbuild` binary build cho Windows, không chạy được Linux — chạy local Windows bình thường
- Không đổi API public, không đổi queryKey → TanStack cache cũ vẫn tương thích

### I.3 Đợt 2 — Additive (LOW risk, session 2026-04-20 cont'd)

Các hạng mục *additive* (chỉ thêm hoặc chuẩn hóa literal số → constants), không đụng schema/RLS, chưa commit git.

| File | Action | Nội dung |
|------|--------|----------|
| `src/lib/utils.ts` | **ADDED** | `formatVND`, `formatDateTimeVN({showSeconds?})`, `formatDateVN`, `formatRoas` |
| `src/pages/store/PnL.tsx` | **MODIFIED** | Import `QUERY_STALE/QUERY_GC`; 4 query (orders/cogs-mapping/fixed-costs/fb-ads-spend) dùng constants; `formatVND` local → import từ utils |
| `src/pages/store/FixedCosts.tsx` | **MODIFIED** | `staleTime: QUERY_STALE.longLived` |
| `src/pages/store/Cogs.tsx` | **MODIFIED** | `staleTime: QUERY_STALE.medium` cho query orders-for-cogs |
| `src/pages/store/AdSpend.tsx` | **MODIFIED** | `staleTime: QUERY_STALE.medium` |
| `src/pages/Dashboard.tsx` | **MODIFIED** | `staleTime: QUERY_STALE.longLived` cho 2 count query |
| `src/components/MatchLevelPanel.tsx` | **MODIFIED** | `staleTime: QUERY_STALE.medium`; `fmtDate` local → `formatDateVN` |
| `src/pages/fb-curator/FBCuratorRunDetail.tsx` | **MODIFIED** | `staleTime: QUERY_STALE.longLived` (× 2 — run immutable sau finish); `fmtTime` local → `formatDateTimeVN({showSeconds:true})` |
| `src/pages/fb-curator/FBCuratorConfig.tsx` | **MODIFIED** | `staleTime: QUERY_STALE.longLived` |
| `src/pages/fb-curator/FBCurator.tsx` | **MODIFIED** | `fmtTime` local → `formatDateTimeVN()` |
| `src/pages/analytics/AnalyticsAds.tsx` | **MODIFIED** | `staleTime: QUERY_STALE.medium` |

**Tác động:**
- Toàn bộ useQuery giờ đã có `staleTime` tường minh — loại bỏ refetch không cần thiết khi remount component.
- 3 local formatter (`formatVND`, 2 × `fmtTime`, `fmtDate`) → gom vào utils → giảm code trùng ~30 LOC.
- Audit tương lai: sửa policy stale/refetch chỉ 1 file (`queryDefaults.ts`).

**Verify:**
- `tsc --noEmit -p tsconfig.json` → exit 0
- Tất cả đều additive, không đổi queryKey / API / DB schema → backward compatible 100%.

### I.4 Đợt 2 — Backend API hot-path (additive, LOW risk, session 2026-04-20 cont'd tiếp)

Tối ưu module-scope cache + song-song hoá RTT cho các Vercel serverless endpoint. Tất cả đều *additive*, không đổi response shape.

| File | Action | Nội dung |
|------|--------|----------|
| `api/gsheets/_helpers.ts` | **MODIFIED** | Cache module-scope `_cachedServiceAccount` (TTL 30 phút) + `_cachedAccessToken` (Google cấp 3600s, chừa 5 phút buffer). Warm Vercel instance bỏ hẳn JWT sign + `POST oauth2.googleapis.com/token` suốt ~55 phút. |
| `api/shopify/status.ts` | **MODIFIED** | Gom 3 query Supabase tuần tự → 1 `getSystemSettings(['SHOPIFY_ADMIN_TOKEN','shopify_domain'])` (1 RTT thay vì 3). Xoá `getShopifyToken()` + `getShopifyStoreUrl()` trùng lặp. |
| `api/cj/wallet.ts` | **MODIFIED** | `Promise.all([cjGetWalletBalance(token), getSystemSetting('CJ_WALLET_MIN_BALANCE')])` — CJ API call và Supabase read độc lập → song song (~80 ms/request). |
| `api/cj/tracking-webhook.ts` | **MODIFIED** | Trong `handleShipped`: song song `upsert cj_shipments` + `update cj_orders status` + `getShopifyConfig()` (3 thao tác độc lập sau khi có `order`) → `Promise.all` thay vì 3 RTT tuần tự. Gom `shippedAt` thành 1 biến để đảm bảo 2 record cùng timestamp. |

**Tác động (dự phóng):**
- `gsheets/read.ts|write.ts|meta.ts|status.ts` ở warm instance: *trước* ~180 ms (JWT sign + oauth POST + Google Sheets API) → *sau* ~40 ms (skip 2 bước đầu). Ước tính 140 ms/request × 4 endpoint.
- `shopify/status.ts`: 3 RTT × ~40 ms = 120 ms → 1 RTT 40 ms. Save ~80 ms.
- `cj/wallet.ts`: max(CJ ~120 ms, Supabase ~40 ms) = 120 ms thay vì tổng 160 ms. Save ~40 ms.
- `cj/tracking-webhook.ts` (đường shipped): 3 RTT × ~40-80 ms = 120-240 ms → max còn ~80 ms. Save ~40-160 ms/webhook.

**Verify:**
- `tsc --noEmit -p tsconfig.json` → exit 0 (toàn dự án, sau cả 4 edit)
- Không đổi contract public của endpoint nào → frontend không cần đổi.
- Cache chỉ sống trong phạm vi 1 Vercel instance — cold start vẫn chạy đúng flow cũ, không gây stale giữa các instance.

**Note ngoài scope (không sửa — chỉ ghi lại để đại vương nắm):**
- `cj_webhook_log` dùng `.update().eq().order().limit(1)` — Supabase JS SDK không hỗ trợ `order/limit` trên UPDATE, query thực tế có thể update nhiều row hoặc fail silent. Cần refactor thành subquery theo id. Đây là bug cũ, không phát sinh từ optimization lần này.

---

## K. Chờ quyết định đại vương (Đợt 2/3)

### K.1 Đợt B+C đã soạn sẵn (session 2026-04-20 cont'd lần 3)

Thuộc hạ đã viết sẵn 2 migration + 1 runbook; chờ đại vương apply trên branch dev trước khi merge prod:

| File | Scope | Action tiếp |
|------|-------|-------------|
| `src/migrations/006_consolidate_schema.sql` | B.3 merge cogs, B.4 job_runs, B.5 materialized view, FK indexes, drop index (phased, commented) | Đại vương apply lên branch dev, smoke test |
| `src/migrations/007_security_hardening.sql` | RLS siết 16 bảng (10 service-only + 5 anon-read + 5 fb_curator), search_path fix cho 3 function, pg_net move (commented) | Cần set `SUPABASE_SERVICE_ROLE_KEY` trước khi apply prod |
| `api/shopify/_helpers.ts` | Module cache ưu tiên SERVICE_ROLE_KEY, fallback anon — log cảnh báo cold start nếu fallback | Đã verify tsc |
| `api/gsheets/_helpers.ts` | Fetch Supabase system_settings ưu tiên SERVICE_ROLE_KEY | Đã verify tsc |
| `ROTATE_SECRETS_RUNBOOK.md` | 6-bước runbook rotate 5 secret + timeline ~2h | Đại vương thực thi thủ công |

**Blocker còn lại:**
- Git state anomaly (`.git/index.lock` stuck trên NTFS) — đại vương chạy `git reset HEAD` trên PowerShell/Git Bash Windows để gỡ.

### K.2 Đợt cũ — chờ quyết định cốt lõi

Đợt 1 đã xong. Đợt 2-3 cần xác nhận trước khi thuộc hạ triển khai:

**Đợt 2 — MEDIUM risk (cần quyết định):**
1. B.1 Migration 001/002 + hook `useShopifyOrdersCache`/`usePnLSnapshots` → **apply hay xoá?**
2. B.3 Gộp `cogs_mapping` + `cogs_physical_products` (có migration sẵn sàng) → OK chạy?
3. B.4 Tạo bảng `job_runs` generic, chuyển 3 bảng log thành VIEW → OK chạy?
4. B.5 Materialized view `facebook_ad_spend_daily` → OK chạy?
5. Drop 23 unused indexes → OK chạy phased?

**Đợt 3 — HIGH risk security (quan trọng nhất):**
1. Siết RLS policy cho 16 bảng đang `USING (true)` → **CRITICAL**
2. Rotate toàn bộ secret đã expose qua `system_settings` (SHOPIFY_ADMIN_TOKEN, FACEBOOK_ACCESS_TOKEN, CJ_API_PASSWORD…)
3. Di chuyển `api/*` sang `SUPABASE_SERVICE_ROLE_KEY`
4. Fix 3 function `search_path` mutable

---

## J. Next step gợi ý cho đại vương

Thuộc hạ đề xuất đợt tiếp theo làm theo thứ tự:

1. **Xác nhận B.1** — Đại vương muốn giữ hay bỏ migration 001/002? Nếu bỏ, thuộc hạ dọn 2 file hook + phần Dashboard.tsx liên quan.
2. **Duyệt Đợt 2** — merge `cogs_*` và gom log tables. Thuộc hạ viết sẵn migration + dry-run trên Supabase branch.
3. **Ra trận Đợt 3 (security)** — cần confirm vì sẽ ảnh hưởng cả Vercel env + rotate secret.
