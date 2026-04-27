# Gmail Morning Triage — 2026-04-27

> Bẩm đại vương, thuộc hạ đã quét inbox `marketing@faithfuldivine.com` + `cs@faithfuldivine.com` trong 24h qua (từ ~2026-04-26 00:40 đến 2026-04-27 00:40 UTC). Dưới đây là tường trình.

## Snapshot
- **Tổng email 24h:** 50
- 🔴 **Urgent:** 1
- 🟡 **Important:** 2
- 💬 **CSKH:** 1
- ⚪ **Junk / Auto-notification:** 46

> Lưu ý: 41/46 email "junk" thực chất là **notification đơn hàng mới (FFD2877 → FFD2917)** — tức **41 đơn hàng trong ~28h**. Đây là signal kinh doanh tích cực, không cần action nhưng đáng ghi nhận.

---

## 🔴 URGENT (cần xử lý sáng nay)

### 1. Khách hàng Della (drush0426@gmail.com) — "I never received it!"
- **1 câu tóm tắt:** Della reply lại email "Your order has been delivered 🤍" gửi ngày 22/4 và khẳng định **chưa nhận được hàng** dù hệ thống báo đã giao.
- **Link Gmail thread:** https://mail.google.com/mail/u/0/#inbox/19dcba1ef4031d80
- **Đề xuất hành động:**
  1. Truy đơn của Della (search trong Shopify admin để tìm order ID + tracking number — Della = "Della" trong email greeting).
  2. Liên hệ shipping carrier để mở claim "lost in transit / delivered but not received".
  3. Reply Della trong **vài giờ tới** với 2 option: (a) reship miễn phí nếu carrier xác nhận lost, hoặc (b) hoàn tiền full. Dùng tone Jessica: warm, faith-rooted, không phòng thủ.
  4. Nếu carrier báo "delivered to address" → guideline thuộc hạ: vẫn ưu tiên reship/refund 1 lần để giữ trust + tránh negative review (đơn ~$30, downside thấp, upside lớn).

---

## 🟡 IMPORTANT (xử lý trong ngày)

### 1. Facebook Ads spend tiếp tục $900/ngày — KHÔNG khớp với chỉ thị "rescale"
- **1 câu tóm tắt:** Slash thông báo 2 charge **$900 FB** (Apr 25 + Apr 26) → **$1,800 trong 2 ngày** trên thẻ "Infinite Impressions Creations LLC".
- **Link Gmail thread:** https://mail.google.com/mail/u/0/#inbox/19dcb692380dc980 (Apr 26) · https://mail.google.com/mail/u/0/#inbox/19dc649a0c8112a1 (Apr 25)
- **Đề xuất hành động:**
  - Theo CLAUDE.md mục 2.4, rule "Rescale campaign FB" yêu cầu **spend giảm ≥ 50% hoặc = 0**. Hiện spend đang ở mức cao — cần đại vương xác nhận: (a) đây là kế hoạch mới (đã đổi chiến lược), hay (b) pacing chưa được điều chỉnh?
  - Cross-check với Supabase `facebook_ad_spend` (run dashboard 12h tới sẽ tự verify) để biết ROAS hôm nay.
  - Nếu ROAS < 2.30 → kill campaign; nếu ≥ 2.30 → giữ + theo dõi.

### 2. Joy Loyalty Weekly Report (Apr 21–27)
- **1 câu tóm tắt:** Avada Joy gửi báo cáo tuần — Loyalty members **32**, given rewards **+3**, top earning program là "Sign Up Newsletter (850 pts)".
- **Link Gmail thread:** https://mail.google.com/mail/u/0/#inbox/19dcc46233878fea
- **Đề xuất hành động:**
  - +3 reward / tuần là **rất thấp** so với volume 41 đơn/ngày → loyalty program đang **không được khách kích hoạt**.
  - Đề xuất: thêm CTA "Earn points" vào post-purchase email + thank-you page. Có thể đưa vào báo cáo tuần (`fd-weekly-review`) như SCE recommendation.

---

## 💬 CSKH pattern

- **1 câu hỏi về size chart** (susanndaren@gmail.com qua Shopify Inbox) — pattern thường lặp, đã có template.
  - Link Gmail thread: https://mail.google.com/mail/u/0/#inbox/19dcb4b9ed6a7491
  - Reply trong Shopify Inbox: https://inbox.shopify.com/store/v0hgim-yf/conversations/open/019dcb4a-2bab-7859-b7b5-431636b6c52e

> Pattern 24h: 1 size question, 0 shipping question, 0 return request. Volume CSKH thấp bất thường so với 41 đơn → có thể khách đang tự service tốt, hoặc Shopify Inbox / FB DM đang nuốt mất một phần (cần verify).

---

## ⚪ JUNK / Auto-notification (đếm thôi)

| Loại | Số lượng |
|---|---|
| 🛒 Shopify order notifications (FFD2877 → FFD2917) | **41** |
| 💳 Slash charge auth (FB $900 ×2 + Shopify $79.90) | 3 |
| 💵 Shopify billing $79.90 (Apr 26) | 1 |
| 🏦 Shopify payout $181.77 (Apr 26) | 1 |
| 📩 Shopify trial promo "$1 extend" | 1 |

---

## Đề xuất của thuộc hạ

1. **ROAS estimate đáng lo:** 41 đơn / ~28h → ~35 đơn/ngày. Nếu AOV ~$32 thì revenue ngày ~$1,120. Pair với spend FB $900/ngày → **ROAS estimate chỉ ~1.24x** (chỉ tính ad-attributed orders thì còn thấp hơn). **Đây là red flag** — cần verify ROAS thực qua Supabase trong run dashboard kế tiếp; nếu confirm < target 2.30x thì PHẢI rescale spend xuống.

2. **Inbox channel coverage:** Hầu hết CSKH có vẻ đi qua Shopify Inbox (1 thread duy nhất trong Gmail), không phải email. Đề xuất set up forward Shopify Inbox + FB DM về Gmail label `cs/inbound` để morning triage này coverage 100% mọi inbound. Không thì thuộc hạ đang triage **mù 1 mắt**.

3. **Lost package case:** Della là customer "lost package" thứ N? Nếu pattern này lặp lại → có thể là vấn đề carrier. Đề xuất tag thread `delivery-issue` trong Gmail để track theo thời gian.

---

*Bẩm báo: thuộc hạ đã hoàn tất triage. Báo cáo này được generate tự động — đại vương chỉ cần đọc 3 mục trên cùng (URGENT + 2 IMPORTANT) trong < 5 phút.*
