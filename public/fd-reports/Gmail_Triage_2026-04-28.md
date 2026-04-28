# Gmail Morning Triage — 2026-04-28

> Bẩm đại vương, thuộc hạ tường trình kết quả triage inbox 24h gần nhất (cutoff: 2026-04-27 ~03:30 UTC → 2026-04-28 ~03:30 UTC). Hai inbox được quét: `marketing@faithfuldivine.com` + `cs@faithfuldivine.com`.

## Snapshot
- **Tổng thread 24h:** 43
- 🔴 **Urgent:** 4
- 🟡 **Important:** 3
- 💬 **CSKH:** 6 (gồm cả 4 urgent/important)
- ⚪ **Junk/Promo/Auto:** 33

---

## 🔴 URGENT (cần xử lý sáng nay)

### 1. Suzy Jones — "Help placing my order" (contact form Shopify)
- **Tóm tắt:** Khách điền form trên store xin trợ giúp đặt đơn (gửi 27/04 14:22). Chưa có ai phản hồi sau >12h.
- **Link:** https://mail.google.com/mail/u/0/#inbox/19dd0d2a5da902a0
- **Liên hệ khách:** suzyqjones@icloud.com · 435-773-2625
- **Đề xuất:** CS phải reply trong sáng nay (giọng Jessica, đề nghị giúp chốt size/sản phẩm). Nếu cần follow-up qua phone, xin phép trước khi gọi vì khách đã để số. Đặt label `urgent`.

### 2. oneskinnieminnie@yahoo.com — "Issue with order FFD2698" (size sai)
- **Tóm tắt:** Khách kêu shirts quá nhỏ, "chưa bao giờ order size S trong đời", yêu cầu return/exchange. Đơn cũ FFD2698.
- **Link:** https://mail.google.com/mail/u/0/#inbox/19dd0934e95687a3
- **Đề xuất:** Theo SOP exchange — xin photo size tag + photo khách mặc, kiểm tra Printify production-spec đúng size không. Nếu Printify lỗi → free replacement. Nếu khách order nhầm size → áp dụng exchange có phí ship. Trả lời trong ngày.

### 3. Della Rush (drush0426@gmail.com) — "I never received it!" (giao hàng)
- **Tóm tắt:** Hôm 26/04 21:11 khách báo chưa nhận hàng dù USPS đã mark "Delivered". Jessica đã reply 27/04 02:34 đề nghị check thêm. Khách reply lại 27/04 10:15: "vẫn chưa thấy gì". Đang chờ tiếp.
- **Link:** https://mail.google.com/mail/u/0/#inbox/19dcba1ef4031d80
- **Đề xuất:** Theo SOP lost-package: yêu cầu khách (a) check porch/neighbor 24-48h, (b) liên hệ USPS local với tracking. Nếu sau 48h vẫn không có → xử lý reshipment hoặc refund. Đã >12h từ reply gần nhất, nên send ngay 1 follow-up đề xuất reship để giữ trải nghiệm.

### 4. Vercel — 4× Failed production deployment (`ncc-admin`)
- **Tóm tắt:** 4 email lỗi deploy production project `ncc-admin` trong khoảng 13:14–13:56 UTC ngày 27/04.
- **Link:** https://mail.google.com/mail/u/0/#inbox/19dcf13ce7e6d066
- **Đề xuất:** Đây là project phụ (admin tool), không phải storefront FaithfulDivine.com — không ảnh hưởng doanh thu trực tiếp. Tuy nhiên nếu là dashboard nội bộ, đại vương cần kiểm tra deployment logs (Vercel MCP đã có) hoặc giao dev fix trong ngày. Nếu không còn dùng → archive project để stop noise.

---

## 🟡 IMPORTANT (xử lý trong ngày)

### 1. Laura (bwal4kids@gmail.com) — Wrong size sweatshirt, đã confirm
- **Tóm tắt:** Order ngày 22/04 — khách đặt 2X nhưng nhận 3X. Jessica đã yêu cầu photo, khách đã gửi confirmation hôm 22/04 05:42. Thread im từ đó đến nay (~6 ngày).
- **Link:** https://mail.google.com/mail/u/0/#inbox/19db34780330dbd7
- **Đề xuất:** **CHẬM SLA exchange** — phải arrange replacement size 2X ngay hôm nay. Gửi label tracking mới + xin lỗi thêm về delay. Lý do delay cần ghi vào lessons (SOP gap về theo dõi exchange tickets).

### 2. salemnomore20@gmail.com — Reply "Stop" cho campaign nurture
- **Tóm tắt:** Khách reply "Stop" cho email "From my heart to yours 🤍" (campaign nurture gửi 26/04). Đây là yêu cầu unsub thủ công.
- **Link:** https://mail.google.com/mail/u/0/#inbox/19dcfe642fa4284a
- **Đề xuất:** Unsub khách khỏi marketing trên Klaviyo (`klaviyo_unsubscribe_profile_from_marketing` với email này). KHÔNG reply trong email — chỉ unsub silent. Tag profile để tránh re-add trong list rebuild.

### 3. expertawwal621@gmail.com — "Hit (30,000) revenue to Cs before Mother's day. ARE YOU IN??"
- **Tóm tắt:** Cold pitch từ gmail cá nhân, nội dung tease "30K revenue trước Mother's Day". Pattern điển hình của cold-email agency / freelancer pitch dịch vụ marketing.
- **Link:** https://mail.google.com/mail/u/0/#inbox/19dd1beeb8e27caf
- **Đề xuất:** Nhiều khả năng spam. Nếu đại vương muốn xem pitch → đọc full body trước khi reply. Nếu không quan tâm → đánh dấu spam + tạo filter chặn các cold pitch dạng "ARE YOU IN??" subject.

---

## 💬 CSKH pattern (24h)

Tổng số ticket CS đã chạm: **6**

- **3 ticket size/exchange:** Laura (wrong size 3X→2X), oneskinnieminnie (size S quá nhỏ FFD2698), Rose Gerth (size XL quá to — CS đã reply 27/04 09:54 theo template Printify).
- **1 ticket lost package:** Della Rush — đang follow up wave 2.
- **1 ticket "help placing order":** Suzy Jones — chưa ai động.
- **1 yêu cầu unsub:** Salem — phải xử lý trên Klaviyo.

Pattern chính: **size complaints chiếm 50%** (3/6) — vẫn là điểm đau lớn nhất của khách. Lost-package đứng thứ 2.

---

## ⚪ Junk / Promo / Auto (đếm, không liệt kê)

- **24 order-notification từ `cs@faithfuldivine.com` → `marketing@faithfuldivine.com`** (FFD2922 → FFD2945). Pattern flow nội bộ Shopify, không cần xử lý.
- **4 payout email Shopify** ($4307.60 + $888.85 + $104.63 + $67.72 nhỏ lẻ — ngày 27-28/04).
- **4 Slash notification** (3 receipt từ Shopify deposit, 1 charge $900 cho Facebook ads).
- **3 promo Shopify** (webinar Google Ads, Shopify Payments terms update, $1/mo offer).

---

## Đề xuất của thuộc hạ

1. **Lập rule auto-archive cho 24 order-notification mỗi ngày.** Inbox `marketing@faithfuldivine.com` đang bị nhiễu nặng vì mỗi đơn = 1 email. Chuyển bằng Gmail filter sang label `Orders/` + skip inbox sẽ giúp tỷ lệ "tín hiệu/nhiễu" lên >70%. Số đơn quan trọng vẫn xem được trong Shopify admin.

2. **CS đang miss SLA exchange** — Laura đã chờ 6 ngày, oneskinnieminnie chưa được trả lời. Cần dựng tracker exchange/return riêng (Notion hoặc Sheet đơn giản) để CS không quên ticket sau khi yêu cầu khách gửi photo. Đây là rủi ro reputational lớn hơn cả dollar value đơn lẻ.

3. **Size complaints = 50% CSKH 24h** — nên review lại size guide trên product page + add 1 bullet "True to size, ngực rộng hơn 1 inch so với chuẩn US" hoặc chèn ảnh model với chiều cao/cân nặng cụ thể. Nếu pattern này lặp lại trong 7 ngày tới → escalate thành Yellow Zone action item trong PM Pulse.

— Hết bẩm báo. —
