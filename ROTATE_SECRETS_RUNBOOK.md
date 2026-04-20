# Runbook — Rotate Secrets & Apply Security Hardening (Đợt 3)

**Ngày:** 2026-04-20
**Mục đích:** Siết RLS Supabase + xoay toàn bộ secret đã expose qua `system_settings`.
**Người thực thi:** Đại vương (một số bước thuộc hạ không được phép tự làm: rotate key trên dashboard external + sửa Vercel env var = modifying security permissions).

Thứ tự thực hiện **BẮT BUỘC** — làm sai thứ tự sẽ khiến production down.

---

## Pre-flight — Checklist trước khi bắt đầu

| # | Điều kiện | Xác nhận |
|---|-----------|----------|
| 1 | Đã có Supabase branch `dev` (hoặc sẵn sàng tạo) để test migration | ⬜ |
| 2 | Đã backup `.env.local` + Vercel env var hiện tại | ⬜ |
| 3 | Xác định thời điểm low-traffic (đêm Việt Nam, ~01-05h) | ⬜ |
| 4 | Có quyền rotate ở Shopify Admin, Facebook Business, CJ Dropshipping | ⬜ |
| 5 | Đọc xong `src/migrations/007_security_hardening.sql` | ⬜ |

---

## Bước 1 — Tạo Supabase branch dev, apply migration 006 + 007

**Người làm:** Đại vương (hoặc thuộc hạ nếu được cấp quyền MCP branch).

```
# Trong Supabase dashboard hoặc CLI
1. Tạo branch 'hardening-dev' từ main
2. Apply migration 006_consolidate_schema.sql trên branch
3. Apply migration 007_security_hardening.sql trên branch
4. Chạy smoke test (section "Smoke test" dưới cùng file 007)
5. Nếu OK → giữ branch mở, chưa merge
```

**Stop-check:** Nếu smoke test fail → rollback branch, không đi tiếp.

---

## Bước 2 — Tạo `SUPABASE_SERVICE_ROLE_KEY` cho Vercel

**Người làm:** Đại vương.

1. Vào Supabase dashboard → Project Settings → API → Service Role Secret.
2. Copy value (chỉ hiển thị lần đầu, nếu không thấy thì **Regenerate**).
3. Thêm vào Vercel:
   ```
   Vercel project → Settings → Environment Variables
   Key:   SUPABASE_SERVICE_ROLE_KEY
   Value: eyJhbGciOi... (dán vào, KHÔNG commit vào git)
   Scope: Production + Preview + Development
   ```
4. Trigger redeploy Vercel để env var được pick up.

**Verify:** Cold-start request đầu tiên sẽ **không** log cảnh báo `SUPABASE_SERVICE_ROLE_KEY chưa set` (xem `api/shopify/_helpers.ts:getSupabaseClient`).

---

## Bước 3 — Merge migration sang production

**Người làm:** Đại vương.

1. Supabase dashboard → merge branch `hardening-dev` vào `main`.
2. Kiểm tra ngay sau merge:
   - `/store/pnl` — cogs, fixed_costs, facebook_ad_spend phải load (anon SELECT).
   - `/admin/cj/*` — api/cj/wallet, api/cj/fulfill phải chạy (service_role).
   - `/analytics/ads` — RPC `fbc_adpnl_*` phải trả data.
3. Nếu bất kỳ call nào fail → kiểm tra log Vercel (runtime logs) xem có message "row-level security" không.

---

## Bước 4 — Rotate 5 secret đã bị expose

Thứ tự rotate: **Shopify → Facebook → CJ → Klaviyo → Google Service Account**.

### 4.1 Shopify Admin Token

**Rủi ro:** TRUNG BÌNH — rotate sai sẽ cắt sync đơn đến khi token mới được set.

1. Shopify Admin → Apps → Private app của đại vương → **Generate new access token**.
2. Update đồng thời 2 chỗ (chuẩn bị sẵn giá trị, paste nhanh):
   - Vercel env: `SHOPIFY_ACCESS_TOKEN` = token mới
   - Supabase `system_settings` (qua dashboard): `SHOPIFY_ADMIN_TOKEN` = token mới
3. Redeploy Vercel.
4. Verify: `curl https://<vercel>/api/shopify/status` → `tokenSource: "env"`, `hasToken: true`.
5. Revoke token cũ trên Shopify Admin.

### 4.2 Facebook Access Token (System User permanent)

1. Business Manager → System Users → [User đã tạo] → Generate new token.
2. Cần permission: `ads_read`, `ads_management`, `business_management`, `read_insights`.
3. Update:
   - Vercel env: `FACEBOOK_ACCESS_TOKEN` (hoặc tên env đang dùng)
   - Supabase `system_settings`: `FACEBOOK_ACCESS_TOKEN`
4. Redeploy Vercel.
5. Verify: `curl https://<vercel>/api/facebook/sync-spend?dry=true`.
6. Revoke token cũ (Facebook không auto-revoke).

### 4.3 CJ Dropshipping credentials

CJ dùng email/password → không có "revoke" thủ công; thay password là đủ.

1. CJ Dashboard → Account → Change Password.
2. Update Supabase `system_settings`:
   - `CJ_API_PASSWORD` = password mới
   - **XÓA** cả 2 key cũ `CJ_ACCESS_TOKEN` và `CJ_TOKEN_EXPIRES_AT` (để force relogin).
3. Call `curl https://<vercel>/api/cj/wallet` → server tự login lại và save token mới.
4. Verify: response có `amount` và `low_balance` trường.

### 4.4 Klaviyo API key

1. Klaviyo dashboard → Settings → API Keys → **Disable** key cũ, Create new Private API Key.
2. Permissions cần: Profiles / Lists / Campaigns / Templates / Events / Metrics (R-W).
3. Update MCP config (nếu Cowork connect Klaviyo), Supabase `system_settings.KLAVIYO_API_KEY`, Vercel env nếu có.
4. Verify: `fd-weekly-review` skill chạy thành công.

### 4.5 Google Service Account — optional, khuyến nghị rotate key

1. Google Cloud Console → IAM → Service Accounts → [SA đang dùng] → Keys → **Add Key → Create new JSON**.
2. Copy nội dung JSON mới.
3. Update Supabase `system_settings.GSHEET_SERVICE_ACCOUNT_JSON` = JSON mới (stringified).
4. Verify: `curl https://<vercel>/api/gsheets/status` — `hasServiceAccount: true`.
5. Xóa key cũ ở Google Cloud Console (không bấm delete ngay — giữ 24h để rollback).

---

## Bước 5 — Xác nhận bảng `system_settings` đã an toàn

Sau tất cả rotate, chạy test sau với anon key để đảm bảo secret không còn expose:

```bash
# Dùng anon key (lấy từ VITE_SUPABASE_ANON_KEY)
curl "https://<project>.supabase.co/rest/v1/system_settings?select=key,value" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>"
# Kỳ vọng: [] (empty array) — nếu trả về rows thì RLS chưa siết thành công
```

---

## Bước 6 — Dọn dẹp (optional)

1. Xóa file credential hardcode ngoài repo (nếu còn): `FB Token vinh vien.txt`, `Shopify dev secret.txt` trên máy local.
2. Thêm các file đó vào `.gitignore` nếu chưa có.
3. Xóa key cũ khỏi Supabase `system_settings` sau khi confirm prod ổn định 24-48h.

---

## Rollback plan

**Nếu prod down sau bước 3 (merge migration):**

1. Supabase dashboard → revert migration 007 (drop các policy `*_service_only` và `*_anon_read`, tạo lại `USING (true)` tạm thời).
2. Redeploy Vercel.
3. Debug ở branch dev, không push fix trực tiếp lên prod.

**Nếu API fail sau bước 4 (rotate secret):**

1. Kiểm tra Vercel runtime log: key mới có bị whitespace/newline không.
2. Rollback từng secret một: put lại giá trị cũ (vẫn còn trong Supabase DB trước khi xóa).
3. Rotate lại theo thứ tự nếu token cũ đã revoke ở service upstream.

---

## Timeline gợi ý

| Thời điểm | Bước | Downtime dự kiến |
|-----------|------|-------------------|
| T+0 | 1–2 (branch + env var) | 0 (parallel) |
| T+30ph | 3 (merge migration) | ~30s tải lại connection pool |
| T+45ph | 4.1 Shopify | <10s nếu đổi cả 2 chỗ song song |
| T+60ph | 4.2 Facebook | <10s |
| T+75ph | 4.3 CJ | ~5s cho server relogin |
| T+90ph | 4.4 Klaviyo | không down (chỉ ảnh hưởng jobs tiếp theo) |
| T+105ph | 4.5 Google | không down |
| T+120ph | 5–6 Verify | — |

Tổng: ~2h.

---

## Liên hệ khẩn

Nếu có vấn đề trong quá trình rotate, ping thuộc hạ ngay với log Vercel + error message. Tránh tự chỉnh SQL trên prod nếu không chắc.
