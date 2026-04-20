# CJ Fulfill Module — Tường trình thiết kế

**Ngày:** 2026-04-18
**Tác giả:** thuộc hạ (AI) — bẩm đại vương Dinh Trong Trang
**Phạm vi:** ncc-admin · thêm module tích hợp CJ Dropshipping song song với `Auto FF` (Google Sheets) đang chạy.

---

## 1. Mục tiêu

Cho FaithfulDivine một luồng fulfillment tự động qua CJ Dropshipping: khi Shopify có order mới, hệ thống map SKU → gửi order sang CJ → theo dõi thanh toán, in POD, shipped → tự push tracking ngược về Shopify để khách nhận email "on the way".

**Không thay thế** module `Auto FF` hiện tại (dùng Google Sheets thủ công) — hai luồng chạy song song cho các SKU khác nhau. SKU nào có mapping trong `cj_product_map` thì chạy CJ, còn lại vẫn theo flow cũ.

---

## 2. Kiến trúc

```
┌─────────────┐    webhook/cron     ┌────────────────┐
│   Shopify   │ ──────────────────► │  /api/cj/*     │
└─────────────┘                     │  (serverless)  │
      ▲                             └────────┬───────┘
      │ fulfillment push                     │
      │                                      ▼
      │                             ┌────────────────┐
      │                             │   Supabase     │
      │                             │  cj_orders     │
      │                             │  cj_product_map│
      │                             │  cj_shipments  │
      │                             │  cj_webhook_log│
      │                             └────────┬───────┘
      │                                      │
      │                                      ▼
      │                             ┌────────────────┐
      └──────── tracking ◄───────── │  CJ API        │
                                    │  (developers.  │
                                    │   cjdropship   │
                                    │   ping.com)    │
                                    └────────────────┘
```

- **Frontend:** `src/pages/store/CJFulfillment.tsx` — 4 tab (Dashboard, Queue, Mapping, Settings). Dùng `@tanstack/react-query` qua hook `useCJFulfillment.ts`.
- **Backend:** Vercel serverless trong `api/cj/`. Stateless, dựa vào Supabase làm source of truth.
- **CJ client:** `src/lib/cj.ts` — wrapper typed cho CJ Developer API 2.0.
- **Auth:** CJ token 15 ngày, cache trong `system_settings` (`CJ_ACCESS_TOKEN` + `CJ_TOKEN_EXPIRES_AT`). Helper `getCJAccessToken()` tự refresh khi còn < 1h.

---

## 3. Data model (migration `004_cj_fulfillment.sql`)

### `cj_product_map`
Liên kết 1-1 giữa Shopify variant và CJ variant. Unique trên `shopify_variant_id`. Có field POD (front/back/mockup URL) để truyền artwork cho đơn in.

### `cj_orders`
State machine cho mỗi đơn CJ:

```
queued → submitted → paid → in_production → shipped → delivered
                                                    ↘ cancelled
                                           ↘ error
```

`request_payload` + `response_payload` JSONB để debug khi CJ reject.

### `cj_shipments`
Một `cj_orders` có thể có nhiều shipment (CJ split kiện). Unique trên `tracking_number`. `pushed_to_shopify` đánh dấu đã POST fulfillment sang Shopify chưa.

### `cj_webhook_log`
Audit raw payload. Mỗi event CJ gửi về đều append 1 row. `processed` flag sau khi xử lý thành công.

### `system_settings` (seed thêm)
10 key mới prefix `CJ_*` (xem tab Settings hoặc file migration).

---

## 4. API routes

| Route | Method | Mô tả |
|---|---|---|
| `/api/cj/status` | GET | Verify connection + wallet balance |
| `/api/cj/wallet` | GET | Số dư ví CJ + cảnh báo low balance |
| `/api/cj/orders` | GET | List `cj_orders` (có filter status) |
| `/api/cj/sku-map` | GET/POST/DELETE | CRUD mapping |
| `/api/cj/fulfill` | POST | Body `{shopifyOrderId}` → createOrder + optional auto-pay |
| `/api/cj/tracking-webhook` | POST | Endpoint CJ call khi shipped/delivered |

**Rate limit CJ:** 1 req/s/endpoint. Hiện tại gọi sequential trong route handler, chưa cần queue. Khi volume > 100 đơn/giờ cân nhắc queue riêng (BullMQ / Supabase cron).

---

## 5. Flow đơn end-to-end

1. **Order tạo trên Shopify** — hiện chưa có webhook auto, đại vương/thuộc hạ gọi tay `/api/cj/fulfill` từ UI hoặc qua Shopify webhook sau. Bước này sẽ hoàn thiện ở phase 2.
2. **`/api/cj/fulfill` handler:**
   a. Fetch Shopify order detail
   b. Load `cj_product_map` cho các variant
   c. Nếu có variant chưa map → return 400 kèm danh sách unmapped, trạng thái để `error`
   d. Build CJ payload (địa chỉ, sản phẩm, shipping method) → gọi `createOrder`
   e. Upsert `cj_orders` status = `submitted`
   f. Nếu `CJ_AUTO_PAY_ENABLED=true` → gọi `confirmOrder` → status = `paid`
3. **CJ in POD + ship:** background phía CJ, không kiểm soát được.
4. **Webhook `ORDER_SHIPPED`:**
   a. Verify HMAC (nếu có `CJ_WEBHOOK_SECRET`)
   b. Append `cj_webhook_log`
   c. Upsert `cj_shipments`
   d. Update `cj_orders.status = shipped`
   e. POST `/fulfillments.json` sang Shopify với `tracking_info`
5. **Webhook `ORDER_DELIVERED`:** update status, không làm gì thêm.

---

## 6. Security

- RLS bật trên tất cả bảng, policy tạm `USING (TRUE)` theo pattern các migration trước. **TODO phase 2:** thêm auth (Supabase service role) nếu public khỏi VPN.
- CJ password lưu trong `system_settings.CJ_API_PASSWORD`. Setting type = `password` để Settings UI có thể hide. Khuyến cáo đại vương tạo sub-account CJ chỉ có quyền order, không quyền finance.
- Webhook verify HMAC-SHA256. Nếu `CJ_WEBHOOK_SECRET` rỗng → skip verify (dev mode) — **BẮT BUỘC set trước khi production**.
- Access token CJ cache trong DB cleartext. Rủi ro thấp vì token TTL 15d và chỉ server đọc; nếu muốn paranoid hơn có thể encrypt bằng pgcrypto.

---

## 7. Cách triển khai

```bash
# 1. Apply migration
psql $SUPABASE_DB_URL -f src/migrations/004_cj_fulfillment.sql
# HOẶC paste vào Supabase Studio → SQL Editor

# 2. Cấu hình credential (Settings UI hoặc SQL)
UPDATE system_settings SET value = 'your@email.com' WHERE key = 'CJ_API_EMAIL';
UPDATE system_settings SET value = '...' WHERE key = 'CJ_API_PASSWORD';
UPDATE system_settings SET value = 'true' WHERE key = 'CJ_AUTO_PAY_ENABLED';

# 3. Deploy Vercel — không cần thêm env (đọc từ Supabase)
vercel --prod

# 4. Test connection
curl https://<your-domain>/api/cj/status

# 5. Gắn webhook trên CJ Dashboard → Developer → Webhook
#    URL = https://<your-domain>/api/cj/tracking-webhook
#    Secret = giá trị trong CJ_WEBHOOK_SECRET
```

---

## 8. Hướng mở rộng (Phase 2)

- **Shopify webhook `orders/create`** → auto enqueue vào `cj_orders` (status=queued). Hiện phải gọi `/api/cj/fulfill` tay từ UI.
- **POD artwork pipeline:** tự gen mockup từ design + product base, upload lên CJ qua `/product/uploadImage`. Hiện chỉ có cột URL, chưa tự upload.
- **Freight comparison:** tab riêng so sánh CJPacket vs YunExpress vs USPS cho cùng order → chọn rẻ nhất.
- **COGS sync:** viết script định kỳ pull `cj_cost_usd` vào `shopify_order_items` để trang COGS có số thật thay vì ước tính.
- **Wallet auto top-up:** CJ có API deposit qua PayPal, có thể auto nạp khi < threshold.
- **Audit UI:** tab thứ 5 hiển thị `cj_webhook_log` cho debug.

---

## 9. File mới thêm

```
src/migrations/004_cj_fulfillment.sql         — schema
src/lib/cj.ts                                 — CJ API client
src/hooks/useCJFulfillment.ts                 — React Query hooks
src/pages/store/CJFulfillment.tsx             — UI 4-tab page
src/App.tsx                                   — +route
src/components/Sidebar.tsx                    — +nav entry
.env.example                                  — +CJ_* keys
api/cj/_helpers.ts                            — token cache + payload builder
api/cj/status.ts                              — connection check
api/cj/wallet.ts                              — balance
api/cj/orders.ts                              — list
api/cj/sku-map.ts                             — CRUD mapping
api/cj/fulfill.ts                             — core: submit order sang CJ
api/cj/tracking-webhook.ts                    — CJ → Shopify bridge
CJ_Fulfill_Module.md                          — tường trình này
```
